import { IpcMain } from 'electron'

type GatewayMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type GatewayProvider = 'gemini' | 'groq' | 'fireworks'

const cleanKey = (value = '') => String(value).trim().replace(/^Bearer\s+/i, '')

const getEnvKey = (name: string) => cleanKey(process.env[name] || '')

const getGeminiKey = () => getEnvKey('NEXUS_GEMINI_API_KEY') || getEnvKey('GEMINI_API_KEY')
const getGroqKey = () => getEnvKey('NEXUS_GROQ_API_KEY') || getEnvKey('GROQ_API_KEY')
const getFireworksKey = () =>
  getEnvKey('NEXUS_FIREWORKS_API_KEY') || getEnvKey('FIREWORKS_API_KEY')

const normalizeGeminiModel = (model = '') => {
  const clean = model.trim() || 'models/gemini-2.5-flash'
  return clean.replace(/^models\//, '')
}

const callGemini = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getGeminiKey())
  if (!apiKey) throw new Error('Missing Gemini API key.')

  const userText = payload.messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n\n')

  const body = {
    systemInstruction: payload.system ? { parts: [{ text: payload.system }] } : undefined,
    contents: [
      {
        role: 'user',
        parts: [{ text: userText || 'Hello' }]
      }
    ]
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${normalizeGeminiModel(payload.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `Gemini failed with ${response.status}.`)

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || '')
      .join('')
      .trim() || 'Gemini returned no text.'
  )
}

const callGroq = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getGroqKey())
  if (!apiKey) throw new Error('Missing Groq API key.')

  const messages = [
    ...(payload.system ? [{ role: 'system', content: payload.system }] : []),
    ...payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
  ]

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `Groq failed with ${response.status}.`)

  return data?.choices?.[0]?.message?.content?.trim() || 'Groq returned no text.'
}

const callFireworks = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getFireworksKey())
  if (!apiKey) throw new Error('Missing Fireworks API key.')

  const messages = [
    ...(payload.system ? [{ role: 'system', content: payload.system }] : []),
    ...payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
  ]

  const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model || 'accounts/fireworks/models/kimi-k2p6',
      messages,
      temperature: 0.7
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Fireworks failed with ${response.status}.`)
  }

  return data?.choices?.[0]?.message?.content?.trim() || 'Fireworks returned no text.'
}

const callProvider = async (provider: GatewayProvider, payload: any) => {
  if (provider === 'groq') return callGroq(payload)
  if (provider === 'fireworks') return callFireworks(payload)
  return callGemini(payload)
}

const normalizeProvider = (value: unknown): GatewayProvider =>
  value === 'groq' || value === 'fireworks' ? value : 'gemini'

const providerOrder = (preferred: GatewayProvider, fallbackOrder?: GatewayProvider[]) => {
  const order = [preferred, ...(fallbackOrder || ['gemini', 'groq', 'fireworks'])]
  return order.filter((provider, index) => order.indexOf(provider) === index)
}

const fetchOpenAiCompatibleModels = async (provider: 'groq' | 'fireworks', apiKey: string) => {
  const url =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1/models'
      : 'https://api.fireworks.ai/inference/v1/models'
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `${provider} models failed.`)
  return (data?.data || []).map((model: any) => ({
    id: model.id || model.name,
    label: model.id || model.name,
    provider
  })).filter((model: any) => model.id)
}

export default function registerAiGateway(ipcMain: IpcMain) {
  ipcMain.handle('ai-gateway:list-models', async (_event, payload: any = {}) => {
    const provider = normalizeProvider(payload.provider)
    try {
      if (provider === 'groq') {
        const apiKey = cleanKey(payload.apiKey || getGroqKey())
        if (!apiKey) throw new Error('Missing Groq API key.')
        return { success: true, provider, models: await fetchOpenAiCompatibleModels('groq', apiKey) }
      }
      if (provider === 'fireworks') {
        const apiKey = cleanKey(payload.apiKey || getFireworksKey())
        if (!apiKey) throw new Error('Missing Fireworks API key.')
        return {
          success: true,
          provider,
          models: await fetchOpenAiCompatibleModels('fireworks', apiKey)
        }
      }
      return { success: true, provider, models: [] }
    } catch (error: any) {
      return { success: false, provider, error: error?.message || String(error), models: [] }
    }
  })

  ipcMain.handle('ai-gateway:chat', async (_event, payload: any = {}) => {
    const preferredProvider = normalizeProvider(payload.provider)
    const modelsByProvider = payload.modelsByProvider || {}
    const attempts: Array<{ provider: GatewayProvider; model?: string; error?: string }> = []

    for (const provider of providerOrder(preferredProvider, payload.fallbackOrder)) {
      try {
        const content = await callProvider(provider, {
          apiKey: provider === 'gemini' ? payload.geminiApiKey : provider === 'groq' ? payload.groqApiKey : payload.fireworksApiKey,
          model: provider === preferredProvider ? payload.model : modelsByProvider[provider],
          system: payload.system,
          messages: payload.messages || []
        })

        attempts.push({
          provider,
          model: provider === preferredProvider ? payload.model : modelsByProvider[provider]
        })
        return { success: true, provider, content, attempts }
      } catch (error: any) {
        attempts.push({
          provider,
          model: provider === preferredProvider ? payload.model : modelsByProvider[provider],
          error: error?.message || String(error)
        })
      }
    }

    return {
      success: false,
      error: attempts.map((attempt) => `${attempt.provider}: ${attempt.error}`).join(' | '),
      attempts
    }
  })

  ipcMain.handle('ai-gateway:chat-single', async (_event, payload: any = {}) => {
    try {
      const provider = normalizeProvider(payload.provider)
      const content = await callProvider(provider, {
        apiKey: payload.apiKey,
        model: payload.model,
        system: payload.system,
        messages: payload.messages || []
      })

      return { success: true, provider, content }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) }
    }
  })
}
