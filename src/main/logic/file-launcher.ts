import { IpcMain } from 'electron'
import { exec } from 'child_process'
import os from 'os'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      resolve(err ? '' : stdout.trim())
    })
  })
}

const RUNNING_APPS_CACHE_MS = 15_000
let runningAppsCache: { value: string[]; updatedAt: number } | null = null
let runningAppsRequest: Promise<string[]> | null = null

const getCachedRunningApps = async () => {
  const now = Date.now()
  if (runningAppsCache && now - runningAppsCache.updatedAt < RUNNING_APPS_CACHE_MS) {
    return runningAppsCache.value
  }

  if (runningAppsRequest) return runningAppsRequest

  runningAppsRequest = (async () => {
    try {
      if (os.platform() === 'win32') {
        const cmd = `powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty ProcessName"`
        const output = await runCommand(cmd)
        const apps = output
          .split(/\r?\n/)
          .map((a) => a.trim())
          .filter((a) => a)
        const uniqueApps = [...new Set(apps)]
        runningAppsCache = { value: uniqueApps, updatedAt: Date.now() }
        return uniqueApps
      }

      if (os.platform() === 'darwin') {
        const cmd = `osascript -e 'tell application "System Events" to get name of (processes where background only is false)'`
        const output = await runCommand(cmd)
        const apps = output.split(', ').map((s) => s.trim())
        runningAppsCache = { value: apps, updatedAt: Date.now() }
        return apps
      }

      runningAppsCache = { value: [], updatedAt: Date.now() }
      return []
    } catch {
      return []
    } finally {
      runningAppsRequest = null
    }
  })()

  return runningAppsRequest
}

export default function registerFileScanner(ipcMain: IpcMain) {

  ipcMain.removeHandler('get-running-apps')

  ipcMain.handle('get-running-apps', async () => {
    return getCachedRunningApps()
  })
}
