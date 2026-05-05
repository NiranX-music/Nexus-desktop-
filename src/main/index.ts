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
  systemPreferences
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
import registerNvidiaAI from './services/nvidia-ai'
import registerWidgetMaker from './auto/widget-manager'
import registerWebsiteBuilder from './auto/website-builder'
import registerWorkflowManager from './workflow/workflow-manager'
import registerDropZoneControl from './handlers/SmartDropZone-Handler'
import registerScreenPeeler from './handlers/ScreenPeeler-handler'
import registerPhantomKeyboard from './handlers/PhantomControl-handler'
import registerSecurityVault from './security/Security'
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
let isOverlayMode = false
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
let pendingCloudAuthPollTimer: ReturnType<typeof setInterval> | null = null
let isCloudAuthClaimInFlight = false

const secureConfigPath = join(app.getPath('userData'), 'nexus_secure_vault.json')
const NEXUS_UPDATE_FEED_URL =
  process.env.NEXUS_UPDATE_FEED_URL || 'https://niranx-nexus-agent.vercel.app/updates/win'
const NEXUS_WEB_APP_URL = (
  process.env.NEXUS_WEB_APP_URL || 'https://niranx-nexus-agent.vercel.app'
).replace(/\/+$/, '')
const NEXUS_DESKTOP_AUTH_API_URL = `${NEXUS_WEB_APP_URL}/api/desktop-auth`

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
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }

  return Buffer.from(value).toString('base64')
}

const decryptSecureValue = (value = '') => {
  if (!value) return ''

  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  }

  return Buffer.from(value, 'base64').toString('utf8')
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

  fs.writeFileSync(secureConfigPath, JSON.stringify(secureData))
}

const seedLaunchNvidiaKey = () => {
  const launchNvidiaKey = getLaunchNvidiaApiKey()
  if (!launchNvidiaKey) return

  if (!process.env.NVIDIA_API_KEY) {
    process.env.NVIDIA_API_KEY = launchNvidiaKey
  }

  const existingKeys = readSecureKeysFromDisk()
  if (normalizeNvidiaApiKey(existingKeys.nvidiaKey)) return

  writeSecureKeysToDisk({
    ...existingKeys,
    nvidiaKey: launchNvidiaKey
  })
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
}

const postDesktopAuth = async (
  endpoint: 'start' | 'claim',
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

const sendCloudAuthCallback = (payload: Record<string, unknown>) => {
  mainWindow?.webContents.send('cloud-auth-callback', payload)
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
      email: result.email || ''
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    frame: false,
    transparent: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) mainWindow.show()
  })

  ipcMain.on('window-min', () => mainWindow?.minimize())
  ipcMain.on('window-close', () => mainWindow?.close())
  ipcMain.on('window-max', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
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
      const isValidState =
        pendingCloudAuthState &&
        state === pendingCloudAuthState &&
        Date.now() < pendingCloudAuthExpiresAt

      if (!isValidState) {
        mainWindow.webContents.send('cloud-auth-callback', {
          ok: false,
          error: 'The website authorization code expired. Start login again from Nexus AI.'
        })
        return
      }

      clearCloudAuthPolling()
      pendingCloudAuthState = ''
      pendingCloudAuthExpiresAt = 0
      pendingCloudAuthRequest = null
      mainWindow.webContents.send('cloud-auth-callback', {
        ok: true,
        state,
        accessToken: parsed.searchParams.get('access_token') || '',
        refreshToken: parsed.searchParams.get('refresh_token') || '',
        expiresAt: parsed.searchParams.get('expires_at') || '',
        userId: parsed.searchParams.get('user_id') || '',
        email: parsed.searchParams.get('email') || ''
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
    mainWindow.focus()
    const url = commandLine.find((arg) => arg.startsWith('nexus://'))
    if (url) {
      handleProtocolUrl(url)
    }
  }
})

function toggleOverlayMode() {
  if (!mainWindow) return

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const dockWidth = 760
  const dockHeight = 82
  const cameraClearance = Math.max(38, Math.round(height * 0.055))

  if (isOverlayMode) {
    mainWindow.setResizable(true)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setBounds({ width: 950, height: 670 })
    mainWindow.center()
    mainWindow.webContents.send('overlay-mode', false)
  } else {
    mainWindow.setBounds({
      width: dockWidth,
      height: dockHeight,
      x: Math.floor(width / 2 - dockWidth / 2),
      y: cameraClearance
    })
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(true)
    mainWindow.webContents.send('overlay-mode', true)
  }
  isOverlayMode = !isOverlayMode
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  seedLaunchNvidiaKey()

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

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = [
      'media',
      'audioCapture',
      'videoCapture',
      'desktopVideoCapture',
      'microphone',
      'camera'
    ]
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowedPermissions = [
      'media',
      'audioCapture',
      'videoCapture',
      'desktopVideoCapture',
      'microphone',
      'camera'
    ]
    return allowedPermissions.includes(permission)
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

  ipcMain.handle('cloud-auth:start', async () => {
    try {
      clearPendingCloudAuth()
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

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    delete responseHeaders['content-security-policy']
    delete responseHeaders['x-content-security-policy']
    delete responseHeaders['access-control-allow-origin']

    callback({
      responseHeaders,
      statusLine: details.statusLine
    })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleProtocolUrl(url)
  })

  registerLockSystem()
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

  globalShortcut.register('CommandOrControl+Shift+I', () => toggleOverlayMode())
  globalShortcut.register('Super+Shift+N', () => toggleOverlayMode())
  ipcMain.on('toggle-overlay', () => toggleOverlayMode())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
