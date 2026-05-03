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
import registerEmailAuth from './security/email-auth'
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

const secureConfigPath = join(app.getPath('userData'), 'nexus_secure_vault.json')
const NEXUS_UPDATE_FEED_URL =
  process.env.NEXUS_UPDATE_FEED_URL || 'https://nexus-desktop-app.vercel.app/updates/win'

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

const sendUpdaterEvent = (
  status: string,
  data: Record<string, unknown> = {},
  error = ''
) => {
  mainWindow?.webContents.send('updater-event', { status, data, error })
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

app.on('second-instance', (event, commandLine) => {
  if (!event) {
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    const url = commandLine.find((arg) => arg.startsWith('nexus://'))
    if (url) {
      mainWindow.webContents.send('oauth-callback', url)
    }
  }
})

function toggleOverlayMode() {
  if (!mainWindow) return

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  if (isOverlayMode) {
    mainWindow.setResizable(true)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setBounds({ width: 950, height: 670 })
    mainWindow.center()
    mainWindow.webContents.send('overlay-mode', false)
  } else {
    const w = 340
    const h = 70
    mainWindow.setBounds({
      width: w,
      height: h,
      x: Math.floor(width / 2 - w / 2),
      y: height - h - 50
    })
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setResizable(false)
    mainWindow.webContents.send('overlay-mode', true)
  }
  isOverlayMode = !isOverlayMode
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  seedLaunchNvidiaKey()

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.setFeedURL({ provider: 'generic', url: NEXUS_UPDATE_FEED_URL })

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent('checking')
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdaterEvent('available', {
      version: info.version,
      releaseNotes: info.releaseNotes || 'Bug fixes and performance improvements.'
    })
  })

  autoUpdater.on('update-not-available', (info) => {
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
    sendUpdaterEvent('downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes || 'Update downloaded and ready to install.'
    })
  })

  autoUpdater.on('error', (error) => {
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

  ipcMain.handle('secure-save-keys', async (_, { groqKey = '', geminiKey = '', nvidiaKey = '' }) => {
    try {
      writeSecureKeysToDisk({ groqKey, geminiKey, nvidiaKey })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

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

  ipcMain.handle('check-for-updates', async () => {
    if (is.dev && process.env.NEXUS_ALLOW_DEV_UPDATES !== 'true') {
      const message = 'Update checks are available in the installed desktop app.'
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

  ipcMain.handle('download-update', async () => {
    if (is.dev && process.env.NEXUS_ALLOW_DEV_UPDATES !== 'true') {
      const message = 'Update downloads are available in the installed desktop app.'
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }

    try {
      sendUpdaterEvent('downloading', { percent: 0 })
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      const message = getUpdaterErrorMessage(error)
      sendUpdaterEvent('error', {}, message)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('install-update', () => {
    try {
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
    if (mainWindow && url.startsWith('nexus://')) {
      mainWindow.webContents.send('oauth-callback', url)
    }
  })

  registerLockSystem()
  registerSecurityVault()
  registerEmailAuth()
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
