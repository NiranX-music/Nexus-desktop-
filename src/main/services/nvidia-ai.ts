import { IpcMain } from 'electron'
import OpenAI from 'openai'

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-pro'
const NEXUS_CLOUD_CHAT_URL =
  process.env.NEXUS_NVIDIA_API_URL || 'https://nexus-desktop-app.vercel.app/api/nvidia/chat'
const NEXUS_CLOUD_MODELS_URL =
  process.env.NEXUS_NVIDIA_MODELS_URL || 'https://nexus-desktop-app.vercel.app/api/nvidia/models'

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

const callNexusCloudChat = async (payload: any, messages: Array<{ role: ChatRole; content: string }>) => {
  const response = await fetch(NEXUS_CLOUD_CHAT_URL, {
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
    throw new Error(data?.error || `Nexus Cloud AI failed with ${response.status} status.`)
  }

  return {
    success: true,
    model: data.model || payload.model || DEFAULT_MODEL,
    content: data.content || ''
  }
}

const listNexusCloudModels = async () => {
  const response = await fetch(NEXUS_CLOUD_MODELS_URL, {
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
    throw new Error(data?.error || `Nexus Cloud model sync failed with ${response.status} status.`)
  }

  return data.models || []
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

      if (!apiKey) {
        return await callNexusCloudChat(payload, messages)
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
      if (!apiKey) {
        const models = await listNexusCloudModels()
        return { success: true, models }
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
