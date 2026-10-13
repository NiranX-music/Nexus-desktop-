export interface NexusBackupManifest {
  app: string
  version: string
  timestamp: string
  operator: {
    name: string
    email: string
  }
  stats: {
    notesCount: number
    memoriesCount: number
    workflowsCount: number
    hasVault: boolean
  }
}

export interface NexusBackupResult {
  success: boolean
  canceled?: boolean
  error?: string
  filename?: string
  filePath?: string
  manifest?: NexusBackupManifest
  stats?: {
    notesCount: number
    memoriesCount: number
    workflowsCount: number
  }
}

export interface NexusSystemStats {
  notesCount: number
  memoriesCount: number
  workflowsCount: number
  hasVault: boolean
  hasPin: boolean
  faceCount: number
}

const collectClientState = (): Record<string, string> => {
  const result: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('nexus_') || key.includes('supabase') || key.includes('whiteboard'))) {
        const val = localStorage.getItem(key)
        if (val !== null) {
          result[key] = val
        }
      }
    }
  } catch (e) {
    console.warn('[BackupService] Error collecting localStorage:', e)
  }
  return result
}

export const applyRestoredClientState = (settings: Record<string, string>) => {
  if (!settings || typeof settings !== 'object') return
  try {
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string') {
        localStorage.setItem(key, value)
      } else {
        localStorage.setItem(key, JSON.stringify(value))
      }
    }
    window.dispatchEvent(new CustomEvent('nexus-backup-restored', { detail: settings }))
  } catch (e) {
    console.error('[BackupService] Failed to apply restored settings:', e)
  }
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      // remove data:application/zip;base64, prefix
      const base64 = res.includes(',') ? res.split(',')[1] : res
      resolve(base64)
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

export const exportNexusBackup = async (options?: { promptFileSave?: boolean }): Promise<NexusBackupResult> => {
  const electron = (window as any).electron?.ipcRenderer
  const clientData = collectClientState()

  if (electron) {
    const res = await electron.invoke('nexus:export-backup', {
      clientData,
      saveDialog: options?.promptFileSave ?? true
    })

    if (res?.success) {
      localStorage.setItem('nexus_last_backup_date', new Date().toISOString())

      // If base64 was returned without native file save (fallback)
      if (res.base64 && !res.filePath) {
        triggerBrowserDownload(res.base64, res.filename || 'nexus-backup.zip')
      }
    }
    return res
  }

  return { success: false, error: 'Desktop Enclave IPC not available.' }
}

export const importNexusBackup = async (
  fileOrBase64?: File | string,
  options?: { useDialog?: boolean }
): Promise<NexusBackupResult> => {
  const electron = (window as any).electron?.ipcRenderer
  if (!electron) {
    return { success: false, error: 'Desktop Enclave IPC not available.' }
  }

  let payload: { base64?: string; fromDialog?: boolean } = {}

  if (options?.useDialog) {
    payload = { fromDialog: true }
  } else if (fileOrBase64 instanceof File) {
    const base64 = await fileToBase64(fileOrBase64)
    payload = { base64 }
  } else if (typeof fileOrBase64 === 'string') {
    payload = { base64: fileOrBase64 }
  } else {
    payload = { fromDialog: true }
  }

  const res = await electron.invoke('nexus:import-backup', payload)

  if (res?.success) {
    if (res.clientSettings) {
      applyRestoredClientState(res.clientSettings)
    }
    localStorage.setItem('nexus_last_backup_date', new Date().toISOString())
  }

  return res
}

export const getNexusSystemStats = async (): Promise<NexusSystemStats> => {
  const electron = (window as any).electron?.ipcRenderer
  if (electron) {
    try {
      const stats = await electron.invoke('nexus:get-system-stats')
      return stats
    } catch {}
  }
  return {
    notesCount: 0,
    memoriesCount: 0,
    workflowsCount: 0,
    hasVault: false,
    hasPin: false,
    faceCount: 0
  }
}

const triggerBrowserDownload = (base64: string, filename: string) => {
  try {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[BackupService] Download trigger error:', e)
  }
}
