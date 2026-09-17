export const readFile = async (filePath: string) => {
  try {
    return await window.electron.ipcRenderer.invoke('read-file', filePath)
  } catch (err) {
    return `Error: ${err}`
  }
}

export const writeFile = async (fileName: string, content: string) => {
  try {
    return await window.electron.ipcRenderer.invoke('write-file', { fileName, content })
  } catch (err) {
    return `Error: ${err}`
  }
}

export const manageFile = async (
  operation: 'copy' | 'move' | 'delete',
  sourcePath: string,
  destPath?: string
) => {
  try {
    return await window.electron.ipcRenderer.invoke('file-ops', { operation, sourcePath, destPath })
  } catch (err) {
    return `Error: ${err}`
  }
}

export const openFile = async (filePath: string) => {
  try {
    const result = await window.electron.ipcRenderer.invoke('file:open', filePath)
    if (result.success) return 'File opened successfully.'
    return `Error opening file: ${result.error}`
  } catch (err) {
    return `System Error: ${err}`
  }
}

export const readDirectory = async (dirPath: string) => {
  try {
    const result = await window.electron.ipcRenderer.invoke('read-directory', dirPath)
    return result
  } catch (err) {
    return `System Error: ${err}`
  }
}

export const createFolder = async (path: string) => {
  try {
    return (await window.electron.ipcRenderer.invoke('create-directory', path)).success
      ? `✅ Created: ${path}`
      : '❌ Failed.'
  } catch (e) {
    return 'Error'
  }
}

export const patchFile = async (
  filePath: string,
  targetContent: string,
  replacementContent: string,
  allowMultiple = false,
  createIfMissing = false
) => {
  try {
    const res = await window.electron.ipcRenderer.invoke('patch-file', {
      filePath,
      targetContent,
      replacementContent,
      allowMultiple,
      createIfMissing
    })
    if (res.success) {
      return res.message || `✅ Successfully patched ${filePath}`
    }
    return `❌ Patch error: ${res.error}`
  } catch (err) {
    return `System Error: ${err}`
  }
}

export const revertFileSnapshot = async (targetPath?: string) => {
  try {
    const res = await window.electron.ipcRenderer.invoke('time-machine-revert', targetPath)
    if (res.success) {
      return `⏪ Time Machine: ${res.message}`
    }
    return `❌ Revert failed: ${res.message}`
  } catch (err) {
    return `System Error: ${err}`
  }
}

export const listFileSnapshots = async (limit = 20) => {
  try {
    return await window.electron.ipcRenderer.invoke('list-recent-snapshots', limit)
  } catch (err) {
    return []
  }
}

