type RendererIssuePayload = {
  source: string
  severity?: 'info' | 'warning' | 'error' | 'fatal'
  title?: string
  message: string
  errorName?: string
  stack?: string
  context?: Record<string, unknown>
}

const electronAPI = (window as any).electron?.ipcRenderer

let issueReportingInitialized = false

const readCurrentRoute = () => {
  const hashRoute = window.location.hash.replace(/^#/, '')
  if (hashRoute) return hashRoute
  return window.location.pathname || '/'
}

const getCurrentOperator = async () => {
  try {
    const { getVerifiedCloudUser } = await import('@renderer/lib/supabase')
    const user = await getVerifiedCloudUser()
    if (!user) return null
    return {
      userId: user.id,
      userEmail: user.email || ''
    }
  } catch {
    return null
  }
}

export const reportRendererIssue = async (payload: RendererIssuePayload) => {
  if (!electronAPI) return null

  const operator = await getCurrentOperator()

  return electronAPI.invoke('issue-report:submit', {
    scope: 'desktop',
    source: payload.source,
    severity: payload.severity || 'error',
    title: payload.title || payload.message,
    message: payload.message,
    errorName: payload.errorName || '',
    stack: payload.stack || '',
    route: readCurrentRoute(),
    platform: navigator.platform,
    userId: operator?.userId || '',
    userEmail: operator?.userEmail || '',
    context: {
      ...payload.context,
      userAgent: navigator.userAgent
    }
  })
}

export const initializeIssueReporting = () => {
  if (issueReportingInitialized) return
  issueReportingInitialized = true

  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : null
    void reportRendererIssue({
      source: 'renderer-window-error',
      severity: 'error',
      title: error?.name || 'Renderer Error',
      message: error?.message || event.message || 'Unhandled renderer error',
      errorName: error?.name || '',
      stack: error?.stack || '',
      context: {
        filename: event.filename || '',
        line: event.lineno || 0,
        column: event.colno || 0
      }
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const error = reason instanceof Error ? reason : null

    void reportRendererIssue({
      source: 'renderer-unhandled-rejection',
      severity: 'error',
      title: error?.name || 'Unhandled Promise Rejection',
      message:
        error?.message || String(reason || 'A renderer promise rejection was not handled.'),
      errorName: error?.name || '',
      stack: error?.stack || '',
      context: {
        promiseRejection: true
      }
    })
  })
}
