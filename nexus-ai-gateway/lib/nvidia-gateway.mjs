const DEFAULT_UPSTREAM_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-pro'
const DEFAULT_ADMIN_PASS = '05122010'
const UPSTREAM_API_KEY_ENV_NAMES = [
  'NEXUS_AI_UPSTREAM_API_KEY',
  'NEXUS_AI_API_KEY',
  'NVIDIA_API_KEY',
  'NVIDIA_BUILD_API_KEY',
  'NVIDIA_NIM_API_KEY'
]
const PLACEHOLDER_UPSTREAM_KEY_RE =
  /^(your-|paste-|replace-|example|placeholder|nvapi[_-]?your|\$[A-Z0-9_]+|\$\{[A-Z0-9_]+\})/i

const MODEL_CATALOG = [
  'deepseek-ai/deepseek-v4-pro',
  'deepseek-ai/deepseek-v4-flash',
  'deepseek-ai/deepseek-v3.2',
  'qwen/qwen3-coder-480b-a35b-instruct',
  'qwen/qwen2.5-coder-32b-instruct',
  'qwen/qwen3-next-80b-a3b-thinking',
  'qwen/qwen3-next-80b-a3b-instruct',
  'z-ai/glm5.1',
  'z-ai/glm4.7',
  'mistralai/mistral-medium-3.5-128b',
  'mistralai/codestral-22b-instruct-v0.1',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.2-90b-vision-instruct',
  'google/gemma-2-2b-it',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'nvidia/riva-translate-4b-instruct-v1_1',
  'nvidia/magpie-tts-multilingual',
  'nvidia/parakeet-1.1b-rnnt-multilingual-asr',
  'nvidia/nv-embedqa-e5-v5',
  'nvidia/usdcode'
]

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers':
    'content-type,x-nexus-client,x-nexus-admin-pass,authorization',
  'access-control-max-age': '86400'
}

export function getEnvValue(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name)
  return (netlifyValue || process.env[name] || '').trim()
}

export function normalizeUpstreamApiKey(value = '') {
  const candidate = String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()

  if (!candidate || PLACEHOLDER_UPSTREAM_KEY_RE.test(candidate)) return ''
  return candidate
}

export function normalizeNvidiaApiKey(value = '') {
  return normalizeUpstreamApiKey(value)
}

export function getUpstreamApiKey() {
  for (const name of UPSTREAM_API_KEY_ENV_NAMES) {
    const apiKey = normalizeUpstreamApiKey(getEnvValue(name))
    if (apiKey) return apiKey
  }

  return ''
}

export function getNvidiaApiKey() {
  return getUpstreamApiKey()
}

export function getUpstreamBaseUrl() {
  const configured =
    getEnvValue('NEXUS_AI_UPSTREAM_BASE_URL') ||
    getEnvValue('NEXUS_AI_BASE_URL') ||
    getEnvValue('NVIDIA_BASE_URL') ||
    DEFAULT_UPSTREAM_BASE_URL

  return configured.replace(/\/$/, '')
}

export function getUpstreamChatUrl() {
  return getEnvValue('NEXUS_AI_UPSTREAM_CHAT_URL') || `${getUpstreamBaseUrl()}/chat/completions`
}

export function getUpstreamModelsUrl() {
  return getEnvValue('NEXUS_AI_UPSTREAM_MODELS_URL') || `${getUpstreamBaseUrl()}/models`
}

export function getUpstreamAuthHeaders(apiKey) {
  if (!apiKey) return {}

  const headerName = getEnvValue('NEXUS_AI_UPSTREAM_AUTH_HEADER') || 'authorization'
  const scheme = getEnvValue('NEXUS_AI_UPSTREAM_AUTH_SCHEME') || 'Bearer'
  const authValue = scheme.toLowerCase() === 'none' ? apiKey : `${scheme} ${apiKey}`

  return {
    [headerName]: authValue
  }
}

function allowsNoUpstreamKey() {
  return getEnvValue('NEXUS_AI_UPSTREAM_ALLOW_NO_KEY').toLowerCase() === 'true'
}

function getUpstreamProviderName() {
  const configured = getEnvValue('NEXUS_AI_UPSTREAM_NAME')
  if (configured) return configured

  const baseUrl = getUpstreamBaseUrl().toLowerCase()
  if (baseUrl.includes('nvidia.com')) return 'nvidia'
  return 'custom-upstream'
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

export function getGatewayStatus(headers = {}) {
  if (!isAuthorizedGatewayClient(headers)) {
    return {
      status: 403,
      body: {
        success: false,
        error: 'Nexus gateway is private. Use the desktop client or admin pass.'
      }
    }
  }

  const apiKey = getUpstreamApiKey()
  return {
    status: 200,
    body: {
      success: true,
      configured: Boolean(apiKey) || allowsNoUpstreamKey(),
      providerMode: 'nexus-api-only',
      upstreamProvider: getUpstreamProviderName(),
      upstreamBaseUrl: getUpstreamBaseUrl(),
      publicAi: getEnvValue('NEXUS_ALLOW_PUBLIC_AI').toLowerCase() === 'true',
      adminPassConfigured: Boolean(getEnvValue('NEXUS_ADMIN_PASS')),
      defaultModel: DEFAULT_MODEL,
      developer: 'NiranX',
      company: 'Resolute Nexus'
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

export async function createChatResult(rawBody = {}, headers = {}) {
  if (!isAuthorizedGatewayClient(headers)) {
    return {
      status: 403,
      body: {
        success: false,
        error: 'Nexus gateway is private. Use the desktop client or admin pass.'
      }
    }
  }

  const apiKey = getUpstreamApiKey()
  if (!apiKey && !allowsNoUpstreamKey()) {
    return {
      status: 503,
      body: {
        success: false,
        error:
          'Nexus AI upstream API key is not configured. Add your key to NEXUS_AI_UPSTREAM_API_KEY on this gateway.'
      }
    }
  }

  const messages = normalizeMessages(rawBody.messages)
  const system = String(rawBody.system || '').trim()
  const finalMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages

  if (finalMessages.length === 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'No chat message was provided.'
      }
    }
  }

  const model = String(rawBody.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const payload = {
    model,
    messages: finalMessages,
    temperature: clampNumber(rawBody.temperature, 0.01, 2, 1),
    top_p: clampNumber(rawBody.top_p, 0, 1, 0.95),
    max_tokens: resolveMaxTokens(rawBody.max_tokens, model),
    stream: false
  }

  if (supportsThinkingToggle(model)) {
    payload.chat_template_kwargs = { thinking: false }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55000)

  try {
    const response = await fetch(getUpstreamChatUrl(), {
      method: 'POST',
      headers: {
        ...getUpstreamAuthHeaders(apiKey),
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    const text = await response.text()
    const data = parseJson(text)

    if (!response.ok) {
      return {
        status: response.status,
        body: {
          success: false,
          error:
            data?.error?.message ||
            data?.error ||
            text ||
            `Nexus AI upstream returned ${response.status}.`
        }
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        providerMode: 'nexus-api-only',
        upstreamProvider: getUpstreamProviderName(),
        model: data?.model || payload.model,
        content: extractChatContent(data),
        usage: data?.usage || null
      }
    }
  } catch (error) {
    return {
      status: 502,
      body: {
        success: false,
        error:
          error?.name === 'AbortError'
            ? 'Nexus AI upstream request timed out.'
            : error?.message || 'Nexus AI upstream request failed.'
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function createModelsResult(headers = {}) {
  if (!isAuthorizedGatewayClient(headers)) {
    return {
      status: 403,
      body: {
        success: false,
        error: 'Nexus gateway is private. Use the desktop client or admin pass.',
        models: []
      }
    }
  }

  const apiKey = getUpstreamApiKey()
  if (!apiKey && !allowsNoUpstreamKey()) {
    return {
      status: 200,
      body: {
        success: true,
        source: 'catalog',
        models: MODEL_CATALOG
      }
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(getUpstreamModelsUrl(), {
      headers: {
        ...getUpstreamAuthHeaders(apiKey)
      },
      signal: controller.signal
    })
    const text = await response.text()
    const data = parseJson(text)

    if (!response.ok) {
      return {
        status: response.status,
        body: {
          success: false,
          error:
            data?.error?.message ||
            data?.error ||
            text ||
            `Nexus AI upstream returned ${response.status}.`,
          models: MODEL_CATALOG
        }
      }
    }

    const models = normalizeModelList(data) || MODEL_CATALOG

    return {
      status: 200,
      body: {
        success: true,
        source: getUpstreamProviderName(),
        providerMode: 'nexus-api-only',
        models
      }
    }
  } catch (error) {
    return {
      status: 200,
      body: {
        success: true,
        source: 'catalog-fallback',
        warning: error?.message || 'Nexus AI upstream model sync failed.',
        models: MODEL_CATALOG
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeMessages(messages = []) {
  if (!Array.isArray(messages)) return []

  return messages
    .slice(-32)
    .map((message) => ({
      role: normalizeRole(message?.role),
      content: String(message?.content || '').trim().slice(0, 24000)
    }))
    .filter((message) => message.content)
}

function normalizeRole(role) {
  if (role === 'system' || role === 'assistant' || role === 'user') return role
  if (role === 'model' || role === 'nexus') return 'assistant'
  return 'user'
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(numeric, min), max)
}

function maxTokensLimitForModel(model) {
  const normalized = String(model || '').toLowerCase()
  if (normalized.includes('deepseek-v4')) return 16384
  return 4096
}

function resolveMaxTokens(value, model) {
  const limit = maxTokensLimitForModel(model)
  const fallback = Math.min(limit, String(model || '').toLowerCase().includes('deepseek-v4') ? 8192 : 4096)
  return clampNumber(value, 1, limit, fallback)
}

function supportsThinkingToggle(model) {
  return model.includes('deepseek-v4')
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

function extractChatContent(data) {
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.content ||
    data?.response ||
    data?.text ||
    data?.output_text ||
    data?.message

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .filter(Boolean)
      .join('\n')
  }

  return typeof content === 'string' ? content : ''
}

function normalizeModelList(data) {
  const rawModels = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.models)
      ? data.models
      : Array.isArray(data)
        ? data
        : null

  if (!rawModels) return null

  const models = rawModels
    .map((model) => (typeof model === 'string' ? model : model?.id || model?.name))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  return models.length ? models : null
}

function getHeader(headers, name) {
  if (!headers) return ''
  if (typeof headers.get === 'function') return headers.get(name) || ''

  const target = name.toLowerCase()
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === target)
  return key ? String(headers[key] || '') : ''
}
