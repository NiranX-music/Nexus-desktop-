export type AgentRole = 'recon_scout' | 'code_architect' | 'system_janitor' | 'sentry_watcher'

export interface FleetAgentState {
  role: AgentRole
  name: string
  title: string
  status: 'idle' | 'running' | 'completed' | 'error'
  currentTask?: string
  progress: number
  lastUpdated: number
  logs: string[]
}

export interface AgentTaskResult {
  role: AgentRole
  taskId: string
  success: boolean
  output: string
  completedAt: number
}

export const getFleetStatus = async (): Promise<FleetAgentState[]> => {
  try {
    return (await window.electron.ipcRenderer.invoke('fleet-get-status')) || []
  } catch {
    return []
  }
}

export const dispatchFleetTask = async (
  role: AgentRole,
  directive: string,
  geminiKey?: string,
  groqKey?: string
): Promise<AgentTaskResult> => {
  try {
    return await window.electron.ipcRenderer.invoke('fleet-dispatch-task', {
      role,
      directive,
      geminiKey,
      groqKey
    })
  } catch (err: any) {
    return {
      role,
      taskId: `error_${Date.now()}`,
      success: false,
      output: err?.message || String(err),
      completedAt: Date.now()
    }
  }
}

export const onFleetStatusUpdate = (callback: (agents: FleetAgentState[]) => void) => {
  const handler = (_event: any, data: FleetAgentState[]) => callback(data)
  window.electron.ipcRenderer.on('fleet-status-update', handler)
  return () => {
    window.electron.ipcRenderer.removeListener('fleet-status-update', handler)
  }
}

export const onFleetTaskComplete = (callback: (result: AgentTaskResult) => void) => {
  const handler = (_event: any, data: AgentTaskResult) => callback(data)
  window.electron.ipcRenderer.on('fleet-task-complete', handler)
  return () => {
    window.electron.ipcRenderer.removeListener('fleet-task-complete', handler)
  }
}
