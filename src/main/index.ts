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
  Menu,
  Tray,
  nativeImage
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
import registerWhiteboardDocs from './logic/whiteboard-docs'
import registerWebAgent from './logic/web-agent'
import registerGhostControl from './logic/ghost-control'
import registerterminalControl from './logic/terminal-control'
import registerGalleryHandlers from './logic/gallery-manager'
import registerGmailHandlers from './logic/gmail-manager'
import registerLocationHandlers from './logic/live-location'
import registerAdbHandlers from './logic/adb-manager'
import registerMediaControl from './logic/media-control'
import registerPerformanceGovernor from './logic/performance-governor'
import registerRealityHacker from './logic/reality-hacker'
import registerNexusCoder from './services/nexus-coder'
import registerTelekinesis from './logic/telekinesis'
import registerPermanentMemory from './logic/permanent-memory'
import registerWormhole from './services/wormhole'
import registerOracle from './services/RAG-oracle'
import registerDeepResearch from './services/deep-research'
import registerIssueReporter from './services/issue-reporter'
import registerAiGateway from './services/ai-gateway'
import registerLanceVideo from './services/lance-video'
import registerMobileCommandBridge from './services/mobile-command-bridge'
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
app.setName('Nexus AI 9.1')
app.setPath('userData', join(app.getPath('appData'), 'Nexus AI 9.1'))

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
let dockWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isOverlayMode = false
let dockCollapseTimer: NodeJS.Timeout | null = null
let updateDownloadPromise: Promise<Array<string>> | null = null
let downloadedUpdateInfo: { version: string; releaseNotes: string } | null = null

const CM_TO_PX = 37.8
const DOCK_COLLAPSED_WIDTH = Math.round(5 * CM_TO_PX)
const DOCK_COLLAPSED_HEIGHT = Math.max(8, Math.round(0.2 * CM_TO_PX))
const DOCK_EXPANDED_WIDTH = 620
const DOCK_EXPANDED_HEIGHT = 168

const NEXUS_UPDATE_FEED_URL =
  process.env.NEXUS_UPDATE_FEED_URL || 'https://nexus-desktop-app.vercel.app/updates/win'
const secureConfigPath = join(app.getPath('userData'), 'nexus_secure_vault.json')

const loadLocalEnvFile = () => {
  const candidates = [
    join(path.dirname(process.execPath), '.env.local'),
    join(app.getPath('userData'), '.env.local'),
    join(process.cwd(), '.env.local'),
    join(app.getAppPath(), '.env.local'),
    join(process.resourcesPath || '', '.env.local'),
    join(path.dirname(process.execPath), 'resources', '.env.local')
  ]

  for (const filePath of Array.from(new Set(candidates))) {
    try {
      if (!filePath || !fs.existsSync(filePath)) continue
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const [key, ...rest] = trimmed.split('=')
        if (!key || process.env[key]) continue
        process.env[key] = rest.join('=').replace(/^['"]|['"]$/g, '')
      }
    } catch {}
  }
}

loadLocalEnvFile()

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

const canUseUpdaterForRequest = (action: string) => {
  if (!is.dev || process.env.NEXUS_ALLOW_DEV_UPDATES === 'true') return ''
  return `${action} are available in the installed desktop app.`
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
    title: 'Nexus AI 9.1',
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

function loadRendererRoute(window: BrowserWindow, route = '') {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${route ? `#${route}` : ''}`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), route ? { hash: route } : {})
  }
}

function createDockWindow(): void {
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.show()
    dockWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, x, y } = primaryDisplay.bounds
  const dockWidth = DOCK_COLLAPSED_WIDTH

  dockWindow = new BrowserWindow({
    width: dockWidth,
    height: DOCK_COLLAPSED_HEIGHT,
    x: x + Math.floor((width - dockWidth) / 2),
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false
    }
  })

  dockWindow.setAlwaysOnTop(true, 'screen-saver')
  dockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  dockWindow.on('ready-to-show', () => dockWindow?.showInactive())
  dockWindow.on('closed', () => {
    dockWindow = null
  })

  loadRendererRoute(dockWindow, '/dock')
}

function sendDockCommand(command: string, payload?: any) {
  mainWindow?.webContents.send('dock-command', { command, payload })
  dockWindow?.webContents.send('dock-command', { command, payload })
}

function setDockExpanded(expanded: boolean) {
  if (!dockWindow || dockWindow.isDestroyed()) return
  if (dockCollapseTimer) {
    clearTimeout(dockCollapseTimer)
    dockCollapseTimer = null
  }
  if (!expanded) {
    dockCollapseTimer = setTimeout(() => {
      dockCollapseTimer = null
      setDockBounds(false)
    }, 450)
    return
  }
  setDockBounds(true)
}

function setDockBounds(expanded: boolean) {
  if (!dockWindow || dockWindow.isDestroyed()) return
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, x, y } = primaryDisplay.bounds
  const nextWidth = expanded ? Math.min(DOCK_EXPANDED_WIDTH, Math.max(DOCK_COLLAPSED_WIDTH, width - 40)) : DOCK_COLLAPSED_WIDTH
  const nextHeight = expanded ? DOCK_EXPANDED_HEIGHT : DOCK_COLLAPSED_HEIGHT
  const bounds = dockWindow.getBounds()
  dockWindow.setBounds({
    ...bounds,
    width: nextWidth,
    height: nextHeight,
    x: x + Math.floor((width - nextWidth) / 2),
    y
  })
}

function showDesktopApp() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  if (tray) return
  const image = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(image)
  tray.setToolTip('Nexus AI 9.1')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Start Session', click: () => sendDockCommand('start-session') },
      { label: 'Open Dock', click: () => createDockWindow() },
      { label: 'Close Dock', click: () => dockWindow?.hide() },
      { type: 'separator' },
      { label: 'Open Desktop App', click: () => showDesktopApp() },
      { type: 'separator' },
      { label: 'Quit App', click: () => app.quit() }
    ])
  )
  tray.on('click', () => createDockWindow())
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
  electronApp.setAppUserModelId('com.nexustech.nexusai91')

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

  ipcMain.handle('secure-save-keys', async (_, { groqKey, geminiKey, fireworksKey = '' }) => {
    try {
      let groqEncrypted, geminiEncrypted, fireworksEncrypted

      if (safeStorage.isEncryptionAvailable()) {
        groqEncrypted = safeStorage.encryptString(groqKey).toString('base64')
        geminiEncrypted = safeStorage.encryptString(geminiKey).toString('base64')
        fireworksEncrypted = safeStorage.encryptString(fireworksKey).toString('base64')
      } else {
        groqEncrypted = Buffer.from(groqKey).toString('base64')
        geminiEncrypted = Buffer.from(geminiKey).toString('base64')
        fireworksEncrypted = Buffer.from(fireworksKey).toString('base64')
      }

      const secureData = {
        groq: groqEncrypted,
        gemini: geminiEncrypted,
        fireworks: fireworksEncrypted
      }

      fs.writeFileSync(secureConfigPath, JSON.stringify(secureData))
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('secure-get-keys', async () => {
    if (!fs.existsSync(secureConfigPath)) return null
    try {
      const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
      let groqKey, geminiKey, fireworksKey

      if (safeStorage.isEncryptionAvailable()) {
        groqKey = safeStorage.decryptString(Buffer.from(data.groq, 'base64'))
        geminiKey = safeStorage.decryptString(Buffer.from(data.gemini, 'base64'))
        fireworksKey = data.fireworks
          ? safeStorage.decryptString(Buffer.from(data.fireworks, 'base64'))
          : ''
      } else {
        groqKey = Buffer.from(data.groq, 'base64').toString('utf8')
        geminiKey = Buffer.from(data.gemini, 'base64').toString('utf8')
        fireworksKey = data.fireworks ? Buffer.from(data.fireworks, 'base64').toString('utf8') : ''
      }

      return { groqKey, geminiKey, fireworksKey }
    } catch (err) {
      return null
    }
  })

  ipcMain.handle('check-keys-exist', () => {
    return fs.existsSync(secureConfigPath)
  })

  ipcMain.handle('save-whiteboard-pdf', async (_event, { imageDataUrl, title }) => {
    const annotationDir = join(app.getPath('documents'), 'Annotation')
    fs.mkdirSync(annotationDir, { recursive: true })

    const safeTitle = String(title || 'Nexus Whiteboard')
      .replace(/[<>:"/\\|?*]+/g, '-')
      .slice(0, 80)
    const filename = `${safeTitle}-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`
    const outputPath = join(annotationDir, filename)

    const pdfWindow = new BrowserWindow({
      show: false,
      width: 1240,
      height: 1754,
      webPreferences: {
        sandbox: false
      }
    })

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body { margin: 0; background: white; }
            body { width: 1240px; min-height: 1754px; display: flex; align-items: flex-start; justify-content: center; }
            img { width: 1120px; margin-top: 48px; border: 1px solid #d6efe7; }
          </style>
        </head>
        <body><img src="${imageDataUrl}" /></body>
      </html>`

    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    })
    fs.writeFileSync(outputPath, pdf)
    pdfWindow.close()
    return { success: true, path: outputPath }
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
  registerEmailAuth()
  registerSecurityVault()
  registerPhantomKeyboard()
  registerScreenPeeler()
  registerDropZoneControl(ipcMain)
  registerPerformanceGovernor({ ipcMain, app, getMainWindow: () => mainWindow })
  registerWorkflowManager()
  registerWebsiteBuilder()
  registerWidgetMaker()
  registerAiGateway(ipcMain)
  registerLanceVideo(ipcMain)
  registerMobileCommandBridge({ app, getMainWindow: () => mainWindow })
  registerIssueReporter({
    ipcMain,
    app,
    getMainWindow: () => mainWindow,
    webAppUrl: process.env.NEXUS_WEB_APP_URL || 'https://nexus-desktop-app.vercel.app'
  })
  registerDeepResearch({ ipcMain })
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
  registerWhiteboardDocs({ ipcMain, app })
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

  ipcMain.handle('get-app-version', () => app.getVersion())

  ipcMain.handle('check-for-updates', async () => {
    const guardMessage = canUseUpdaterForRequest('Update checks')
    if (guardMessage) {
      try {
        sendUpdaterEvent('checking')
        const latest = await getLatestUpdateInfo()
        if (compareVersions(latest.version, app.getVersion()) > 0) {
          sendUpdaterEvent('available', {
            version: latest.version,
            releaseNotes: `Installer published ${latest.releaseDate || 'on the Nexus updates page'}.`
          })
        } else {
          sendUpdaterEvent('not-available', { version: latest.version })
        }
        return { success: true, devPreview: true, latestVersion: latest.version }
      } catch (error) {
        const message = getUpdaterErrorMessage(error)
        sendUpdaterEvent('error', {}, message)
        return { success: false, error: message }
      }
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
    const guardMessage = canUseUpdaterForRequest('Update downloads')
    if (guardMessage) {
      sendUpdaterEvent('error', {}, guardMessage)
      return { success: false, error: guardMessage }
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

  createWindow()
  createDockWindow()
  createTray()

  setTimeout(() => {
    void (async () => {
      const guardMessage = canUseUpdaterForRequest('Update checks')
      try {
        sendUpdaterEvent('checking')
        if (guardMessage) {
          const latest = await getLatestUpdateInfo()
          if (compareVersions(latest.version, app.getVersion()) > 0) {
            sendUpdaterEvent('available', {
              version: latest.version,
              releaseNotes: `Installer published ${latest.releaseDate || 'on the Nexus updates page'}.`
            })
          } else {
            sendUpdaterEvent('not-available', { version: latest.version })
          }
          return
        }
        await autoUpdater.checkForUpdates()
      } catch (error) {
        sendUpdaterEvent('error', {}, getUpdaterErrorMessage(error))
      }
    })()
  }, 1800)

  globalShortcut.register('CommandOrControl+Shift+I', () => toggleOverlayMode())
  ipcMain.on('toggle-overlay', () => toggleOverlayMode())
  ipcMain.on('dock-expand', () => setDockExpanded(true))
  ipcMain.on('dock-collapse', () => setDockExpanded(false))
  ipcMain.on('dock-command', (_event, command, payload) => {
    if (command === 'open-dock') createDockWindow()
    else if (command === 'close-dock') dockWindow?.hide()
    else if (command === 'open-desktop') showDesktopApp()
    else if (command === 'quit-app') app.quit()
    else sendDockCommand(command, payload)
  })

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
