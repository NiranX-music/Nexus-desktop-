import fs from 'fs'
import path from 'path'
import { app, safeStorage, IpcMain } from 'electron'

type GatewayMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type GatewayProvider =
  | 'puter'
  | 'gemini'
  | 'groq'
  | 'fireworks'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'ollama'

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

const getVaultKey = (service: string): string => {
  try {
    const secureConfigPath = path.join(app.getPath('userData'), 'nexus_secure_vault.json')
    if (fs.existsSync(secureConfigPath)) {
      const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
      const enc = data[service] || data[`${service}Key`]
      if (!enc) return ''
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(enc, 'base64'))
      } else {
        return Buffer.from(enc, 'base64').toString('utf8')
      }
    }
  } catch {}
  return ''
}

const getGeminiKey = () =>
  cleanKey(getEnvKey('NEXUS_GEMINI_API_KEY') || getEnvKey('GEMINI_API_KEY') || getVaultKey('gemini'))
const getGroqKey = () =>
  cleanKey(getEnvKey('NEXUS_GROQ_API_KEY') || getEnvKey('GROQ_API_KEY') || getVaultKey('groq'))
const getFireworksKey = () =>
  cleanKey(getEnvKey('NEXUS_FIREWORKS_API_KEY') || getEnvKey('FIREWORKS_API_KEY') || getVaultKey('fireworks'))
const getPuterKey = () =>
  cleanKey(getEnvKey('NEXUS_PUTER_TOKEN') || getEnvKey('PUTER_AUTH_TOKEN') || getEnvKey('PUTER_API_KEY') || getVaultKey('puter'))
const getOpenAiKey = () =>
  cleanKey(getEnvKey('OPENAI_API_KEY') || getEnvKey('NEXUS_OPENAI_API_KEY') || getVaultKey('openai'))
const getAnthropicKey = () =>
  cleanKey(getEnvKey('ANTHROPIC_API_KEY') || getEnvKey('NEXUS_ANTHROPIC_API_KEY') || getVaultKey('anthropic'))
const getDeepSeekKey = () =>
  cleanKey(getEnvKey('DEEPSEEK_API_KEY') || getEnvKey('NEXUS_DEEPSEEK_API_KEY') || getVaultKey('deepseek'))

const LATEX_SYSTEM_INSTRUCTION =
  '\n\n[MATHEMATICAL FORMATTING REQUIREMENT]: ALWAYS format all mathematical expressions, formulas, scientific notation, numbers, calculations, exponents, limits, integrals, and mathematical variables using standard LaTeX syntax. For inline expressions, enclose in single dollar signs: $...$ (e.g. $E=mc^2$). For standalone or block formulas, enclose on their own separate lines in double dollar signs: $$...$$. Never output raw unformatted formulas.'

const normalizeGeminiModel = (model = '') => {
  let clean = model.trim() || 'gemini-2.5-flash'
  clean = clean.replace(/^models\//, '')
  if (clean === 'gemini-3.8-flash' || clean === 'gemini-3-flash-preview') {
    return 'gemini-2.5-flash'
  }
  if (clean === 'gemini-3.5-flash-lite' || clean === 'gemini-3.1-flash-lite-preview') {
    return 'gemini-2.5-flash-lite'
  }
  return clean || 'gemini-2.5-flash'
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

  if (!apiKey) {
    throw new Error('Gemini API key is not configured.')
  }

  try {
    const userText = payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
      .join('\n\n')

    const parts = await buildGeminiParts(apiKey, payload, userText)
    const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION

    const body = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [
        {
          role: 'user',
          parts
        }
      ]
    }

    const modelName = normalizeGeminiModel(payload.model)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    )

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini request failed with ${response.status}.`)
    }

    const candidate = data?.candidates?.[0]
    const content = candidate?.content?.parts?.map((part: any) => part.text || '').join('') || ''
    if (!content.trim()) {
      throw new Error('Gemini returned an empty response.')
    }
    return content.trim()
  } catch (err: any) {
    console.warn('[AI Gateway] Native Gemini call failed:', err?.message)
    throw err
  }
}

const callGroq = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getGroqKey())
  if (!apiKey) {
    throw new Error('Groq API key is not configured.')
  }

  const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION
  const messages = [
    { role: 'system', content: systemText },
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
  if (!apiKey) {
    throw new Error('Fireworks API key is not configured.')
  }

  const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION
  const messages = [
    { role: 'system', content: systemText },
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

const callPuter = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const token = cleanKey(payload.apiKey || getPuterKey())
  const model = payload.model || 'gpt-4o'
  const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION
  const messages = [
    { role: 'system', content: systemText },
    ...payload.messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ]

  if (token) {
    try {
      // @ts-ignore
      const { init } = await import('@heyputer/puter.js/src/init.cjs')
      const client: any = init(token)
      const res: any = await client.ai.chat(messages, { model })
      if (typeof res === 'string') return (res as string).trim()
      if (res?.message?.content) {
        if (typeof res.message.content === 'string') return res.message.content.trim()
        if (Array.isArray(res.message.content)) {
          return res.message.content.map((c: any) => c.text || '').join('').trim()
        }
      }
      return String(res || 'Puter returned empty response.').trim()
    } catch (err: any) {
      console.warn('[AI Gateway] Puter Node call failed:', err)
    }
  }

  throw new Error('Puter authentication token is not configured in backend vault.')
}

const callOpenAI = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getOpenAiKey())
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured.')
  }

  const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION
  const messages = [
    { role: 'system', content: systemText },
    ...payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI failed with ${response.status}.`)
  return data?.choices?.[0]?.message?.content?.trim() || 'OpenAI returned no text.'
}

const callAnthropic = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getAnthropicKey())
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured.')
  }

  const userMessages = payload.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))

  const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model || 'claude-3-7-sonnet-20250219',
      max_tokens: 4096,
      system: systemText,
      messages: userMessages
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `Anthropic failed with ${response.status}.`)
  const text = data?.content?.map((c: any) => c.text || '').join('')
  return text?.trim() || 'Anthropic returned no text.'
}

const callDeepSeek = async (payload: {
  apiKey?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const apiKey = cleanKey(payload.apiKey || getDeepSeekKey())
  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured.')
  }

  const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION
  const messages = [
    { role: 'system', content: systemText },
    ...payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
  ]

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: payload.model || 'deepseek-chat',
      messages,
      temperature: 0.7
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `DeepSeek failed with ${response.status}.`)
  return data?.choices?.[0]?.message?.content?.trim() || 'DeepSeek returned no text.'
}

const callOllama = async (payload: {
  baseUrl?: string
  model?: string
  system?: string
  messages: GatewayMessage[]
}) => {
  const baseUrl = (payload.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434')
    .replace(/\/v1\/?$/, '')
    .replace(/\/$/, '')
  const systemText = (payload.system || 'You are Nexus AI.') + LATEX_SYSTEM_INSTRUCTION
  const messages = [
    { role: 'system', content: systemText },
    ...payload.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
  ]

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: payload.model || 'llama3.1',
      messages,
      temperature: 0.7
    })
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `Ollama at ${baseUrl} failed with ${response.status}.`)
  return data?.choices?.[0]?.message?.content?.trim() || 'Ollama returned no text.'
}

const callProvider = async (provider: GatewayProvider, payload: any) => {
  if (provider === 'puter') return callPuter(payload)
  if (provider === 'gemini') return callGemini(payload)
  if (provider === 'groq') return callGroq(payload)
  if (provider === 'fireworks') return callFireworks(payload)
  if (provider === 'openai') return callOpenAI(payload)
  if (provider === 'anthropic') return callAnthropic(payload)
  if (provider === 'deepseek') return callDeepSeek(payload)
  if (provider === 'ollama') return callOllama(payload)
  return callPuter(payload)
}

const normalizeProvider = (value: unknown): GatewayProvider => {
  const val = String(value || '').toLowerCase().trim()
  if (
    val === 'puter' ||
    val === 'gemini' ||
    val === 'groq' ||
    val === 'fireworks' ||
    val === 'openai' ||
    val === 'anthropic' ||
    val === 'deepseek' ||
    val === 'ollama'
  ) {
    return val as GatewayProvider
  }
  return 'puter'
}

const providerOrder = (preferred: GatewayProvider, fallbackOrder?: GatewayProvider[]): GatewayProvider[] => {
  const order: GatewayProvider[] = [
    preferred,
    ...(fallbackOrder || ['puter', 'gemini', 'groq', 'openai', 'anthropic', 'deepseek', 'ollama', 'fireworks'])
  ]
  return order.filter((provider, index) => order.indexOf(provider) === index)
}

export default function registerAiGateway(ipcMain: IpcMain) {
  ipcMain.removeHandler('ai-gateway:list-models')
  ipcMain.handle('ai-gateway:list-models', async (_event, payload: any = {}) => {
    const provider = normalizeProvider(payload.provider)
    try {
      if (provider === 'puter') {
        return {
          success: true,
          provider: 'puter',
          models: [
            { id: 'gpt-4o', label: 'GPT-4o (OpenAI / Puter)', provider: 'puter' },
            { id: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet (Anthropic / Puter)', provider: 'puter' },
            { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Anthropic / Puter)', provider: 'puter' },
            { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (DeepSeek / Puter)', provider: 'puter' },
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google / Puter)', provider: 'puter' },
            { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (Meta / Puter)', provider: 'puter' },
            { id: 'mistralai/mistral-large-2411', label: 'Mistral Large (Mistral / Puter)', provider: 'puter' },
            { id: 'custom', label: 'Custom Model ID (Puter 500+ Catalog)', provider: 'puter' }
          ]
        }
      }

      if (provider === 'gemini') {
        return {
          success: true,
          provider: 'gemini',
          models: [
            { id: 'models/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Flagship Fast)', provider: 'gemini' },
            { id: 'models/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deep Reasoning)', provider: 'gemini' },
            { id: 'models/gemini-3.8-flash', label: 'Gemini 3.8 Flash (Latest Preview)', provider: 'gemini' },
            { id: 'models/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Ultra Low Latency)', provider: 'gemini' }
          ]
        }
      }

      if (provider === 'groq') {
        return {
          success: true,
          provider: 'groq',
          models: [
            { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', provider: 'groq' },
            { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', provider: 'groq' },
            { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K', provider: 'groq' },
            { id: 'gemma2-9b-it', label: 'Gemma 2 9B IT', provider: 'groq' }
          ]
        }
      }

      if (provider === 'openai') {
        return {
          success: true,
          provider: 'openai',
          models: [
            { id: 'gpt-4o', label: 'GPT-4o (Omni Flagship)', provider: 'openai' },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Affordable & Fast)', provider: 'openai' },
            { id: 'o1', label: 'o1 (Deep Reasoning)', provider: 'openai' },
            { id: 'o3-mini', label: 'o3-mini (Reasoning Mini)', provider: 'openai' }
          ]
        }
      }

      if (provider === 'anthropic') {
        return {
          success: true,
          provider: 'anthropic',
          models: [
            { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Hybrid Thinking)', provider: 'anthropic' },
            { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (State of the Art)', provider: 'anthropic' },
            { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)', provider: 'anthropic' }
          ]
        }
      }

      if (provider === 'deepseek') {
        return {
          success: true,
          provider: 'deepseek',
          models: [
            { id: 'deepseek-chat', label: 'DeepSeek-V3 (Chat Flagship)', provider: 'deepseek' },
            { id: 'deepseek-reasoner', label: 'DeepSeek-R1 (Chain of Thought Reasoner)', provider: 'deepseek' }
          ]
        }
      }

      if (provider === 'ollama') {
        return {
          success: true,
          provider: 'ollama',
          models: [
            { id: 'llama3.1', label: 'Llama 3.1 (Local)', provider: 'ollama' },
            { id: 'deepseek-coder', label: 'DeepSeek Coder (Local)', provider: 'ollama' },
            { id: 'mistral', label: 'Mistral 7B (Local)', provider: 'ollama' },
            { id: 'phi3', label: 'Phi-3 Mini (Local)', provider: 'ollama' },
            { id: 'custom', label: 'Custom Ollama Model', provider: 'ollama' }
          ]
        }
      }

      return { success: true, provider, models: [] }
    } catch (error: any) {
      return { success: false, provider, error: error?.message || String(error), models: [] }
    }
  })

  ipcMain.removeHandler('ai-gateway:chat')
  ipcMain.handle('ai-gateway:chat', async (_event, payload: any = {}) => {
    const preferredProvider = normalizeProvider(payload.provider)
    const modelsByProvider = payload.modelsByProvider || {}
    const attempts: Array<{ provider: GatewayProvider; model?: string; error?: string }> = []

    for (const provider of providerOrder(preferredProvider, payload.fallbackOrder)) {
      try {
        const apiKey =
          provider === 'puter'
            ? payload.puterToken || payload.apiKey || getPuterKey()
            : provider === 'gemini'
            ? payload.geminiApiKey || getGeminiKey()
            : provider === 'groq'
            ? payload.groqApiKey || getGroqKey()
            : provider === 'fireworks'
            ? payload.fireworksApiKey || getFireworksKey()
            : provider === 'openai'
            ? payload.openaiApiKey || getOpenAiKey()
            : provider === 'anthropic'
            ? payload.anthropicApiKey || getAnthropicKey()
            : provider === 'deepseek'
            ? payload.deepseekApiKey || getDeepSeekKey()
            : payload.apiKey

        const content = await callProvider(provider, {
          apiKey,
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

  ipcMain.removeHandler('ai-gateway:chat-single')
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
