import { IpcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { globalSandboxManager } from '../security/sandbox-manager'

export default function registerSystemControl(ipcMain: IpcMain) {
  ipcMain.handle('run-shell-command', async (_event, { command, cwd }) => {
    return new Promise((resolve) => {
      // 1. Sandbox Command Firewall Validation
      const validation = globalSandboxManager.validateCommand(command, cwd)
      const broadcastTerminalData = (data: string) => {
        const wins = BrowserWindow.getAllWindows()
        for (const win of wins) {
          if (!win.isDestroyed()) {
            win.webContents.send('terminal-data', data)
          }
        }
      }

      if (!validation.allowed) {
        const errorMsg = `\r\n\x1b[31;1m🛡️ [NEXUS SANDBOX FIREWALL BLOCKED]:\x1b[0m \x1b[31m${validation.reason}\x1b[0m\r\n\x1b[33mCommand:\x1b[0m ${command}\r\n\x1b[32mHost PC filesystem & registry preserved intact.\x1b[0m\r\n\r\n`
        broadcastTerminalData(errorMsg)
        return resolve({
          success: false,
          output: `[NEXUS SANDBOX BLOCKED]: ${validation.reason}`
        })
      }

      const safeCwd = validation.safeCwd

      const child = spawn('powershell.exe', ['-Command', command], {
        cwd: safeCwd,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      child.stdout.on('data', (data) => {
        const output = data.toString()
        broadcastTerminalData(output)
      })

      child.stderr.on('data', (data) => {
        const output = data.toString()
        broadcastTerminalData(`\x1b[31m${output}\x1b[0m`)
      })

      child.on('close', (code) => {
        const msg = `\r\n[Process exited with code ${code}]\r\n`
        broadcastTerminalData(msg)
        resolve({ success: code === 0, output: `Completed with code ${code}` })
      })

      child.on('error', (err) => {
        broadcastTerminalData(`Error: ${err.message}`)
        resolve({ success: false, output: err.message })
      })
    })
  })
}
