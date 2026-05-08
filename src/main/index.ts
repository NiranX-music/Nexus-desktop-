import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  globalShortcut,
  screen,
  session,
  safeStorage,
  systemPreferences,
  Tray,
  Menu,
  nativeImage,
  WebContents
} from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { get as httpsGet } from 'https'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import registerIpcHandlers from './logic/nexus-memory-save'
import registerSystemHandlers from './logic/get-system-info'
import registerFileSearch from './logic/file-search'
import registerFileOps from './logic/file-ops'
import registerFileWrite from './logic/file-write'
import registerFileRead from './logic/file-read'
import registerFileOpen from './logic/file-open'
import registerDirLoader from './logic/dir-load'
import registerFileScanner from './logic/file-launcher'
import registerAppLauncher from './logic/app-launcher'
import registerNotesHandlers from './logic/notes-manager'
import registerWebAgent from './logic/web-agent'
import registerGhostControl from './logic/ghost-control'
import registerterminalControl from './logic/terminal-control'
import registerGalleryHandlers from './logic/gallery-manager'
import registerGmailHandlers from './logic/gmail-manager'
import registerLocationHandlers from './logic/live-location'
import registerAdbHandlers from './logic/adb-manager'
import registerMediaControl from './logic/media-control'
import registerRealityHacker from './logic/reality-hacker'
import registerNexusCoder from './services/nexus-coder'
import registerTelekinesis from './logic/telekinesis'
import registerPermanentMemory from './logic/permanent-memory'
import registerWormhole from './services/wormhole'
import registerOracle from './services/RAG-oracle'
import registerDeepResearch from './services/deep-research'
import registerIssueReporter from './services/issue-reporter'
import registerNvidiaAI from './services/nvidia-ai'
import registerWidgetMaker from './auto/widget-manager'
import registerWebsiteBuilder from './auto/website-builder'
import registerWorkflowManager from './workflow/workflow-manager'
import registerDropZoneControl from './handlers/SmartDropZone-Handler'
import registerScreenPeeler from './handlers/ScreenPeeler-handler'
import registerPhantomKeyboard from './handlers/PhantomControl-handler'
import registerSecurityVault from './security/Security'
import registerEmailAuth from './security/email-auth'
import registerLockSystem from './security/lock-system'
import { autoUpdater } from 'electron-updater'

app.commandLine.appendSwitch('use-fake-ui-for-media-stream')

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('nexus', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('nexus')
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isOverlayMode = false
let isOverlayDockExpanded = false
let isQuitting = false
let updateDownloadPromise: Promise<Array<string>> | null = null
let downloadedUpdateInfo: { version: string; releaseNotes: string } | null = null
let pendingCloudAuthState = ''
let pendingCloudAuthExpiresAt = 0
let pendingCloudAuthRequest: {
  requestId: string
  deviceCode: string
  userCode: string
  expiresAt: number
} | null = null
let pendingRendererCloudAuthPayload: Record<string, unknown> | null = null
let pendingCloudAuthPollTimer: ReturnType<typeof setInterval> | null = null
let isCloudAuthClaimInFlight = false

const secureConfigPath = join(app.getPath('userData'), 'nexus_secure_vault.json')
const NEXUS_UPDATE_FEED_URL =
  process.env.NEXUS_UPDATE_FEED_URL || 'https://niranx-nexus-agent.vercel.app/updates/win'
const NEXUS_WEB_APP_URL = (
  process.env.NEXUS_WEB_APP_URL || 'https://niranx-nexus-agent.vercel.app'
).replace(/\/+$/, '')
const NEXUS_DESKTOP_AUTH_API_URL = `${NEXUS_WEB_APP_URL}/api/desktop-auth`
const NEXUS_WEB_APP_ORIGIN = (() => {
  try {
    return new URL(NEXUS_WEB_APP_URL).origin
  } catch {
    return ''
  }
})()
const DEV_RENDERER_ORIGIN = (() => {
  try {
    return process.env['ELECTRON_RENDERER_URL']
      ? new URL(process.env['ELECTRON_RENDERER_URL']).origin
      : ''
  } catch {
    return ''
  }
})()

const NVIDIA_API_KEY_ENV_NAMES = ['NVIDIA_API_KEY', 'NVIDIA_BUILD_API_KEY', 'NVIDIA_NIM_API_KEY']
const PLACEHOLDER_NVIDIA_KEY_RE =
  /^(your-|paste-|replace-|example|placeholder|nvapi[_-]?your|\$NVIDIA_API_KEY|\$\{NVIDIA_API_KEY\})/i

const normalizeNvidiaApiKey = (value = '') => {
  const candidate = String(value)
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()

  if (!candidate || PLACEHOLDER_NVIDIA_KEY_RE.test(candidate)) return ''
  return candidate
}

const getLaunchNvidiaApiKey = () => {
  for (const name of NVIDIA_API_KEY_ENV_NAMES) {
    const apiKey = normalizeNvidiaApiKey(process.env[name])
    if (apiKey) return apiKey
  }

  return ''
}

const encryptSecureValue = (value = '') => {
  if (!value) return ''

  if (safeStorage.isEncryptionAvailable()) {
    return `safe:${safeStorage.encryptString(value).toString('base64')}`
  }

  throw new Error(
    'OS secure storage is not available. Nexus refused to persist API keys insecurely.'
  )
}

const decryptSecureValue = (value = '') => {
  if (!value) return ''

  if (value.startsWith('safe:')) {
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(Buffer.from(value.slice(5), 'base64'))
  }

  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  }

  return ''
}

const readSecureKeysFromDisk = () => {
  if (!fs.existsSync(secureConfigPath)) {
    return { groqKey: '', geminiKey: '', nvidiaKey: '' }
  }

  try {
    const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
    return {
      groqKey: decryptSecureValue(data.groq),
      geminiKey: decryptSecureValue(data.gemini),
      nvidiaKey: normalizeNvidiaApiKey(decryptSecureValue(data.nvidia))
    }
  } catch {
    return { groqKey: '', geminiKey: '', nvidiaKey: '' }
  }
}

const writeSecureKeysToDisk = ({
  groqKey = '',
  geminiKey = '',
  nvidiaKey = ''
}: {
  groqKey?: string
  geminiKey?: string
  nvidiaKey?: string
}) => {
  const secureData = {
    groq: encryptSecureValue(groqKey),
    gemini: encryptSecureValue(geminiKey),
    nvidia: encryptSecureValue(normalizeNvidiaApiKey(nvidiaKey))
  }

  fs.mkdirSync(path.dirname(secureConfigPath), { recursive: true })
  fs.writeFileSync(secureConfigPath, JSON.stringify(secureData), { mode: 0o600 })
  try {
    fs.chmodSync(secureConfigPath, 0o600)
  } catch {}
}

const seedLaunchNvidiaKey = () => {
  const launchNvidiaKey = getLaunchNvidiaApiKey()
  if (!launchNvidiaKey) return

  if (!process.env.NVIDIA_API_KEY) {
    process.env.NVIDIA_API_KEY = launchNvidiaKey
  }

  const existingKeys = readSecureKeysFromDisk()
  if (normalizeNvidiaApiKey(existingKeys.nvidiaKey)) return

  try {
    writeSecureKeysToDisk({
      ...existingKeys,
      nvidiaKey: launchNvidiaKey
    })
  } catch {}
}

const getUpdaterErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  return String(error || 'Unknown updater error.')
}

const compareVersions = (left: string, right: string) => {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0
    const rightPart = rightParts[index] || 0
    if (leftPart > rightPart) return 1
    if (leftPart < rightPart) return -1
  }

  return 0
}

const fetchText = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const request = httpsGet(url, { timeout: 8000 }, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        resolve(fetchText(new URL(response.headers.location, url).toString()))
        return
      }

      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`Update server returned ${response.statusCode || 'no status'}.`))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => resolve(body))
    })

    request.on('timeout', () => {
      request.destroy(new Error('Update check timed out.'))
    })
    request.on('error', reject)
  })

const getLatestUpdateInfo = async () => {
  const feedUrl = NEXUS_UPDATE_FEED_URL.replace(/\/+$/, '')
  const latestYmlUrl = `${feedUrl}/latest.yml`
  const latestYml = await fetchText(latestYmlUrl)
  const version = latestYml.match(/^version:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim()
  const releaseDate = latestYml.match(/^releaseDate:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim()

  if (!version) throw new Error('Update feed did not include a version.')

  return {
    version,
    releaseDate: releaseDate || '',
    feedUrl,
    latestYmlUrl,
    installerUrl: `${feedUrl}/nexus-ai-latest-setup.exe`
  }
}

const sendUpdaterEvent = (status: string, data: Record<string, unknown> = {}, error = '') => {
  mainWindow?.webContents.send('updater-event', { status, data, error })
}

const getInstallerOnlyUpdateGuardMessage = (action: string) =>
  `${action} are available in the installed desktop app.`

const canUseUpdaterForRequest = (action: string) => {
  if (!is.dev || process.env.NEXUS_ALLOW_DEV_UPDATES === 'true') return ''
  return getInstallerOnlyUpdateGuardMessage(action)
}

const parseUrlSafely = (value = '') => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const isLoopbackHost = (hostname = '') =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'

const isTrustedRendererUrl = (value = '') => {
  if (!value) return false
  if (value.startsWith('file://')) return true

  const parsed = parseUrlSafely(value)
  if (!parsed) return false

  return Boolean(DEV_RENDERER_ORIGIN && parsed.origin === DEV_RENDERER_ORIGIN)
}

const isAllowedExternalUrl = (
  value = '',
  {
    allowedOrigins = [],
    allowHttpLoopback = is.dev
  }: { allowedOrigins?: string[]; allowHttpLoopback?: boolean } = {}
) => {
  const parsed = parseUrlSafely(value)
  if (!parsed) return false

  const isHttps = parsed.protocol === 'https:'
  const isAllowedLoopbackHttp =
    parsed.protocol === 'http:' && allowHttpLoopback && isLoopbackHost(parsed.hostname)

  if (!isHttps && !isAllowedLoopbackHttp) return false
  if (!allowedOrigins.length) return true

  return allowedOrigins.includes(parsed.origin)
}

const openExternalIfAllowed = (
  value: string,
  options?: { allowedOrigins?: string[]; allowHttpLoopback?: boolean }
) => {
  if (!isAllowedExternalUrl(value, options)) return false

  void shell.openExternal(value)
  return true
}

const isTrustedPermissionRequest = (webContents: WebContents | null) =>
  Boolean(webContents && isTrustedRendererUrl(webContents.getURL()))

const buildRendererContentSecurityPolicy = () => {
  const scriptSource = is.dev ? "'self' 'unsafe-eval'" : "'self'"

  return [
    "default-src 'self'",
    `script-src ${scriptSource}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: file: https:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: ws: wss: http://localhost:* http://127.0.0.1:*",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
}

const registerRendererSecurityHeaders = () => {
  const csp = buildRendererContentSecurityPolicy()

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isTrustedRendererUrl(details.url)) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
        'Referrer-Policy': ['no-referrer']
      }
    })
  })
}

const shouldUsePersistentDock = () => !is.dev || process.env.NEXUS_FORCE_DOCK === 'true'

const getCommandBounds = () => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { x, y, width, height } = primaryDisplay.workArea
  const horizontalInset = Math.max(14, Math.round(width * 0.018))
  const verticalInset = Math.max(14, Math.round(height * 0.02))
  const maxWidth = Math.max(760, width - horizontalInset * 2)
  const maxHeight = Math.max(560, height - verticalInset * 2)
  const boundedWidth = Math.min(1160, maxWidth)
  const boundedHeight = Math.min(760, maxHeight)

  return {
    width: boundedWidth,
    height: boundedHeight,
    x: Math.floor(x + (width - boundedWidth) / 2),
    y: Math.floor(y + (height - boundedHeight) / 2)
  }
}

const getDockBounds = (expanded = isOverlayDockExpanded) => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const dockWidth = Math.min(expanded ? 800 : 210, width - 12)
  const dockHeight = expanded ? 112 : 32
  const topInset = Math.max(6, Math.round(height * 0.007))

  return {
    width: dockWidth,
    height: dockHeight,
    x: Math.floor(width / 2 - dockWidth / 2),
    y: topInset
  }
}

const setOverlayDockExpanded = (expanded: boolean) => {
  if (!mainWindow || !isOverlayMode) return

  isOverlayDockExpanded = expanded
  mainWindow.setBounds(getDockBounds(expanded))
}

const sendOverlayMode = () => {
  mainWindow?.webContents.send('overlay-mode', isOverlayMode)
}

const updateTrayMenu = () => {
  if (!tray) return

  tray.setToolTip(isOverlayMode ? 'Nexus AI - Dock active' : 'Nexus AI - Command console')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Nexus Console',
        click: () => {
          exitOverlayMode()
        }
      },
      {
        label: 'Show Floating Dock',
        click: () => {
          enterOverlayMode()
        }
      },
      { type: 'separator' },
      {
        label: 'Exit Nexus AI',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
}

function enterOverlayMode() {
  if (!mainWindow) return

  isOverlayDockExpanded = false
  const bounds = getDockBounds(false)
  isOverlayMode = true
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setResizable(false)
  mainWindow.setSkipTaskbar(true)
  mainWindow.setBounds(bounds)
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.showInactive()
  sendOverlayMode()
  updateTrayMenu()
}

function exitOverlayMode() {
  if (!mainWindow) return

  const bounds = getCommandBounds()
  isOverlayMode = false
  isOverlayDockExpanded = false
  mainWindow.setFullScreen(false)
  mainWindow.setResizable(true)
  mainWindow.setAlwaysOnTop(false)
  mainWindow.setSkipTaskbar(false)
  mainWindow.setBounds(bounds)
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  sendOverlayMode()
  updateTrayMenu()
}

function toggleOverlayMode() {
  if (isOverlayMode) {
    exitOverlayMode()
  } else {
    enterOverlayMode()
  }
}

const createTray = () => {
  if (tray) return

  const trayIcon = nativeImage.createFromPath(icon)
  const resolvedIcon = trayIcon.isEmpty()
    ? icon
    : process.platform === 'win32'
      ? trayIcon.resize({ width: 18, height: 18 })
      : trayIcon

  tray = new Tray(resolvedIcon)
  tray.on('click', () => {
    if (!mainWindow) return
    exitOverlayMode()
  })
  updateTrayMenu()
}

type DesktopAuthApiResponse = {
  ok?: boolean
  status?: string
  error?: string
  requestId?: string
  deviceCode?: string
  userCode?: string
  expiresAt?: string
  verificationUri?: string
  accessToken?: string
  refreshToken?: string
  userId?: string
  email?: string
  supabaseUrl?: string
  supabasePublishableKey?: string
}

const postDesktopAuth = async (
  endpoint: 'start' | 'claim' | 'redeem',
  body: Record<string, unknown>
): Promise<DesktopAuthApiResponse> => {
  const response = await fetch(`${NEXUS_DESKTOP_AUTH_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-nexus-client': 'desktop'
    },
    body: JSON.stringify(body)
  })
  const data = (await response.json().catch(() => ({}))) as DesktopAuthApiResponse

  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || `Desktop authorization returned ${response.status}.`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }

  return data
}

const clearCloudAuthPolling = () => {
  if (pendingCloudAuthPollTimer) {
    clearInterval(pendingCloudAuthPollTimer)
    pendingCloudAuthPollTimer = null
  }
  isCloudAuthClaimInFlight = false
}

const clearPendingCloudAuth = () => {
  clearCloudAuthPolling()
  pendingCloudAuthState = ''
  pendingCloudAuthExpiresAt = 0
  pendingCloudAuthRequest = null
}

const revealMainWindowForAuth = () => {
  if (!mainWindow) return

  if (mainWindow.isMinimized()) mainWindow.restore()
  if (isOverlayMode) exitOverlayMode()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

const sendCloudAuthCallback = (payload: Record<string, unknown>) => {
  pendingRendererCloudAuthPayload = payload
  revealMainWindowForAuth()

  if (!mainWindow || mainWindow.webContents.isDestroyed()) return

  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once('did-finish-load', () => {
      if (!mainWindow || mainWindow.webContents.isDestroyed()) return
      mainWindow.webContents.send('cloud-auth-callback', payload)
    })
    return
  }

  mainWindow.webContents.send('cloud-auth-callback', payload)
}

const pollPendingCloudAuth = async () => {
  if (!pendingCloudAuthRequest || isCloudAuthClaimInFlight) return

  if (Date.now() >= pendingCloudAuthRequest.expiresAt) {
    clearPendingCloudAuth()
    sendCloudAuthCallback({
      ok: false,
      error: 'The website authorization code expired. Start login again from Nexus AI.'
    })
    return
  }

  isCloudAuthClaimInFlight = true

  try {
    const result = await postDesktopAuth('claim', {
      requestId: pendingCloudAuthRequest.requestId,
      deviceCode: pendingCloudAuthRequest.deviceCode
    })

    if (result.status !== 'approved') return

    clearPendingCloudAuth()
    sendCloudAuthCallback({
      ok: true,
      state: result.requestId || '',
      accessToken: result.accessToken || '',
      refreshToken: result.refreshToken || '',
      expiresAt: result.expiresAt || '',
      userId: result.userId || '',
      email: result.email || '',
      supabaseUrl: result.supabaseUrl || '',
      supabasePublishableKey: result.supabasePublishableKey || ''
    })
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 0
    if (!status || status >= 400) {
      clearPendingCloudAuth()
      sendCloudAuthCallback({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to claim the website authorization session.'
      })
    }
  } finally {
    isCloudAuthClaimInFlight = false
  }
}

const startCloudAuthPolling = () => {
  clearCloudAuthPolling()
  pendingCloudAuthPollTimer = setInterval(() => {
    void pollPendingCloudAuth()
  }, 2000)
  void pollPendingCloudAuth()
}

const downloadCheckedUpdate = async () => {
  if (downloadedUpdateInfo) {
    sendUpdaterEvent('downloaded', downloadedUpdateInfo)
    return []
  }

  if (!updateDownloadPromise) {
    sendUpdaterEvent('downloading', { percent: 0 })
    updateDownloadPromise = autoUpdater.downloadUpdate().finally(() => {
      updateDownloadPromise = null
    })
  }

  return updateDownloadPromise
}

function createWindow(): void {
  const commandBounds = getCommandBounds()
  mainWindow = new BrowserWindow({
    ...commandBounds,
    show: false,
    fullscreen: false,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: is.dev
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) return

    if (shouldUsePersistentDock()) {
      enterOverlayMode()
      return
    }

    mainWindow.show()
  })

  mainWindow.on('close', (event) => {
    if (!shouldUsePersistentDock() || isQuitting || !mainWindow) return

    event.preventDefault()
    enterOverlayMode()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  ipcMain.on('window-min', () => {
    if (!mainWindow) return

    if (shouldUsePersistentDock()) {
      enterOverlayMode()
      return
    }

    mainWindow.minimize()
  })
  ipcMain.on('window-close', () => {
    if (!mainWindow) return

    if (shouldUsePersistentDock()) {
      enterOverlayMode()
      return
    }

    mainWindow.close()
  })
  ipcMain.on('window-max', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternalIfAllowed(details.url)
    return { action: 'deny' }
  })

  const guardExternalNavigation = (event: Electron.Event, targetUrl: string) => {
    if (isTrustedRendererUrl(targetUrl)) return

    event.preventDefault()
    openExternalIfAllowed(targetUrl)
  }

  mainWindow.webContents.on('will-navigate', guardExternalNavigation)
  mainWindow.webContents.on('will-redirect', guardExternalNavigation)
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const isCloudAuthProtocolUrl = (url: URL) => {
  const target = `${url.hostname}${url.pathname}`.replace(/^\/+/, '').replace(/\//g, '-')
  return target === 'auth-callback' || target === 'authcallback'
}

const handleProtocolUrl = (url: string) => {
  if (!mainWindow || !url.startsWith('nexus://')) return

  try {
    const parsed = new URL(url)

    if (isCloudAuthProtocolUrl(parsed)) {
      const state = parsed.searchParams.get('state') || ''
      const isValidLegacyState =
        pendingCloudAuthState &&
        state === pendingCloudAuthState &&
        Date.now() < pendingCloudAuthExpiresAt
      const isValidDesktopRequest =
        pendingCloudAuthRequest &&
        state === pendingCloudAuthRequest.requestId &&
        Date.now() < pendingCloudAuthRequest.expiresAt

      if (!isValidLegacyState && !isValidDesktopRequest) {
        sendCloudAuthCallback({
          ok: false,
          error: 'The website authorization code expired. Start login again from Nexus AI.'
        })
        return
      }

      clearCloudAuthPolling()
      pendingCloudAuthState = ''
      pendingCloudAuthExpiresAt = 0
      pendingCloudAuthRequest = null
      sendCloudAuthCallback({
        ok: true,
        state,
        accessToken: parsed.searchParams.get('access_token') || '',
        refreshToken: parsed.searchParams.get('refresh_token') || '',
        expiresAt: parsed.searchParams.get('expires_at') || '',
        userId: parsed.searchParams.get('user_id') || '',
        email: parsed.searchParams.get('email') || '',
        supabaseUrl: parsed.searchParams.get('supabase_url') || '',
        supabasePublishableKey: parsed.searchParams.get('supabase_publishable_key') || ''
      })
      return
    }
  } catch {}

  mainWindow.webContents.send('oauth-callback', url)
}

app.on('second-instance', (event, commandLine) => {
  if (!event) {
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (isOverlayMode) exitOverlayMode()
    mainWindow.focus()
    const url = commandLine.find((arg) => arg.startsWith('nexus://'))
    if (url) {
      handleProtocolUrl(url)
    }
  }
})

const getLaunchProtocolUrl = () => process.argv.find((arg) => arg.startsWith('nexus://')) || ''

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  seedLaunchNvidiaKey()
  registerRendererSecurityHeaders()
  registerIssueReporter({
    ipcMain,
    app,
    getMainWindow: () => mainWindow,
    webAppUrl: NEXUS_WEB_APP_URL
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.setFeedURL({ provider: 'generic', url: NEXUS_UPDATE_FEED_URL })

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent('checking')
  })

  autoUpdater.on('update-available', (info) => {
    if (downloadedUpdateInfo?.version !== info.version) {
      downloadedUpdateInfo = null
    }
    sendUpdaterEvent('available', {
      version: info.version,
      releaseNotes: info.releaseNotes || 'Bug fixes and performance improvements.'
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    downloadedUpdateInfo = null
    sendUpdaterEvent('not-available', {
      version: info.version
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdaterEvent('downloading', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    downloadedUpdateInfo = {
      version: info.version,
      releaseNotes: String(info.releaseNotes || 'Update downloaded and ready to install.')
    }
    sendUpdaterEvent('downloaded', downloadedUpdateInfo)
  })

  autoUpdater.on('error', (error) => {
    updateDownloadPromise = null
    sendUpdaterEvent('error', {}, getUpdaterErrorMessage(error))
  })

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = [
      'media',
      'audioCapture',
      'videoCapture',
      'desktopVideoCapture',
      'microphone',
      'camera'
    ]
    if (allowedPermissions.includes(permission) && isTrustedPermissionRequest(webContents)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = [
      'media',
      'audioCapture',
      'videoCapture',
      'desktopVideoCapture',
      'microphone',
      'camera'
    ]
    return allowedPermissions.includes(permission) && isTrustedPermissionRequest(webContents)
  })

  if (process.platform === 'darwin') {
    if (systemPreferences.getMediaAccessStatus('microphone') !== 'granted') {
      systemPreferences.askForMediaAccess('microphone')
    }
    if (systemPreferences.getMediaAccessStatus('camera') !== 'granted') {
      systemPreferences.askForMediaAccess('camera')
    }
  }

  ipcMain.handle(
    'secure-save-keys',
    async (_, { groqKey = '', geminiKey = '', nvidiaKey = '' }) => {
      try {
        writeSecureKeysToDisk({ groqKey, geminiKey, nvidiaKey })
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('secure-get-keys', async () => {
    if (!fs.existsSync(secureConfigPath)) return null
    try {
      return readSecureKeysFromDisk()
    } catch (err) {
      return null
    }
  })

  ipcMain.handle('check-keys-exist', () => {
    return fs.existsSync(secureConfigPath)
  })

  ipcMain.handle('get-app-version', () => app.getVersion())

  ipcMain.handle('get-update-feed-url', () => NEXUS_UPDATE_FEED_URL)
  ipcMain.handle('overlay-mode:get', () => isOverlayMode)
  ipcMain.handle('cloud-auth:consume-pending', () => {
    const payload = pendingRendererCloudAuthPayload
    pendingRendererCloudAuthPayload = null
    return payload
  })
  ipcMain.handle('cloud-auth:open-login', async () => {
    const loginUrl = `${NEXUS_WEB_APP_URL}/auth=desktop?desktop=1`

    if (
      !isAllowedExternalUrl(loginUrl, {
        allowedOrigins: NEXUS_WEB_APP_ORIGIN ? [NEXUS_WEB_APP_ORIGIN] : [],
        allowHttpLoopback: is.dev
      })
    ) {
      return { ok: false, error: 'The Nexus website login URL is not trusted.' }
    }

    await shell.openExternal(loginUrl)
    return { ok: true, loginUrl }
  })
  ipcMain.handle('cloud-auth:redeem-code', async (_event, payload) => {
    const userCode = String(payload?.userCode || payload?.code || '').trim().toUpperCase()

    if (!userCode) {
      return { ok: false, error: 'Enter the Nexus desktop code from the website.' }
    }

    try {
      const result = await postDesktopAuth('redeem', { userCode })
      return {
        ok: true,
        accessToken: result.accessToken || '',
        refreshToken: result.refreshToken || '',
        expiresAt: result.expiresAt || '',
        userId: result.userId || '',
        email: result.email || '',
        supabaseUrl: result.supabaseUrl || '',
        supabasePublishableKey: result.supabasePublishableKey || ''
      }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unable to verify the Nexus desktop code.'
      }
    }
  })

  ipcMain.handle('cloud-auth:start', async () => {
    try {
      clearPendingCloudAuth()
      pendingRendererCloudAuthPayload = null
      const authRequest = await postDesktopAuth('start', {
        version: app.getVersion(),
        deviceName: `${app.getName()} ${process.platform}`
      })

      if (
        !authRequest.requestId ||
        !authRequest.deviceCode ||
        !authRequest.userCode ||
        !authRequest.expiresAt ||
        !authRequest.verificationUri
      ) {
        throw new Error('The Nexus website did not return a complete desktop pairing request.')
      }

      const expiresAt = new Date(authRequest.expiresAt).getTime()
      pendingCloudAuthRequest = {
        requestId: authRequest.requestId,
        deviceCode: authRequest.deviceCode,
        userCode: authRequest.userCode,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 1000 * 60 * 10
      }

      if (
        !isAllowedExternalUrl(authRequest.verificationUri, {
          allowedOrigins: NEXUS_WEB_APP_ORIGIN ? [NEXUS_WEB_APP_ORIGIN] : [],
          allowHttpLoopback: is.dev
        })
      ) {
        throw new Error('The desktop authorization URL is not trusted.')
      }

      await shell.openExternal(authRequest.verificationUri)
      startCloudAuthPolling()

      return {
        ok: true,
        requestId: authRequest.requestId,
        userCode: authRequest.userCode,
        url: authRequest.verificationUri,
        expiresAt: authRequest.expiresAt
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open website login.'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('mandatory-update:status', async () => {
    const currentVersion = app.getVersion()

    try {
      const latest = await getLatestUpdateInfo()
      const updateRequired = compareVersions(latest.version, currentVersion) > 0

      return {
        success: true,
        updateRequired,
        currentVersion,
        latestVersion: latest.version,
        releaseDate: latest.releaseDate,
        feedUrl: latest.feedUrl,
        installerUrl: latest.installerUrl
      }
    } catch (error) {
      return {
        success: false,
        updateRequired: false,
        currentVersion,
        latestVersion: currentVersion,
        error: getUpdaterErrorMessage(error)
      }
    }
  })

  ipcMain.handle('check-for-updates', async () => {
    const guardMessage = canUseUpdaterForRequest('Update checks')
    if (guardMessage) {
      const message = guardMessage
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }

    try {
      sendUpdaterEvent('checking')
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (error) {
      const message = getUpdaterErrorMessage(error)
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('check-and-download-update', async () => {
    const guardMessage = canUseUpdaterForRequest('Update downloads')
    if (guardMessage) {
      sendUpdaterEvent('error', {}, guardMessage)
      return { success: false, error: guardMessage }
    }

    try {
      const checkResult = await autoUpdater.checkForUpdates()
      if (!checkResult) {
        const message = 'Updater is not active for this build.'
        sendUpdaterEvent('error', {}, message)
        return { success: false, error: message }
      }

      if (!checkResult.isUpdateAvailable) {
        return {
          success: true,
          updateAvailable: false,
          version: checkResult.updateInfo.version
        }
      }

      if (downloadedUpdateInfo?.version === checkResult.updateInfo.version) {
        sendUpdaterEvent('downloaded', downloadedUpdateInfo)
        return {
          success: true,
          updateAvailable: true,
          downloaded: true,
          version: downloadedUpdateInfo.version
        }
      }

      await downloadCheckedUpdate()
      return {
        success: true,
        updateAvailable: true,
        downloaded: true,
        version: checkResult.updateInfo.version
      }
    } catch (error) {
      const message = getUpdaterErrorMessage(error)
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('download-update', async () => {
    const guardMessage = canUseUpdaterForRequest('Update downloads')
    if (guardMessage) {
      const message = guardMessage
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }

    try {
      await downloadCheckedUpdate()
      return { success: true }
    } catch (error) {
      const message = getUpdaterErrorMessage(error)
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('install-update', () => {
    try {
      if (!downloadedUpdateInfo) {
        const message = 'The update has not finished downloading yet.'
        sendUpdaterEvent('error', {}, message)
        return { success: false, error: message }
      }

      setImmediate(() => {
        isQuitting = true
        app.removeAllListeners('window-all-closed')
        autoUpdater.quitAndInstall(false, true)
      })
      return { success: true }
    } catch (error) {
      const message = getUpdaterErrorMessage(error)
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolUrl(url)
  })

  registerLockSystem()
  registerEmailAuth()
  registerSecurityVault()
  registerPhantomKeyboard()
  registerScreenPeeler()
  registerDropZoneControl(ipcMain)
  registerWorkflowManager()
  registerWebsiteBuilder()
  registerWidgetMaker()
  registerDeepResearch({ ipcMain })
  registerNvidiaAI({ ipcMain })
  registerOracle({ ipcMain })
  registerWormhole({ ipcMain })
  registerPermanentMemory({ ipcMain, app })
  registerTelekinesis({ ipcMain })
  registerNexusCoder({ ipcMain, app })
  registerRealityHacker(ipcMain)
  registerAdbHandlers(ipcMain)
  registerMediaControl(ipcMain)
  registerLocationHandlers(ipcMain)
  registerGmailHandlers(ipcMain)
  registerGalleryHandlers(ipcMain)
  registerterminalControl(ipcMain)
  registerGhostControl(ipcMain)
  registerWebAgent(ipcMain)
  registerNotesHandlers(ipcMain)
  registerAppLauncher(ipcMain)
  registerDirLoader(ipcMain)
  registerFileOpen(ipcMain)
  registerFileSearch(ipcMain)
  registerFileRead(ipcMain)
  registerFileWrite(ipcMain)
  registerFileOps(ipcMain)
  registerFileScanner(ipcMain)
  registerSystemHandlers(ipcMain)
  registerIpcHandlers({ ipcMain, app })

  ipcMain.handle('get-screen-source', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources[0]?.id
  })

  createWindow()
  createTray()
  const launchProtocolUrl = getLaunchProtocolUrl()
  if (launchProtocolUrl) {
    setTimeout(() => handleProtocolUrl(launchProtocolUrl), 1000)
  }

  globalShortcut.register('CommandOrControl+Shift+I', () => toggleOverlayMode())
  globalShortcut.register('Super+Shift+N', () => toggleOverlayMode())
  ipcMain.on('toggle-overlay', () => toggleOverlayMode())
  ipcMain.on('overlay-dock:set-expanded', (_event, expanded: boolean) => {
    setOverlayDockExpanded(Boolean(expanded))
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  tray?.destroy()
  tray = null
  globalShortcut.unregisterAll()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
