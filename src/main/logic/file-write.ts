import { IpcMain } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { globalSnapshotManager } from './snapshot-manager'
import { globalSandboxManager } from '../security/sandbox-manager'

export default function registerFileWrite(ipcMain: IpcMain) {
  ipcMain.handle('write-file', async (_event, { fileName, content }) => {
    try {
      const resolution = globalSandboxManager.resolveWritePath(fileName)
      if (!resolution.allowed) {
        return resolution.error || 'Write blocked by Sandbox.'
      }

      const targetPath = resolution.targetPath

      const targetDir = path.dirname(targetPath)
      if (!fsSync.existsSync(targetDir)) {
        await fs.mkdir(targetDir, { recursive: true })
      }

      if (fsSync.existsSync(targetPath)) {
        await globalSnapshotManager.takeSnapshot(
          targetPath,
          `Pre-write backup before overwriting ${path.basename(targetPath)}`
        )
      }

      await fs.writeFile(targetPath, content, 'utf-8')
      return `Success. File saved to: ${targetPath}`
    } catch (err) {
      return `Error writing file: ${err}`
    }
  })
}
