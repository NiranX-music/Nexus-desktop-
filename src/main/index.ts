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
  nativeImage,
  nativeTheme
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
import registerFilePatcher from './logic/file-patch'
import registerSnapshotHandlers from './logic/snapshot-manager'
import registerVisualGrounding from './logic/visual-grounding'
import registerVisualSentry from './logic/visual-sentry'
import registerKnowledgeGraph from './services/knowledge-graph'
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
import registerWallpaperEngine from './logic/wallpaper-engine'
import registerWhatsAppManager from './logic/whatsapp-manager'
import registerDocForge from './logic/doc-forge'
import registerFocusProtocol from './logic/focus-protocol'
import registerPermanentMemory from './logic/permanent-memory'
import registerWormhole from './services/wormhole'
import registerOracle from './services/RAG-oracle'
import registerDeepResearch from './services/deep-research'
import registerIssueReporter from './services/issue-reporter'
import registerAiGateway from './services/ai-gateway'
import registerMcpHandlers from './services/mcp-manager'
import registerAgentFleet from './services/agent-fleet'
import registerMobileCommandBridge from './services/mobile-command-bridge'
import { registerEcosystemManager } from './services/nexus-ecosystem-manager'
import registerWidgetMaker from './auto/widget-manager'
import registerWebsiteBuilder from './auto/website-builder'
import registerWorkflowManager from './workflow/workflow-manager'
import registerDropZoneControl from './handlers/SmartDropZone-Handler'
import registerScreenPeeler from './handlers/ScreenPeeler-handler'
import registerPhantomKeyboard from './handlers/PhantomControl-handler'
import registerSecurityVault from './security/Security'
import registerSandboxManager from './security/sandbox-manager'
import registerEmailAuth from './security/email-auth'
import registerLockSystem from './security/lock-system'
import registerSkyvernAgent from './services/skyvern-screen-agent'
import { registerDemandSystemCoordinator } from './services/demand-system-coordinator'
import registerBackupManager from './services/backup-manager'
import registerChatHistoryManager from './logic/chat-history-manager'
import { nexusUpdater } from './services/nexus-updater'
import { dockManager } from './logic/dock-manager'

app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization')
app.setName('Nexus AI 9.1')
app.setPath('userData', join(app.getPath('appData'), 'Nexus AI 9.1'))
nativeTheme.themeSource = 'dark'

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
  process.exit(0)
}

function handleDeepLinkUrl(urlStr: string) {
  try {
    const parsed = new URL(urlStr)
    if (parsed.protocol === 'nexus:' && (parsed.hostname === 'auth' || parsed.pathname.includes('auth'))) {
      const key = parsed.searchParams.get('key') || ''
      const token = parsed.searchParams.get('token') || ''
      const user = parsed.searchParams.get('user') || ''

      if (key) {
        try {
          const configPath = join(app.getPath('userData'), 'nexus_secure_vault.json')
          let existing: any = {}
          if (fs.existsSync(configPath)) {
            existing = JSON.parse(fs.readFileSync(configPath, 'utf8'))
          }
          const encrypted = safeStorage.isEncryptionAvailable()
            ? safeStorage.encryptString(key).toString('base64')
            : Buffer.from(key).toString('base64')

          existing.gemini = encrypted
          if (!existing.groq) existing.groq = encrypted
          fs.writeFileSync(configPath, JSON.stringify(existing, null, 2))
          console.log('[DEEP LINK] Stored API key from web bridge.')
        } catch (err) {
          console.error('[DEEP LINK] Failed to store API key:', err)
        }
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('web-auth-bridge:synced', { key, token, user })
      }
    }
  } catch (err) {
    console.error('[DEEP LINK] Error parsing deep link:', err)
  }
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }

  const urlArg = commandLine.find((arg) => arg.startsWith('nexus://'))
  if (urlArg) {
    handleDeepLinkUrl(urlArg)
  }
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLinkUrl(url)
})

let mainWindow: BrowserWindow | null = null
let dockWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isOverlayMode = false
let isQuitting = false
let dockCollapseTimer: NodeJS.Timeout | null = null

const CM_TO_PX = 37.8
const DOCK_COLLAPSED_WIDTH = 204
const DOCK_COLLAPSED_HEIGHT = 40
const DOCK_EXPANDED_WIDTH = 620
const DOCK_EXPANDED_HEIGHT = 188
const DOCK_TOP_MARGIN = 8

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

function createWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showDesktopApp()
    return
  }

  mainWindow = new BrowserWindow({
    title: 'Nexus AI 9.1',
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: '#050505',
    center: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
      webviewTag: true
    }
  })

  nexusUpdater.setMainWindow(mainWindow)
  dockManager.setWindows(dockWindow, mainWindow)

  mainWindow.on('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    console.error('MainWindow failed to load:', errorCode, errorDescription)
  })
  mainWindow.webContents.on('console-message', (_e, _level, message) => {
    console.log('[Renderer]', message)
  })
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer process gone:', details)
  })

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  }, 1200)

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    hideDesktopApp()
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

  const initialBounds = dockManager.computeCollapsedBounds()

  dockWindow = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
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

  dockManager.setWindows(dockWindow, mainWindow)

  dockWindow.setAlwaysOnTop(true, 'screen-saver')
  dockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  dockWindow.on('ready-to-show', () => dockWindow?.showInactive())
  dockWindow.on('closed', () => {
    dockWindow = null
    dockManager.setWindows(null, mainWindow)
  })

  loadRendererRoute(dockWindow, '/dock')

  setTimeout(() => {
    if (dockWindow && !dockWindow.isDestroyed() && !dockWindow.isVisible()) {
      dockWindow.showInactive()
    }
  }, 1500)
}

function sendDockCommand(command: string, payload?: any) {
  mainWindow?.webContents.send('dock-command', { command, payload })
  dockWindow?.webContents.send('dock-command', { command, payload })
}

function setDockExpanded(expanded: boolean) {
  dockManager.setExpanded(expanded)
}

function setDockBounds(_expanded: boolean) {
  dockManager.applyCurrentBounds()
}

function showDesktopApp() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function hideDesktopApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.hide()
}

function requestAppQuit() {
  isQuitting = true
  app.quit()
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
      { label: 'Quit App', click: () => requestAppQuit() }
    ])
  )
  tray.on('click', () => createDockWindow())
}

app.on('second-instance', (_event, commandLine) => {
  showDesktopApp()
  if (mainWindow && !mainWindow.isDestroyed()) {
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
    async (_, { groqKey, geminiKey, fireworksKey = '', puterToken = '' }) => {
      try {
        let groqEncrypted, geminiEncrypted, fireworksEncrypted, puterEncrypted

        if (safeStorage.isEncryptionAvailable()) {
          groqEncrypted = safeStorage.encryptString(groqKey).toString('base64')
          geminiEncrypted = safeStorage.encryptString(geminiKey).toString('base64')
          fireworksEncrypted = safeStorage.encryptString(fireworksKey).toString('base64')
          puterEncrypted = safeStorage.encryptString(puterToken).toString('base64')
        } else {
          groqEncrypted = Buffer.from(groqKey).toString('base64')
          geminiEncrypted = Buffer.from(geminiKey).toString('base64')
          fireworksEncrypted = Buffer.from(fireworksKey).toString('base64')
          puterEncrypted = Buffer.from(puterToken).toString('base64')
        }

        const secureData = {
          groq: groqEncrypted,
          gemini: geminiEncrypted,
          fireworks: fireworksEncrypted,
          puter: puterEncrypted
        }

        fs.writeFileSync(secureConfigPath, JSON.stringify(secureData))
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('secure-get-keys', async () => {
    let groqKey = process.env.GROQ_API_KEY || ''
    let geminiKey = process.env.GEMINI_API_KEY || ''
    let fireworksKey = process.env.FIREWORKS_API_KEY || ''
    let puterToken =
      process.env.PUTER_AUTH_TOKEN || process.env.NEXUS_PUTER_TOKEN || ''

    if (fs.existsSync(secureConfigPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
        if (safeStorage.isEncryptionAvailable()) {
          groqKey = data.groq ? safeStorage.decryptString(Buffer.from(data.groq, 'base64')) : groqKey
          const decryptedGemini = data.gemini ? safeStorage.decryptString(Buffer.from(data.gemini, 'base64')) : ''
          geminiKey = decryptedGemini || geminiKey
          fireworksKey = data.fireworks
            ? safeStorage.decryptString(Buffer.from(data.fireworks, 'base64'))
            : fireworksKey
          puterToken = data.puter
            ? safeStorage.decryptString(Buffer.from(data.puter, 'base64'))
            : puterToken
        } else {
          groqKey = data.groq ? Buffer.from(data.groq, 'base64').toString('utf8') : groqKey
          const decryptedGemini = data.gemini ? Buffer.from(data.gemini, 'base64').toString('utf8') : ''
          geminiKey = decryptedGemini || geminiKey
          fireworksKey = data.fireworks ? Buffer.from(data.fireworks, 'base64').toString('utf8') : fireworksKey
          puterToken = data.puter
            ? Buffer.from(data.puter, 'base64').toString('utf8')
            : puterToken
        }
      } catch (_err) {
        // fallback
      }
    }

    return { groqKey, geminiKey, fireworksKey, puterToken }
  })

  ipcMain.handle('check-keys-exist', () => {
    return true
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
    delete responseHeaders['x-frame-options']
    delete responseHeaders['X-Frame-Options']

    callback({
      responseHeaders,
      statusLine: details.statusLine
    })
  })

  ipcMain.removeHandler('open-external-url')
  ipcMain.handle('open-external-url', async (_event, url: string) => {
    try {
      if (url && typeof url === 'string') {
        await shell.openExternal(url)
        return { success: true }
      }
      return { success: false, error: 'Empty or invalid URL' }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to open external URL' }
    }
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

  registerDemandSystemCoordinator(ipcMain)
  registerBackupManager()
  registerLockSystem()
  registerEmailAuth()
  registerSecurityVault()
  registerSandboxManager(ipcMain)
  registerPhantomKeyboard()
  registerScreenPeeler()
  registerDropZoneControl(ipcMain)
  registerPerformanceGovernor({ ipcMain, app, getMainWindow: () => mainWindow })
  registerWorkflowManager()
  registerWebsiteBuilder()
  registerWidgetMaker()
  registerAiGateway(ipcMain)
  registerChatHistoryManager({ ipcMain, app })
  registerMcpHandlers(ipcMain)
  registerAgentFleet(ipcMain)
  registerMobileCommandBridge({ app, getMainWindow: () => mainWindow })
  registerIssueReporter({
    ipcMain,
    app,
    getMainWindow: () => mainWindow,
    webAppUrl: process.env.NEXUS_WEB_APP_URL || 'https://nexusaix.vercel.app'
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
  registerFilePatcher(ipcMain)
  registerSnapshotHandlers(ipcMain)
  registerVisualGrounding(ipcMain)
  registerVisualSentry(ipcMain)
  registerKnowledgeGraph({ ipcMain, app })
  registerFileOps(ipcMain)
  registerFileScanner(ipcMain)
  registerSystemHandlers(ipcMain)
  registerIpcHandlers({ ipcMain, app })
  registerWallpaperEngine(ipcMain)
  registerWhatsAppManager(ipcMain)
  registerDocForge(ipcMain)
  registerFocusProtocol(ipcMain)
  registerSkyvernAgent(ipcMain, app)
  registerEcosystemManager({ app, getMainWindow: () => mainWindow })
  dockManager.registerIpcHandlers()

  ipcMain.handle('get-screen-source', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources[0]?.id
  })

  ipcMain.handle('get-desktop-sources', async (_event, options?: { types?: ('screen' | 'window')[] }) => {
    try {
      const types = options?.types || ['screen', 'window']
      const sources = await desktopCapturer.getSources({
        types,
        thumbnailSize: { width: 480, height: 270 },
        fetchWindowIcons: true
      })
      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        display_id: source.display_id,
        type: source.id.startsWith('screen:') ? 'screen' : 'window',
        thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : '',
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null
      }))
    } catch (err: any) {
      console.error('[get-desktop-sources] Error fetching desktop sources:', err)
      return []
    }
  })

  ipcMain.handle('get-app-version', () => app.getVersion())

  ipcMain.handle('check-for-updates', async (_event, forceCheck = false) => {
    try {
      const result = await nexusUpdater.checkForUpdates(Boolean(forceCheck))
      return { success: true, ...result }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Check failed.' }
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      return await nexusUpdater.downloadUpdate()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Download failed.' }
    }
  })

  ipcMain.handle('install-update', () => {
    try {
      return nexusUpdater.installUpdate()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Install failed.' }
    }
  })

  ipcMain.handle('defer-update', () => {
    try {
      return nexusUpdater.deferUpdate()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Defer failed.' }
    }
  })

  ipcMain.handle('get-update-status', () => {
    return nexusUpdater.getStatus()
  })

  ipcMain.handle('open-updates-folder', () => {
    nexusUpdater.openUpdatesFolder()
    return { success: true }
  })

  createWindow()
  createDockWindow()
  createTray()

  const appMenu = Menu.buildFromTemplate([
    {
      label: 'Nexus AI',
      submenu: [
        { label: 'About Nexus AI', role: 'about' },
        { type: 'separator' },
        { label: 'Quit App', accelerator: 'CommandOrControl+Q', click: () => requestAppQuit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CommandOrControl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CommandOrControl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CommandOrControl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CommandOrControl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CommandOrControl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CommandOrControl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Interface',
          accelerator: 'CommandOrControl+R',
          click: () => mainWindow?.webContents.reload()
        },
        {
          label: 'Refresh All Systems & Agents',
          accelerator: 'CommandOrControl+Shift+R',
          click: () => {
            mainWindow?.webContents.send('nexus-trigger-refresh-all')
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CommandOrControl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CommandOrControl+=',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const current = mainWindow.webContents.getZoomFactor()
              const next = Math.min(2.0, Math.round((current + 0.1) * 10) / 10)
              mainWindow.webContents.setZoomFactor(next)
              mainWindow.webContents.send('zoom-changed', next)
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const current = mainWindow.webContents.getZoomFactor()
              const next = Math.max(0.5, Math.round((current - 0.1) * 10) / 10)
              mainWindow.webContents.setZoomFactor(next)
              mainWindow.webContents.send('zoom-changed', next)
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CommandOrControl+0',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.setZoomFactor(1.0)
              mainWindow.webContents.send('zoom-changed', 1.0)
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen())
            }
          }
        }
      ]
    }
  ])
  Menu.setApplicationMenu(appMenu)

  ipcMain.handle('window-set-zoom', (event, factor: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, Number(factor) || 1.0))
    event.sender.setZoomFactor(clamped)
    return event.sender.getZoomFactor()
  })

  ipcMain.handle('window-get-zoom', (event) => {
    return event.sender.getZoomFactor()
  })

  ipcMain.handle('window-reload', (event) => {
    event.sender.reload()
    return true
  })

  ipcMain.handle('window-toggle-devtools', (event) => {
    event.sender.toggleDevTools()
    return true
  })

  ipcMain.handle('window-toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      const isFull = !win.isFullScreen()
      win.setFullScreen(isFull)
      return isFull
    }
    return false
  })

  if (mainWindow) {
    nexusUpdater.init(mainWindow)
  }

  setTimeout(() => {
    void nexusUpdater.checkForUpdates().catch((err) => {
      console.warn('[NexusUpdater] Automatic startup check warning:', err)
    })
  }, 3500)

  ipcMain.on('window-min', () => mainWindow?.minimize())
  ipcMain.on('window-close', () => hideDesktopApp())
  ipcMain.on('window-max', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })

  globalShortcut.register('CommandOrControl+Shift+I', () => toggleOverlayMode())
  ipcMain.on('toggle-overlay', () => toggleOverlayMode())
  ipcMain.on('dock-expand', () => setDockExpanded(true))
  ipcMain.on('dock-collapse', () => setDockExpanded(false))
  ipcMain.on('dock-command', (_event, command, payload) => {
    if (command === 'open-dock') createDockWindow()
    else if (command === 'close-dock') dockWindow?.hide()
    else if (command === 'open-desktop') showDesktopApp()
    else if (command === 'quit-app') requestAppQuit()
    else if (command === 'set-dock-config') {
      dockManager.saveConfig(payload)
    } else if (command === 'reposition-dock') {
      dockManager.applyCurrentBounds()
    } else sendDockCommand(command, payload)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  isQuitting = true
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') {
    app.quit()
  }
})
