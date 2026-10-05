import { IpcMain, screen } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

function getWindowManager() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { windowManager } = require('node-window-manager')
    return windowManager
  } catch (e) {
    console.warn('[Telekinesis] WindowManager native addon unavailable:', e)
    return null
  }
}

async function teleportWithPowerShell(
  commands: { appName: string; position: string }[],
  bounds: { width: number; height: number; screenX: number; screenY: number }
) {
  const { width, height, screenX, screenY } = bounds
  const halfW = Math.floor(width / 2)
  const halfH = Math.floor(height / 2)

  for (const cmd of commands) {
    let targetX = screenX
    let targetY = screenY
    let targetW = width
    let targetH = height
    let isMax = false

    switch (cmd.position) {
      case 'left':
        targetW = halfW
        break
      case 'right':
        targetX = screenX + halfW
        targetW = halfW
        break
      case 'top-left':
        targetW = halfW
        targetH = halfH
        break
      case 'bottom-left':
        targetY = screenY + halfH
        targetW = halfW
        targetH = halfH
        break
      case 'top-right':
        targetX = screenX + halfW
        targetW = halfW
        targetH = halfH
        break
      case 'bottom-right':
        targetX = screenX + halfW
        targetY = screenY + halfH
        targetW = halfW
        targetH = halfH
        break
      case 'maximize':
        isMax = true
        break
    }

    const psCode = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinUser {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$proc = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*${cmd.appName}*" -or $_.MainWindowTitle -like "*${cmd.appName}*") } | Select-Object -First 1
if ($proc) {
  $h = $proc.MainWindowHandle
  [WinUser]::ShowWindow($h, 9)
  [WinUser]::SetForegroundWindow($h)
  ${isMax ? '[WinUser]::ShowWindow($h, 3)' : `[WinUser]::MoveWindow($h, ${targetX}, ${targetY}, ${targetW}, ${targetH}, $true)`}
}
`
    const encoded = Buffer.from(psCode, 'utf16le').toString('base64')
    await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`).catch(
      () => {}
    )
  }
}

export default function registerTelekinesis({ ipcMain }: { ipcMain: IpcMain }) {
  ipcMain.handle('teleport-windows', async (_event, commands) => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height, x: screenX, y: screenY } = primaryDisplay.workArea
      const wm = getWindowManager()

      if (!wm) {
        if (process.platform === 'win32') {
          await teleportWithPowerShell(commands, { width, height, screenX, screenY })
          return { success: true }
        }
        return { success: false, error: 'Window manager addon is not available.' }
      }

      wm.requestAccessibility()
      const openWindows = wm.getWindows()

      for (const cmd of commands) {
        const validWindows = openWindows.filter(
          (w) =>
            w.isWindow() &&
            w.isVisible() &&
            w.getTitle() !== '' &&
            (w.getTitle().toLowerCase().includes(cmd.appName.toLowerCase()) ||
              w.path.toLowerCase().includes(cmd.appName.toLowerCase()))
        )

        const targetWindow = validWindows[0]

        if (targetWindow) {
          targetWindow.restore()
          targetWindow.bringToTop()

          const halfW = Math.floor(width / 2)
          const halfH = Math.floor(height / 2)

          let newBounds = { x: screenX, y: screenY, width, height }

          switch (cmd.position) {
            case 'left':
              newBounds = { x: screenX, y: screenY, width: halfW, height }
              break
            case 'right':
              newBounds = { x: screenX + halfW, y: screenY, width: halfW, height }
              break
            case 'top-left':
              newBounds = { x: screenX, y: screenY, width: halfW, height: halfH }
              break
            case 'bottom-left':
              newBounds = { x: screenX, y: screenY + halfH, width: halfW, height: halfH }
              break
            case 'top-right':
              newBounds = { x: screenX + halfW, y: screenY, width: halfW, height: halfH }
              break
            case 'bottom-right':
              newBounds = { x: screenX + halfW, y: screenY + halfH, width: halfW, height: halfH }
              break
            case 'maximize':
              targetWindow.maximize()
              continue
          }

          targetWindow.setBounds(newBounds)
        }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
