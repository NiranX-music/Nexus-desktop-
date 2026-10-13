/**
 * Nexus Puter API Service
 * Handles Puter.js integration, live model queries, and fallback chat execution.
 */

declare global {
  interface Window {
    puter?: any
  }
}

export interface PuterChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface PuterChatOptions {
  model?: string
  system?: string
  messages: PuterChatMessage[]
  temperature?: number
  maxTokens?: number
  testMode?: boolean
}

export const isPuterReady = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.puter?.ai?.chat)
}

export const waitForPuter = async (timeoutMs = 5000): Promise<boolean> => {
  if (isPuterReady()) return true
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (isPuterReady()) return true
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return isPuterReady()
}

export const listPuterModels = async (): Promise<Array<{ id: string; label: string; provider: 'puter' }>> => {
  try {
    const ready = await waitForPuter(4000)
    if (!ready || typeof window.puter.ai.listModels !== 'function') {
      return []
    }
    const models = await window.puter.ai.listModels()
    if (Array.isArray(models)) {
      return models.map((m: any) => ({
        id: m.id || m.puterId,
        label: `${m.name || m.id} (${m.provider || 'AI'})`,
        provider: 'puter' as const
      }))
    }
    return []
  } catch (err) {
    console.warn('[Puter API] Error listing models:', err)
    return []
  }
}

export const executePuterChat = async ({
  model = 'gpt-4o',
  system = '',
  messages,
  temperature = 0.7,
  maxTokens = 4096,
  testMode = false
}: PuterChatOptions): Promise<string> => {
  const ready = await waitForPuter(6000)
  if (!ready) {
    throw new Error('Puter.js SDK is not available in the desktop environment.')
  }

  const cleanModel = String(model || 'gpt-4o').trim()
  const formattedMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  ]

  const options: Record<string, any> = {
    model: cleanModel,
    temperature,
    max_tokens: maxTokens,
    normalize: true
  }
  if (testMode) options.testMode = true

  const response = await window.puter.ai.chat(formattedMessages, options)

  // Handle both normalized and raw responses
  if (typeof response === 'string') return response.trim()
  if (response?.message?.content) {
    if (typeof response.message.content === 'string') return response.message.content.trim()
    if (Array.isArray(response.message.content)) {
      return response.message.content
        .map((c: any) => c.text || '')
        .join('')
        .trim()
    }
  }
  if (response?.text) return String(response.text).trim()

  return String(response || 'Puter AI returned an empty response.').trim()
}

export const generatePuterImage = async (prompt: string): Promise<{ objectUrl: string; modelUsed: string }> => {
  const ready = await waitForPuter(6000)
  if (!ready) {
    throw new Error('Puter.js SDK is not ready.')
  }
  if (typeof window.puter?.ai?.txt2img === 'function') {
    const res = await window.puter.ai.txt2img(prompt)
    if (res && typeof res === 'object' && res.src) {
      return { objectUrl: res.src, modelUsed: 'puter-txt2img' }
    }
    if (typeof res === 'string') {
      return { objectUrl: res, modelUsed: 'puter-txt2img' }
    }
    if (res instanceof Blob) {
      return { objectUrl: URL.createObjectURL(res), modelUsed: 'puter-txt2img' }
    }
  }
  throw new Error('Puter.js txt2img is not available in current session.')
}

