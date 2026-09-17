import { IpcMain, app } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { globalSnapshotManager } from './snapshot-manager'

export default function registerFileWrite(ipcMain: IpcMain) {
  ipcMain.handle('write-file', async (_event, { fileName, content }) => {
    try {
      const isAbsolutePath = fileName.includes('/') || fileName.includes('\\')

      const targetPath = isAbsolutePath ? path.resolve(fileName) : path.join(app.getPath('desktop'), fileName)

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
