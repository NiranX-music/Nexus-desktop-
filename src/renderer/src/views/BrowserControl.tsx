import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiArrowGoBackLine,
  RiCursorLine,
  RiGlobalLine,
  RiKeyboardLine,
  RiLoader4Line,
  RiMicLine,
  RiMicOffLine,
  RiPlayFill,
  RiRefreshLine,
  RiSendPlane2Line,
  RiSpeakLine,
  RiTerminalBoxLine
} from 'react-icons/ri'
import {
  BrowserControlAction,
  BrowserControlResult,
  runBrowserControlPrompt
} from '@renderer/functions/browser-control-api'

interface BrowserEvent {
  id: number
  prompt: string
  result: BrowserControlResult
  source: 'text' | 'voice' | 'quick'
}

const quickPrompts = [
  { label: 'Search', prompt: 'search Nexus AI desktop agent', icon: <RiGlobalLine /> },
  { label: 'New Tab', prompt: 'new tab', icon: <RiKeyboardLine /> },
  { label: 'Reload', prompt: 'reload', icon: <RiRefreshLine /> },
  { label: 'Back', prompt: 'back', icon: <RiArrowGoBackLine /> },
  { label: 'Click', prompt: 'click', icon: <RiCursorLine /> },
  { label: 'Scroll', prompt: 'scroll down', icon: <RiTerminalBoxLine /> }
]

const getSpeechRecognition = () =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

const ActionRow = ({ action }: { action: BrowserControlAction }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0">
    <div className="min-w-0">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
        {action.action}
      </p>
      <p className="mt-1 truncate text-[11px] font-mono text-zinc-500">
        {action.error || action.detail}
      </p>
    </div>
    <span
      className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] ${
        action.ok
          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
          : 'border-red-300/20 bg-red-400/10 text-red-200'
      }`}
    >
      {action.ok ? 'done' : 'fail'}
    </span>
  </div>
)

export default function BrowserControlView() {
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState<BrowserEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Voice ready')
  const [autoRunVoice, setAutoRunVoice] = useState(true)
  const recognitionRef = useRef<any>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [events, isRunning])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').trim())
    utterance.rate = 1.02
    utterance.pitch = 0.94
    window.speechSynthesis.speak(utterance)
  }

  const runPrompt = async (nextPrompt: string, source: BrowserEvent['source'] = 'text') => {
    const command = nextPrompt.trim()
    if (!command || isRunning) return

    setIsRunning(true)
    const result = await runBrowserControlPrompt(command)
    setEvents((current) => [
      ...current.slice(-9),
      {
        id: Date.now(),
        prompt: command,
        result,
        source
      }
    ])
    speak(result.summary)
    setIsRunning(false)
  }

  const submitPrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = prompt.trim()
    if (!command) return
    setPrompt('')
    await runPrompt(command, 'text')
  }

  const startVoicePrompt = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setVoiceStatus('Voice unavailable')
      return
    }

    recognitionRef.current?.stop?.()
    const recognition = new Recognition()
    recognition.lang = localStorage.getItem('nexus_voice_lang') || 'en-US'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      setVoiceStatus('Listening')
    }

    recognition.onerror = () => {
      setIsListening(false)
      setVoiceStatus('Voice interrupted')
    }

    recognition.onend = () => {
      setIsListening(false)
      setVoiceStatus('Voice ready')
    }

    recognition.onresult = (event: any) => {
      let transcript = ''
      let isFinal = false

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
        if (event.results[index].isFinal) isFinal = true
      }

      const command = transcript.trim()
      if (!command) return

      setPrompt(command)
      if (isFinal && autoRunVoice) {
        setPrompt('')
        runPrompt(command, 'voice')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopVoicePrompt = () => {
    recognitionRef.current?.stop?.()
    setIsListening(false)
    setVoiceStatus('Voice ready')
  }

  const latestEvent = events[events.length - 1]

  return (
    <div className="nexus-browser-control h-full w-full overflow-hidden p-4 text-zinc-100">
      <div className="grid h-full min-h-0 grid-cols-12 gap-3">
        <section className="col-span-12 flex min-h-0 flex-col gap-3 xl:col-span-8">
          <div className="nexus-browser-hero flex shrink-0 items-center justify-between gap-4 overflow-hidden border border-emerald-300/15 bg-black/35 p-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-2xl text-emerald-200">
                <RiGlobalLine />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-black uppercase tracking-[0.14em] text-white">
                  Browser Control
                </h2>
                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/70">
                  Local browser execution bus
                </p>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2 text-[9px] font-black uppercase tracking-[0.16em]">
              <span className="rounded-md border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-emerald-200">
                Open
              </span>
              <span className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-3 py-2 text-cyan-100">
                Type
              </span>
              <span className="rounded-md border border-orange-300/15 bg-orange-300/10 px-3 py-2 text-orange-100">
                Click
              </span>
            </div>
          </div>

          <form
            onSubmit={submitPrompt}
            className="flex shrink-0 items-center gap-2 border border-emerald-300/15 bg-black/50 p-3"
          >
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Browser command..."
              className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={isListening ? stopVoicePrompt : startVoicePrompt}
              className={`grid h-12 w-12 shrink-0 place-items-center border text-lg transition ${
                isListening
                  ? 'border-red-300/30 bg-red-400/15 text-red-200'
                  : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300 hover:text-black'
              }`}
              title="Voice prompt"
            >
              {isListening ? <RiMicOffLine /> : <RiMicLine />}
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || isRunning}
              className="grid h-12 w-12 shrink-0 place-items-center border border-emerald-300/25 bg-emerald-400/15 text-lg text-emerald-100 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
              title="Run browser command"
            >
              {isRunning ? <RiLoader4Line className="animate-spin" /> : <RiSendPlane2Line />}
            </button>
          </form>

          <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {quickPrompts.map((item) => (
              <button
                key={item.label}
                onClick={() => runPrompt(item.prompt, 'quick')}
                disabled={isRunning}
                className="nexus-browser-action-tile flex min-h-24 flex-col justify-between border border-white/10 bg-white/[0.035] p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="text-xl text-emerald-200">{item.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-200">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="min-h-0 border border-white/10 bg-black/35 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  Execution
                </span>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-300/60">
                  {isRunning ? 'Running' : 'Ready'}
                </span>
              </div>
              <div className="grid gap-2">
                {(latestEvent?.result.actions || []).length > 0 ? (
                  latestEvent.result.actions.map((action, index) => (
                    <ActionRow key={`${latestEvent.id}-${index}`} action={action} />
                  ))
                ) : (
                  <div className="grid h-52 place-items-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
                    No active browser run
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-0 border border-white/10 bg-black/35 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  Voice
                </span>
                <button
                  onClick={() => setAutoRunVoice((value) => !value)}
                  className={`rounded-md border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] ${
                    autoRunVoice
                      ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
                      : 'border-white/10 bg-white/[0.03] text-zinc-500'
                  }`}
                >
                  Auto run {autoRunVoice ? 'on' : 'off'}
                </button>
              </div>

              <div className="flex h-52 flex-col items-center justify-center gap-4">
                <button
                  onClick={isListening ? stopVoicePrompt : startVoicePrompt}
                  className={`grid h-24 w-24 place-items-center rounded-lg border text-4xl transition ${
                    isListening
                      ? 'border-red-300/30 bg-red-400/15 text-red-100 shadow-[0_0_30px_rgba(248,113,113,0.18)]'
                      : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300 hover:text-black'
                  }`}
                >
                  {isListening ? <RiSpeakLine className="animate-pulse" /> : <RiMicLine />}
                </button>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  {voiceStatus}
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="col-span-12 flex min-h-0 flex-col border border-white/10 bg-black/35 p-4 xl:col-span-4">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
              Browser Log
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-300/60">
              Local
            </span>
          </div>

          <div
            ref={logRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-small"
          >
            {events.length === 0 ? (
              <div className="grid h-full place-items-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
                No browser events
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      {event.source}
                    </span>
                    <span
                      className={`text-[8px] font-black uppercase tracking-[0.16em] ${
                        event.result.success ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {event.result.success ? 'success' : 'blocked'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-zinc-200">
                    {event.prompt}
                  </p>
                  <p className="mt-2 text-[10px] font-mono leading-relaxed text-zinc-500">
                    {event.result.summary}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/70">
              <RiPlayFill />
              Browser bridge armed
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
