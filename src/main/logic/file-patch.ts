import { IpcMain, app } from 'electron'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { globalSnapshotManager } from './snapshot-manager'

interface PatchFilePayload {
  filePath: string
  targetContent: string
  replacementContent: string
  allowMultiple?: boolean
  createIfMissing?: boolean
}

export function applyChunkPatch(
  originalSource: string,
  targetContent: string,
  replacementContent: string,
  allowMultiple = false
): { patched: string; matchesCount: number } {
  // Normalize line endings for comparison
  const normalizedOriginal = originalSource.replace(/\r\n/g, '\n')
  const normalizedTarget = targetContent.replace(/\r\n/g, '\n')
  const normalizedReplacement = replacementContent.replace(/\r\n/g, '\n')

  // Direct exact match
  if (normalizedOriginal.includes(normalizedTarget)) {
    if (allowMultiple) {
      const parts = normalizedOriginal.split(normalizedTarget)
      return {
        patched: parts.join(normalizedReplacement),
        matchesCount: parts.length - 1
      }
    } else {
      const firstIndex = normalizedOriginal.indexOf(normalizedTarget)
      const patched =
        normalizedOriginal.slice(0, firstIndex) +
        normalizedReplacement +
        normalizedOriginal.slice(firstIndex + normalizedTarget.length)
      return {
        patched,
        matchesCount: 1
      }
    }
  }

  // Tolerant match: trim trailing whitespace on each line
  const trimLines = (text: string) =>
    text
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')

  const tolerantOriginal = trimLines(normalizedOriginal)
  const tolerantTarget = trimLines(normalizedTarget)

  if (tolerantOriginal.includes(tolerantTarget)) {
    const origLines = normalizedOriginal.split('\n')
    const targetLines = normalizedTarget.split('\n').map((l) => l.trimEnd())

    for (let i = 0; i <= origLines.length - targetLines.length; i++) {
      let matched = true
      for (let j = 0; j < targetLines.length; j++) {
        if (origLines[i + j].trimEnd() !== targetLines[j]) {
          matched = false
          break
        }
      }

      if (matched) {
        origLines.splice(i, targetLines.length, ...normalizedReplacement.split('\n'))
        return {
          patched: origLines.join('\n'),
          matchesCount: 1
        }
      }
    }
  }

  return {
    patched: originalSource,
    matchesCount: 0
  }
}

export default function registerFilePatcher(ipcMain: IpcMain) {
  ipcMain.handle(
    'patch-file',
    async (
      _event,
      {
        filePath,
        targetContent,
        replacementContent,
        allowMultiple = false,
        createIfMissing = false
      }: PatchFilePayload
    ) => {
      try {
        if (!filePath) {
          return { success: false, error: 'File path is required.' }
        }

        const isAbsolutePath = filePath.includes('/') || filePath.includes('\\')
        const targetPath = isAbsolutePath ? path.resolve(filePath) : path.join(app.getPath('desktop'), filePath)

        if (!fs.existsSync(targetPath)) {
          if (createIfMissing) {
            const parentDir = path.dirname(targetPath)
            if (!fs.existsSync(parentDir)) {
              await fsPromises.mkdir(parentDir, { recursive: true })
            }
            await fsPromises.writeFile(targetPath, replacementContent, 'utf-8')
            return {
              success: true,
              created: true,
              filePath: targetPath,
              message: `File did not exist. Created new file at: ${targetPath}`
            }
          }
          return {
            success: false,
            error: `File not found: ${targetPath}`
          }
        }

        // Take automatic Time Machine snapshot before applying patch
        const snapshot = await globalSnapshotManager.takeSnapshot(
          targetPath,
          `Pre-patch backup before modifying ${path.basename(targetPath)}`
        )

        const original = await fsPromises.readFile(targetPath, 'utf-8')
        const { patched, matchesCount } = applyChunkPatch(
          original,
          targetContent,
          replacementContent,
          allowMultiple
        )

        if (matchesCount === 0) {
          return {
            success: false,
            error: `Could not locate target content in ${path.basename(targetPath)}. Ensure lines match existing file content.`,
            snapshotId: snapshot?.id
          }
        }

        await fsPromises.writeFile(targetPath, patched, 'utf-8')

        return {
          success: true,
          filePath: targetPath,
          matchesCount,
          snapshotId: snapshot?.id,
          message: `Successfully patched ${path.basename(targetPath)} (${matchesCount} match replaced). Backup secured in Time Machine.`
        }
      } catch (err: any) {
        return {
          success: false,
          error: `Patching failed: ${err?.message || String(err)}`
        }
      }
    }
  )
}
