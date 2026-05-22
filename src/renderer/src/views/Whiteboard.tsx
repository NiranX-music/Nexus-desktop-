import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Editor,
  Tldraw,
  TLDefaultColorStyle,
  TLGeoShapeGeoStyle,
  TLShapePartial,
  createShapeId,
  getSnapshot,
  toRichText
} from 'tldraw'
import 'tldraw/tldraw.css'
import {
  RiDeleteBin6Line,
  RiDownloadLine,
  RiPencilLine,
  RiRefreshLine,
  RiSendPlane2Line,
  RiShapesLine
} from 'react-icons/ri'
import {
  WHITEBOARD_WRITE_EVENT,
  WhiteboardWritePayload,
  createWhiteboardPayload,
  saveWhiteboardDocument
} from '@renderer/services/whiteboard'

const glassPanel = 'bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl'
const boardStoreKey = 'nexus_tldraw_board_snapshot'

const normalizeLines = (value: string) =>
  value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const stripDiagramMarker = (line: string) => line.replace(/^\[diagram:\s*[\w-]+\]\s*/i, '').trim()
const boardColors = ['black', 'green', 'blue', 'red', 'orange', 'violet'] as const
void boardColors
type BoardColor = (typeof boardColors)[number]

const detectDiagram = (text: string) => {
  const explicit = text.match(/\[diagram:\s*([\w-]+)\]/i)?.[1]?.toLowerCase()
  if (explicit) return explicit
  if (/lens|mirror|ray|optic/i.test(text)) return 'lens'
  if (/triangle|angle|geometry|geo/i.test(text)) return 'triangle'
  if (/circle|radius|diameter/i.test(text)) return 'circle'
  if (/graph|axis|plot/i.test(text)) return 'graph'
  if (/flow|process|steps/i.test(text)) return 'flow'
  return ''
}

const shapeText = (text: string, x: number, y: number, w = 680, size: 's' | 'm' | 'l' | 'xl' = 'm') =>
  ({
    id: createShapeId(),
    type: 'text',
    x,
    y,
    props: {
      autoSize: false,
      color: 'black',
      font: 'draw',
      richText: toRichText(text),
      scale: 1,
      size,
      w
    }
  }) satisfies TLShapePartial

const geoShape = (
  geo: TLGeoShapeGeoStyle,
  x: number,
  y: number,
  w: number,
  h: number,
  label = '',
  color: BoardColor = 'green'
) =>
  ({
    id: createShapeId(),
    type: 'geo',
    x,
    y,
    props: {
      color: color as TLDefaultColorStyle,
      dash: 'draw',
      fill: 'none',
      font: 'draw',
      geo,
      h,
      labelColor: 'black' as TLDefaultColorStyle,
      richText: toRichText(label),
      size: 'm',
      w
    }
  }) satisfies TLShapePartial

const arrowShape = (x: number, y: number, startX: number, startY: number, endX: number, endY: number) =>
  ({
    id: createShapeId(),
    type: 'arrow',
    x,
    y,
    props: {
      color: 'green',
      dash: 'draw',
      end: { x: endX, y: endY },
      arrowheadEnd: 'arrow',
      richText: toRichText(''),
      size: 'm',
      start: { x: startX, y: startY },
      arrowheadStart: 'none'
    }
  }) satisfies TLShapePartial

function buildDiagramShapes(kind: string, baseX: number, baseY: number): TLShapePartial[] {
  if (kind === 'lens') {
    return [
      geoShape('ellipse', baseX + 280, baseY + 25, 42, 230, 'lens'),
      arrowShape(baseX, baseY + 140, 0, 0, 650, 0),
      arrowShape(baseX + 70, baseY + 78, 0, 0, 565, 62),
      arrowShape(baseX + 70, baseY + 202, 0, 0, 565, -62),
      shapeText('principal axis', baseX + 350, baseY + 112, 230, 's')
    ]
  }

  if (kind === 'circle') {
    return [
      geoShape('ellipse', baseX + 30, baseY + 18, 210, 210, ''),
      arrowShape(baseX + 135, baseY + 123, 0, 0, 104, 0),
      shapeText('r', baseX + 174, baseY + 91, 60, 'm')
    ]
  }

  if (kind === 'graph') {
    return [
      arrowShape(baseX + 35, baseY + 240, 0, 0, 0, -220),
      arrowShape(baseX + 35, baseY + 240, 0, 0, 360, 0),
      geoShape('rectangle', baseX + 108, baseY + 118, 55, 122, '', 'blue'),
      geoShape('rectangle', baseX + 195, baseY + 75, 55, 165, '', 'blue'),
      geoShape('rectangle', baseX + 282, baseY + 38, 55, 202, '', 'blue')
    ]
  }

  if (kind === 'flow') {
    return [
      geoShape('rectangle', baseX + 10, baseY + 42, 150, 72, 'Start'),
      arrowShape(baseX + 170, baseY + 78, 0, 0, 100, 0),
      geoShape('diamond', baseX + 280, baseY + 22, 150, 112, 'Check'),
      arrowShape(baseX + 438, baseY + 78, 0, 0, 100, 0),
      geoShape('rectangle', baseX + 548, baseY + 42, 150, 72, 'Result')
    ]
  }

  return [
    geoShape('triangle', baseX + 30, baseY + 25, 320, 250, ''),
    geoShape('ellipse', baseX + 12, baseY + 214, 76, 52, 'A'),
    shapeText('B', baseX + 358, baseY + 242, 50, 'm'),
    shapeText('C', baseX + 180, baseY - 5, 50, 'm')
  ]
}

export default function WhiteboardView() {
  const editorRef = useRef<Editor | null>(null)
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('tldraw ready')
  const [lastTitle, setLastTitle] = useState('Open board')

  const components = useMemo(
    () => ({
      DebugMenu: null,
      HelpMenu: null,
      SharePanel: null
    }),
    []
  )

  const saveSnapshot = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const snapshot = getSnapshot(editor.store)
    localStorage.setItem(boardStoreKey, JSON.stringify(snapshot))
    setStatus('Board saved locally')
  }, [])

  const saveBoard = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) return
    saveSnapshot()

    const shapeIds = Array.from(editor.getCurrentPageShapeIds())
    if (shapeIds.length) {
      try {
        const image = await editor.toImageDataUrl(shapeIds, {
          background: true,
          format: 'png',
          padding: 48,
          pixelRatio: 1.5
        })
        const res = await window.electron?.ipcRenderer?.invoke('save-whiteboard-pdf', {
          imageDataUrl: image.url,
          title: lastTitle || 'Nexus Whiteboard'
        })
        if (res?.path) setStatus('PDF saved to Documents/Annotation')
      } catch {
        setStatus('Board saved; PDF export skipped')
      }
    }
  }, [lastTitle, saveSnapshot])

  const clearBoard = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const ids = Array.from(editor.getCurrentPageShapeIds())
    if (ids.length) editor.deleteShapes(ids)
    saveSnapshot()
    setStatus('Board cleared')
  }, [saveSnapshot])

  const resetView = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.zoomToFit()
    setStatus('Board view fitted')
  }, [])

  const writeOnBoard = useCallback(
    async (prompt: string, content?: string) => {
      const editor = editorRef.current
      if (!editor) return

      const text = [content || '', !content ? prompt : ''].filter(Boolean).join('\n')
      const lines = normalizeLines(text)
        .map(stripDiagramMarker)
        .filter(Boolean)
      const title = prompt || lines[0] || 'Nexus Whiteboard'
      const diagram = detectDiagram([prompt, content || ''].join('\n'))
      const shapes: TLShapePartial[] = []

      shapes.push(shapeText(title, 80, 70, 760, 'xl'))
      shapes.push(
        geoShape('rectangle', 62, 55, 820, 78, '', 'green'),
        shapeText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 715, 82, 130, 's')
      )

      let y = 180
      const boardLines = lines.length
        ? lines
        : [
            'Given information goes here.',
            'Pick the correct relation.',
            'Substitute values carefully.',
            'Simplify and box the final result.'
          ]

      boardLines.slice(0, 16).forEach((line, index) => {
        const prefix = /^\d+[.)]/.test(line) || /^[-*]/.test(line) ? '' : `${index + 1}. `
        shapes.push(shapeText(`${prefix}${line}`, 115, y, 900, index === 0 ? 'l' : 'm'))
        y += line.length > 92 ? 86 : 58
      })

      if (diagram) {
        shapes.push(...buildDiagramShapes(diagram, 130, y + 35))
        y += 350
      }

      shapes.push(geoShape('rectangle', 95, y + 30, 620, 86, 'Final answer', 'green'))

      const existingIds = Array.from(editor.getCurrentPageShapeIds())
      editor.run(() => {
        if (existingIds.length) editor.deleteShapes(existingIds)
        editor.createShapes(shapes)
        editor.select(...shapes.map((shape) => shape.id!).filter(Boolean))
        editor.zoomToFit()
      })

      setLastTitle(title)
      setStatus('AI wrote editable tldraw board')
      saveSnapshot()

      const payload = createWhiteboardPayload(title, [prompt, content || text].filter(Boolean).join('\n\n'), 'whiteboard')
      const result = await saveWhiteboardDocument(payload)
      if (result.success) setStatus('AI board saved to Docs')
    },
    [saveSnapshot]
  )

  useEffect(() => {
    const handler = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail || ''
      if (prompt) void writeOnBoard(prompt)
    }

    const writeHandler = (event: Event) => {
      const payload = (event as CustomEvent<WhiteboardWritePayload>).detail
      if (payload?.prompt || payload?.content) void writeOnBoard(payload.prompt, payload.content)
    }

    window.addEventListener('nexus-whiteboard-request', handler)
    window.addEventListener(WHITEBOARD_WRITE_EVENT, writeHandler)

    const pending = localStorage.getItem('nexus_whiteboard_request')
    if (pending) {
      try {
        const parsed = JSON.parse(pending)
        if (parsed?.prompt) void writeOnBoard(parsed.prompt)
        localStorage.removeItem('nexus_whiteboard_request')
      } catch {}
    }

    return () => {
      window.removeEventListener('nexus-whiteboard-request', handler)
      window.removeEventListener(WHITEBOARD_WRITE_EVENT, writeHandler)
    }
  }, [writeOnBoard])

  const onMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    editor.user.updateUserPreferences({ colorScheme: 'light', isSnapMode: true })
    editor.updateInstanceState({ isGridMode: true })
    editor.setCurrentTool('draw')
    setStatus('tldraw board online')
  }, [])

  const solveOnBoard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!question.trim()) return
    void writeOnBoard(question)
    setQuestion('')
  }

  return (
    <div className="h-full w-full overflow-hidden p-4 grid grid-cols-12 gap-4 bg-white/2 animate-in fade-in duration-300">
      <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 min-h-0">
        <div className={`${glassPanel} p-4 border-emerald-500/10`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-300">
              <RiPencilLine size={20} />
            </div>
            <div>
              <div className="text-xs font-black tracking-[0.22em] text-emerald-300 uppercase">
                Nexus Board
              </div>
              <div className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
                tldraw + AI writing
              </div>
            </div>
          </div>

          <form onSubmit={solveOnBoard} className="space-y-3">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="h-32 w-full resize-none rounded-xl border border-white/10 bg-black/60 p-3 text-xs leading-relaxed text-zinc-200 outline-none focus:border-emerald-400/50"
              placeholder="Ask Nexus to write, solve, or draw on the board..."
            />
            <button
              type="submit"
              className="h-11 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-black tracking-widest text-emerald-300 hover:bg-emerald-400 hover:text-black flex items-center justify-center gap-2"
            >
              <RiSendPlane2Line size={16} /> WRITE ON BOARD
            </button>
          </form>
        </div>

        <div className={`${glassPanel} p-4 flex-1 min-h-0 border-white/5`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-[10px] font-black tracking-widest text-zinc-400">BOARD CONTROLS</div>
            <RiShapesLine className="text-emerald-300" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => editorRef.current?.setCurrentTool('draw')}
              className="h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest"
            >
              PEN
            </button>
            <button
              onClick={() => editorRef.current?.setCurrentTool('eraser')}
              className="h-11 rounded-xl border border-white/10 bg-black/40 text-zinc-300 hover:text-red-300 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest"
            >
              ERASE
            </button>
            <button
              onClick={resetView}
              className="h-11 rounded-xl border border-white/10 bg-black/40 text-zinc-300 hover:text-cyan-300 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest"
            >
              <RiRefreshLine /> FIT
            </button>
            <button
              onClick={clearBoard}
              className="h-11 rounded-xl border border-white/10 bg-black/40 text-zinc-300 hover:text-red-300 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest"
            >
              <RiDeleteBin6Line /> CLEAR
            </button>
          </div>

          <button
            onClick={saveBoard}
            className="mt-2 h-11 w-full rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-400 hover:text-black flex items-center justify-center gap-2 text-[10px] font-black tracking-widest"
          >
            <RiDownloadLine /> SAVE PDF
          </button>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-[10px] font-mono text-zinc-400">
            <div className="flex justify-between gap-3">
              <span>Status</span>
              <span className="text-emerald-300 text-right">{status}</span>
            </div>
            <div className="mt-2 text-zinc-500 leading-relaxed">
              AI output becomes editable tldraw objects, so you can move, erase, annotate, and export.
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-9 min-h-0">
        <div className={`${glassPanel} h-full p-4 border-emerald-500/10`}>
          <div className="h-full overflow-hidden rounded-xl border border-emerald-950 bg-[#f8fff8] shadow-inner">
            <div className="h-full min-h-[560px] nexus-tldraw-board">
              <Tldraw
                autoFocus
                components={components}
                onMount={onMount}
                persistenceKey="nexus-ai-tldraw-board"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
