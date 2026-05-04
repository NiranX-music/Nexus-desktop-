export interface SystemStats {
  cpu: string
  memory: {
    total: string
    free: string
    usedPercentage: string
  }
  temperature: number | null
  battery: {
    isPresent: boolean
    percentage: number | null
    isCharging: boolean
    isOnBattery: boolean
    status: string
    estimatedMinutes: number | null
  }
  network: {
    rxBytesPerSecond: number
    txBytesPerSecond: number
    totalBytesPerSecond: number
    activeInterfaces: number
    updatedAt: number
  }
  os: {
    type: string
    release: string
    arch: string
    uptime: string
  }
}

export interface AppItem {
  name: string
  id: string
}

export const getSystemStatus = async (): Promise<SystemStats | null> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-system-stats')
  } catch (error) {
    return null
  }
}

export const getAllApps = async (): Promise<AppItem[]> => {
  try {
    const apps = await window.electron.ipcRenderer.invoke('get-installed-apps')
    return Array.isArray(apps) ? apps : []
  } catch (error) {
    return []
  }
}

export const getDrives = async (): Promise<any[]> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-drives')
  } catch (error) {
    return []
  }
}
