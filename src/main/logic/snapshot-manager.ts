import { IpcMain, app } from 'electron'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export interface SnapshotRecord {
  id: string
  originalPath: string
  snapshotPath: string
  timestamp: number
  reason: string
  sizeBytes: number
}

const MAX_SNAPSHOTS = 150

export class SnapshotManager {
  private baseDir: string
  private manifestPath: string

  constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'Snapshots')
    this.manifestPath = path.join(this.baseDir, 'snapshot_manifest.json')
    this.ensureDirs()
  }

  private ensureDirs() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true })
    }
  }

  private async loadManifest(): Promise<SnapshotRecord[]> {
    try {
      if (!fs.existsSync(this.manifestPath)) return []
      const data = await fsPromises.readFile(this.manifestPath, 'utf-8')
      return JSON.parse(data) || []
    } catch {
      return []
    }
  }

  private async saveManifest(records: SnapshotRecord[]) {
    try {
      this.ensureDirs()
      await fsPromises.writeFile(this.manifestPath, JSON.stringify(records, null, 2), 'utf-8')
    } catch {}
  }

  async takeSnapshot(filePath: string, reason = 'Pre-mutation backup'): Promise<SnapshotRecord | null> {
    try {
      const normalizedPath = path.resolve(filePath)
      if (!fs.existsSync(normalizedPath)) {
        return null
      }

      const stat = await fsPromises.stat(normalizedPath)
      if (!stat.isFile()) {
        return null
      }

      this.ensureDirs()
      const timestamp = Date.now()
      const pathHash = crypto.createHash('md5').update(normalizedPath).digest('hex').slice(0, 8)
      const baseName = path.basename(normalizedPath)
      const snapshotName = `${timestamp}_${pathHash}_${baseName}`
      const destination = path.join(this.baseDir, snapshotName)

      await fsPromises.copyFile(normalizedPath, destination)

      const record: SnapshotRecord = {
        id: `${timestamp}_${pathHash}`,
        originalPath: normalizedPath,
        snapshotPath: destination,
        timestamp,
        reason,
        sizeBytes: stat.size
      }

      const manifest = await this.loadManifest()
      manifest.unshift(record)

      // Prune snapshots exceeding MAX_SNAPSHOTS
      if (manifest.length > MAX_SNAPSHOTS) {
        const removed = manifest.splice(MAX_SNAPSHOTS)
        for (const item of removed) {
          try {
            if (fs.existsSync(item.snapshotPath)) {
              await fsPromises.unlink(item.snapshotPath)
            }
          } catch {}
        }
      }

      await this.saveManifest(manifest)
      return record
    } catch (err) {
      console.error('[SnapshotManager] Failed to create snapshot:', err)
      return null
    }
  }

  async revert(targetPath?: string): Promise<{ success: boolean; message: string; restoredPath?: string }> {
    try {
      const manifest = await this.loadManifest()
      if (manifest.length === 0) {
        return { success: false, message: 'No snapshots found in Time Machine vault.' }
      }

      let matchIndex = -1
      if (targetPath) {
        const normalizedTarget = path.resolve(targetPath).toLowerCase()
        matchIndex = manifest.findIndex(
          (m) => path.resolve(m.originalPath).toLowerCase() === normalizedTarget
        )
      } else {
        matchIndex = 0
      }

      if (matchIndex === -1) {
        return {
          success: false,
          message: `No snapshot available for path: "${targetPath}"`
        }
      }

      const record = manifest[matchIndex]
      if (!fs.existsSync(record.snapshotPath)) {
        manifest.splice(matchIndex, 1)
        await this.saveManifest(manifest)
        return { success: false, message: 'Snapshot archive file is missing or corrupted.' }
      }

      // Ensure parent directory exists for restoration
      const parentDir = path.dirname(record.originalPath)
      if (!fs.existsSync(parentDir)) {
        await fsPromises.mkdir(parentDir, { recursive: true })
      }

      // Restore the file from the snapshot
      await fsPromises.copyFile(record.snapshotPath, record.originalPath)

      // Remove the reverted snapshot from the stack so subsequent reverts step backward
      manifest.splice(matchIndex, 1)
      await this.saveManifest(manifest)

      const timeAgo = new Date(record.timestamp).toLocaleTimeString()
      return {
        success: true,
        message: `Restored "${path.basename(record.originalPath)}" to state from ${timeAgo} (${record.reason}).`,
        restoredPath: record.originalPath
      }
    } catch (error) {
      return { success: false, message: `Failed to restore snapshot: ${String(error)}` }
    }
  }

  async listRecent(limit = 20): Promise<SnapshotRecord[]> {
    const manifest = await this.loadManifest()
    return manifest.slice(0, limit)
  }
}

export const globalSnapshotManager = new SnapshotManager()

export default function registerSnapshotHandlers(ipcMain: IpcMain) {
  ipcMain.handle('take-file-snapshot', async (_event, { filePath, reason }) => {
    const record = await globalSnapshotManager.takeSnapshot(filePath, reason)
    return { success: Boolean(record), record }
  })

  ipcMain.handle('time-machine-revert', async (_event, targetPath?: string) => {
    return await globalSnapshotManager.revert(targetPath)
  })

  ipcMain.handle('list-recent-snapshots', async (_event, limit = 20) => {
    return await globalSnapshotManager.listRecent(limit)
  })
}
