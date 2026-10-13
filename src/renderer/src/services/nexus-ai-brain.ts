import {
  listCloudChatHistory,
  listCloudMemories,
  saveCloudChatMessage,
  saveCloudMemory
} from './cloud-data'

export interface ChatMessage {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

const isMeaningfulText = (text: string): boolean => {
  if (!text) return false
  const cleaned = text
    .replace(/<\|nospeech\|>/gi, '')
    .replace(/<(?:no[- ]speech|silence|applause|music|laughter)>/gi, '')
    .replace(/\[(?:no[- ]speech|silence|applause|music|laughter)\]/gi, '')
    .trim()
  return cleaned.length > 0
}

export const saveMessage = async (role: 'user' | 'model' | 'nexus', text: string) => {
  try {
    if (!text || !isMeaningfulText(text)) return

    const safeRole = role === 'nexus' ? 'model' : role
    const cleanedText = text
      .replace(/<\|nospeech\|>/gi, '')
      .replace(/<(?:no[- ]speech|silence|applause|music|laughter)>/gi, '')
      .replace(/\[(?:no[- ]speech|silence|applause|music|laughter)\]/gi, '')
      .trim()

    await window.electron.ipcRenderer.invoke('add-message', {
      role: safeRole,
      parts: [{ text: cleanedText }]
    })
    void saveCloudChatMessage(safeRole, cleanedText).catch(() => {})
  } catch (err) {}
}

export const getHistory = async (): Promise<ChatMessage[]> => {
  try {
    let history = await window.electron.ipcRenderer.invoke('get-history')
    if (!history?.length) {
      history = await listCloudChatHistory(20)
    }
    if (Array.isArray(history)) {
      return history.filter((msg: any) => {
        const text = msg.parts && msg.parts[0] ? msg.parts[0].text : msg.content || ''
        return isMeaningfulText(text)
      })
    }
    return []
  } catch (e) {
    try {
      const cloud = await listCloudChatHistory(20)
      return Array.isArray(cloud)
        ? cloud.filter((msg: any) => {
            const text = msg.parts && msg.parts[0] ? msg.parts[0].text : msg.content || ''
            return isMeaningfulText(text)
          })
        : []
    } catch {
      return []
    }
  }
}

export const saveCoreMemory = async (fact: string): Promise<string> => {
  try {
    const [localResult, cloudResult] = await Promise.allSettled([
      window.electron.ipcRenderer.invoke('save-core-memory', fact),
      saveCloudMemory(fact)
    ])
    const localSuccess = localResult.status === 'fulfilled' && Boolean(localResult.value)
    const cloudSuccess =
      cloudResult.status === 'fulfilled' && Boolean((cloudResult.value as any)?.ok)

    if (localSuccess || cloudSuccess) {
      return `✅ Successfully committed to permanent memory: "${fact}"`
    }
    return '❌ System failure: Could not save to permanent memory.'
  } catch (error) {
    return `❌ System failure: ${String(error)}`
  }
}

export const retrieveCoreMemory = async (): Promise<string> => {
  try {
    const [memories, notes, cloudMemories] = await Promise.all([
      window.electron.ipcRenderer.invoke('search-core-memory'),
      window.electron.ipcRenderer.invoke('get-notes'),
      listCloudMemories()
    ])
    const editableMemoryNotes = Array.isArray(notes)
      ? notes
          .filter((note: any) => String(note.filename || '').startsWith('user_memory_'))
          .map((note: any) => ({ title: note.title, content: note.content }))
      : []

    if (
      (memories && memories.length > 0) ||
      editableMemoryNotes.length > 0 ||
      cloudMemories.length > 0
    ) {
      return `Here is the permanent memory bank data. Editable Notes are authoritative if the user changed them:\n${JSON.stringify({ savedMemory: memories || [], cloudMemory: cloudMemories, editableNotes: editableMemoryNotes })}`
    }
    return 'The permanent memory bank is currently empty.'
  } catch (error) {
    return `❌ System failure: ${String(error)}`
  }
}
