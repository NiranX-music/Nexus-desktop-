import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rough from 'roughjs/bundled/rough.esm'
import {
  RiBrushLine,
  RiDeleteBinLine,
  RiFolderOpenLine,
  RiLoader4Line,
  RiRefreshLine,
  RiSendPlane2Line
} from 'react-icons/ri'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import '@fontsource/kalam/400.css'
import '@fontsource/kalam/700.css'
import 'katex/dist/katex.min.css'
import { generateWithNexusGeminiClient } from '@renderer/services/nexus-gemini-api'
import {
  WHITEBOARD_SAVED_EVENT,
  WHITEBOARD_SYSTEM_PROMPT,
  WHITEBOARD_WRITE_EVENT,
  WhiteboardWritePayload,
  createWhiteboardPayload,
  publishWhiteboardWrite,
  readLatestWhiteboardPayload
} from '@renderer/services/whiteboard'

const defaultBoard: WhiteboardWritePayload = {
  id: 'empty-board',
  title: 'Whiteboard',
  prompt: '',
  content: 'Ask a question and Nexus will write the solution here.',
  source: 'whiteboard',
  createdAt: new Date().toISOString()
}

const looksLikeLatexLine = (value: string) =>
  /\\(?:frac|sqrt|sum|prod|int|lim|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|sin|cos|tan|log|ln|leq|geq|neq|times|div|cdot|approx|rightarrow|leftarrow|infty)|(?:\^|_)\{/.test(
    value
  )

const normalizeWhiteboardMath = (content: string) =>
  content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `\n$$\n${String(math).trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => `$${String(math).trim()}$`)
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.includes('$') || trimmed.startsWith('|')) return line
      return looksLikeLatexLine(trimmed) ? `$$${trimmed}$$` : line
    })
    .join('\n')

type DiagramKind = 'lens' | 'triangle' | 'circle' | 'graph' | 'flow'

const diagramMarkerPattern = /^\s*\[diagram:\s*([a-z-]+)\]\s*$/gim

const stripDiagramMarkers = (content: string) => content.replace(diagramMarkerPattern, '').trim()

const normalizeDiagramKind = (value: string): DiagramKind | null => {
  const clean = value.toLowerCase().trim()
  if (/lens|mirror|ray|optics|refraction|convex|concave|focal/.test(clean)) return 'lens'
  if (/triangle|angle|geometry|geo|hypotenuse|perpendicular|similar/.test(clean)) return 'triangle'
  if (/circle|radius|diameter|chord|arc|tangent/.test(clean)) return 'circle'
  if (/graph|axis|coordinate|parabola|curve|function|plot/.test(clean)) return 'graph'
  if (/flow|process|cycle|map|diagram|draw/.test(clean)) return 'flow'
  return null
}

const getDiagramKind = (prompt: string, content: string): DiagramKind | null => {
  const explicit = [...content.matchAll(diagramMarkerPattern)]
    .map((match) => normalizeDiagramKind(match[1] || ''))
    .find(Boolean)
  if (explicit) return explicit
  return normalizeDiagramKind(`${prompt}\n${content}`)
}

const reactNodeToText = (node: ReactNode): string | null => {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    let text = ''
    for (const child of node) {
      const next = reactNodeToText(child)
      if (next === null) return null
      text += next
    }
    return text
  }
  return null
}

const inkRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const InkText = ({ children }: { children: ReactNode }) => {
  const text = reactNodeToText(children)
  if (!text) return <>{children}</>

  return (
    <span className="nexus-ink-line" aria-label={text}>
      {Array.from(text).map((char, index) => {
        if (char === ' ') {
          return (
            <span key={`${char}-${index}`} className="nexus-ink-space" aria-hidden="true">
              {' '}
            </span>
          )
        }

        const code = char.charCodeAt(0)
        const rotate = (inkRandom(code * 17 + index * 29) - 0.5) * 5.8
        const x = (inkRandom(code * 41 + index * 13) - 0.5) * 2.2
        const y = (inkRandom(code * 23 + index * 37) - 0.5) * 4.6
        const scale = 0.96 + inkRandom(code * 31 + index * 19) * 0.1
        const style = {
          animationDelay: `${Math.min(index * 7, 420)}ms`,
          transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rotate.toFixed(
            2
          )}deg) scale(${scale.toFixed(2)})`
        } satisfies CSSProperties

        return (
          <span key={`${char}-${index}`} className="nexus-ink-char" style={style}>
            {char}
          </span>
        )
      })}
    </span>
  )
}

const createSvgText = (
  svg: SVGSVGElement,
  x: number,
  y: number,
  label: string,
  size = 18,
  anchor: 'start' | 'middle' | 'end' = 'start'
) => {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('x', String(x))
  text.setAttribute('y', String(y))
  text.setAttribute('text-anchor', anchor)
  text.setAttribute('class', 'nexus-rough-label')
  text.setAttribute('style', `font-size:${size}px`)
  text.textContent = label
  svg.appendChild(text)
}

const WhiteboardDiagram = ({ kind, title }: { kind: DiagramKind; title: string }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const rc = rough.svg(svg, { options: { roughness: 1.65, bowing: 1.45 } })
    const ink = '#0f3b3f'
    const teal = '#0f766e'
    const faint = '#99f6e4'
    const append = (node: SVGGElement) => svg.appendChild(node)

    append(
      rc.rectangle(18, 18, 724, 244, {
        stroke: 'rgba(15, 118, 110, 0.26)',
        strokeWidth: 1.3,
        fill: 'rgba(204, 251, 241, 0.12)',
        fillStyle: 'hachure'
      })
    )

    if (kind === 'lens') {
      append(rc.line(54, 138, 704, 138, { stroke: teal, strokeWidth: 2 }))
      append(
        rc.path('M380 38 C326 86 326 190 380 238 C434 190 434 86 380 38 Z', {
          stroke: ink,
          strokeWidth: 2.6,
          fill: 'rgba(45, 212, 191, 0.12)',
          fillStyle: 'zigzag'
        })
      )
      append(rc.line(130, 138, 130, 70, { stroke: ink, strokeWidth: 2.2 }))
      append(rc.line(116, 86, 130, 70, { stroke: ink, strokeWidth: 2.2 }))
      append(rc.line(144, 86, 130, 70, { stroke: ink, strokeWidth: 2.2 }))
      append(rc.line(596, 138, 596, 194, { stroke: ink, strokeWidth: 2.2 }))
      append(rc.line(582, 178, 596, 194, { stroke: ink, strokeWidth: 2.2 }))
      append(rc.line(610, 178, 596, 194, { stroke: ink, strokeWidth: 2.2 }))
      append(rc.line(130, 70, 380, 138, { stroke: '#0e7490', strokeWidth: 1.9 }))
      append(rc.line(380, 138, 596, 194, { stroke: '#0e7490', strokeWidth: 1.9 }))
      append(rc.line(130, 70, 380, 70, { stroke: '#059669', strokeWidth: 1.7 }))
      append(rc.line(380, 70, 596, 194, { stroke: '#059669', strokeWidth: 1.7 }))
      append(rc.circle(306, 138, 8, { stroke: faint, strokeWidth: 1.5 }))
      append(rc.circle(454, 138, 8, { stroke: faint, strokeWidth: 1.5 }))
      createSvgText(svg, 130, 58, 'object', 17, 'middle')
      createSvgText(svg, 596, 216, 'image', 17, 'middle')
      createSvgText(svg, 380, 28, 'convex lens', 19, 'middle')
      createSvgText(svg, 306, 162, 'F', 17, 'middle')
      createSvgText(svg, 454, 162, 'F', 17, 'middle')
      createSvgText(svg, 526, 118, 'ray path', 16, 'middle')
    } else if (kind === 'triangle') {
      append(
        rc.polygon(
          [
            [142, 216],
            [360, 54],
            [620, 216]
          ],
          {
            stroke: ink,
            strokeWidth: 2.7,
            fill: 'rgba(45, 212, 191, 0.1)',
            fillStyle: 'hachure'
          }
        )
      )
      append(rc.arc(172, 214, 72, 72, Math.PI * 1.1, Math.PI * 1.52, false, { stroke: teal }))
      append(rc.arc(588, 214, 82, 82, Math.PI * 1.48, Math.PI * 1.9, false, { stroke: teal }))
      append(rc.line(360, 54, 360, 216, { stroke: '#0e7490', strokeWidth: 1.7 }))
      createSvgText(svg, 132, 234, 'A', 20)
      createSvgText(svg, 360, 42, 'B', 20, 'middle')
      createSvgText(svg, 634, 234, 'C', 20)
      createSvgText(svg, 382, 144, 'height', 17)
      createSvgText(svg, 380, 244, 'base', 17, 'middle')
    } else if (kind === 'circle') {
      append(
        rc.circle(376, 140, 178, {
          stroke: ink,
          strokeWidth: 2.7,
          fill: 'rgba(45, 212, 191, 0.08)',
          fillStyle: 'dots'
        })
      )
      append(rc.line(376, 140, 464, 104, { stroke: teal, strokeWidth: 2.2 }))
      append(rc.line(286, 140, 466, 140, { stroke: '#0e7490', strokeWidth: 1.9 }))
      append(rc.line(300, 86, 500, 206, { stroke: '#059669', strokeWidth: 1.7 }))
      append(rc.circle(376, 140, 8, { stroke: ink, fill: ink, fillStyle: 'solid' }))
      createSvgText(svg, 388, 132, 'O', 18)
      createSvgText(svg, 426, 110, 'r', 18)
      createSvgText(svg, 376, 166, 'diameter', 17, 'middle')
      createSvgText(svg, 524, 216, 'chord', 17)
    } else if (kind === 'graph') {
      append(rc.line(92, 216, 680, 216, { stroke: ink, strokeWidth: 2 }))
      append(rc.line(138, 236, 138, 42, { stroke: ink, strokeWidth: 2 }))
      append(rc.line(668, 206, 680, 216, { stroke: ink, strokeWidth: 2 }))
      append(rc.line(668, 226, 680, 216, { stroke: ink, strokeWidth: 2 }))
      append(rc.line(128, 54, 138, 42, { stroke: ink, strokeWidth: 2 }))
      append(rc.line(148, 54, 138, 42, { stroke: ink, strokeWidth: 2 }))
      append(
        rc.curve(
          [
            [156, 206],
            [260, 168],
            [346, 74],
            [452, 118],
            [626, 58]
          ],
          { stroke: '#0e7490', strokeWidth: 3 }
        )
      )
      createSvgText(svg, 686, 224, 'x', 18)
      createSvgText(svg, 128, 38, 'y', 18)
      createSvgText(svg, 390, 92, 'sketch curve', 17, 'middle')
    } else {
      append(rc.rectangle(80, 82, 150, 78, { stroke: ink, strokeWidth: 2.3, fill: 'rgba(45, 212, 191, 0.1)' }))
      append(rc.rectangle(306, 82, 150, 78, { stroke: ink, strokeWidth: 2.3, fill: 'rgba(45, 212, 191, 0.08)' }))
      append(rc.rectangle(532, 82, 150, 78, { stroke: ink, strokeWidth: 2.3, fill: 'rgba(45, 212, 191, 0.1)' }))
      append(rc.line(230, 121, 306, 121, { stroke: teal, strokeWidth: 2 }))
      append(rc.line(456, 121, 532, 121, { stroke: teal, strokeWidth: 2 }))
      append(rc.line(292, 110, 306, 121, { stroke: teal, strokeWidth: 2 }))
      append(rc.line(292, 132, 306, 121, { stroke: teal, strokeWidth: 2 }))
      append(rc.line(518, 110, 532, 121, { stroke: teal, strokeWidth: 2 }))
      append(rc.line(518, 132, 532, 121, { stroke: teal, strokeWidth: 2 }))
      createSvgText(svg, 155, 126, 'given', 18, 'middle')
      createSvgText(svg, 381, 126, 'steps', 18, 'middle')
      createSvgText(svg, 607, 126, 'answer', 18, 'middle')
    }

    createSvgText(svg, 36, 248, title.slice(0, 54), 14)
  }, [kind, title])

  return (
    <figure className="nexus-whiteboard-diagram-wrap">
      <svg ref={svgRef} viewBox="0 0 760 280" role="img" aria-label={`${kind} diagram`} />
    </figure>
  )
}

export default function WhiteboardView() {
  const [board, setBoard] = useState<WhiteboardWritePayload>(
    () => readLatestWhiteboardPayload() || defaultBoard
  )
  const [question, setQuestion] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const [status, setStatus] = useState('Ready')
  const paperRef = useRef<HTMLDivElement>(null)

  const visibleBoardContent = useMemo(() => stripDiagramMarkers(board.content), [board.content])
  const boardMarkdown = useMemo(
    () => normalizeWhiteboardMath(visibleBoardContent),
    [visibleBoardContent]
  )
  const diagramKind = useMemo(
    () => getDiagramKind(board.prompt, board.content),
    [board.content, board.prompt]
  )

  useEffect(() => {
    paperRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [board.id])

  useEffect(() => {
    const handleWrite = (event: Event) => {
      const payload = (event as CustomEvent<WhiteboardWritePayload>).detail
      if (typeof payload?.content !== 'string') return
      setBoard(payload)
      setStatus('Written')
    }

    const handleSaved = (event: Event) => {
      const payload = (event as CustomEvent<WhiteboardWritePayload>).detail
      if (!payload?.id) return
      setBoard((current) => (current.id === payload.id ? { ...current, ...payload } : current))
      setStatus('Saved to Docs')
    }

    window.addEventListener(WHITEBOARD_WRITE_EVENT, handleWrite as EventListener)
    window.addEventListener(WHITEBOARD_SAVED_EVENT, handleSaved as EventListener)
    return () => {
      window.removeEventListener(WHITEBOARD_WRITE_EVENT, handleWrite as EventListener)
      window.removeEventListener(WHITEBOARD_SAVED_EVENT, handleSaved as EventListener)
    }
  }, [])

  const writeQuestion = async (nextQuestion: string) => {
    const prompt = nextQuestion.trim()
    if (!prompt || isWriting) return

    setIsWriting(true)
    setStatus('Thinking')

    try {
      const content = await generateWithNexusGeminiClient({
        prompt,
        system: WHITEBOARD_SYSTEM_PROMPT,
        temperature: 0.35,
        maxOutputTokens: 1100
      })
      const payload = createWhiteboardPayload(prompt, content, 'whiteboard')
      setBoard(payload)
      const saveResult = await publishWhiteboardWrite(payload)
      if (saveResult.success) {
        setBoard((current) =>
          current.id === payload.id
            ? {
                ...current,
                docPath: saveResult.path,
                latestDocPath: saveResult.latestPath,
                docFolder: saveResult.folder,
                savedAt: saveResult.savedAt
              }
            : current
        )
      }
      setStatus(saveResult.success ? 'Saved to Docs' : 'Written')
    } catch (error: any) {
      setStatus(error?.message || 'Whiteboard API failed')
    } finally {
      setIsWriting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt) return
    setQuestion('')
    await writeQuestion(prompt)
  }

  const clearBoard = () => {
    const payload = createWhiteboardPayload('', ' ', 'whiteboard')
    setBoard(payload)
    void publishWhiteboardWrite(payload)
    setStatus('Cleared')
  }

  const rewriteBoard = () => {
    if (!board.prompt) return
    void writeQuestion(board.prompt)
  }

  const openDocsFolder = async () => {
    try {
      if (board.docPath) {
        await window.electron.ipcRenderer.invoke('file:reveal', board.docPath)
      } else {
        await window.electron.ipcRenderer.invoke('whiteboard:open-docs')
      }
      setStatus('Docs Opened')
    } catch (error: any) {
      setStatus(error?.message || 'Docs unavailable')
    }
  }

  return (
    <div className="nexus-whiteboard-view h-full min-h-[42rem] w-full overflow-y-auto p-4 text-zinc-100 scrollbar-small">
      <div className="grid h-full min-h-0 grid-cols-12 gap-3">
        <section className="col-span-12 flex min-h-0 flex-col border border-emerald-300/15 bg-black/35 p-4 lg:col-span-4 xl:col-span-3">
          <div className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-xl text-emerald-200">
                <RiBrushLine />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                  Nexus Whiteboard
                </p>
                <h2 className="mt-1 truncate text-xl font-black uppercase tracking-[0.06em] text-white">
                  Handwriting Surface
                </h2>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Question
            </label>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Solve a question on the whiteboard..."
              className="min-h-36 resize-none border border-white/10 bg-black/50 px-3 py-3 text-sm font-semibold leading-relaxed text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/35"
            />
            <button
              type="submit"
              disabled={!question.trim() || isWriting}
              className="inline-flex items-center justify-center gap-2 border border-emerald-300/25 bg-emerald-400/18 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100 transition hover:bg-emerald-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isWriting ? <RiLoader4Line className="animate-spin" /> : <RiSendPlane2Line />}
              Write Solution
            </button>
          </form>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={rewriteBoard}
              disabled={!board.prompt || isWriting}
              className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-300/25 hover:text-cyan-100 disabled:opacity-35"
            >
              <RiRefreshLine /> Rewrite
            </button>
            <button
              type="button"
              onClick={clearBoard}
              className="inline-flex items-center justify-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-red-300/25 hover:text-red-100"
            >
              <RiDeleteBinLine /> Clear
            </button>
          </div>

          <div className="mt-4 border border-white/10 bg-black/35 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Board State
            </p>
            <p className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-emerald-200">
              {status}
            </p>
            {board.prompt ? (
              <p className="mt-2 line-clamp-3 text-[11px] font-semibold leading-relaxed text-zinc-500">
                {board.prompt}
              </p>
            ) : null}
            <button
              type="button"
              onClick={openDocsFolder}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100 transition hover:bg-emerald-300 hover:text-black"
            >
              <RiFolderOpenLine /> Open Docs
            </button>
            {board.docPath ? (
              <p className="mt-2 break-all text-[10px] font-semibold leading-relaxed text-zinc-600">
                {board.docPath}
              </p>
            ) : null}
          </div>
        </section>

        <section className="col-span-12 min-h-0 lg:col-span-8 xl:col-span-9">
          <div className="nexus-whiteboard-frame h-full min-h-[42rem] overflow-hidden border border-emerald-300/15 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_28%),linear-gradient(135deg,rgba(6,10,11,0.96),rgba(1,4,5,0.98))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
            <div className="nexus-whiteboard-board relative h-full min-h-[38rem] overflow-hidden">
              <div className="nexus-whiteboard-glare" />
              <div className="absolute left-6 right-6 top-5 flex items-center justify-between gap-3 border-b border-cyan-900/10 pb-3">
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-black text-slate-800">{board.title}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {new Date(board.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-700/20 bg-emerald-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
                  Human Handwriting
                </span>
              </div>

              <div
                ref={paperRef}
                className="nexus-whiteboard-paper absolute inset-x-6 bottom-6 top-24 overflow-y-auto overscroll-contain pr-2 scrollbar-small"
              >
                {diagramKind ? <WhiteboardDiagram kind={diagramKind} title={board.title} /> : null}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => (
                      <p className="nexus-whiteboard-paragraph">
                        <InkText>{children}</InkText>
                      </p>
                    ),
                    h1: ({ children }) => (
                      <h1 className="nexus-whiteboard-heading">
                        <InkText>{children}</InkText>
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="nexus-whiteboard-heading">
                        <InkText>{children}</InkText>
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="nexus-whiteboard-heading">
                        <InkText>{children}</InkText>
                      </h3>
                    ),
                    li: ({ children }) => (
                      <li className="nexus-whiteboard-list-item">
                        <InkText>{children}</InkText>
                      </li>
                    ),
                    code: ({ children }) => (
                      <code className="nexus-whiteboard-inline-code">{children}</code>
                    ),
                    pre: ({ children }) => <pre className="nexus-whiteboard-code">{children}</pre>
                  }}
                >
                  {boardMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
