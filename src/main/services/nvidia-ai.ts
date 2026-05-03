import { IpcMain } from 'electron'

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-pro'
const DEFAULT_NEXUS_API_BASE_URL = 'https://nexus-desktop-app.vercel.app'
const NVIDIA_API_KEY_ENV_NAMES = ['NVIDIA_API_KEY', 'NVIDIA_BUILD_API_KEY', 'NVIDIA_NIM_API_KEY']
const PLACEHOLDER_NVIDIA_KEY_RE =
  /^(your-|paste-|replace-|example|placeholder|nvapi[_-]?your|\$NVIDIA_API_KEY|\$\{NVIDIA_API_KEY\})/i

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
  if (cleanBase.includes('/api/nvidia/') || cleanBase.includes('/.netlify/functions/')) {
    return cleanBase
      .replace(/\/chat$/, `/${endpoint}`)
      .replace(/\/models$/, `/${endpoint}`)
      .replace(/nvidia-chat$/, `nvidia-${endpoint}`)
      .replace(/nvidia-models$/, `nvidia-${endpoint}`)
  }

  if (cleanBase.includes('netlify.app')) {
    return `${cleanBase}/.netlify/functions/nvidia-${endpoint}`
  }

  return `${cleanBase}/api/nvidia/${endpoint}`
}

const normalizeNvidiaApiKey = (value = '') => {
  const candidate = String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()

  if (!candidate || PLACEHOLDER_NVIDIA_KEY_RE.test(candidate)) return ''
  return candidate
}

const getDirectNvidiaApiKey = (payload: any = {}) => {
  const payloadKey = normalizeNvidiaApiKey(payload.apiKey)
  if (payloadKey) return payloadKey

  for (const name of NVIDIA_API_KEY_ENV_NAMES) {
    const apiKey = normalizeNvidiaApiKey(process.env[name])
    if (apiKey) return apiKey
  }

  return ''
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

const buildNvidiaMessages = (payload: any, messages: Array<{ role: ChatRole; content: string }>) => {
  const system = String(payload.system || '').trim()
  return system ? [{ role: 'system' as ChatRole, content: system }, ...messages] : messages
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
        `${response.status} status from Nexus AI API. Check that NVIDIA_API_KEY is set on Vercel.`
      )
    )
  }

  return {
    success: true,
    endpoint: baseUrl,
    model: data.model || model,
    content: data.content || ''
  }
}

const callDirectNvidiaChat = async (
  payload: any,
  messages: Array<{ role: ChatRole; content: string }>
) => {
  const apiKey = getDirectNvidiaApiKey(payload)
  if (!apiKey) {
    throw new Error('No NVIDIA API key is saved. Add one in Settings or use the hosted Nexus API.')
  }

  const model = String(payload.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const upstreamPayload: any = {
    model,
    messages: buildNvidiaMessages(payload, messages),
    temperature: payload.temperature ?? 1,
    top_p: payload.top_p ?? 0.95,
    max_tokens: resolveMaxTokens(payload.max_tokens, model),
    stream: false
  }

  if (model.includes('deepseek-v4')) {
    upstreamPayload.chat_template_kwargs = { thinking: false }
  }

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(upstreamPayload)
  })

  const { data } = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, `NVIDIA returned ${response.status} for ${model}.`))
  }

  return {
    success: true,
    endpoint: NVIDIA_BASE_URL,
    model: data.model || model,
    content: data.choices?.[0]?.message?.content || ''
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
        `${response.status} status from Nexus AI API. Check that NVIDIA_API_KEY is set on Vercel.`
      )
    )
  }

  return data.models || []
}

const listDirectNvidiaModels = async (payload: any = {}) => {
  const apiKey = getDirectNvidiaApiKey(payload)
  if (!apiKey) {
    throw new Error('No NVIDIA API key is saved. Add one in Settings or use the hosted Nexus API.')
  }

  const response = await fetch(`${NVIDIA_BASE_URL}/models`, {
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  })

  const { data } = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, `NVIDIA returned ${response.status}.`))
  }

  return (data.data || [])
    .map((model: any) => model.id)
    .filter(Boolean)
    .sort((a: string, b: string) => a.localeCompare(b))
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
      modelCount: Array.isArray(data?.models) ? data.models.length : 0,
      error: response.ok ? '' : data?.error || `${response.status} status from Nexus AI API`
    }
  } catch (error: any) {
    return {
      success: false,
      endpoint: baseUrl,
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

      if (payload.useNexusServers === false) {
        return await callDirectNvidiaChat(payload, messages)
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
      const models =
        payload.useNexusServers === false
          ? await listDirectNvidiaModels(payload)
          : await listNexusApiModels()
      return { success: true, models }
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
