import { type App, type BrowserWindow, ipcMain, shell } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'

export interface SubsystemStatus {
  puterServer: {
    online: boolean
    port: number
    url: string
    pid?: number
  }
  fastAgent: {
    online: boolean
    pid?: number
  }
  mobileBridge: {
    online: boolean
    port: number
  }
  autoStart: boolean
}

type EcosystemOptions = {
  app: App
  getMainWindow: () => BrowserWindow | null
}

let puterProcess: ChildProcess | null = null
let fastAgentProcess: ChildProcess | null = null
let ecosystemInitialized = false

/**
 * Discovers the best available Python executable.
 */
export function findPythonExecutable(appPath: string): string {
  const candidates = [
    path.resolve(appPath, '..', '.venv', 'Scripts', 'python.exe'),
    path.resolve(appPath, '..', '..', '.venv', 'Scripts', 'python.exe'),
    path.resolve(appPath, '.venv', 'Scripts', 'python.exe'),
    path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
    path.resolve(process.cwd(), '..', '.venv', 'Scripts', 'python.exe')
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return process.platform === 'win32' ? 'python' : 'python3'
}

/**
 * Checks whether an HTTP port is responding.
 */
function checkPortOpen(port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, { timeout: timeoutMs }, (res) => {
      resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

/**
 * Finds a target script file across likely repository root locations.
 */
function findScriptPath(appPath: string, relativePath: string): string | null {
  const candidates = [
    path.resolve(appPath, '..', relativePath),
    path.resolve(appPath, '..', '..', relativePath),
    path.resolve(appPath, relativePath),
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '..', relativePath)
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Launches the Puter AI Chat HTTP Server on port 8088.
 */
export async function launchPuterServer(appPath: string): Promise<boolean> {
  const isAlreadyOpen = await checkPortOpen(8088)
  if (isAlreadyOpen) {
    console.log('[Nexus Ecosystem] Puter AI server is already running on port 8088.')
    return true
  }

  const serverScript = findScriptPath(appPath, path.join('nexus-puter-chat', 'server.py'))
  if (!serverScript) {
    console.warn('[Nexus Ecosystem] Could not locate nexus-puter-chat/server.py')
    return false
  }

  const python = findPythonExecutable(appPath)
  const scriptDir = path.dirname(serverScript)

  try {
    puterProcess = spawn(python, [serverScript, '--no-browser'], {
      cwd: scriptDir,
      detached: false,
      stdio: 'pipe',
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    })

    puterProcess.stdout?.on('data', (d) => {
      console.log(`[Puter Server stdout] ${d.toString().trim()}`)
    })

    puterProcess.stderr?.on('data', (d) => {
      console.warn(`[Puter Server stderr] ${d.toString().trim()}`)
    })

    puterProcess.on('exit', (code) => {
      console.log(`[Puter Server] Process exited with code ${code}`)
      puterProcess = null
    })

    console.log(`[Nexus Ecosystem] Launched Puter AI server (PID: ${puterProcess.pid}) on http://localhost:8088`)
    return true
  } catch (err: any) {
    console.error('[Nexus Ecosystem] Failed to launch Puter server:', err?.message)
    return false
  }
}

/**
 * Launches the Nexus Fast Desktop Agent Daemon (Edge Bridge).
 */
export async function launchFastAgent(appPath: string): Promise<boolean> {
  if (fastAgentProcess && !fastAgentProcess.killed) {
    console.log('[Nexus Ecosystem] Fast Desktop Agent is already running.')
    return true
  }

  const agentScript =
    findScriptPath(appPath, path.join('desktop_agent', 'nexus_fast_agent.py')) ||
    findScriptPath(appPath, path.join('Nexus-desktop-', 'desktop_agent', 'nexus_fast_agent.py'))

  if (!agentScript) {
    console.warn('[Nexus Ecosystem] Could not locate desktop_agent/nexus_fast_agent.py')
    return false
  }

  const python = findPythonExecutable(appPath)
  const scriptDir = path.dirname(agentScript)

  try {
    fastAgentProcess = spawn(python, [agentScript], {
      cwd: scriptDir,
      detached: false,
      stdio: 'pipe',
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    })

    fastAgentProcess.stdout?.on('data', (d) => {
      const line = d.toString().trim()
      if (line) console.log(`[Fast Agent stdout] ${line}`)
    })

    fastAgentProcess.stderr?.on('data', (d) => {
      const line = d.toString().trim()
      if (line) console.warn(`[Fast Agent stderr] ${line}`)
    })

    fastAgentProcess.on('exit', (code) => {
      console.log(`[Fast Agent] Process exited with code ${code}`)
      fastAgentProcess = null
    })

    console.log(`[Nexus Ecosystem] Launched Nexus Fast Agent daemon (PID: ${fastAgentProcess.pid})`)
    return true
  } catch (err: any) {
    console.error('[Nexus Ecosystem] Failed to launch Fast Agent:', err?.message)
    return false
  }
}

/**
 * Stops all spawned background processes safely.
 */
export function shutdownEcosystem(): void {
  if (puterProcess) {
    try {
      if (process.platform === 'win32' && puterProcess.pid) {
        spawn('taskkill', ['/pid', puterProcess.pid.toString(), '/f', '/t'], { windowsHide: true })
      } else {
        puterProcess.kill()
      }
    } catch {}
    puterProcess = null
  }

  if (fastAgentProcess) {
    try {
      if (process.platform === 'win32' && fastAgentProcess.pid) {
        spawn('taskkill', ['/pid', fastAgentProcess.pid.toString(), '/f', '/t'], { windowsHide: true })
      } else {
        fastAgentProcess.kill()
      }
    } catch {}
    fastAgentProcess = null
  }
}

/**
 * Registers ecosystem coordinators and starts all Nexus background systems on app launch.
 */
export function registerEcosystemManager({ app, getMainWindow }: EcosystemOptions): void {
  if (ecosystemInitialized) return
  ecosystemInitialized = true

  const appPath = app.getAppPath()

  // Auto-launch all background subsystems when Nexus is launched!
  setTimeout(async () => {
    console.log('[Nexus Ecosystem] Launching all ecosystem subsystems...')
    await Promise.allSettled([
      launchPuterServer(appPath),
      launchFastAgent(appPath)
    ])

    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('ecosystem-status-changed', {
        puter: Boolean(puterProcess),
        fastAgent: Boolean(fastAgentProcess)
      })
    }
  }, 1200)

  // Ensure all child processes are killed when Nexus app quits
  app.on('before-quit', () => {
    console.log('[Nexus Ecosystem] Nexus is quitting. Shutting down all background subsystems...')
    shutdownEcosystem()
  })

  app.on('will-quit', () => {
    shutdownEcosystem()
  })

  // IPC Handlers for renderer telemetry & controls
  ipcMain.handle('ecosystem:get-status', async (): Promise<SubsystemStatus> => {
    const puterOnline = await checkPortOpen(8088)
    const mobileBridgeOnline = await checkPortOpen(17173)

    return {
      puterServer: {
        online: puterOnline,
        port: 8088,
        url: 'http://localhost:8088',
        pid: puterProcess?.pid
      },
      fastAgent: {
        online: Boolean(fastAgentProcess && !fastAgentProcess.killed),
        pid: fastAgentProcess?.pid
      },
      mobileBridge: {
        online: mobileBridgeOnline,
        port: 17173
      },
      autoStart: true
    }
  })

  ipcMain.handle('ecosystem:start-all', async () => {
    await Promise.allSettled([
      launchPuterServer(appPath),
      launchFastAgent(appPath)
    ])
    return { success: true }
  })

  ipcMain.handle('ecosystem:stop-all', async () => {
    shutdownEcosystem()
    return { success: true }
  })

  ipcMain.handle('ecosystem:restart-subsystem', async (_e, name: 'puter' | 'fastAgent') => {
    if (name === 'puter') {
      if (puterProcess) {
        try { puterProcess.kill() } catch {}
        puterProcess = null
      }
      const ok = await launchPuterServer(appPath)
      return { success: ok }
    } else if (name === 'fastAgent') {
      if (fastAgentProcess) {
        try { fastAgentProcess.kill() } catch {}
        fastAgentProcess = null
      }
      const ok = await launchFastAgent(appPath)
      return { success: ok }
    }
    return { success: false }
  })

  ipcMain.handle('ecosystem:open-puter-chat', async () => {
    await shell.openExternal('http://localhost:8088')
    return { success: true }
  })
}
