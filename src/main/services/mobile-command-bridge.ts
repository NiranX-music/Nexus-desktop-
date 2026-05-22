import { safeStorage, type App, type BrowserWindow } from 'electron'
import Store from 'electron-store'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import * as os from 'os'
import * as path from 'path'

type MobileCommand = {
  source?: string
  appVersion?: string
  type?: string
  payload?: string
  pairCode?: string
}

type BridgeOptions = {
  app: App
  getMainWindow: () => BrowserWindow | null
}

const MAX_BODY_BYTES = 64 * 1024
const DEFAULT_PORT = 17173
const FALLBACK_PORT = 5173
const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash'
const PAIRING_TTL_MS = 1000 * 60 * 15
const CHAT_MODEL_FALLBACKS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash'
]

const allowedTypes = new Set([
  'page',
  'voice',
  'command',
  'whiteboard',
  'whiteboard-diagram',
  'files-search',
  'files-open',
  'weather',
  'stocks',
  'maps',
  'research'
])

const StoreClass = (Store as any).default || Store
const bridgeStore = new StoreClass()
const EMAIL_USERS_KEY = 'nexus_email_auth_users'
const EMAIL_SESSIONS_KEY = 'nexus_email_auth_sessions'

let activePairing: { pairCode: string; createdAt: number; expiresAt: number } | null = null

function sendJson(res: http.ServerResponse, status: number, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function sendSvg(res: http.ServerResponse, status: number, svg: string) {
  res.writeHead(status, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(svg)
  })
  res.end(svg)
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sanitizeCommand(raw: MobileCommand): MobileCommand {
  const type = String(raw.type || '').trim()
  const payload = String(raw.payload || '').trim().slice(0, 4000)
  const source = String(raw.source || 'nexus-android').trim().slice(0, 80)
  const appVersion = String(raw.appVersion || '').trim().slice(0, 40)
  const pairCode = String(raw.pairCode || '').replace(/[^\dA-Za-z-]/g, '').slice(0, 32)

  return { source, appVersion, type, payload, pairCode }
}

function decryptStoredValue(value = '') {
  if (!value) return ''
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  }
  return Buffer.from(value, 'base64').toString('utf8')
}

function loadDesktopGeminiKey(app: App) {
  const secureConfigPath = path.join(app.getPath('userData'), 'nexus_secure_vault.json')
  if (!fs.existsSync(secureConfigPath)) return ''

  try {
    const secureData = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
    return decryptStoredValue(secureData.gemini || '').trim()
  } catch {
    return ''
  }
}

function readSecureVaultStatus(app: App) {
  const secureConfigPath = path.join(app.getPath('userData'), 'nexus_secure_vault.json')
  if (!fs.existsSync(secureConfigPath)) {
    return { gemini: false, groq: false, fireworks: false }
  }

  try {
    const secureData = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
    return {
      gemini: Boolean(secureData.gemini),
      groq: Boolean(secureData.groq),
      fireworks: Boolean(secureData.fireworks)
    }
  } catch {
    return { gemini: false, groq: false, fireworks: false }
  }
}

function getLocalAddresses() {
  const interfaces = os.networkInterfaces()
  const addresses: string[] = []

  Object.values(interfaces).forEach((entries) => {
    entries?.forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address)
      }
    })
  })

  return addresses
}

function getPrimaryBridgeUrl(port: number) {
  const lanAddress = getLocalAddresses()[0] || '127.0.0.1'
  return `http://${lanAddress}:${port}`
}

function getPairingState() {
  const now = Date.now()
  if (!activePairing || activePairing.expiresAt <= now) {
    activePairing = {
      pairCode: String(Math.floor(100000 + Math.random() * 900000)),
      createdAt: now,
      expiresAt: now + PAIRING_TTL_MS
    }
  }
  return activePairing
}

function readAccountSummary() {
  const users = ((bridgeStore.get(EMAIL_USERS_KEY) as any[] | undefined) || []).map((user) => ({
    id: String(user?.id || ''),
    name: String(user?.name || ''),
    email: String(user?.email || ''),
    createdAt: String(user?.createdAt || ''),
    lastLoginAt: String(user?.lastLoginAt || '')
  }))
  const sessions = ((bridgeStore.get(EMAIL_SESSIONS_KEY) as any[] | undefined) || []).filter(
    (session) => new Date(session?.expiresAt || 0).getTime() > Date.now()
  )

  return {
    configured: users.length > 0,
    users,
    activeSessions: sessions.length
  }
}

function buildPairingPayload(port: number) {
  const pairing = getPairingState()
  const bridgeUrl = getPrimaryBridgeUrl(port)
  const payload = {
    type: 'nexus-mobile-pair',
    app: 'Nexus AI 9.1',
    bridgeUrl,
    pairCode: pairing.pairCode,
    expiresAt: new Date(pairing.expiresAt).toISOString(),
    scopes: ['desktop-command', 'voice-agent', 'pc-telemetry', 'account-status', 'mobile-control']
  }

  return {
    ok: true,
    ...payload,
    qrText: JSON.stringify(payload)
  }
}

function renderPairingQrSvg(port: number) {
  const pairing = buildPairingPayload(port)
  const qrImageUrl =
    'https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=svg&margin=8&color=21f2a4&bgcolor=020504&data=' +
    encodeURIComponent(pairing.qrText)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260" role="img" aria-label="Nexus mobile pairing QR">
  <rect width="260" height="260" rx="18" fill="#020504"/>
  <rect x="14" y="14" width="232" height="232" rx="14" fill="#020504" stroke="#21f2a4" stroke-opacity="0.42"/>
  <image href="${escapeXml(qrImageUrl)}" x="20" y="20" width="220" height="220" preserveAspectRatio="xMidYMid meet"/>
  <text x="130" y="254" text-anchor="middle" fill="#21f2a4" font-family="monospace" font-size="14" font-weight="700">${escapeXml(pairing.pairCode)}</text>
</svg>`
}

function buildMobileTelemetry(app: App, port: number) {
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const usedMemory = Math.max(totalMemory - freeMemory, 0)
  const memoryPercent = totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0
  const pairing = buildPairingPayload(port)
  const secureVault = readSecureVaultStatus(app)

  return {
    ok: true,
    app: 'Nexus AI 9.1',
    bridge: {
      port,
      url: pairing.bridgeUrl,
      lanAddresses: getLocalAddresses(),
      pairCode: pairing.pairCode,
      pairExpiresAt: pairing.expiresAt
    },
    desktop: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.round(os.uptime()),
      cpuCount: os.cpus().length,
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        percent: memoryPercent
      },
      processMemory: process.memoryUsage()
    },
    account: readAccountSummary(),
    supabase: {
      configured: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
      mode: 'desktop-mediated',
      note: 'Mobile receives account status through the paired desktop bridge. Secret Supabase keys and refresh tokens are not exposed.'
    },
    aiKeys: secureVault,
    permissions: {
      desktopControl: true,
      voiceAgent: true,
      browserControl: true,
      fileAccess: true,
      whiteboard: true,
      media: true,
      notes: true,
      gallery: true,
      mobileControl: 'Available when Android accessibility/ADB permissions are enabled'
    },
    features: [
      'Agent',
      'AI Chat',
      'Voice Agent',
      'Browser Control',
      'Files',
      'Whiteboard',
      'Video Studio',
      'Notes',
      'Gallery',
      'Phone Control',
      'Macros',
      'Apps',
      'Settings',
      'Weather',
      'Stocks',
      'Maps',
      'Research',
      'Gmail',
      'WhatsApp',
      'Terminal',
      'Screenshots',
      'Volume'
    ],
    createdAt: new Date().toISOString()
  }
}

function normalizeGeminiModel(model?: string) {
  const cleaned = String(model || DEFAULT_CHAT_MODEL).trim().replace(/^models\//, '')
  return cleaned || DEFAULT_CHAT_MODEL
}

function postJsonToGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'You are Nexus 9.1, the same AI assistant personality used by the desktop app. ' +
                'Answer as the mobile agent UI: direct, useful, and able to reference desktop controls when relevant.\n\n' +
                `User: ${prompt}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 768
      }
    })

    const request = https.request(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${normalizeGeminiModel(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        },
        timeout: 30000
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          responseBody += chunk
        })
        response.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody || '{}')
            if ((response.statusCode || 500) >= 400) {
              reject(new Error(parsed?.error?.message || `Gemini request failed (${response.statusCode})`))
              return
            }

            const parts = parsed?.candidates?.[0]?.content?.parts || []
            const text = parts
              .map((part: { text?: string }) => part?.text || '')
              .filter(Boolean)
              .join('\n')
              .trim()

            resolve(text || 'Nexus received a response, but it did not include text.')
          } catch (error: any) {
            reject(new Error(error?.message || 'Unable to parse Gemini response'))
          }
        })
      }
    )

    request.on('timeout', () => {
      request.destroy(new Error('Gemini request timed out'))
    })
    request.on('error', reject)
    request.write(requestBody)
    request.end()
  })
}

async function generateMobileChat(apiKey: string, requestedModel: string, prompt: string) {
  const models = Array.from(
    new Set([normalizeGeminiModel(requestedModel), ...CHAT_MODEL_FALLBACKS.map(normalizeGeminiModel)])
  )
  let lastError = 'Gemini request failed'

  for (const model of models) {
    try {
      const text = await postJsonToGemini(apiKey, model, prompt)
      return { text, model }
    } catch (error: any) {
      lastError = error?.message || lastError
    }
  }

  throw new Error(lastError)
}

export default function registerMobileCommandBridge({ app, getMainWindow }: BridgeOptions) {
  let activeServer: http.Server | null = null

  const startServer = (port: number) => {
    const server = http.createServer(async (req, res) => {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')

      if (req.method === 'OPTIONS') {
        sendJson(res, 204, {})
        return
      }

      if (req.method === 'GET' && requestUrl.pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          app: 'Nexus AI 9.1',
          bridge: 'mobile-command',
          port
        })
        return
      }

      if (req.method === 'GET' && requestUrl.pathname === '/mobile-telemetry') {
        sendJson(res, 200, buildMobileTelemetry(app, port))
        return
      }

      if (req.method === 'GET' && requestUrl.pathname === '/mobile-pairing') {
        sendJson(res, 200, buildPairingPayload(port))
        return
      }

      if (req.method === 'GET' && requestUrl.pathname === '/mobile-pairing.svg') {
        sendSvg(res, 200, renderPairingQrSvg(port))
        return
      }

      if (req.method === 'POST' && requestUrl.pathname === '/mobile-chat') {
        try {
          const rawBody = await readBody(req)
          const payload = JSON.parse(rawBody || '{}')
          const prompt = String(payload.prompt || '').trim().slice(0, 4000)
          const model = normalizeGeminiModel(payload.model)

          if (!prompt) {
            sendJson(res, 400, { ok: false, error: 'Prompt is required' })
            return
          }

          const geminiKey = loadDesktopGeminiKey(app)
          if (!geminiKey) {
            sendJson(res, 412, {
              ok: false,
              error: 'Gemini key is not saved in Nexus desktop settings'
            })
            return
          }

          const targetWindow = getMainWindow()
          if (targetWindow && !targetWindow.isDestroyed()) {
            if (targetWindow.isMinimized()) targetWindow.restore()
            targetWindow.show()
            targetWindow.focus()
            targetWindow.webContents.send('mobile-command', {
              source: payload.source || 'nexus-mobile-preview',
              appVersion: payload.appVersion || '',
              type: 'command',
              payload: prompt,
              pairCode: payload.pairCode || ''
            })
          }

          const result = await generateMobileChat(geminiKey, model, prompt)
          sendJson(res, 200, { ok: true, text: result.text, model: result.model })
        } catch (error: any) {
          sendJson(res, 500, { ok: false, error: error?.message || 'Mobile chat failed' })
        }
        return
      }

      if (req.method !== 'POST' || requestUrl.pathname !== '/mobile-command') {
        sendJson(res, 404, { ok: false, error: 'Unknown endpoint' })
        return
      }

      try {
        const rawBody = await readBody(req)
        const command = sanitizeCommand(JSON.parse(rawBody || '{}'))

        if (!command.type || !allowedTypes.has(command.type)) {
          sendJson(res, 400, { ok: false, error: 'Unsupported command type' })
          return
        }

        const targetWindow = getMainWindow()
        if (!targetWindow || targetWindow.isDestroyed()) {
          sendJson(res, 503, { ok: false, error: 'Nexus window unavailable' })
          return
        }

        if (targetWindow.isMinimized()) targetWindow.restore()
        targetWindow.show()
        targetWindow.focus()
        targetWindow.webContents.send('mobile-command', command)

        sendJson(res, 202, { ok: true, accepted: command.type })
      } catch (error: any) {
        sendJson(res, 400, { ok: false, error: error?.message || 'Invalid command' })
      }
    })

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && port === DEFAULT_PORT) {
        startServer(FALLBACK_PORT)
        return
      }
      console.warn('[mobile-command-bridge] failed:', error.message)
    })

    server.listen(port, '0.0.0.0', () => {
      activeServer = server
      console.log(`[mobile-command-bridge] listening on ${port}`)
    })
  }

  const configuredPort = Number(process.env.NEXUS_MOBILE_BRIDGE_PORT || DEFAULT_PORT)
  startServer(Number.isFinite(configuredPort) ? configuredPort : DEFAULT_PORT)

  app.on('before-quit', () => {
    activeServer?.close()
    activeServer = null
  })
}
