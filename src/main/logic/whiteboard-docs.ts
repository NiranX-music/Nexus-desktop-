import { App, IpcMain, shell } from 'electron'
import fs from 'fs/promises'
import path from 'path'

interface WhiteboardDocPayload {
  id?: string
  title?: string
  prompt?: string
  content?: string
  source?: string
  createdAt?: string
}

const sanitizeFileSegment = (value = 'Whiteboard') => {
  const cleaned = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (cleaned || 'Whiteboard').slice(0, 72).trim()
}

const formatTimestampForFile = (value = new Date().toISOString()) => {
  const date = Number.isNaN(new Date(value).getTime()) ? new Date() : new Date(value)
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

const buildWhiteboardMarkdown = (payload: WhiteboardDocPayload) => {
  const title = String(payload.title || 'Whiteboard Solution').trim()
  const prompt = String(payload.prompt || '').trim()
  const content = String(payload.content || '').trim()
  const createdAt = payload.createdAt || new Date().toISOString()

  return [
    `# ${title}`,
    '',
    `Saved: ${new Date(createdAt).toLocaleString()}`,
    `Source: ${payload.source || 'whiteboard'}`,
    '',
    prompt ? `## Question\n\n${prompt}` : '',
    '## Whiteboard Solution',
    '',
    content || '_Blank whiteboard_',
    ''
  ]
    .filter((section) => section !== '')
    .join('\n')
}

export default function registerWhiteboardDocs({
  ipcMain,
  app
}: {
  ipcMain: IpcMain
  app: App
}) {
  ipcMain.removeHandler('whiteboard:save-doc')
  ipcMain.handle('whiteboard:save-doc', async (_event, payload: WhiteboardDocPayload = {}) => {
    try {
      const content = String(payload.content || '').trim()
      if (!content) {
        return { success: false, skipped: true, error: 'Blank whiteboard was not saved.' }
      }

      const docsDir = path.join(app.getPath('documents'), 'Nexus AI Whiteboards')
      await fs.mkdir(docsDir, { recursive: true })

      const title = sanitizeFileSegment(payload.title || payload.prompt || 'Whiteboard Solution')
      const timestamp = formatTimestampForFile(payload.createdAt)
      const filePath = path.join(docsDir, `${timestamp}_${title}.md`)
      const markdown = buildWhiteboardMarkdown(payload)

      await fs.writeFile(filePath, markdown, 'utf-8')

      const latestPath = path.join(docsDir, 'Latest Nexus Whiteboard.md')
      await fs.writeFile(latestPath, markdown, 'utf-8')

      return {
        success: true,
        path: filePath,
        latestPath,
        folder: docsDir,
        savedAt: new Date().toISOString()
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unable to save the whiteboard document.'
      }
    }
  })

  ipcMain.removeHandler('whiteboard:open-docs')
  ipcMain.handle('whiteboard:open-docs', async () => {
    const docsDir = path.join(app.getPath('documents'), 'Nexus AI Whiteboards')
    await fs.mkdir(docsDir, { recursive: true })
    const error = await shell.openPath(docsDir)
    return { success: !error, folder: docsDir, error }
  })
}
