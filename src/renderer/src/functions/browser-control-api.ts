export interface BrowserControlAction {
  action: string
  detail: string
  ok: boolean
  error?: string
}

export interface BrowserControlResult {
  success: boolean
  summary: string
  actions: BrowserControlAction[]
}

export const runBrowserControlPrompt = async (prompt: string): Promise<BrowserControlResult> => {
  try {
    return await window.electron.ipcRenderer.invoke('browser-control:run', { prompt })
  } catch (error: any) {
    return {
      success: false,
      summary: error?.message || 'Browser control bridge failed.',
      actions: []
    }
  }
}
