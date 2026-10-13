import fs from 'fs'
import path from 'path'
import { IpcMain, App, shell } from 'electron'

export interface SavedChatMessage {
  role: 'user' | 'assistant' | 'model' | 'system'
  content: string
  timestamp: string
  provider?: string
  model?: string
}

export interface ChatSessionRecord {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  provider: string
  model: string
  messages: SavedChatMessage[]
  filePath?: string
}

const sanitizeFilename = (title: string): string => {
  return (
    title
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'chat_session'
  )
}

export default function registerChatHistoryManager({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const getDocumentsChatDir = () => {
    try {
      const docsBase = app.getPath('documents')
      return path.join(docsBase, 'Nexus_Docs', 'Chat_History')
    } catch {
      return path.join(app.getPath('userData'), 'Nexus_Docs', 'Chat_History')
    }
  }

  const getMasterIndexPath = () => path.join(getDocumentsChatDir(), 'nexus_chat_history.json')

  const ensureDir = () => {
    const dir = getDocumentsChatDir()
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  const loadSessionsFromDisk = (): ChatSessionRecord[] => {
    try {
      ensureDir()
      const indexPath = getMasterIndexPath()
      if (fs.existsSync(indexPath)) {
        const raw = fs.readFileSync(indexPath, 'utf-8')
        return JSON.parse(raw) || []
      }
    } catch (err) {
      console.error('[ChatHistory] Failed to read master index:', err)
    }
    return []
  }

  const saveSessionsToDisk = (sessions: ChatSessionRecord[]) => {
    try {
      ensureDir()
      fs.writeFileSync(getMasterIndexPath(), JSON.stringify(sessions, null, 2), 'utf-8')
    } catch (err) {
      console.error('[ChatHistory] Failed to write master index:', err)
    }
  }

  const generateSessionMarkdown = (session: ChatSessionRecord): string => {
    const lines: string[] = [
      `# 🧠 Nexus AI Chat Session: ${session.title}`,
      `**Session ID:** \`${session.id}\``,
      `**Created:** ${new Date(session.createdAt).toLocaleString()}`,
      `**Last Updated:** ${new Date(session.updatedAt).toLocaleString()}`,
      `**Primary Provider:** ${session.provider || 'Nexus AI Gateway'} | **Model:** \`${session.model || 'default'}\``,
      `\n---\n`
    ]

    for (const msg of session.messages) {
      const isUser = msg.role === 'user'
      const icon = isUser ? '👤' : '🤖'
      const roleLabel = isUser ? 'User' : 'Nexus AI'
      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''
      lines.push(`### ${icon} ${roleLabel}${timeStr ? ` (${timeStr})` : ''}`)
      lines.push(msg.content || '')
      lines.push('\n---\n')
    }

    return lines.join('\n')
  }

  // --- IPC Handlers ---

  ipcMain.removeHandler('chat-history:get-folder-path')
  ipcMain.handle('chat-history:get-folder-path', async () => {
    const dir = ensureDir()
    return { success: true, folderPath: dir }
  })

  ipcMain.removeHandler('chat-history:open-folder')
  ipcMain.handle('chat-history:open-folder', async () => {
    try {
      const dir = ensureDir()
      await shell.openPath(dir)
      return { success: true, folderPath: dir }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to open directory' }
    }
  })

  ipcMain.removeHandler('chat-history:get-sessions')
  ipcMain.handle('chat-history:get-sessions', async () => {
    try {
      const sessions = loadSessionsFromDisk()
      return { success: true, sessions }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to load sessions', sessions: [] }
    }
  })

  ipcMain.removeHandler('chat-history:save-session')
  ipcMain.handle('chat-history:save-session', async (_event, sessionData: Partial<ChatSessionRecord>) => {
    try {
      const dir = ensureDir()
      if (!sessionData.id) {
        throw new Error('Session ID is required.')
      }

      const sessions = loadSessionsFromDisk()
      const now = new Date().toISOString()
      const title = sessionData.title?.trim() || 'Nexus Conversation'
      const safeTitle = sanitizeFilename(title)
      const datePrefix = new Date().toISOString().slice(0, 10)
      const mdFilename = `${datePrefix}_${safeTitle}_${sessionData.id.slice(-6)}.md`
      const mdFilePath = path.join(dir, mdFilename)

      const existingIndex = sessions.findIndex((s) => s.id === sessionData.id)
      const fullRecord: ChatSessionRecord = {
        id: sessionData.id,
        title,
        createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : now,
        updatedAt: now,
        provider: sessionData.provider || 'gemini',
        model: sessionData.model || 'default',
        messages: (sessionData.messages || []) as SavedChatMessage[],
        filePath: mdFilePath
      }

      if (existingIndex >= 0) {
        sessions[existingIndex] = fullRecord
      } else {
        sessions.unshift(fullRecord)
      }

      // Save master JSON index
      saveSessionsToDisk(sessions)

      // Save user-readable Markdown document in Documents/Nexus_Docs/Chat_History/
      const mdContent = generateSessionMarkdown(fullRecord)
      fs.writeFileSync(mdFilePath, mdContent, 'utf-8')

      return { success: true, session: fullRecord, filePath: mdFilePath }
    } catch (err: any) {
      console.error('[ChatHistory] Failed to save session:', err)
      return { success: false, error: err?.message || 'Failed to save session' }
    }
  })

  ipcMain.removeHandler('chat-history:delete-session')
  ipcMain.handle('chat-history:delete-session', async (_event, sessionId: string) => {
    try {
      let sessions = loadSessionsFromDisk()
      const target = sessions.find((s) => s.id === sessionId)
      if (target?.filePath && fs.existsSync(target.filePath)) {
        try {
          fs.unlinkSync(target.filePath)
        } catch {}
      }

      sessions = sessions.filter((s) => s.id !== sessionId)
      saveSessionsToDisk(sessions)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete session' }
    }
  })

  // Hook legacy add-message & get-history for backward compatibility
  ipcMain.removeHandler('add-message')
  ipcMain.handle('add-message', async (_event, msg: any) => {
    try {
      ensureDir()
      const text = msg.parts?.[0]?.text || msg.content || ''
      if (!text.trim()) return false

      const sessions = loadSessionsFromDisk()
      let activeSession = sessions[0]
      const now = new Date().toISOString()

      if (!activeSession) {
        activeSession = {
          id: `session_${Date.now()}`,
          title: 'Recent Conversation',
          createdAt: now,
          updatedAt: now,
          provider: 'nexus',
          model: 'gateway',
          messages: []
        }
        sessions.unshift(activeSession)
      }

      activeSession.messages.push({
        role: msg.role === 'model' || msg.role === 'nexus' ? 'assistant' : 'user',
        content: text,
        timestamp: now
      })
      activeSession.updatedAt = now

      saveSessionsToDisk(sessions)
      return true
    } catch {
      return false
    }
  })

  ipcMain.removeHandler('get-history')
  ipcMain.handle('get-history', async () => {
    try {
      const sessions = loadSessionsFromDisk()
      const latest = sessions[0]
      if (!latest?.messages) return []
      return latest.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content }]
      }))
    } catch {
      return []
    }
  })
}
