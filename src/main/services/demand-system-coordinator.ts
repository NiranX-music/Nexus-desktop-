import { IpcMain } from 'electron'

interface ServiceState {
  id: string
  name: string
  status: 'dormant' | 'active' | 'hibernated'
  estimatedRamMb: number
  lastActive: number
}

const BACKEND_SERVICES: Record<string, ServiceState> = {
  'adb-polling': {
    id: 'adb-polling',
    name: 'Android Debug Bridge Daemon',
    status: 'dormant',
    estimatedRamMb: 45,
    lastActive: 0
  },
  'visual-sentry': {
    id: 'visual-sentry',
    name: 'Autonomous Visual Sentry Watcher',
    status: 'dormant',
    estimatedRamMb: 60,
    lastActive: 0
  },
  'skyvern-agent': {
    id: 'skyvern-agent',
    name: 'Skyvern Screen & Vision Agent',
    status: 'dormant',
    estimatedRamMb: 80,
    lastActive: 0
  },
  'knowledge-graph': {
    id: 'knowledge-graph',
    name: 'Local Knowledge Graph AST Indexer',
    status: 'dormant',
    estimatedRamMb: 55,
    lastActive: 0
  },
  'terminal-pty': {
    id: 'terminal-pty',
    name: 'PTY Process Spawner',
    status: 'dormant',
    estimatedRamMb: 40,
    lastActive: 0
  }
}

export function registerDemandSystemCoordinator(ipcMain: IpcMain) {
  ipcMain.handle('nexus-demand:get-telemetry', () => {
    let dormantCount = 0
    let activeCount = 0
    let ramSaved = 0

    const services = Object.values(BACKEND_SERVICES).map((s) => {
      if (s.status === 'dormant' || s.status === 'hibernated') {
        dormantCount++
        ramSaved += s.estimatedRamMb
      } else {
        activeCount++
      }
      return { ...s }
    })

    return {
      success: true,
      services,
      activeCount,
      dormantCount,
      ramSavedMb: ramSaved
    }
  })

  ipcMain.handle('nexus-demand:activate-service', (_event, serviceId: string) => {
    const s = BACKEND_SERVICES[serviceId]
    if (s) {
      s.status = 'active'
      s.lastActive = Date.now()
      console.log(`[DemandCoordinator] Backend service "${s.name}" activated on demand.`)
      return { success: true, service: s }
    }
    return { success: false, error: 'Service not found' }
  })

  ipcMain.handle('nexus-demand:hibernate-service', (_event, serviceId: string) => {
    const s = BACKEND_SERVICES[serviceId]
    if (s) {
      s.status = 'hibernated'
      console.log(`[DemandCoordinator] Backend service "${s.name}" hibernated.`)
      return { success: true, service: s }
    }
    return { success: false, error: 'Service not found' }
  })
}
