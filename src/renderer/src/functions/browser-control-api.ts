export interface BrowserControlAction {
  action: string
  detail: string
  ok: boolean
  error?: string
}

export type BrowserAccessScope = 'tab' | 'tab-group' | 'browser'

export type BrowserRuntimeMode = 'live-bridge' | 'serverless-chromium'

export interface BrowserControlSource {
  title: string
  url: string
  snippet?: string
}

export interface BrowserControlResult {
  success: boolean
  summary: string
  scope: BrowserAccessScope
  runtime?: BrowserRuntimeMode
  actions: BrowserControlAction[]
  sources?: BrowserControlSource[]
  readableText?: string
  title?: string
  url?: string
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

export const runServerlessBrowserPrompt = async (
  prompt: string,
  scope: BrowserAccessScope
): Promise<BrowserControlResult> => {
  try {
    return await window.electron.ipcRenderer.invoke('browser-control:serverless-run', {
      prompt,
      scope
    })
  } catch (error: any) {
    return {
      success: false,
      summary: error?.message || 'Serverless Chromium browser failed.',
      scope,
      runtime: 'serverless-chromium',
      actions: [],
      sources: []
    }
  }
}
