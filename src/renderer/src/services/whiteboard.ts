export const WHITEBOARD_WRITE_EVENT = 'nexus:whiteboard-write'
export const WHITEBOARD_NAVIGATE_EVENT = 'nexus:navigate-tab'
export const WHITEBOARD_SAVED_EVENT = 'nexus:whiteboard-saved'
export const WHITEBOARD_STORAGE_KEY = 'nexus_whiteboard_latest'

export interface WhiteboardWritePayload {
  id: string
  title: string
  prompt: string
  content: string
  source: 'command' | 'chat' | 'whiteboard'
  createdAt: string
  docPath?: string
  latestDocPath?: string
  docFolder?: string
  savedAt?: string
}

export interface WhiteboardSaveResult {
  success: boolean
  path?: string
  latestPath?: string
  folder?: string
  savedAt?: string
  skipped?: boolean
  error?: string
}

export const WHITEBOARD_SYSTEM_PROMPT = `
You are Nexus AI writing on a classroom whiteboard.
Create a clear handwritten-board solution.
Use short lines, natural step-by-step reasoning, and plain text explanations.
Use LaTeX for math when it improves clarity. Wrap inline math in $...$ and full equations in $$...$$.
If a diagram will help, put one marker on its own line near the top:
[diagram: lens], [diagram: triangle], [diagram: circle], [diagram: graph], or [diagram: flow].
Avoid markdown tables, code fences, huge paragraphs, and long decorative prose.
Keep the solution compact enough to fit on one whiteboard page.
`

const normalizeBoardText = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ''))
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const isWhiteboardCommand = (command: string) => {
  const text = command.toLowerCase()
  return /\bwhite\s*board\b|\bwhiteboard\b/.test(text) && /\b(write|draw|show|put|solve|solution|answer|explain)\b/.test(text)
}

export const extractWhiteboardQuestion = (command: string) => {
  const stripped = command
    .replace(
      /\s*(?:and\s+)?(?:write|put|show|draw)\s+(?:the\s+|its\s+|my\s+)?(?:solution|answer|steps?)?\s*(?:on|onto|in|to)\s+(?:the\s+)?white\s*board\.?/gi,
      ''
    )
    .replace(/\s*(?:on|onto|in|to)\s+(?:the\s+)?white\s*board\.?/gi, '')
    .replace(/\bwhiteboard\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return stripped || command.trim()
}

export const createWhiteboardTitle = (prompt: string) => {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Whiteboard Solution'
  return clean.length > 54 ? `${clean.slice(0, 51).trim()}...` : clean
}

export const createWhiteboardPayload = (
  prompt: string,
  content: string,
  source: WhiteboardWritePayload['source']
): WhiteboardWritePayload => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: createWhiteboardTitle(prompt),
  prompt,
  content: normalizeBoardText(content),
  source,
  createdAt: new Date().toISOString()
})

export const readLatestWhiteboardPayload = (): WhiteboardWritePayload | null => {
  try {
    const raw = localStorage.getItem(WHITEBOARD_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.content !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

const hasElectronIpc = () =>
  typeof window !== 'undefined' && Boolean(window.electron?.ipcRenderer?.invoke)

export const saveWhiteboardDocument = async (
  payload: WhiteboardWritePayload
): Promise<WhiteboardSaveResult> => {
  if (!payload.content.trim()) {
    return { success: false, skipped: true, error: 'Blank whiteboard was not saved.' }
  }

  if (!hasElectronIpc()) {
    return {
      success: false,
      error: 'Whiteboard document save is only available inside Nexus AI.'
    }
  }

  try {
    return await window.electron.ipcRenderer.invoke('whiteboard:save-doc', payload)
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Unable to save the whiteboard document.'
    }
  }
}

export const publishWhiteboardWrite = async (
  payload: WhiteboardWritePayload
): Promise<WhiteboardSaveResult> => {
  const normalizedPayload = {
    ...payload,
    content: normalizeBoardText(payload.content)
  }

  localStorage.setItem(WHITEBOARD_STORAGE_KEY, JSON.stringify(normalizedPayload))
  window.dispatchEvent(new CustomEvent(WHITEBOARD_WRITE_EVENT, { detail: normalizedPayload }))
  window.dispatchEvent(
    new CustomEvent(WHITEBOARD_NAVIGATE_EVENT, {
      detail: { tab: 'WHITEBOARD', trialTab: 'whiteboard' }
    })
  )

  const saveResult = await saveWhiteboardDocument(normalizedPayload)
  if (!saveResult.success) return saveResult

  const savedPayload: WhiteboardWritePayload = {
    ...normalizedPayload,
    docPath: saveResult.path,
    latestDocPath: saveResult.latestPath,
    docFolder: saveResult.folder,
    savedAt: saveResult.savedAt
  }

  const latestPayload = readLatestWhiteboardPayload()
  if (!latestPayload || latestPayload.id === savedPayload.id) {
    localStorage.setItem(WHITEBOARD_STORAGE_KEY, JSON.stringify(savedPayload))
  }

  window.dispatchEvent(new CustomEvent(WHITEBOARD_SAVED_EVENT, { detail: savedPayload }))
  return saveResult
}
