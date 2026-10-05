const DEFAULT_NEXUS_WEB_APP_URL = 'https://nexusaix.vercel.app'

interface GeminiClientGeneratePayload {
  prompt: string
  system?: string
  model?: string
  temperature?: number
  topP?: number
  maxOutputTokens?: number
}

const getNexusWebAppUrl = () =>
  (import.meta.env.VITE_NEXUS_WEB_APP_URL || DEFAULT_NEXUS_WEB_APP_URL).replace(/\/$/, '')

const readJsonResponse = async (response: Response) => {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: text }
  }
}

export const generateWithNexusGeminiClient = async ({
  prompt,
  system = '',
  model = 'gemini-3.8-flash',
  temperature = 0.7,
  topP = 0.95,
  maxOutputTokens = 4096
}: GeminiClientGeneratePayload) => {
  let targetModel = String(model || 'gemini-3.8-flash').trim().replace(/^models\//, '')
  if (targetModel === 'gemini-2.5-flash' || targetModel === 'gemini-2.0-flash' || targetModel === 'gemini-1.5-flash') {
    targetModel = 'gemini-3.8-flash'
  }
  if (targetModel === 'gemini-2.5-flash-lite' || targetModel === 'gemini-2.0-flash-lite') {
    targetModel = 'gemini-3.5-flash-lite'
  }

  const response = await fetch(`${getNexusWebAppUrl()}/api/gemini/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-nexus-client': 'desktop'
    },
    body: JSON.stringify({
      model: targetModel,
      prompt,
      system,
      temperature,
      topP,
      maxOutputTokens
    })
  })

  const data = await readJsonResponse(response)
  if (!response.ok || !data?.success) {
    const message = data?.error?.message || data?.error || data?.message
    throw new Error(message || `Nexus Gemini API returned ${response.status}.`)
  }

  return String(data.content || '').trim()
}
