import { IpcMain } from 'electron'
import { exec } from 'child_process'
import os from 'os'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => {
      resolve(err ? '' : stdout.trim())
    })
  })
}

let cachedRunningApps: string[] | null = null
let lastRunningAppsFetch = 0

export default function registerFileScanner(ipcMain: IpcMain) {
  ipcMain.removeHandler('get-running-apps')

  ipcMain.handle('get-running-apps', async () => {
    try {
      const now = Date.now()
      if (cachedRunningApps && now - lastRunningAppsFetch < 5000) {
        return cachedRunningApps
      }

      if (os.platform() === 'win32') {
        const cmd = 'tasklist /fo csv /nh'
        const output = await runCommand(cmd)
        const apps = output
          .split(/\r?\n/)
          .map((line) => {
            const match = line.match(/^"([^"]+)"/)
            return match ? match[1].replace(/\.exe$/i, '').trim() : ''
          })
          .filter(Boolean)
        const uniqueApps = [...new Set(apps)]
        cachedRunningApps = uniqueApps
        lastRunningAppsFetch = now
        return uniqueApps
      }

      if (os.platform() === 'darwin') {
        const cmd = `osascript -e 'tell application "System Events" to get name of (processes where background only is false)'`
        const output = await runCommand(cmd)
        const apps = output.split(', ').map((s) => s.trim()).filter(Boolean)
        cachedRunningApps = apps
        lastRunningAppsFetch = now
        return apps
      }

      return [] 
    } catch (e) {
      return []
    }
  })
}
