import { IpcMain } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { globalSnapshotManager } from './snapshot-manager'
import { globalSandboxManager } from '../security/sandbox-manager'

export default function registerFileOps(ipcMain: IpcMain) {
  ipcMain.handle('file-ops', async (_event, { operation, sourcePath, destPath }) => {
    try {
      const normalizedSource = path.resolve(sourcePath)

      switch (operation) {
        case 'copy': {
          if (!destPath) return 'Error: Destination path required for copy.'
          const normalizedDest = path.resolve(destPath)
          const writeCheck = globalSandboxManager.validateFileMutation(normalizedDest, 'file_write')
          if (!writeCheck.allowed) return writeCheck.error || 'Copy blocked by Sandbox.'

          const destDir = path.dirname(normalizedDest)
          if (!fsSync.existsSync(destDir)) {
            await fs.mkdir(destDir, { recursive: true })
          }

          await fs.cp(normalizedSource, normalizedDest, { recursive: true })
          return `Success: Copied to ${destPath}`
        }

        case 'move': {
          if (!destPath) return 'Error: Destination path required for move.'
          const normalizedDest = path.resolve(destPath)

          const srcCheck = globalSandboxManager.validateFileMutation(normalizedSource, 'file_delete')
          if (!srcCheck.allowed) return srcCheck.error || 'Move blocked by Sandbox.'

          const destCheck = globalSandboxManager.validateFileMutation(normalizedDest, 'file_write')
          if (!destCheck.allowed) return destCheck.error || 'Move blocked by Sandbox.'

          const destDir = path.dirname(normalizedDest)
          if (!fsSync.existsSync(destDir)) {
            await fs.mkdir(destDir, { recursive: true })
          }

          if (fsSync.existsSync(normalizedSource)) {
            await globalSnapshotManager.takeSnapshot(
              normalizedSource,
              `Pre-move backup before moving to ${destPath}`
            )
          }
          await fs.rename(normalizedSource, normalizedDest)
          return `Success: Moved to ${destPath}`
        }

        case 'delete': {
          const delCheck = globalSandboxManager.validateFileMutation(normalizedSource, 'file_delete')
          if (!delCheck.allowed) return delCheck.error || 'Delete blocked by Sandbox.'

          if (fsSync.existsSync(normalizedSource)) {
            await globalSnapshotManager.takeSnapshot(
              normalizedSource,
              `Pre-deletion backup before deleting ${path.basename(normalizedSource)}`
            )
          }
          await fs.rm(normalizedSource, { recursive: true, force: true })
          return `Success: Deleted ${sourcePath}. Snapshot saved in Time Machine.`
        }

        default:
          return `Error: Unknown operation '${operation}'`
      }
    } catch (err) {
      return `System Error: ${err}`
    }
  })
}
