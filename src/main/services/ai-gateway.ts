import { IpcMain } from 'electron'

type GatewayMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type GatewayProvider = 'gemini' | 'groq' | 'fireworks'

type GeminiAttachment = {
  name?: string
  mimeType?: string
  mime_type?: string
  size?: number
  data?: string
  base64?: string
  fileUri?: string
  file_uri?: string
  uri?: string
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { mime_type: string; file_uri: string } }

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

const GEMINI_INLINE_ATTACHMENT_LIMIT_BYTES = 18 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  js: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  html: 'text/html',
  css: 'text/css',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  zip: 'application/zip'
}

const sanitizeGeminiAttachmentName = (name = 'attachment') => {
  const clean = String(name).replace(/[^\w.\- ()]/g, '_').trim()
  return clean || 'attachment'
}

const normalizeGeminiAttachmentMimeType = (attachment: GeminiAttachment) => {
  const explicit = String(attachment.mimeType || attachment.mime_type || '').trim()
  if (explicit && explicit !== 'application/octet-stream') return explicit

  const extension = sanitizeGeminiAttachmentName(attachment.name || '')
    .split('.')
    .pop()
    ?.toLowerCase()
  return (extension && MIME_BY_EXTENSION[extension]) || explicit || 'application/octet-stream'
}

const normalizeGeminiAttachmentData = (attachment: GeminiAttachment) =>
  String(attachment.data || attachment.base64 || '').replace(/^data:[^;]+;base64,/, '').trim()

const estimateBase64Bytes = (data: string) => {
  if (!data) return 0
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
  return Math.floor((data.length * 3) / 4) - padding
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForGeminiFile = async (apiKey: string, file: any) => {
  let current = file
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (!current?.name || current.state === 'ACTIVE' || !current.state) return current
    if (current.state === 'FAILED') throw new Error(`Gemini file processing failed for ${current.displayName || current.name}.`)

    await sleep(5000)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${current.name}?key=${encodeURIComponent(apiKey)}`
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || `Gemini file status failed with ${response.status}.`)
    current = data
  }

  throw new Error(`Gemini file processing timed out for ${current?.displayName || current?.name || 'attachment'}.`)
}

const uploadGeminiAttachment = async (apiKey: string, attachment: GeminiAttachment): Promise<GeminiPart> => {
  const name = sanitizeGeminiAttachmentName(attachment.name)
  const mimeType = normalizeGeminiAttachmentMimeType(attachment)
  const data = normalizeGeminiAttachmentData(attachment)
  const bytes = Buffer.from(data, 'base64')
  if (!bytes.length) throw new Error(`Attachment ${name} has no file data.`)

  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType
      },
      body: JSON.stringify({ file: { display_name: name } })
    }
  )

  const uploadUrl = startResponse.headers.get('x-goog-upload-url')
  if (!startResponse.ok || !uploadUrl) {
    let message = `Gemini file upload start failed with ${startResponse.status}.`
    try {
      message = (await startResponse.json())?.error?.message || message
    } catch {}
    throw new Error(message)
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: bytes
  })
  const uploaded = await uploadResponse.json()
  if (!uploadResponse.ok) {
    throw new Error(uploaded?.error?.message || `Gemini file upload failed with ${uploadResponse.status}.`)
  }

  const file = await waitForGeminiFile(apiKey, uploaded?.file || uploaded)
  const fileUri = file?.uri || file?.fileUri || file?.file_uri
  if (!fileUri) throw new Error(`Gemini did not return a file URI for ${name}.`)

  return {
    file_data: {
      mime_type: file?.mimeType || file?.mime_type || mimeType,
      file_uri: fileUri
    }
  }
}

const buildGeminiParts = async (apiKey: string, payload: { attachments?: GeminiAttachment[] }, userText: string) => {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : []
  const parts: GeminiPart[] = [
    {
      text: attachments.length
        ? `${userText || 'Hello'}\n\nThe user attached ${attachments.length} file(s). Use the file bytes directly when available; do not ask for OCR or manual text extraction first.`
        : userText || 'Hello'
    }
  ]

  for (const attachment of attachments) {
    const name = sanitizeGeminiAttachmentName(attachment.name)
    const mimeType = normalizeGeminiAttachmentMimeType(attachment)
    const fileUri = attachment.fileUri || attachment.file_uri || attachment.uri
    const data = normalizeGeminiAttachmentData(attachment)

    parts.push({ text: `Attached file: ${name} (${mimeType}, ${attachment.size || estimateBase64Bytes(data)} bytes).` })

    if (fileUri) {
      parts.push({ file_data: { mime_type: mimeType, file_uri: fileUri } })
      continue
    }

    if (!data) continue

    if (estimateBase64Bytes(data) > GEMINI_INLINE_ATTACHMENT_LIMIT_BYTES) {
      parts.push(await uploadGeminiAttachment(apiKey, { ...attachment, data }))
      continue
    }

    parts.push({ inline_data: { mime_type: mimeType, data } })
  }

  return parts
}

const callGemini = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
  attachments?: GeminiAttachment[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getGeminiKey())
  if (!apiKey) throw new Error('Missing Gemini API key.')

  const userText = payload.messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n\n')

  const parts = await buildGeminiParts(apiKey, payload, userText)

  const body = {
    systemInstruction: payload.system ? { parts: [{ text: payload.system }] } : undefined,
    contents: [
      {
        role: 'user',
        parts
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
          messages: payload.messages || [],
          attachments: provider === 'gemini' ? payload.attachments || [] : []
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
        messages: payload.messages || [],
        attachments: provider === 'gemini' ? payload.attachments || [] : []
      })

      return { success: true, provider, content }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) }
    }
  })
}
