import { IpcMain } from 'electron'
import OpenAI from 'openai'

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-pro'
const DEFAULT_NEXUS_GATEWAYS = [
  'https://nexus-ai-gateway.vercel.app',
  'https://nexus-ai-gateway-2.vercel.app',
  'https://nexus-ai-gateway-3.vercel.app',
  'https://nexus-ai-gateway.netlify.app',
  'https://nexus-ai-gateway-2.netlify.app',
  'https://nexus-ai-gateway-3.netlify.app',
  'https://nexus-desktop-app.vercel.app'
]

type ChatRole = 'system' | 'user' | 'assistant'

interface NvidiaChatMessage {
  role: ChatRole | 'model' | 'nexus'
  content: string
}

const normalizeApiKey = (key?: string) => {
  const candidate = (key || process.env.NVIDIA_API_KEY || '').trim()
  if (!candidate || candidate === '$NVIDIA_API_KEY') return ''
  return candidate
}

const parseGatewayList = () => {
  const configured = process.env.NEXUS_AI_GATEWAY_URLS || process.env.NEXUS_NVIDIA_API_URL || ''
  const urls = configured
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

  return Array.from(new Set([...urls, ...DEFAULT_NEXUS_GATEWAYS]))
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

const callNexusCloudChat = async (
  payload: any,
  messages: Array<{ role: ChatRole; content: string }>
) => {
  const failures: string[] = []

  for (const gateway of parseGatewayList()) {
    const url = endpointFor(gateway, 'chat')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-nexus-client': 'desktop'
        },
        body: JSON.stringify({
          model: payload.model || DEFAULT_MODEL,
          system: (payload.system || '').trim(),
          messages,
          temperature: payload.temperature ?? 1,
          top_p: payload.top_p ?? 0.95,
          max_tokens: payload.max_tokens ?? 16384
        })
      })

      const text = await response.text()
      let data: any = {}

      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { error: text }
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `${response.status} status`)
      }

      return {
        success: true,
        gateway,
        model: data.model || payload.model || DEFAULT_MODEL,
        content: data.content || ''
      }
    } catch (error: any) {
      failures.push(`${gateway}: ${error?.message || 'failed'}`)
    }
  }

  if (failures.some((failure) => failure.includes('NVIDIA_API_KEY is not configured'))) {
    throw new Error(
      'Nexus Server AI is online, but NVIDIA_API_KEY is not configured on the gateway mirrors. Open /api-edit.html on a gateway mirror and add the key in Vercel/Netlify environment variables.'
    )
  }

  throw new Error(`All Nexus Cloud AI gateways failed. ${failures.slice(0, 3).join(' | ')}`)
}

const listNexusCloudModels = async () => {
  const failures: string[] = []

  for (const gateway of parseGatewayList()) {
    const url = endpointFor(gateway, 'models')

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

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `${response.status} status`)
      }

      return data.models || []
    } catch (error: any) {
      failures.push(`${gateway}: ${error?.message || 'failed'}`)
    }
  }

  throw new Error(`All Nexus Cloud model gateways failed. ${failures.slice(0, 3).join(' | ')}`)
}

export default function registerNvidiaAI({ ipcMain }: { ipcMain: IpcMain }) {
  ipcMain.removeHandler('nvidia:chat-completion')
  ipcMain.removeHandler('nvidia:list-models')

  ipcMain.handle('nvidia:chat-completion', async (_event, payload: any = {}) => {
    try {
      const apiKey = normalizeApiKey(payload.apiKey)
      const system = (payload.system || '').trim()
      const messages = normalizeMessages(payload.messages)
      const finalMessages = system
        ? [{ role: 'system' as ChatRole, content: system }, ...messages]
        : messages

      if (finalMessages.length === 0) {
        return { success: false, error: 'No chat message was provided.' }
      }

      if (payload.useNexusServers !== false) {
        return await callNexusCloudChat(payload, messages)
      }

      if (!apiKey) {
        return {
          success: false,
          error: 'Local NVIDIA API key mode is selected, but no key is saved.'
        }
      }

      const client = new OpenAI({
        apiKey,
        baseURL: NVIDIA_BASE_URL
      })

      const completion = await client.chat.completions.create({
        model: payload.model || DEFAULT_MODEL,
        messages: finalMessages,
        temperature: payload.temperature ?? 1,
        top_p: payload.top_p ?? 0.95,
        max_tokens: payload.max_tokens ?? 16384,
        chat_template_kwargs: { thinking: false },
        stream: false
      } as any)

      return {
        success: true,
        model: completion.model || payload.model || DEFAULT_MODEL,
        content: completion.choices[0]?.message?.content || ''
      }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'NVIDIA chat completion failed.'
      }
    }
  })

  ipcMain.handle('nvidia:list-models', async (_event, payload: any = {}) => {
    try {
      const apiKey = normalizeApiKey(payload.apiKey)
      if (payload.useNexusServers !== false) {
        const models = await listNexusCloudModels()
        return { success: true, models }
      }

      if (!apiKey) {
        return {
          success: false,
          error: 'Local NVIDIA API key mode is selected, but no key is saved.',
          models: []
        }
      }

      const client = new OpenAI({
        apiKey,
        baseURL: NVIDIA_BASE_URL
      })

      const response = await client.models.list()
      const models = response.data
        .map((model) => model.id)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))

      return { success: true, models }
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unable to fetch NVIDIA models.',
        models: []
      }
    }
  })
}
