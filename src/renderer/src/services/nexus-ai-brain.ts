import { listCloudData, saveCloudData } from './cloud-data'

export interface ChatMessage {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

const HISTORY_CACHE_MS = 4_000
let historyCache: ChatMessage[] = []
let historyCacheUpdatedAt = 0

const primeHistoryCache = (history: ChatMessage[]) => {
  historyCache = Array.isArray(history) ? history.slice(-20) : []
  historyCacheUpdatedAt = Date.now()
}

export const saveMessage = async (role: 'user' | 'model' | 'nexus', text: string) => {
  try {
    if (!text) return

    const safeRole = role === 'nexus' ? 'model' : role
    const nextMessage: ChatMessage = {
      role: safeRole,
      parts: [{ text }]
    }

    primeHistoryCache([...historyCache, nextMessage])

    await window.electron.ipcRenderer.invoke('add-message', {
      role: safeRole,
      parts: [{ text: text }]
    })
    await saveCloudData('chat_history', `${Date.now()}-${safeRole}`, {
      role: safeRole,
      text,
      timestamp: new Date().toISOString()
    })
  } catch (err) {}
}

export const getHistory = async (): Promise<ChatMessage[]> => {
  try {
    if (Date.now() - historyCacheUpdatedAt < HISTORY_CACHE_MS && historyCache.length > 0) {
      return historyCache
    }

    const history = await window.electron.ipcRenderer.invoke('get-history')
    if (history?.length) {
      primeHistoryCache(history)
      return historyCache
    }

    if (Date.now() - historyCacheUpdatedAt < HISTORY_CACHE_MS) {
      return historyCache
    }

    const cloudRows = await listCloudData<{ role?: string; text?: string }>('chat_history')
    const nextHistory: ChatMessage[] = cloudRows
      .slice(0, 20)
      .reverse()
      .map((row) => ({
        role: row.value?.role === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: row.value?.text || '' }]
      }))
    primeHistoryCache(nextHistory)
    return historyCache
  } catch (e) {
    return []
  }
}

export const saveCoreMemory = async (fact: string): Promise<string> => {
  try {
    const success = await window.electron.ipcRenderer.invoke('save-core-memory', fact)

    if (success) {
      await saveCloudData('core_memory', `${Date.now()}`, {
        fact,
        timestamp: new Date().toISOString()
      })
      return `✅ Successfully committed to permanent memory: "${fact}"`
    }
    return '❌ System failure: Could not save to permanent memory.'
  } catch (error) {
    return `❌ System failure: ${String(error)}`
  }
}

export const retrieveCoreMemory = async (): Promise<string> => {
  try {
    const memories = await window.electron.ipcRenderer.invoke('search-core-memory')

    if (memories && memories.length > 0) {
      return `Here is the permanent memory bank data:\n${JSON.stringify(memories)}`
    }
    return 'The permanent memory bank is currently empty.'
  } catch (error) {
    return `❌ System failure: ${String(error)}`
  }
}
