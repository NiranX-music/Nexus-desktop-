export const WHITEBOARD_WRITE_EVENT = 'nexus:whiteboard-write'
export const WHITEBOARD_NAVIGATE_EVENT = 'nexus:navigate-tab'
export const WHITEBOARD_SAVED_EVENT = 'nexus:whiteboard-saved'
export const WHITEBOARD_STORAGE_KEY = 'nexus_whiteboard_latest'

export type WhiteboardMode = 'marker_ink' | 'diagram' | 'hybrid' | 'text'
export type WhiteboardColor =
  | 'black'
  | 'grey'
  | 'light-violet'
  | 'violet'
  | 'blue'
  | 'light-blue'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'light-green'
  | 'light-red'
  | 'red'

export interface WhiteboardWritePayload {
  id: string
  title: string
  prompt: string
  content: string
  source: 'command' | 'chat' | 'whiteboard'
  createdAt: string
  mode?: WhiteboardMode
  color?: WhiteboardColor
  size?: 's' | 'm' | 'l' | 'xl'
  diagram?: string
  append?: boolean
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
You are Nexus AI writing on a high-tech smart whiteboard with full marker pen handwriting & shape drawing capabilities.
You have the ability to write in authentic marker ink handwriting, draw educational/technical diagrams, and sketch geometric shapes.

Output Guidelines:
1. Marker Handwriting:
   - If the user asks to write, solve, or show text in marker/pen handwriting, use clear, step-by-step lines.
   - You can include [mode: marker_ink] or [mode: hybrid] at the top.
2. Shapes & Diagrams:
   - To invoke the best specialized diagram, specify one tag near the top:
     [diagram: flow] - Process flowchart with start, decision, branches, and end
     [diagram: architecture] - Full edge-to-desktop / cloudflare system diagram
     [diagram: neural] - Neural network with input, hidden, output layers and synapses
     [diagram: graph] - Coordinate plane (X-Y) with function plots (sin, x^2)
     [diagram: lens] - Optics convex lens with ray tracing and focal points
     [diagram: circuit] - DC circuit with battery, resistor, switch, and current
     [diagram: geometry] - Pythagorean right triangle proof with formulas
     [diagram: chemistry] - Benzene ring and molecular resonance
     [diagram: mindmap] - Central concept with radiating topic branches
3. Color & Styling:
   - You can specify [color: green], [color: blue], [color: violet], [color: orange], [color: red], or [color: black].
   - Wrap inline math in $...$ and key equations on their own lines.
4. Keep the output organized, concise, and whiteboard-ready.
`

const normalizeBoardText = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ''))
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const isWhiteboardCommand = (command: string) => {
  const text = command.toLowerCase()
  return (
    /\bwhite\s*board\b|\bwhiteboard\b|\bboard\b/.test(text) &&
    /\b(write|draw|sketch|show|put|solve|solution|answer|explain|diagram|graph|flowchart|shape|formula|marker|pen|ink)\b/.test(
      text
    )
  )
}

export const extractWhiteboardQuestion = (command: string) => {
  const stripped = command
    .replace(
      /\s*(?:and\s+)?(?:write|put|show|draw|sketch)\s+(?:the\s+|its\s+|my\s+)?(?:solution|answer|steps?|diagram|shape|graph)?\s*(?:on|onto|in|to)\s+(?:the\s+)?(?:white\s*board|board)\.?/gi,
      ''
    )
    .replace(/\s*(?:on|onto|in|to)\s+(?:the\s+)?(?:white\s*board|board)\.?/gi, '')
    .replace(/\bwhiteboard\b/gi, '')
    .replace(/\bwhite\s*board\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return stripped || command.trim()
}

export const extractWhiteboardOptions = (
  text: string
): {
  mode?: WhiteboardMode
  color?: WhiteboardColor
  diagram?: string
  append?: boolean
} => {
  const lower = text.toLowerCase()

  // Mode
  let mode: WhiteboardMode | undefined
  if (/\[mode:\s*marker_ink\]/i.test(text) || /marker|pen|cursive|handwriting|handwritten/i.test(lower)) {
    mode = 'marker_ink'
  } else if (/\[mode:\s*diagram\]/i.test(text) || /diagram|flowchart|circuit|graph/i.test(lower)) {
    mode = 'diagram'
  } else if (/\[mode:\s*hybrid\]/i.test(text)) {
    mode = 'hybrid'
  }

  // Color
  let color: WhiteboardColor | undefined
  const colorMatch = text.match(/\[color:\s*([a-z-]+)\]/i)
  if (colorMatch) {
    color = colorMatch[1] as WhiteboardColor
  } else if (/\bgreen\b|\bemerald\b/i.test(lower)) {
    color = 'green'
  } else if (/\bblue\b|\bcyan\b/i.test(lower)) {
    color = 'blue'
  } else if (/\bviolet\b|\bpurple\b/i.test(lower)) {
    color = 'violet'
  } else if (/\bred\b|\bcrimson\b/i.test(lower)) {
    color = 'red'
  } else if (/\borange\b|\bamber\b/i.test(lower)) {
    color = 'orange'
  } else if (/\bblack\b/i.test(lower)) {
    color = 'black'
  }

  // Diagram
  const diagMatch = text.match(/\[diagram:\s*([a-z_-]+)\]/i)
  const diagram = diagMatch ? diagMatch[1].toLowerCase() : undefined

  // Append
  const append = /\[append:\s*true\]/i.test(text) || /\bappend\b|\bdon't clear\b|\badd to\b/i.test(lower)

  return { mode, color, diagram, append }
}

export const createWhiteboardTitle = (prompt: string) => {
  const clean = prompt
    .replace(/\[[a-z]+:\s*[^\]]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return 'Whiteboard Solution'
  return clean.length > 54 ? `${clean.slice(0, 51).trim()}...` : clean
}

export const createWhiteboardPayload = (
  prompt: string,
  content: string,
  source: WhiteboardWritePayload['source'],
  options: {
    mode?: WhiteboardMode
    color?: WhiteboardColor
    size?: 's' | 'm' | 'l' | 'xl'
    diagram?: string
    append?: boolean
  } = {}
): WhiteboardWritePayload => {
  const extracted = extractWhiteboardOptions(`${prompt}\n${content}`)
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: createWhiteboardTitle(prompt),
    prompt,
    content: normalizeBoardText(content),
    source,
    createdAt: new Date().toISOString(),
    mode: options.mode || extracted.mode || 'hybrid',
    color: options.color || extracted.color || 'green',
    size: options.size || 'm',
    diagram: options.diagram || extracted.diagram,
    append: options.append !== undefined ? options.append : extracted.append || false
  }
}

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
