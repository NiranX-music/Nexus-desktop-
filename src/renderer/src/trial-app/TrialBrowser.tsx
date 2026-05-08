import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiArrowGoBackLine,
  RiCursorLine,
  RiGlobalLine,
  RiKeyboardLine,
  RiLoader4Line,
  RiMicLine,
  RiRefreshLine,
  RiSendPlane2Line,
  RiSpeakLine,
  RiTerminalBoxLine
} from 'react-icons/ri'
import {
  type BrowserAccessScope,
  type BrowserControlResult,
  runBrowserControlPrompt,
  runServerlessBrowserPrompt
} from '@renderer/functions/browser-control-api'
import type { TrialRuntimeProps } from './types'

type BrowserExecutionMode = 'core' | 'bridge' | 'serverless'

interface BrowserEvent {
  id: number
  prompt: string
  result: BrowserControlResult
  source: 'text' | 'voice' | 'quick' | 'core'
}

const quickPrompts = [
  { label: 'Search', prompt: 'search Nexus Agent trial build' },
  { label: 'Back', prompt: 'back' },
  { label: 'Reload', prompt: 'reload' },
  { label: 'Click', prompt: 'click' },
  { label: 'Scroll', prompt: 'scroll down' },
  { label: 'New Tab', prompt: 'new tab' }
]

const scopes: Array<{ id: BrowserAccessScope; label: string; detail: string }> = [
  { id: 'tab', label: 'Tab', detail: 'Only the active tab.' },
  { id: 'tab-group', label: 'Tab Group', detail: 'Current window tabs.' },
  { id: 'browser', label: 'Browser', detail: 'All browser windows.' }
]

const executionModeCopy: Record<BrowserExecutionMode, string> = {
  core: 'Routes the browser task through the voice core.',
  bridge: 'Controls the live browser you already have open.',
  serverless: 'Runs search and page reading in isolated Chromium.'
}

const browserScopeLabels: Record<BrowserAccessScope, string> = {
  tab: 'Tab access',
  'tab-group': 'Tab group access',
  browser: 'Entire browser access'
}

const getSpeechRecognition = () =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

const buildCoreBrowserCommand = (command: string, scope: BrowserAccessScope) => `
[Browser Control Mode]
Access scope: ${scope} (${browserScopeLabels[scope]}).
Use the control_browser tool with this exact scope for browser actions.
Browser command: ${command}
After the tool result, reply in voice with a short status.
`

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').trim())
  utterance.rate = 1.02
  utterance.pitch = 0.94
  window.speechSynthesis.speak(utterance)
}

export default function TrialBrowser({
  isSystemActive,
  isMicMuted,
  toggleMic,
  sendTextCommand
}: Pick<TrialRuntimeProps, 'isSystemActive' | 'isMicMuted' | 'toggleMic' | 'sendTextCommand'>) {
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState<BrowserEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Voice ready')
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

  const pushEvent = (
    nextPrompt: string,
    result: BrowserControlResult,
    source: BrowserEvent['source']
  ) => {
    setEvents((current) => [
      ...current.slice(-9),
      {
        id: Date.now(),
        prompt: nextPrompt,
        result,
        source
      }
    ])
  }

  const runPrompt = async (nextPrompt: string, source: BrowserEvent['source'] = 'text') => {
    const command = nextPrompt.trim()
    if (!command || isRunning) return

    setIsRunning(true)

    try {
      if (executionMode === 'core') {
        await sendTextCommand(buildCoreBrowserCommand(command, scope))
        const result: BrowserControlResult = {
          success: true,
          summary: 'Sent through Core voice. Nexus will answer in voice.',
          scope,
          actions: [
            {
              action: 'core_voice',
              detail: `${browserScopeLabels[scope]} routed through the core assistant.`,
              ok: true
            }
          ]
        }
        pushEvent(command, result, 'core')
        speak(result.summary)
        return
      }

      const result =
        executionMode === 'serverless'
          ? await runServerlessBrowserPrompt(command, scope)
          : await runBrowserControlPrompt(command, scope)

      pushEvent(command, result, source)
      speak(result.summary)
    } catch (error: any) {
      pushEvent(
        command,
        {
          success: false,
          summary: error?.message || 'Browser control failed.',
          scope,
          actions: [
            {
              action: 'browser_control',
              detail: 'Command failed before completion.',
              ok: false,
              error: error?.message || 'Browser control failed.'
            }
          ]
        },
        source
      )
    } finally {
      setIsRunning(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextPrompt = prompt.trim()
    if (!nextPrompt) return
    setPrompt('')
    await runPrompt(nextPrompt, 'text')
  }

  const beginVoiceCapture = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setVoiceStatus('Speech recognition is unavailable on this machine.')
      return
    }

    recognitionRef.current?.stop?.()
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsListening(true)
      setVoiceStatus('Listening for a browser task...')
    }

    recognition.onerror = () => {
      setIsListening(false)
      setVoiceStatus('Voice capture failed. Try text mode.')
    }

    recognition.onend = () => {
      setIsListening(false)
      setVoiceStatus('Voice ready')
    }

    recognition.onresult = async (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim()
      if (!transcript) return
      setPrompt(transcript)
      await runPrompt(transcript, 'voice')
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-3xl border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(8,14,14,0.96),rgba(4,7,8,0.92))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
              Trial Browser Control
            </p>
            <h2 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
              Text and voice browser tasks
            </h2>
          </div>
          <button
            type="button"
            onClick={toggleMic}
            className={`rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition ${
              isMicMuted
                ? 'border-red-300/18 bg-red-400/10 text-red-100'
                : 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100'
            }`}
          >
            {isMicMuted ? 'Mic Muted' : 'Mic Live'}
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Access scope
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {scopes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScope(item.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    scope === item.id
                      ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100'
                      : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{item.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Execution mode
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(['core', 'bridge', 'serverless'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setExecutionMode(mode)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    executionMode === mode
                      ? 'border-cyan-300/25 bg-cyan-400/12 text-cyan-50'
                      : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em]">
                    {mode === 'core'
                      ? 'Core Voice'
                      : mode === 'bridge'
                        ? 'Live Bridge'
                        : 'Serverless Chromium'}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    {executionModeCopy[mode]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Tell Nexus what to do in the browser..."
              className="min-h-[8rem] w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/25"
            />

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <button
                type="submit"
                disabled={isRunning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
              >
                {isRunning ? <RiLoader4Line className="animate-spin" /> : <RiSendPlane2Line />}
                Run command
              </button>
              <button
                type="button"
                onClick={beginVoiceCapture}
                disabled={isListening || (executionMode === 'core' && !isSystemActive)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/16 disabled:opacity-50"
              >
                <RiMicLine /> {isListening ? 'Listening' : 'Voice prompt'}
              </button>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                {voiceStatus}
              </div>
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-3">
            {quickPrompts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => void runPrompt(item.prompt, 'quick')}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs leading-relaxed text-zinc-300 transition hover:border-white/20"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  {item.label}
                </p>
                <p className="mt-2">{item.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col rounded-3xl border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(8,14,14,0.96),rgba(4,7,8,0.92))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Run Log
            </p>
            <h3 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
              Actions and sources
            </h3>
          </div>
          <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
            {events.length} events
          </span>
        </div>

        <div ref={logRef} className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
          {events.length ? (
            events.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      {item.source} / {browserScopeLabels[item.result.scope]}
                    </p>
                    <p className="mt-2 text-sm text-white">{item.prompt}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                      item.result.success
                        ? 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100'
                        : 'border-red-300/18 bg-red-400/10 text-red-100'
                    }`}
                  >
                    {item.result.success ? 'Completed' : 'Failed'}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{item.result.summary}</p>

                {item.result.actions?.length ? (
                  <div className="mt-4 space-y-2">
                    {item.result.actions.map((action, index) => (
                      <div
                        key={`${item.id}-action-${index}`}
                        className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-zinc-300"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                            {action.action}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                              action.ok ? 'bg-emerald-400/10 text-emerald-100' : 'bg-red-400/10 text-red-100'
                            }`}
                          >
                            {action.ok ? 'done' : 'error'}
                          </span>
                        </div>
                        <p className="mt-2">{action.error || action.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {item.result.sources?.length ? (
                  <div className="mt-4 space-y-2">
                    {item.result.sources.map((source, index) => (
                      <div
                        key={`${item.id}-source-${index}`}
                        className="rounded-2xl border border-cyan-300/10 bg-cyan-400/5 px-3 py-3"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                          {source.title}
                        </p>
                        <p className="mt-2 text-xs text-cyan-200/70">{source.url}</p>
                        {source.snippet ? (
                          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                            {source.snippet}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="grid h-full min-h-[16rem] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/18 px-6 text-center text-zinc-500">
              Run a text or voice browser prompt and the trial build will show the actions here.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
