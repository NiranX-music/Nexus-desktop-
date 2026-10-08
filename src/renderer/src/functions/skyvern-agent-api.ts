export type SkyvernTaskMode = 'desktop' | 'browser'
export type SkyvernActionType =
  | 'CLICK'
  | 'DOUBLE_CLICK'
  | 'RIGHT_CLICK'
  | 'TYPE'
  | 'PRESS'
  | 'SCROLL'
  | 'WAIT'
  | 'NAVIGATE'
  | 'COMPLETE'
  | 'FAIL'

export interface SkyvernStep {
  stepIndex: number
  action: SkyvernActionType
  thought: string
  coordinate?: { x: number; y: number }
  pixelCoordinate?: { x: number; y: number }
  text?: string
  key?: string
  direction?: 'up' | 'down'
  amount?: number
  url?: string
  screenshotDataUrl?: string
  success: boolean
  error?: string
  timestamp: number
}

export type SkyvernTaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface SkyvernTaskState {
  taskId: string
  goal: string
  mode: SkyvernTaskMode
  status: SkyvernTaskStatus
  currentStep: number
  maxSteps: number
  steps: SkyvernStep[]
  finalResult?: string
  startedAt: number
  completedAt?: number
  lastScreenshot?: string
}

export interface SkyvernConfig {
  skyvernApiUrl: string
  geminiModel: string
  maxSteps: number
  stepDelayMs: number
  smoothMouse: boolean
}

export const startSkyvernTask = async (
  goal: string,
  options: {
    mode?: SkyvernTaskMode
    startUrl?: string
    maxSteps?: number
  } = {}
): Promise<SkyvernTaskState> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:start-task', {
      goal,
      mode: options.mode || 'desktop',
      startUrl: options.startUrl,
      maxSteps: options.maxSteps
    })
  } catch (error: any) {
    return {
      taskId: `error-${Date.now()}`,
      goal,
      mode: options.mode || 'desktop',
      status: 'failed',
      currentStep: 0,
      maxSteps: options.maxSteps || 15,
      steps: [],
      finalResult: error?.message || 'Failed to start screen use task.',
      startedAt: Date.now(),
      completedAt: Date.now()
    }
  }
}

export const stopSkyvernTask = async (): Promise<boolean> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:stop-task')
  } catch {
    return false
  }
}

export const getSkyvernStatus = async (): Promise<SkyvernTaskState | { status: 'idle' }> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:get-status')
  } catch {
    return { status: 'idle' }
  }
}

export const executeSkyvernVisualClick = async (
  description: string
): Promise<{ success: boolean; message: string; clickedAt?: { x: number; y: number } }> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:visual-click', description)
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Visual click failed'
    }
  }
}

export const getSkyvernConfig = async (): Promise<SkyvernConfig> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:get-config')
  } catch {
    return {
      skyvernApiUrl: 'http://localhost:8000',
      geminiModel: 'gemini-3.8-flash',
      maxSteps: 15,
      stepDelayMs: 900,
      smoothMouse: true
    }
  }
}

export const saveSkyvernConfig = async (config: Partial<SkyvernConfig>): Promise<SkyvernConfig> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:save-config', config)
  } catch {
    return {
      skyvernApiUrl: 'http://localhost:8000',
      geminiModel: 'gemini-3.8-flash',
      maxSteps: 15,
      stepDelayMs: 900,
      smoothMouse: true
    }
  }
}

export const captureScreenPreview = async (): Promise<{ dataUrl: string }> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:capture-screen')
  } catch {
    return { dataUrl: '' }
  }
}

export const runSkyvernApiWorkflow = async (payload: {
  url: string
  navigation_goal: string
  data_extraction_goal?: string
}): Promise<any> => {
  try {
    return await window.electron.ipcRenderer.invoke('skyvern:run-api-task', payload)
  } catch (error: any) {
    return { success: false, error: error?.message || 'External screen task failed' }
  }
}

// Aliases
export const startScreenTask = startSkyvernTask
export const stopScreenTask = stopSkyvernTask
export const getScreenStatus = getSkyvernStatus
export const executeScreenVisualClick = executeSkyvernVisualClick
export const getScreenConfig = getSkyvernConfig
export const saveScreenConfig = saveSkyvernConfig
export type ScreenTaskState = SkyvernTaskState
export type ScreenStep = SkyvernStep
export type ScreenConfig = SkyvernConfig
