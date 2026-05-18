const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_KEY_ENV_NAMES = ['NEXUS_GEMINI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_AI_API_KEY']
const PLACEHOLDER_KEY_RE =
  /^(your-|paste-|replace-|example|placeholder|\$[A-Z0-9_]+|\$\{[A-Z0-9_]+\})/i

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers':
    'content-type,x-nexus-client,x-nexus-admin-pass,authorization',
  'access-control-max-age': '86400'
}

const DEFAULT_ADMIN_PASS = '05122010'

export function getEnvValue(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name)
  return (netlifyValue || process.env[name] || '').trim()
}

export function normalizeGeminiApiKey(value = '') {
  const candidate = String(value || '').trim().replace(/^['"]|['"]$/g, '').trim()
  if (!candidate || PLACEHOLDER_KEY_RE.test(candidate)) return ''
  return candidate
}

export function getGeminiApiKey() {
  for (const name of GEMINI_KEY_ENV_NAMES) {
    const key = normalizeGeminiApiKey(getEnvValue(name))
    if (key) return key
  }

  return ''
}

export function buildHeaders(extra = {}) {
  return {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8',
    ...extra
  }
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders(extraHeaders)
  })
}

export function sendVercelJson(res, status, body, extraHeaders = {}) {
  const headers = buildHeaders(extraHeaders)
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value))
  return res.status(status).json(body)
}

export function handleOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  })
}

export function handleVercelOptions(req, res) {
  if (req.method !== 'OPTIONS') return false
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value))
  res.status(204).end()
  return true
}

export function isAuthorizedGatewayClient(headers = {}) {
  const allowPublic = getEnvValue('NEXUS_ALLOW_PUBLIC_AI').toLowerCase() === 'true'
  if (allowPublic) return true

  const adminPass = getEnvValue('NEXUS_ADMIN_PASS') || DEFAULT_ADMIN_PASS
  const clientHeader = getHeader(headers, 'x-nexus-client')
  const adminHeader = getHeader(headers, 'x-nexus-admin-pass')

  return clientHeader === 'desktop' || adminHeader === adminPass
}

export function getGeminiStatus(headers = {}) {
  if (!isAuthorizedGatewayClient(headers)) {
    return {
      status: 403,
      body: {
        success: false,
        error: 'Nexus Gemini gateway is private. Use the desktop client or admin pass.'
      }
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      providerMode: 'nexus-gemini-live',
      configured: Boolean(getGeminiApiKey()),
      model: getEnvValue('NEXUS_GEMINI_MODEL') || DEFAULT_GEMINI_MODEL
    }
  }
}

export async function readNetlifyJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export function readVercelJson(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  return req.body
}

export async function createGeminiGenerateResult(rawBody = {}, headers = {}) {
  if (!isAuthorizedGatewayClient(headers)) {
    return {
      status: 403,
      body: {
        success: false,
        error: 'Nexus Gemini gateway is private. Use the desktop client or admin pass.'
      }
    }
  }

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'Gemini API is not configured. Add NEXUS_GEMINI_API_KEY on this gateway.'
      }
    }
  }

  const model = String(rawBody.model || getEnvValue('NEXUS_GEMINI_MODEL') || DEFAULT_GEMINI_MODEL).trim()
  const contents = normalizeContents(rawBody)
  const system = String(rawBody.system || '').trim()

  if (contents.length === 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'No Gemini prompt was provided.'
      }
    }
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: clampNumber(rawBody.temperature, 0, 2, 0.7),
      topP: clampNumber(rawBody.topP ?? rawBody.top_p, 0, 1, 0.95),
      maxOutputTokens: clampNumber(rawBody.maxOutputTokens ?? rawBody.max_tokens, 1, 65536, 8192)
    }
  }

  if (system) {
    payload.systemInstruction = {
      parts: [{ text: system.slice(0, 32000) }]
    }
  }

  try {
    const response = await fetch(
      `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    const text = await response.text()
    const data = parseJson(text)

    if (!response.ok) {
      return {
        status: response.status,
        body: {
          success: false,
          error: data?.error?.message || data?.error || text || `Gemini returned ${response.status}.`
        }
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        providerMode: 'nexus-gemini-live',
        model,
        content: extractGeminiText(data),
        usage: data?.usageMetadata || null
      }
    }
  } catch (error) {
    return {
      status: 502,
      body: {
        success: false,
        error: error?.message || 'Gemini API request failed.'
      }
    }
  }
}

export async function createGeminiEmbedResult(rawBody = {}, headers = {}) {
  if (!isAuthorizedGatewayClient(headers)) {
    return {
      status: 403,
      body: {
        success: false,
        error: 'Nexus Gemini gateway is private. Use the desktop client or admin pass.'
      }
    }
  }

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'Gemini API is not configured. Add NEXUS_GEMINI_API_KEY on this gateway.'
      }
    }
  }

  const texts = normalizeEmbeddingTexts(rawBody)
  if (texts.length === 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'No Gemini embedding text was provided.'
      }
    }
  }

  const model = normalizeGeminiModelId(rawBody.model || getEnvValue('NEXUS_GEMINI_EMBEDDING_MODEL'))
  const taskType = String(rawBody.taskType || rawBody.task_type || '').trim()
  const payload = {
    requests: texts.map((text) => {
      const requestPayload = {
        model: model.resourceName,
        content: {
          parts: [{ text: text.slice(0, 30000) }]
        }
      }

      if (taskType) requestPayload.taskType = taskType
      return requestPayload
    })
  }

  try {
    const response = await fetch(
      `${GEMINI_API_BASE_URL}/${model.resourceName}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    const text = await response.text()
    const data = parseJson(text)

    if (!response.ok) {
      return {
        status: response.status,
        body: {
          success: false,
          error: data?.error?.message || data?.error || text || `Gemini returned ${response.status}.`
        }
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        providerMode: 'nexus-gemini-live',
        model: model.id,
        embeddings: extractGeminiEmbeddings(data)
      }
    }
  } catch (error) {
    return {
      status: 502,
      body: {
        success: false,
        error: error?.message || 'Gemini embedding request failed.'
      }
    }
  }
}

function normalizeContents(body) {
  if (Array.isArray(body.contents) && body.contents.length > 0) return body.contents

  const prompt = String(body.prompt || body.text || body.message || '').trim()
  if (!prompt) return []

  return [
    {
      role: 'user',
      parts: [{ text: prompt.slice(0, 120000) }]
    }
  ]
}

function normalizeGeminiModelId(model) {
  const clean = String(model || 'gemini-embedding-001').trim().replace(/^models\//, '')
  return {
    id: clean,
    resourceName: `models/${clean}`
  }
}

function normalizeEmbeddingTexts(body) {
  const rawTexts = Array.isArray(body.texts)
    ? body.texts
    : Array.isArray(body.contents)
      ? body.contents
      : [body.text || body.prompt || body.message || body.content]

  return rawTexts
    .map((text) => String(text || '').trim())
    .filter(Boolean)
    .slice(0, 100)
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('\n')

  return text || data?.text || data?.response || ''
}

function extractGeminiEmbeddings(data) {
  if (Array.isArray(data?.embeddings)) {
    return data.embeddings.map((embedding) => embedding?.values || []).filter((values) => values.length)
  }

  const values = data?.embedding?.values
  return Array.isArray(values) && values.length ? [values] : []
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(numeric, min), max)
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

function getHeader(headers, name) {
  if (!headers) return ''
  if (typeof headers.get === 'function') return headers.get(name) || ''

  const target = name.toLowerCase()
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === target)
  return key ? String(headers[key] || '') : ''
}
