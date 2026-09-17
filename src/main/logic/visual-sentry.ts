import { IpcMain, BrowserWindow, screen } from 'electron'
import screenshot from 'screenshot-desktop'

export interface SentryWatchPayload {
  label: string
  pollIntervalMs?: number
  maxWaitSec?: number
  triggerOnStabilize?: boolean // alert when screen stops changing (e.g. build finishes)
}

class VisualSentry {
  private activeWatchTimer: NodeJS.Timeout | null = null
  private isWatching = false
  private lastSampleHash = 0
  private stableCount = 0

  private computeSimpleHash(buffer: Buffer): number {
    let hash = 0
    // Sample every 64th byte for ultra-fast perceptual diff
    const step = 64
    for (let i = 0; i < buffer.length; i += step) {
      hash = (hash * 31 + buffer[i]) | 0
    }
    return hash
  }

  async startWatch(payload: SentryWatchPayload): Promise<{ success: boolean; message: string }> {
    this.stopWatch()
    this.isWatching = true
    this.stableCount = 0

    const interval = payload.pollIntervalMs || 2500
    const maxWait = (payload.maxWaitSec || 120) * 1000
    const startTime = Date.now()

    try {
      const initialImg = await screenshot({ format: 'png' })
      this.lastSampleHash = this.computeSimpleHash(initialImg)
    } catch {
      this.isWatching = false
      return { success: false, message: 'Failed to capture initial screen baseline.' }
    }

    this.activeWatchTimer = setInterval(async () => {
      if (!this.isWatching) {
        this.stopWatch()
        return
      }

      if (Date.now() - startTime > maxWait) {
        this.stopWatch()
        this.notify('timeout', `Sentry watch for "${payload.label}" timed out after ${payload.maxWaitSec || 120}s.`)
        return
      }

      try {
        const currentImg = await screenshot({ format: 'png' })
        const currentHash = this.computeSimpleHash(currentImg)
        const changed = currentHash !== this.lastSampleHash
        this.lastSampleHash = currentHash

        if (payload.triggerOnStabilize) {
          if (!changed) {
            this.stableCount++
            if (this.stableCount >= 2) {
              this.stopWatch()
              this.notify('stabilized', `Target "${payload.label}" has stabilized (process completed).`)
            }
          } else {
            this.stableCount = 0
          }
        } else if (changed) {
          this.stopWatch()
          this.notify('change_detected', `Visual change detected on target "${payload.label}".`)
        }
      } catch {}
    }, interval)

    return {
      success: true,
      message: `Visual Sentry active for "${payload.label}". Monitoring screen changes...`
    }
  }

  stopWatch(): boolean {
    if (this.activeWatchTimer) {
      clearInterval(this.activeWatchTimer)
      this.activeWatchTimer = null
    }
    const wasWatching = this.isWatching
    this.isWatching = false
    this.stableCount = 0
    return wasWatching
  }

  private notify(type: string, message: string) {
    const wins = BrowserWindow.getAllWindows()
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('visual-sentry-triggered', { type, message, timestamp: Date.now() })
      }
    }
  }
}

export const globalVisualSentry = new VisualSentry()

export default function registerVisualSentry(ipcMain: IpcMain) {
  ipcMain.handle('sentry:start-watch', async (_event, payload: SentryWatchPayload) => {
    return await globalVisualSentry.startWatch(payload)
  })

  ipcMain.handle('sentry:stop-watch', () => {
    const stopped = globalVisualSentry.stopWatch()
    return { success: true, stopped }
  })
}
