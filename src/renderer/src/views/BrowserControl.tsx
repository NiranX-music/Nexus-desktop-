import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiArrowGoBackLine,
  RiBrainLine,
  RiCursorLine,
  RiGlobalLine,
  RiKeyboardLine,
  RiLoader4Line,
  RiMicLine,
  RiMicOffLine,
  RiPlayFill,
  RiRefreshLine,
  RiSendPlane2Line,
  RiShieldFlashLine,
  RiSpeakLine,
  RiTerminalBoxLine
} from 'react-icons/ri'
import {
  BrowserAccessScope,
  BrowserControlAction,
  BrowserControlSource,
  BrowserControlResult,
  runBrowserControlPrompt,
  runServerlessBrowserPrompt
} from '@renderer/functions/browser-control-api'

interface BrowserEvent {
  id: number
  prompt: string
  result: BrowserControlResult
  source: 'text' | 'voice' | 'quick' | 'core'
}

interface BrowserControlViewProps {
  isSystemActive: boolean
  isSystemStarting: boolean
  isMicMuted: boolean
  toggleSystem: () => void | Promise<void>
  toggleMic: () => void
  sendTextCommand: (command: string) => Promise<void>
}

type BrowserExecutionMode = 'core' | 'bridge' | 'serverless'

const quickPrompts = [
  { label: 'Search', prompt: 'search Nexus AI desktop agent', icon: <RiGlobalLine /> },
  { label: 'New Tab', prompt: 'new tab', icon: <RiKeyboardLine /> },
  { label: 'Reload', prompt: 'reload', icon: <RiRefreshLine /> },
  { label: 'Back', prompt: 'back', icon: <RiArrowGoBackLine /> },
  { label: 'Click', prompt: 'click', icon: <RiCursorLine /> },
  { label: 'Scroll', prompt: 'scroll down', icon: <RiTerminalBoxLine /> }
]

const accessScopes: Array<{
  id: BrowserAccessScope
  label: string
  detail: string
}> = [
  {
    id: 'tab',
    label: 'Tab Access',
    detail: 'Only the active tab: type, click, scroll, reload, back/forward.'
  },
  {
    id: 'tab-group',
    label: 'Tab Group',
    detail: 'Current window tabs: open/search in new tabs and manage tab flow.'
  },
  {
    id: 'browser',
    label: 'Entire Browser',
    detail: 'All browser windows: open windows, launch URLs, and global browser actions.'
  }
]

const getSpeechRecognition = () =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

const browserScopeLabels: Record<BrowserAccessScope, string> = {
  tab: 'Tab Access',
  'tab-group': 'Tab Group Access',
  browser: 'Entire Browser Access'
}

const executionModeCopy: Record<BrowserExecutionMode, string> = {
  core: 'Core voice model routes the task through the assistant.',
  bridge: 'Direct bridge controls the browser you already have open.',
  serverless:
    'Serverless Chromium runs an isolated open-source browser for web search and page reading.'
}

const buildCoreBrowserCommand = (command: string, scope: BrowserAccessScope) => `
[Browser Control Mode]
Access scope: ${scope} (${browserScopeLabels[scope]}).
Use the control_browser tool with this exact scope for browser actions.
Browser command: ${command}
After the tool result, reply in voice with a short status.
`

const createBrowserEventResult = (
  scope: BrowserAccessScope,
  success: boolean,
  summary: string,
  detail: string
): BrowserControlResult => ({
  success,
  summary,
  scope,
  actions: [
    {
      action: 'core_voice',
      detail,
      ok: success,
      error: success ? undefined : summary
    }
  ]
})

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

const SourceRow = ({ source, index }: { source: BrowserControlSource; index: number }) => (
  <div className="border-b border-white/5 py-2 last:border-b-0">
    <div className="flex items-center gap-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-emerald-300/20 bg-emerald-300/10 text-[8px] font-black text-emerald-200">
        {index + 1}
      </span>
      <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.12em] text-zinc-200">
        {source.title}
      </p>
    </div>
    <p className="mt-1 truncate pl-7 text-[10px] font-mono text-cyan-300/65">{source.url}</p>
    {source.snippet ? (
      <p className="mt-1 line-clamp-2 pl-7 text-[10px] font-semibold leading-relaxed text-zinc-500">
        {source.snippet}
      </p>
    ) : null}
  </div>
)

export default function BrowserControlView({
  isSystemActive,
  isSystemStarting,
  isMicMuted,
  toggleSystem,
  toggleMic,
  sendTextCommand
}: BrowserControlViewProps) {
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState<BrowserEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Voice ready')
  const [coreStatus, setCoreStatus] = useState('Core voice ready')
  const [autoRunVoice, setAutoRunVoice] = useState(true)
  const [scope, setScope] = useState<BrowserAccessScope>('tab')
  const [executionMode, setExecutionMode] = useState<BrowserExecutionMode>('core')
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

    if (executionMode === 'core') {
      setCoreStatus(isSystemActive ? 'Sending to Core voice' : 'Starting Core voice')
      try {
        await sendTextCommand(buildCoreBrowserCommand(command, scope))
        setEvents((current) => [
          ...current.slice(-9),
          {
            id: Date.now(),
            prompt: command,
            result: createBrowserEventResult(
              scope,
              true,
              'Sent through Core voice model. Voice response queued.',
              `${browserScopeLabels[scope]} routed through Core`
            ),
            source: 'core'
          }
        ])
        setCoreStatus('Core voice response queued')
      } catch (error: any) {
        const message = error?.message || 'Unable to reach Core voice model.'
        setEvents((current) => [
          ...current.slice(-9),
          {
            id: Date.now(),
            prompt: command,
            result: createBrowserEventResult(scope, false, message, 'Core voice route failed'),
            source: 'core'
          }
        ])
        setCoreStatus(message)
      } finally {
        setIsRunning(false)
      }
      return
    }

    try {
      const result =
        executionMode === 'serverless'
          ? await runServerlessBrowserPrompt(command, scope)
          : await runBrowserControlPrompt(command, scope)
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
    } finally {
      setIsRunning(false)
    }
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

  const toggleCoreVoice = async () => {
    if (isSystemStarting) {
      setCoreStatus('Core voice starting')
      return
    }

    if (!isSystemActive) {
      setCoreStatus('Starting Core voice')
      await toggleSystem()
      setCoreStatus('Core voice online')
      return
    }

    toggleMic()
    setCoreStatus(isMicMuted ? 'Core mic live' : 'Core mic muted')
  }

  const handleVoiceButton = () => {
    if (executionMode === 'core') {
      toggleCoreVoice()
      return
    }

    if (isListening) stopVoicePrompt()
    else startVoicePrompt()
  }

  const latestEvent = events[events.length - 1]
  const latestSources = latestEvent?.result.sources || []

  return (
    <div className="nexus-browser-control h-full w-full overflow-hidden p-4 text-zinc-100">
      <div className="grid h-full min-h-0 grid-cols-12 gap-3">
        <section className="col-span-12 flex min-h-0 flex-col gap-3 xl:col-span-8">
          <div className="nexus-browser-hero flex shrink-0 flex-wrap items-center justify-between gap-4 overflow-hidden border border-emerald-300/15 bg-black/35 p-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-2xl text-emerald-200">
                <RiGlobalLine />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-black uppercase tracking-[0.14em] text-white">
                  Browser Control
                </h2>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/70">
                  Scoped local browser execution
                </p>
                <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-zinc-500">
                  One command rail for browser voice, text, and autonomous page actions with clear access boundaries.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-[9px] font-black uppercase tracking-[0.16em]">
              <button
                type="button"
                onClick={() => {
                  stopVoicePrompt()
                  setExecutionMode('core')
                }}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 transition ${
                  executionMode === 'core'
                    ? 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100'
                    : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <RiBrainLine /> Core Voice
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode('bridge')}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 transition ${
                  executionMode === 'bridge'
                    ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <RiTerminalBoxLine /> Direct Bridge
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode('serverless')}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 transition ${
                  executionMode === 'serverless'
                    ? 'border-lime-300/30 bg-lime-300/15 text-lime-100'
                    : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <RiGlobalLine /> Serverless Chromium
              </button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
            {accessScopes.map((item) => (
              <button
                key={item.id}
                onClick={() => setScope(item.id)}
                className={`nexus-browser-scope-card min-h-24 border p-3 text-left transition ${
                  scope === item.id
                    ? 'border-emerald-300/40 bg-emerald-300/10 text-white'
                    : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em]">
                    {item.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      scope === item.id ? 'bg-emerald-300 shadow-[0_0_10px_#34d399]' : 'bg-zinc-700'
                    }`}
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-[10px] font-semibold leading-relaxed text-zinc-500">
                  {item.detail}
                </p>
              </button>
            ))}
          </div>

          <form
            onSubmit={submitPrompt}
            className="flex shrink-0 flex-wrap items-center gap-2 border border-emerald-300/15 bg-black/50 p-3"
          >
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                executionMode === 'core'
                  ? 'Ask Core to control the browser...'
                  : executionMode === 'serverless'
                    ? 'Search the web or read a public URL in Serverless Chromium...'
                    : scope === 'tab'
                      ? 'Active tab command...'
                      : scope === 'tab-group'
                        ? 'Tab group command...'
                        : 'Entire browser command...'
              }
              className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={handleVoiceButton}
              className={`grid h-12 w-12 shrink-0 place-items-center border text-lg transition ${
                executionMode === 'core'
                  ? isSystemActive && !isMicMuted
                    ? 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100'
                    : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300 hover:text-black'
                  : isListening
                    ? 'border-red-300/30 bg-red-400/15 text-red-200'
                    : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300 hover:text-black'
              }`}
              title={executionMode === 'core' ? 'Core voice model' : 'Voice prompt'}
            >
              {executionMode === 'core' ? (
                isSystemStarting ? (
                  <RiLoader4Line className="animate-spin" />
                ) : isSystemActive && !isMicMuted ? (
                  <RiSpeakLine className="animate-pulse" />
                ) : (
                  <RiMicLine />
                )
              ) : isListening ? (
                <RiMicOffLine />
              ) : (
                <RiMicLine />
              )}
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
              {latestSources.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <div className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    Serverless Sources
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-1 scrollbar-small">
                    {latestSources.slice(0, 5).map((source, index) => (
                      <SourceRow key={`${source.url}-${index}`} source={source} index={index} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 border border-white/10 bg-black/35 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                  {executionMode === 'core'
                    ? 'Core Voice Model'
                    : executionMode === 'serverless'
                      ? 'Voice + Chromium'
                      : 'Voice'}
                </span>
                {executionMode !== 'core' ? (
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
                ) : (
                  <span
                    className={`rounded-md border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] ${
                      isSystemActive
                        ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
                        : 'border-white/10 bg-white/[0.03] text-zinc-500'
                    }`}
                  >
                    {isSystemStarting ? 'Starting' : isSystemActive ? 'Online' : 'Standby'}
                  </span>
                )}
              </div>

              <div className="flex h-52 flex-col items-center justify-center gap-4">
                <button
                  onClick={handleVoiceButton}
                  className={`grid h-24 w-24 place-items-center rounded-lg border text-4xl transition ${
                    executionMode === 'core'
                      ? isSystemActive && !isMicMuted
                        ? 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100 shadow-[0_0_30px_rgba(52,211,153,0.18)]'
                        : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300 hover:text-black'
                      : isListening
                        ? 'border-red-300/30 bg-red-400/15 text-red-100 shadow-[0_0_30px_rgba(248,113,113,0.18)]'
                        : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300 hover:text-black'
                  }`}
                >
                  {executionMode === 'core' ? (
                    isSystemStarting ? (
                      <RiLoader4Line className="animate-spin" />
                    ) : isSystemActive && !isMicMuted ? (
                      <RiSpeakLine className="animate-pulse" />
                    ) : (
                      <RiBrainLine />
                    )
                  ) : isListening ? (
                    <RiSpeakLine className="animate-pulse" />
                  ) : (
                    <RiMicLine />
                  )}
                </button>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  {executionMode === 'core'
                    ? isSystemStarting
                      ? 'Core starting'
                      : isSystemActive
                        ? isMicMuted
                          ? 'Core online, mic muted'
                          : 'Core listening'
                        : 'Core standby'
                    : voiceStatus}
                </p>
                <p className="max-w-xs text-center text-[10px] font-semibold leading-relaxed text-zinc-600">
                  {executionMode === 'core' ? coreStatus : executionModeCopy[executionMode]}
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
              {scope}
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
              {executionMode === 'core' ? <RiShieldFlashLine /> : <RiPlayFill />}
              {executionMode === 'core'
                ? 'Core browser voice armed'
                : executionMode === 'serverless'
                  ? 'Serverless Chromium armed'
                  : 'Browser bridge armed'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
