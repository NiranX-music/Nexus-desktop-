import { IpcMain } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { globalSnapshotManager } from './snapshot-manager'

export default function registerFileOps(ipcMain: IpcMain) {
  ipcMain.handle('file-ops', async (_event, { operation, sourcePath, destPath }) => {
    try {
      const normalizedSource = path.resolve(sourcePath)

      switch (operation) {
        case 'copy':
          if (!destPath) return 'Error: Destination path required for copy.'
          await fs.cp(normalizedSource, path.resolve(destPath), { recursive: true })
          return `Success: Copied to ${destPath}`

        case 'move':
          if (!destPath) return 'Error: Destination path required for move.'
          if (fsSync.existsSync(normalizedSource)) {
            await globalSnapshotManager.takeSnapshot(
              normalizedSource,
              `Pre-move backup before moving to ${destPath}`
            )
          }
          await fs.rename(normalizedSource, path.resolve(destPath))
          return `Success: Moved to ${destPath}`

        case 'delete':
          if (fsSync.existsSync(normalizedSource)) {
            await globalSnapshotManager.takeSnapshot(
              normalizedSource,
              `Pre-deletion backup before deleting ${path.basename(normalizedSource)}`
            )
          }
          await fs.rm(normalizedSource, { recursive: true, force: true })
          return `Success: Deleted ${sourcePath}. Snapshot saved in Time Machine.`

        default:
          return `Error: Unknown operation '${operation}'`
      }
    } catch (err) {
      return `System Error: ${err}`
    }
  })
}
