import { app as electronApp, ipcMain as electronIpcMain, WebContents } from 'electron'
import type { BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'

type IssueSeverity = 'info' | 'warning' | 'error' | 'fatal'

type IssueReportPayload = {
  scope?: 'desktop' | 'web'
  source?: string
  severity?: IssueSeverity
  title?: string
  message?: string
  errorName?: string
  stack?: string
  route?: string
  userId?: string
  userEmail?: string
  context?: Record<string, unknown>
  platform?: string
  osRelease?: string
}

type RegisterIssueReporterOptions = {
  ipcMain: typeof electronIpcMain
  app: typeof electronApp
  getMainWindow: () => BrowserWindow | null
  webAppUrl: string
}

const ISSUE_DEDUPE_WINDOW_MS = 15_000
const MAX_TRACKED_ISSUES = 120
const issueTimestamps = new Map<string, number>()

const normalizeText = (value = '', max = 3000) => String(value || '').trim().slice(0, max)

const normalizeContext = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch {
    return {}
  }
}

const pruneIssueCache = (now: number) => {
  for (const [key, timestamp] of issueTimestamps) {
    if (now - timestamp > ISSUE_DEDUPE_WINDOW_MS) {
      issueTimestamps.delete(key)
    }
  }

  if (issueTimestamps.size <= MAX_TRACKED_ISSUES) return

  const oldestEntries = [...issueTimestamps.entries()].sort((left, right) => left[1] - right[1])
  for (const [key] of oldestEntries.slice(0, issueTimestamps.size - MAX_TRACKED_ISSUES)) {
    issueTimestamps.delete(key)
  }
}

const buildIssueFingerprint = (payload: IssueReportPayload) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        scope: payload.scope || 'desktop',
        source: payload.source || 'unknown',
        severity: payload.severity || 'error',
        title: normalizeText(payload.title || '', 240),
        message: normalizeText(payload.message || '', 4000),
        stack: normalizeText(payload.stack || '', 1200)
      })
    )
    .digest('hex')

const buildIssuePayload = (
  payload: IssueReportPayload,
  options: RegisterIssueReporterOptions
): IssueReportPayload => {
  const mainWindow = options.getMainWindow()
  const route =
    normalizeText(payload.route || '', 260) ||
    normalizeText(mainWindow?.webContents.getURL() || '', 260) ||
    ''

  return {
    scope: payload.scope || 'desktop',
    source: normalizeText(payload.source || 'unknown', 80) || 'unknown',
    severity: (['info', 'warning', 'error', 'fatal'].includes(payload.severity || '')
      ? payload.severity
      : 'error') as IssueSeverity,
    title: normalizeText(payload.title || payload.message || 'Desktop issue', 200),
    message: normalizeText(payload.message || 'Unknown desktop issue', 4000),
    errorName: normalizeText(payload.errorName || '', 160),
    stack: normalizeText(payload.stack || '', 12000),
    route,
    userId: normalizeText(payload.userId || '', 80),
    userEmail: normalizeText(payload.userEmail || '', 240),
    platform: normalizeText(payload.platform || process.platform, 120),
    osRelease: normalizeText(payload.osRelease || process.getSystemVersion?.() || '', 120),
    context: {
      ...(normalizeContext(payload.context) || {}),
      releaseChannel: options.app.isPackaged ? 'packaged' : 'development',
      appVersion: options.app.getVersion()
    }
  }
}

const postIssueReport = async (
  payload: IssueReportPayload,
  options: RegisterIssueReporterOptions
) => {
  const normalizedPayload = buildIssuePayload(payload, options)
  const now = Date.now()
  const fingerprint = buildIssueFingerprint(normalizedPayload)
  pruneIssueCache(now)

  const lastSentAt = issueTimestamps.get(fingerprint) || 0
  if (now - lastSentAt < ISSUE_DEDUPE_WINDOW_MS) {
    return { ok: true, skipped: true }
  }

  issueTimestamps.set(fingerprint, now)

  const endpoint = `${options.webAppUrl.replace(/\/+$/, '')}/api/issues/report`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-nexus-client': 'desktop'
    },
    body: JSON.stringify({
      ...normalizedPayload,
      appVersion: options.app.getVersion()
    })
  })

  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Issue report endpoint returned ${response.status}.`)
  }

  return data
}

const buildErrorMessage = (reason: unknown) => {
  if (reason instanceof Error) {
    return {
      title: reason.name || 'Desktop Error',
      message: reason.message || 'Desktop error',
      errorName: reason.name || 'Error',
      stack: reason.stack || ''
    }
  }

  return {
    title: 'Desktop Error',
    message: normalizeText(String(reason || 'Unknown desktop issue'), 4000),
    errorName: '',
    stack: ''
  }
}

export default function registerIssueReporter(options: RegisterIssueReporterOptions) {
  const submitIssue = async (payload: IssueReportPayload) => {
    try {
      return await postIssueReport(payload, options)
    } catch (error) {
      console.error('Nexus issue reporting failed:', error)
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to send issue report.'
      }
    }
  }

  options.ipcMain.handle('issue-report:submit', async (_event, payload: IssueReportPayload = {}) => {
    return submitIssue(payload)
  })

  process.on('unhandledRejection', (reason) => {
    const issue = buildErrorMessage(reason)
    void submitIssue({
      source: 'main-unhandled-rejection',
      severity: 'error',
      ...issue
    })
  })

  process.on('uncaughtException', (error) => {
    const issue = buildErrorMessage(error)
    void submitIssue({
      source: 'main-uncaught-exception',
      severity: 'fatal',
      ...issue
    })
  })

  options.app.on('web-contents-created', (_event, contents: WebContents) => {
    if (contents.getType() !== 'window') return

    contents.on('render-process-gone', (_goneEvent, details) => {
      void submitIssue({
        source: 'renderer-process-gone',
        severity: details.reason === 'crashed' ? 'fatal' : 'error',
        title: 'Renderer process exited',
        message: `Renderer process exited: ${details.reason}`,
        context: {
          exitCode: details.exitCode,
          reason: details.reason
        },
        route: contents.getURL()
      })
    })

    contents.on('unresponsive', () => {
      void submitIssue({
        source: 'renderer-unresponsive',
        severity: 'warning',
        title: 'Renderer became unresponsive',
        message: 'The renderer process stopped responding.',
        route: contents.getURL()
      })
    })
  })
}
