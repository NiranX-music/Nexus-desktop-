import { IpcMain } from 'electron'

const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-pro'
const DEFAULT_NEXUS_API_BASE_URL = 'https://niranx-nexus-agent.vercel.app'

type ChatRole = 'system' | 'user' | 'assistant'

interface NvidiaChatMessage {
  role: ChatRole | 'model' | 'nexus'
  content: string
}

const getNexusApiBaseUrl = () => {
  const configured =
    process.env.NEXUS_AI_API_URL ||
    process.env.NEXUS_NVIDIA_API_URL ||
    process.env.NEXUS_AI_GATEWAY_URLS ||
    DEFAULT_NEXUS_API_BASE_URL
  const firstUrl = configured
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)[0]

  return firstUrl || DEFAULT_NEXUS_API_BASE_URL
}

const endpointFor = (baseUrl: string, endpoint: 'chat' | 'models') => {
  const cleanBase = baseUrl.replace(/\/$/, '')
  if (
    cleanBase.includes('/api/nvidia/') ||
    cleanBase.includes('/api/ai/') ||
    cleanBase.includes('/.netlify/functions/')
  ) {
    return cleanBase
      .replace(/\/chat$/, `/${endpoint}`)
      .replace(/\/models$/, `/${endpoint}`)
      .replace(/nvidia-chat$/, `nvidia-${endpoint}`)
      .replace(/nvidia-models$/, `nvidia-${endpoint}`)
      .replace(/ai-chat$/, `ai-${endpoint}`)
      .replace(/ai-models$/, `ai-${endpoint}`)
  }

  if (cleanBase.includes('netlify.app')) {
    return `${cleanBase}/.netlify/functions/nvidia-${endpoint}`
  }

  return `${cleanBase}/api/nvidia/${endpoint}`
}

const normalizeMessages = (messages: NvidiaChatMessage[] = []) =>
  messages
    .filter((message) => message?.content?.trim())
    .map((message) => ({
      role:
        message.role === 'model' || message.role === 'nexus'
          ? ('assistant' as ChatRole)
          : (message.role as ChatRole),
      content: message.content.trim()
    }))

const readJsonResponse = async (response: Response) => {
  const text = await response.text()
  let data: any = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text }
  }

  return { data, text }
}

const getApiErrorMessage = (data: any, fallback: string) => {
  const error = data?.error?.message || data?.error || data?.detail || data?.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return fallback
}

const callNexusApiChat = async (
  payload: any,
  messages: Array<{ role: ChatRole; content: string }>
) => {
  const baseUrl = getNexusApiBaseUrl()
  const url = endpointFor(baseUrl, 'chat')
  const model = String(payload.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-nexus-client': 'desktop'
    },
    body: JSON.stringify({
      model,
      system: (payload.system || '').trim(),
      messages,
      temperature: payload.temperature ?? 1,
      top_p: payload.top_p ?? 0.95,
      max_tokens: resolveMaxTokens(payload.max_tokens, model)
    })
  })

  const { data } = await readJsonResponse(response)

  if (!response.ok || !data?.success) {
    throw new Error(
      getApiErrorMessage(
        data,
        `${response.status} status from Nexus AI API. Check NEXUS_AI_API_URL and the upstream API key on the API host.`
      )
    )
  }

  return {
    success: true,
    endpoint: baseUrl,
    providerMode: 'nexus-api-only',
    model: data.model || model,
    content: data.content || ''
  }
}

const listNexusApiModels = async () => {
  const baseUrl = getNexusApiBaseUrl()
  const url = endpointFor(baseUrl, 'models')

  const response = await fetch(url, {
    headers: {
      'x-nexus-client': 'desktop'
    }
  })

  const { data } = await readJsonResponse(response)

  if (!response.ok || !data?.success) {
    throw new Error(
      getApiErrorMessage(
        data,
        `${response.status} status from Nexus AI API. Check NEXUS_AI_API_URL and the upstream API key on the API host.`
      )
    )
  }

  return data.models || []
}

const getNexusApiStatus = async () => {
  const baseUrl = getNexusApiBaseUrl()
  const url = endpointFor(baseUrl, 'models')

  try {
    const response = await fetch(url, {
      headers: {
        'x-nexus-client': 'desktop'
      }
    })
    const text = await response.text()
    let data: any = {}

    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { error: text }
    }

    return {
      success: response.ok && data?.success !== false,
      endpoint: baseUrl,
      providerMode: 'nexus-api-only',
      modelCount: Array.isArray(data?.models) ? data.models.length : 0,
      error: response.ok ? '' : data?.error || `${response.status} status from Nexus AI API`
    }
  } catch (error: any) {
    return {
      success: false,
      endpoint: baseUrl,
      providerMode: 'nexus-api-only',
      modelCount: 0,
      error: error?.message || 'Nexus AI API status check failed.'
    }
  }
}

export default function registerNvidiaAI({ ipcMain }: { ipcMain: IpcMain }) {
  ipcMain.removeHandler('nvidia:chat-completion')
  ipcMain.removeHandler('nvidia:list-models')
  ipcMain.removeHandler('nvidia:api-status')

  ipcMain.handle('nvidia:chat-completion', async (_event, payload: any = {}) => {
    try {
      const system = (payload.system || '').trim()
      const messages = normalizeMessages(payload.messages)
      const finalMessages = system
        ? [{ role: 'system' as ChatRole, content: system }, ...messages]
        : messages

      if (finalMessages.length === 0) {
        return { success: false, error: 'No chat message was provided.' }
      }

      return await callNexusApiChat(payload, messages)
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Nexus AI API chat completion failed.'
      }
    }
  })

  ipcMain.handle('nvidia:list-models', async (_event, payload: any = {}) => {
    try {
      const models = await listNexusApiModels()
      return { success: true, providerMode: 'nexus-api-only', models }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unable to fetch Nexus AI models.',
        models: []
      }
    }
  })

  ipcMain.handle('nvidia:api-status', async () => getNexusApiStatus())
}

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(numeric, min), max)
}

const maxTokensLimitForModel = (model: string) => {
  const normalized = model.toLowerCase()
  if (normalized.includes('deepseek-v4')) return 16384
  return 4096
}

const resolveMaxTokens = (value: unknown, model: string) => {
  const limit = maxTokensLimitForModel(model)
  const fallback = Math.min(limit, model.toLowerCase().includes('deepseek-v4') ? 8192 : 4096)
  return clampNumber(value, 1, limit, fallback)
}
