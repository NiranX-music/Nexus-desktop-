import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Editor,
  Tldraw,
  TLShapePartial,
  createShapeId,
  getSnapshot
} from 'tldraw'
import 'tldraw/tldraw.css'
import {
  RiDeleteBin6Line,
  RiDownloadLine,
  RiPencilLine,
  RiRefreshLine,
  RiSendPlane2Line,
  RiShapesLine,
  RiSparklingLine
} from 'react-icons/ri'
import {
  WHITEBOARD_WRITE_EVENT,
  WhiteboardColor,
  WhiteboardMode,
  WhiteboardWritePayload,
  createWhiteboardPayload,
  saveWhiteboardDocument
} from '@renderer/services/whiteboard'
import {
  BoardColor,
  StrokeSize,
  composeWhiteboardElements,
  createArrowShape,
  createGeoShape,
  createHandwrittenTextShapes,
  buildArchitectureDiagram,
  buildChemistryBenzene,
  buildCoordinateGraph,
  buildElectricCircuitDiagram,
  buildFlowchart,
  buildMindMap,
  buildNeuralNetworkDiagram,
  buildOpticsLensDiagram,
  buildPythagoreanGeometry
} from '@renderer/services/whiteboard-pen-engine'

const glassPanel = 'bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl'
const boardStoreKey = 'nexus_tldraw_board_snapshot'

interface DrawOptions {
  mode?: WhiteboardMode
  color?: WhiteboardColor
  size?: StrokeSize
  diagram?: string
  append?: boolean
}

const PRESET_TEMPLATES = [
  { label: '🖊️ Marker Ink', prompt: 'Write "Welcome to Nexus AI" in authentic marker handwriting' },
  { label: '🔀 Auth Flowchart', prompt: 'Create a user authentication flowchart with decision diamond' },
  { label: '📐 Pythagoras Proof', prompt: 'Draw Pythagorean theorem right-triangle and proof' },
  { label: '📊 Math Coordinates', prompt: 'Plot y = sin(x) and y = x^2 coordinate graph' },
  { label: '⚡ Physics Lens', prompt: 'Convex lens ray tracing diagram with focal points' },
  { label: '🧠 Neural Network', prompt: 'Deep learning neural network architecture with synapses' },
  { label: '☁️ System Arch', prompt: 'Cloudflare edge to desktop agent system architecture' },
  { label: '🧪 Benzene Molecule', prompt: 'Chemistry benzene C6H6 aromatic ring resonance' },
  { label: '💡 Mind Map', prompt: 'Autonomous agent core concept mind map' },
  { label: '🔌 DC Circuit', prompt: 'DC electric circuit with battery, resistor, and switch' }
]

const COLOR_SWATCHES: { label: string; value: BoardColor; bg: string }[] = [
  { label: 'Emerald', value: 'green', bg: 'bg-emerald-500' },
  { label: 'Cyan', value: 'blue', bg: 'bg-sky-500' },
  { label: 'Violet', value: 'violet', bg: 'bg-purple-500' },
  { label: 'Amber', value: 'orange', bg: 'bg-amber-500' },
  { label: 'Crimson', value: 'red', bg: 'bg-rose-500' },
  { label: 'Black', value: 'black', bg: 'bg-zinc-800' }
]

export default function WhiteboardView() {
  const editorRef = useRef<Editor | null>(null)
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('tldraw board online')
  const [lastTitle, setLastTitle] = useState('Open board')
  const [selectedMode, setSelectedMode] = useState<WhiteboardMode>('marker_ink')
  const [selectedColor, setSelectedColor] = useState<BoardColor>('green')
  const [selectedSize, setSelectedSize] = useState<StrokeSize>('m')
  const [appendMode, setAppendMode] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

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

  // Universal Whiteboard Writer & Artist
  const writeOnBoard = useCallback(
    async (prompt: string, content?: string, options: DrawOptions = {}) => {
      const editor = editorRef.current
      if (!editor) return

      setIsDrawing(true)
      setStatus('🖊️ AI drawing on board...')

      try {
        const mode = options.mode || selectedMode
        const color = (options.color as BoardColor) || selectedColor
        const append = options.append !== undefined ? options.append : appendMode

        let shapes: TLShapePartial[] = []
        let title = prompt || 'Nexus Whiteboard'

        // Check for specific diagram explicit request
        const lower = `${prompt} ${content || ''}`.toLowerCase()
        const explicitDiagram = options.diagram || ''

        if (explicitDiagram === 'flow' || /flowchart|process flow/i.test(lower)) {
          shapes = buildFlowchart(100, 80)
          title = 'Flowchart'
        } else if (explicitDiagram === 'architecture' || /architecture|system design/i.test(lower)) {
          shapes = buildArchitectureDiagram(80, 80)
          title = 'System Architecture'
        } else if (explicitDiagram === 'neural' || /neural network|deep learning/i.test(lower)) {
          shapes = buildNeuralNetworkDiagram(80, 80)
          title = 'Neural Network'
        } else if (explicitDiagram === 'graph' || /coordinate|sin\(x\)|parabola/i.test(lower)) {
          shapes = buildCoordinateGraph(100, 80)
          title = 'Math Graph'
        } else if (explicitDiagram === 'lens' || /optic|lens|ray tracing/i.test(lower)) {
          shapes = buildOpticsLensDiagram(100, 80)
          title = 'Optics Lens Diagram'
        } else if (explicitDiagram === 'circuit' || /circuit|resistor|dc circuit/i.test(lower)) {
          shapes = buildElectricCircuitDiagram(100, 80)
          title = 'DC Circuit'
        } else if (explicitDiagram === 'geometry' || /pythagor|right triangle/i.test(lower)) {
          shapes = buildPythagoreanGeometry(100, 80)
          title = 'Pythagorean Geometry'
        } else if (explicitDiagram === 'chemistry' || /benzene|molecule/i.test(lower)) {
          shapes = buildChemistryBenzene(100, 80)
          title = 'Benzene Ring'
        } else if (explicitDiagram === 'mindmap' || /mind map|concept tree/i.test(lower)) {
          shapes = buildMindMap(100, 80)
          title = 'Mind Map'
        } else {
          // Use Master Composer (handles pure marker ink, shapes, and hybrid)
          const comp = composeWhiteboardElements(
            prompt,
            content || '',
            mode === 'text' ? 'hybrid' : mode,
            color
          )
          shapes = comp.shapes
          title = comp.title
        }

        // Calculate offset if appending to existing canvas
        if (append) {
          const existingBounds = editor.getCurrentPageBounds()
          if (existingBounds) {
            const offsetY = existingBounds.maxY + 80
            shapes = shapes.map((shape) => ({
              ...shape,
              y: (shape.y || 0) + offsetY
            }))
          }
        }

        editor.run(() => {
          if (!append) {
            const existingIds = Array.from(editor.getCurrentPageShapeIds())
            if (existingIds.length) editor.deleteShapes(existingIds)
          }
          editor.createShapes(shapes)
          editor.select(...shapes.map((s) => s.id!).filter(Boolean))
          editor.zoomToFit()
        })

        setLastTitle(title)
        setStatus(`✓ Drawn: ${title} (${shapes.length} elements)`)
        saveSnapshot()

        const payload = createWhiteboardPayload(
          title,
          [prompt, content].filter(Boolean).join('\n\n'),
          'whiteboard',
          { mode, color, append }
        )
        const result = await saveWhiteboardDocument(payload)
        if (result.success) setStatus('✓ Board auto-saved to Docs')
      } catch (err: any) {
        setStatus(`Drawing error: ${err?.message || 'unknown'}`)
      } finally {
        setIsDrawing(false)
      }
    },
    [appendMode, saveSnapshot, selectedColor, selectedMode]
  )

  // Direct quick shape insertion
  const insertQuickShape = useCallback(
    (shapeType: 'rectangle' | 'circle' | 'arrow' | 'star' | 'diamond' | 'cloud' | 'handwriting') => {
      const editor = editorRef.current
      if (!editor) return

      const bounds = editor.getViewportPageBounds()
      const cx = bounds.midX - 80
      const cy = bounds.midY - 40

      let shape: TLShapePartial | null = null

      if (shapeType === 'handwriting') {
        const textShapes = createHandwrittenTextShapes('Nexus Marker', cx, cy, {
          color: selectedColor,
          size: selectedSize,
          scale: 1.5,
          underline: true
        })
        editor.createShapes(textShapes)
        editor.select(...textShapes.map((s) => s.id!).filter(Boolean))
        setStatus('Inserted marker handwriting')
        return
      }

      switch (shapeType) {
        case 'rectangle':
          shape = createGeoShape({ geo: 'rectangle', x: cx, y: cy, w: 160, h: 90, color: selectedColor })
          break
        case 'circle':
          shape = createGeoShape({ geo: 'ellipse', x: cx, y: cy, w: 120, h: 120, color: selectedColor })
          break
        case 'arrow':
          shape = createArrowShape(cx, cy, 140, 0, '', selectedColor)
          break
        case 'star':
          shape = createGeoShape({ geo: 'star', x: cx, y: cy, w: 120, h: 120, color: selectedColor, fill: 'semi' })
          break
        case 'diamond':
          shape = createGeoShape({ geo: 'diamond', x: cx, y: cy, w: 140, h: 90, color: selectedColor })
          break
        case 'cloud':
          shape = createGeoShape({ geo: 'cloud', x: cx, y: cy, w: 180, h: 110, color: selectedColor, fill: 'semi' })
          break
      }

      if (shape) {
        editor.createShapes([shape])
        editor.select(shape.id!)
        setStatus(`Inserted ${shapeType}`)
      }
    },
    [selectedColor, selectedSize]
  )

  useEffect(() => {
    const handler = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail || ''
      if (prompt) void writeOnBoard(prompt)
    }

    const writeHandler = (event: Event) => {
      const payload = (event as CustomEvent<WhiteboardWritePayload>).detail
      if (payload?.prompt || payload?.content) {
        void writeOnBoard(payload.prompt, payload.content, {
          mode: payload.mode,
          color: payload.color,
          diagram: payload.diagram,
          append: payload.append
        })
      }
    }

    window.addEventListener('nexus-whiteboard-request', handler)
    window.addEventListener(WHITEBOARD_WRITE_EVENT, writeHandler)

    const pending = localStorage.getItem('nexus_whiteboard_request')
    if (pending) {
      try {
        const parsed = JSON.parse(pending)
        if (parsed?.prompt) void writeOnBoard(parsed.prompt, parsed?.content)
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
    void writeOnBoard(question, undefined, {
      mode: selectedMode,
      color: selectedColor,
      size: selectedSize,
      append: appendMode
    })
    setQuestion('')
  }

  return (
    <div className="h-full w-full overflow-hidden p-4 grid grid-cols-12 gap-4 bg-white/2 animate-in fade-in duration-300">
      {/* LEFT SIDEBAR: BOARD CONTROLS & AI WRITING */}
      <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1 pb-28 scrollbar-small">
        {/* HEADER PANEL */}
        <div className={`${glassPanel} p-4 border-emerald-500/10`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-300">
                <RiPencilLine size={19} />
              </div>
              <div>
                <div className="text-xs font-black tracking-[0.22em] text-emerald-300 uppercase">
                  Nexus Board
                </div>
                <div className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">
                  Marker Ink & Shape Engine
                </div>
              </div>
            </div>
            {isDrawing && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>

          {/* MODE SELECTOR */}
          <div className="mb-3 space-y-1.5">
            <div className="text-[9px] font-mono text-zinc-400 tracking-wider uppercase">Style Mode</div>
            <div className="grid grid-cols-3 gap-1 bg-black/50 p-1 rounded-xl border border-white/5 text-[9px] font-bold">
              <button
                type="button"
                onClick={() => setSelectedMode('marker_ink')}
                className={`py-1.5 rounded-lg transition-all ${
                  selectedMode === 'marker_ink'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                🖊️ Marker
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('hybrid')}
                className={`py-1.5 rounded-lg transition-all ${
                  selectedMode === 'hybrid'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ✨ Hybrid
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('diagram')}
                className={`py-1.5 rounded-lg transition-all ${
                  selectedMode === 'diagram'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                📐 Diagram
              </button>
            </div>
          </div>

          {/* COLOR & TIP SIZE SELECTOR */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="text-[9px] font-mono text-zinc-400 tracking-wider uppercase mb-1">Color</div>
              <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-xl border border-white/5">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    onClick={() => setSelectedColor(swatch.value)}
                    className={`h-5 w-5 rounded-full transition-all ${swatch.bg} ${
                      selectedColor === swatch.value
                        ? 'ring-2 ring-white scale-110'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-mono text-zinc-400 tracking-wider uppercase mb-1">Tip Size</div>
              <div className="grid grid-cols-4 gap-1 bg-black/50 p-1 rounded-xl border border-white/5 text-[9px] font-black text-center">
                {(['s', 'm', 'l', 'xl'] as StrokeSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`py-1 rounded-lg uppercase ${
                      selectedSize === sz
                        ? 'bg-emerald-500 text-black'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PROMPT FORM */}
          <form onSubmit={solveOnBoard} className="space-y-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/60 p-2.5 text-xs leading-relaxed text-zinc-200 outline-none focus:border-emerald-400/50 scrollbar-small placeholder:text-zinc-600"
              placeholder="Ask Nexus to write in marker handwriting, draw shapes, or sketch diagrams..."
            />

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer text-[10px] text-zinc-400 select-none">
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20"
                />
                Append to canvas
              </label>
            </div>

            <button
              type="submit"
              disabled={isDrawing}
              className="h-10 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-black tracking-widest text-emerald-300 hover:bg-emerald-400 hover:text-black flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RiSendPlane2Line size={15} /> WRITE & DRAW ON BOARD
            </button>
          </form>
        </div>

        {/* QUICK SHAPES TOOLBAR */}
        <div className={`${glassPanel} p-3 border-white/5`}>
          <div className="text-[9px] font-mono tracking-widest text-zinc-400 uppercase mb-2 flex items-center justify-between">
            <span>Instant Shape Drawer</span>
            <RiShapesLine className="text-emerald-400" />
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[9px] font-bold text-zinc-300">
            <button
              type="button"
              onClick={() => insertQuickShape('rectangle')}
              className="py-1.5 px-1 rounded-lg border border-white/5 bg-black/40 hover:border-emerald-500/30 hover:text-emerald-300 transition-all text-center"
            >
              Box
            </button>
            <button
              type="button"
              onClick={() => insertQuickShape('circle')}
              className="py-1.5 px-1 rounded-lg border border-white/5 bg-black/40 hover:border-emerald-500/30 hover:text-emerald-300 transition-all text-center"
            >
              Circle
            </button>
            <button
              type="button"
              onClick={() => insertQuickShape('arrow')}
              className="py-1.5 px-1 rounded-lg border border-white/5 bg-black/40 hover:border-emerald-500/30 hover:text-emerald-300 transition-all text-center"
            >
              Arrow
            </button>
            <button
              type="button"
              onClick={() => insertQuickShape('star')}
              className="py-1.5 px-1 rounded-lg border border-white/5 bg-black/40 hover:border-emerald-500/30 hover:text-emerald-300 transition-all text-center"
            >
              Star
            </button>
            <button
              type="button"
              onClick={() => insertQuickShape('diamond')}
              className="py-1.5 px-1 rounded-lg border border-white/5 bg-black/40 hover:border-emerald-500/30 hover:text-emerald-300 transition-all text-center"
            >
              Diamond
            </button>
            <button
              type="button"
              onClick={() => insertQuickShape('cloud')}
              className="py-1.5 px-1 rounded-lg border border-white/5 bg-black/40 hover:border-emerald-500/30 hover:text-emerald-300 transition-all text-center"
            >
              Cloud
            </button>
            <button
              type="button"
              onClick={() => insertQuickShape('handwriting')}
              className="col-span-2 py-1.5 px-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-400 hover:text-black transition-all text-center"
            >
              🖊️ Pen Text
            </button>
          </div>
        </div>

        {/* PRESET EDUCATIONAL & DIAGRAM PROMPTS */}
        <div className={`${glassPanel} p-3 border-white/5 flex-1 min-h-0 flex flex-col`}>
          <div className="text-[9px] font-mono tracking-widest text-zinc-400 uppercase mb-2 flex items-center justify-between">
            <span>Specialized Templates</span>
            <RiSparklingLine className="text-amber-400" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-small pr-1">
            {PRESET_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => void writeOnBoard(tmpl.prompt)}
                className="w-full text-left p-1.5 rounded-lg border border-white/5 bg-black/30 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-[10px] text-zinc-300 flex items-center justify-between group"
              >
                <span>{tmpl.label}</span>
                <span className="text-[9px] text-zinc-600 group-hover:text-emerald-400">Draw →</span>
              </button>
            ))}
          </div>

          {/* BOARD HARDWARE CONTROLS */}
          <div className="pt-2 border-t border-white/5 mt-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => editorRef.current?.setCurrentTool('draw')}
                className="h-9 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 flex items-center justify-center gap-1 text-[10px] font-black tracking-widest hover:bg-emerald-400 hover:text-black transition-all"
              >
                PEN
              </button>
              <button
                type="button"
                onClick={() => editorRef.current?.setCurrentTool('eraser')}
                className="h-9 rounded-xl border border-white/10 bg-black/40 text-zinc-300 hover:text-red-300 flex items-center justify-center gap-1 text-[10px] font-black tracking-widest transition-all"
              >
                ERASE
              </button>
              <button
                type="button"
                onClick={resetView}
                className="h-9 rounded-xl border border-white/10 bg-black/40 text-zinc-300 hover:text-cyan-300 flex items-center justify-center gap-1 text-[10px] font-black tracking-widest transition-all"
              >
                <RiRefreshLine /> FIT
              </button>
              <button
                type="button"
                onClick={clearBoard}
                className="h-9 rounded-xl border border-white/10 bg-black/40 text-zinc-300 hover:text-red-300 flex items-center justify-center gap-1 text-[10px] font-black tracking-widest transition-all"
              >
                <RiDeleteBin6Line /> CLEAR
              </button>
            </div>

            <button
              type="button"
              onClick={saveBoard}
              className="mt-2 h-9 w-full rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-400 hover:text-black flex items-center justify-center gap-1.5 text-[10px] font-black tracking-widest transition-all"
            >
              <RiDownloadLine /> SAVE PDF
            </button>

            {/* STATUS FOOTER */}
            <div className="mt-2.5 rounded-xl border border-white/5 bg-black/40 p-2.5 text-[10px] font-mono text-zinc-400">
              <div className="flex justify-between gap-2">
                <span>Status</span>
                <span className="text-emerald-300 truncate text-right font-medium">{status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT CANVAS: TLDRAW WHITEBOARD */}
      <div className="col-span-12 lg:col-span-9 min-h-0">
        <div className={`${glassPanel} h-full p-4 border-emerald-500/10 flex flex-col`}>
          <div className="h-full overflow-hidden rounded-xl border border-emerald-950/60 bg-[#f8fff8] shadow-inner relative">
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
