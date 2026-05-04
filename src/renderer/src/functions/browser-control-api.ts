export interface BrowserControlAction {
  action: string
  detail: string
  ok: boolean
  error?: string
}

export type BrowserAccessScope = 'tab' | 'tab-group' | 'browser'

export interface BrowserControlResult {
  success: boolean
  summary: string
  scope: BrowserAccessScope
  actions: BrowserControlAction[]
}

export const runBrowserControlPrompt = async (
  prompt: string,
  scope: BrowserAccessScope
): Promise<BrowserControlResult> => {
  try {
    return await window.electron.ipcRenderer.invoke('browser-control:run', { prompt, scope })
  } catch (error: any) {
    return {
      success: false,
      summary: error?.message || 'Browser control bridge failed.',
      scope,
      actions: []
    }
  }
}
