const DEFAULT_NEXUS_API_BASE_URL = 'https://nexusaix.vercel.app'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

interface GeminiGeneratePayload {
  model?: string
  prompt?: string
  contents?: any[]
  system?: string
  temperature?: number
  topP?: number
  maxOutputTokens?: number
}

export type GeminiEmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

interface GeminiEmbeddingPayload {
  model?: string
  texts: string[]
  taskType?: GeminiEmbeddingTaskType
}

const getNexusApiBaseUrl = () => {
  const configured =
    process.env.NEXUS_AI_API_URL ||
    process.env.NEXUS_GEMINI_API_URL ||
    process.env.NEXUS_AI_GATEWAY_URLS ||
    DEFAULT_NEXUS_API_BASE_URL
  const firstUrl = configured
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)[0]

  return firstUrl || DEFAULT_NEXUS_API_BASE_URL
}

const endpointFor = (baseUrl: string, action: 'generate' | 'status' | 'embed') => {
  const cleanBase = baseUrl.replace(/\/$/, '')
  if (cleanBase.includes('/api/gemini/')) {
    return cleanBase.replace(/\/(?:generate|status|embed)$/, `/${action}`)
  }

  if (cleanBase.includes('/.netlify/functions/')) {
    return cleanBase.replace(/\/gemini-(?:generate|status|embed)$/, `/gemini-${action}`)
  }

  if (cleanBase.includes('netlify.app')) {
    return `${cleanBase}/.netlify/functions/gemini-${action}`
  }

  return `${cleanBase}/api/gemini/${action}`
}

const readJsonResponse = async (response: Response) => {
  const text = await response.text()
  let data: any = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { error: text }
  }

  return data
}

const getApiErrorMessage = (data: any, fallback: string) => {
  const error = data?.error?.message || data?.error || data?.detail || data?.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return fallback
}

export const generateWithNexusGemini = async ({
  model = DEFAULT_GEMINI_MODEL,
  prompt,
  contents,
  system = '',
  temperature = 0.7,
  topP = 0.95,
  maxOutputTokens = 8192
}: GeminiGeneratePayload) => {
  const baseUrl = getNexusApiBaseUrl()
  const url = endpointFor(baseUrl, 'generate')
  const cleanPrompt = String(prompt || '').trim()

  if (!cleanPrompt && (!Array.isArray(contents) || contents.length === 0)) {
    throw new Error('No Gemini prompt or contents were provided.')
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-nexus-client': 'desktop'
    },
    body: JSON.stringify({
      model,
      prompt: cleanPrompt,
      contents,
      system,
      temperature,
      topP,
      maxOutputTokens
    })
  })

  const data = await readJsonResponse(response)
  if (!response.ok || !data?.success) {
    throw new Error(
      getApiErrorMessage(
        data,
        `${response.status} status from Nexus Gemini API. Check NEXUS_GEMINI_API_KEY on the API host.`
      )
    )
  }

  return String(data.content || '')
}

export const embedWithNexusGemini = async ({
  model = 'gemini-embedding-001',
  texts,
  taskType
}: GeminiEmbeddingPayload) => {
  const cleanTexts = texts.map((text) => String(text || '').trim()).filter(Boolean)
  if (cleanTexts.length === 0) return []

  const baseUrl = getNexusApiBaseUrl()
  const url = endpointFor(baseUrl, 'embed')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-nexus-client': 'desktop'
    },
    body: JSON.stringify({
      model,
      texts: cleanTexts,
      taskType
    })
  })

  const data = await readJsonResponse(response)
  if (!response.ok || !data?.success) {
    throw new Error(
      getApiErrorMessage(
        data,
        `${response.status} status from Nexus Gemini embeddings API. Check NEXUS_GEMINI_API_KEY on the API host.`
      )
    )
  }

  return Array.isArray(data.embeddings) ? data.embeddings : []
}
