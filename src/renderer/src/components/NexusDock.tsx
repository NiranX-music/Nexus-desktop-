import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCloseLine,
  RiComputerLine,
  RiGitBranchLine,
  RiMicLine,
  RiMicOffLine,
  RiPhoneFill,
  RiSendPlane2Line,
  RiSparklingLine
} from 'react-icons/ri'

const sendDockCommand = (command: string, payload?: any) => {
  ;(window as any).electron?.ipcRenderer?.send('dock-command', command, payload)
}

export default function NexusDock() {
  const [prompt, setPrompt] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [sessionState, setSessionState] = useState<'STANDBY' | 'STARTING' | 'ONLINE'>('STANDBY')
  const [voiceState, setVoiceState] = useState<'MUTED' | 'OPEN'>('MUTED')
  const startingTimerRef = useRef<number | null>(null)
  const collapseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const api = (window as any).electron?.ipcRenderer
    if (!api) return

    api.on('dock-command', (_event: any, message: any) => {
      if (message?.command === 'session-state') {
        const isStarting = Boolean(message.payload?.starting)
        const isActive = Boolean(message.payload?.active)
        if (startingTimerRef.current) {
          window.clearTimeout(startingTimerRef.current)
          startingTimerRef.current = null
        }
        if (isStarting) {
          setSessionState('STARTING')
          startingTimerRef.current = window.setTimeout(() => {
            setSessionState((current) => (current === 'STARTING' ? 'STANDBY' : current))
          }, 3500)
        } else {
          setSessionState(isActive ? 'ONLINE' : 'STANDBY')
        }
        setVoiceState(message.payload?.muted ? 'MUTED' : 'OPEN')
      }
    })

    return () => {
      if (startingTimerRef.current) window.clearTimeout(startingTimerRef.current)
      api.removeAllListeners('dock-command')
    }
  }, [])

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current === null) return
    window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
  }

  const setDockExpanded = (value: boolean) => {
    clearCollapseTimer()
    setExpanded(value)
    ;(window as any).electron?.ipcRenderer?.send(value ? 'dock-expand' : 'dock-collapse')
  }

  const scheduleDockCollapse = () => {
    clearCollapseTimer()
    collapseTimerRef.current = window.setTimeout(() => {
      setExpanded(false)
      ;(window as any).electron?.ipcRenderer?.send('dock-collapse')
      collapseTimerRef.current = null
    }, 450)
  }

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = prompt.trim()
    if (!text) return
    sendDockCommand('text-command', { text, intent: 'queue' })
    setPrompt('')
  }

  return (
    <div
      onMouseEnter={() => setDockExpanded(true)}
      onMouseMove={clearCollapseTimer}
      onMouseLeave={scheduleDockCollapse}
      className="h-full w-full bg-transparent text-zinc-100 select-none overflow-hidden flex flex-col items-center justify-center p-0 font-sans"
    >
      {!expanded ? (
        /* COLLAPSED DYNAMIC ISLAND PILL - ULTRA CURVED TRANSLUCENT GLASS */
        <div
          onClick={() => setDockExpanded(true)}
          className="group relative flex h-full w-full items-center justify-between rounded-full border border-white/25 bg-slate-950/35 px-2.5 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_1.5px_rgba(255,255,255,0.35),0_0_18px_rgba(16,185,129,0.15)] backdrop-blur-2xl backdrop-saturate-200 transition-all duration-300 hover:border-emerald-400/50 hover:bg-slate-900/45 hover:shadow-[0_12px_36px_rgba(0,0,0,0.45),inset_0_1px_2px_rgba(255,255,255,0.45),0_0_24px_rgba(16,185,129,0.25)] cursor-pointer drag-region"
        >
          {/* Specular Top Rim Reflection */}
          <div className="pointer-events-none absolute top-0 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Ambient Frosted Glow */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/15 via-white/[0.04] to-cyan-500/15 opacity-70 group-hover:opacity-100 transition-opacity" />

          {/* Left: NX Badge + Status */}
          <div className="relative z-10 flex items-center gap-1.5 min-w-0 no-drag">
            <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600/40 to-teal-400/30 border border-emerald-400/60 text-[8.5px] font-black text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.35)]">
              <span>NX</span>
              <span
                className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${
                  sessionState === 'ONLINE'
                    ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                    : sessionState === 'STARTING'
                      ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse'
                      : 'bg-zinc-500'
                }`}
              />
            </div>

            <span className="text-[9px] font-bold tracking-wider text-zinc-200 group-hover:text-emerald-300 transition-colors uppercase truncate">
              {sessionState === 'ONLINE'
                ? 'LIVE'
                : sessionState === 'STARTING'
                  ? 'SYNC'
                  : 'READY'}
            </span>
          </div>

          {/* Center: Soundwave Audio Equalizer */}
          <div className="relative z-10 flex items-center gap-1 h-3.5 px-0.5 no-drag">
            {sessionState === 'ONLINE' && voiceState === 'OPEN' ? (
              <div className="flex items-center gap-1">
                <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-[island-wave-1_0.7s_ease-in-out_infinite]" />
                <span className="w-0.5 h-4 bg-emerald-300 rounded-full animate-[island-wave-2_0.5s_ease-in-out_infinite_0.1s]" />
                <span className="w-0.5 h-2.5 bg-teal-300 rounded-full animate-[island-wave-3_0.8s_ease-in-out_infinite_0.2s]" />
              </div>
            ) : (
              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                <span className="h-1 w-2.5 rounded-full bg-white/30 group-hover:bg-emerald-400/60 transition-colors" />
                <span className="h-1 w-1 rounded-full bg-cyan-400" />
              </div>
            )}
          </div>

          {/* Right: Mic Button & Expand Chevron */}
          <div className="relative z-10 flex items-center gap-1 shrink-0 no-drag">
            <div
              onClick={(e) => {
                e.stopPropagation()
                sendDockCommand('toggle-mute')
              }}
              title={voiceState === 'MUTED' ? 'Microphone muted (click to unmute)' : 'Microphone live (click to mute)'}
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-all hover:scale-110 active:scale-95 ${
                voiceState === 'OPEN'
                  ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.45)]'
                  : 'border-white/15 bg-white/10 text-zinc-300 hover:text-white'
              }`}
            >
              {voiceState === 'MUTED' ? <RiMicOffLine size={11} /> : <RiMicLine size={11} />}
            </div>
            <RiArrowDownSLine
              size={13}
              className="text-zinc-400 group-hover:text-emerald-300 group-hover:translate-y-0.5 transition-all"
            />
          </div>
        </div>
      ) : (
        /* EXPANDED DYNAMIC ISLAND COCKPIT - TRANSLUCENT FROSTED GLASS */
        <div className="relative flex flex-col h-full w-full overflow-hidden rounded-[28px] border border-white/20 bg-slate-950/40 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.35),0_0_30px_rgba(16,185,129,0.15)] backdrop-blur-2xl backdrop-saturate-200 transition-all duration-300">
          {/* Specular Top Rim Reflection */}
          <div className="pointer-events-none absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Ambient Lighting Orbs for Glass Morphism */}
          <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-80 rounded-full bg-gradient-to-r from-emerald-500/20 via-teal-400/15 to-cyan-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 right-10 h-20 w-44 rounded-full bg-cyan-500/10 blur-2xl" />

          {/* Header Bar: Dynamic Island Notch Header */}
          <div className="relative z-10 h-7 flex items-center justify-between gap-3 drag-region">
            {/* Brand Emblem & Island Title */}
            <div className="flex items-center gap-2 min-w-0 no-drag">
              <div className="h-6 w-6 rounded-full border border-emerald-400/50 bg-gradient-to-tr from-emerald-600/35 to-teal-400/25 flex items-center justify-center text-[10px] font-black text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                NX
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-black tracking-[0.2em] bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent uppercase truncate">
                  Nexus 9.1 Island
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-mono tracking-widest text-emerald-300 uppercase">
                  <RiSparklingLine size={10} /> Glass Dock
                </span>
              </div>
            </div>

            {/* Center Live Audio Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 no-drag">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  sessionState === 'ONLINE'
                    ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]'
                    : sessionState === 'STARTING'
                      ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]'
                      : 'bg-zinc-600'
                }`}
              />
              <span className="text-[8px] font-mono tracking-widest uppercase text-zinc-300">
                {sessionState === 'ONLINE'
                  ? 'Live Audio Channel'
                  : sessionState === 'STARTING'
                    ? 'Handshake'
                    : 'System Standby'}
              </span>
            </div>

            {/* Window Controls & Session Pill */}
            <div className="flex items-center gap-1.5 no-drag">
              <span
                className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[8px] font-bold tracking-widest transition-all ${
                  sessionState === 'STARTING'
                    ? 'border-amber-400/40 bg-amber-400/15 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                    : sessionState === 'ONLINE'
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'border-white/10 bg-white/5 text-zinc-400'
                }`}
              >
                <span
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    sessionState === 'ONLINE'
                      ? 'bg-emerald-400'
                      : sessionState === 'STARTING'
                        ? 'bg-amber-400'
                        : 'bg-zinc-500'
                  }`}
                />
                {sessionState}
              </span>
              <button
                type="button"
                onClick={() => sendDockCommand('open-desktop')}
                className="h-6 w-6 rounded-full border border-white/10 bg-white/5 hover:border-emerald-400/40 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 transition-all flex items-center justify-center shadow-sm"
                title="Open desktop app"
              >
                <RiComputerLine size={13} />
              </button>
              <button
                type="button"
                onClick={() => sendDockCommand('close-dock')}
                className="h-6 w-6 rounded-full border border-white/10 bg-white/5 hover:border-red-400/40 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition-all flex items-center justify-center shadow-sm"
                title="Close dock"
              >
                <RiCloseLine size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Core: 3-Column Glass Deck */}
          <div className="relative z-10 pt-2 grid grid-cols-[auto_1fr_auto] gap-2.5 items-stretch no-drag flex-1">
            {/* Left Column: Glass Control Tiles */}
            <div className="grid grid-cols-2 gap-2">
              {/* SESSION Tile */}
              <button
                type="button"
                onClick={() => sendDockCommand('start-session')}
                className={`group relative h-[110px] w-[90px] rounded-2xl border backdrop-blur-xl p-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                  sessionState === 'ONLINE'
                    ? 'border-emerald-400/60 bg-gradient-to-b from-emerald-500/25 to-emerald-950/40 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:bg-emerald-500/35'
                    : sessionState === 'STARTING'
                      ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/20 to-amber-950/30 text-amber-200 animate-pulse'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-emerald-400/40 text-zinc-300 hover:text-emerald-200 shadow-sm'
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                    sessionState === 'ONLINE'
                      ? 'bg-emerald-400/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                      : 'bg-white/5 text-zinc-400 group-hover:text-emerald-300 group-hover:bg-emerald-500/10'
                  }`}
                >
                  <RiPhoneFill size={19} />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-black tracking-widest uppercase">SESSION</span>
                  <span className="text-[7.5px] font-mono text-zinc-400 group-hover:text-zinc-300">
                    {sessionState === 'ONLINE' ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </div>
              </button>

              {/* MIC Tile */}
              <button
                type="button"
                onClick={() => sendDockCommand('toggle-mute')}
                className={`group relative h-[110px] w-[90px] rounded-2xl border backdrop-blur-xl p-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                  voiceState === 'OPEN'
                    ? 'border-cyan-400/60 bg-gradient-to-b from-cyan-500/25 to-cyan-950/40 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:bg-cyan-500/35'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-cyan-400/40 text-zinc-300 hover:text-cyan-200 shadow-sm'
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                    voiceState === 'OPEN'
                      ? 'bg-cyan-400/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-white/5 text-zinc-400 group-hover:text-cyan-300 group-hover:bg-cyan-500/10'
                  }`}
                >
                  {voiceState === 'MUTED' ? <RiMicOffLine size={19} /> : <RiMicLine size={19} />}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-black tracking-widest uppercase">{voiceState}</span>
                  <span className="text-[7.5px] font-mono text-zinc-400 group-hover:text-zinc-300">
                    {voiceState === 'MUTED' ? 'UNMUTE' : 'MUTE'}
                  </span>
                </div>
              </button>
            </div>

            {/* Center Column: Curved Glass Prompt Deck */}
            <form onSubmit={submitPrompt} className="min-w-0 flex flex-col justify-between">
              <div className="relative h-[110px] rounded-2xl border border-white/10 bg-black/25 backdrop-blur-xl p-2.5 transition-all focus-within:border-emerald-400/50 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.15)] flex flex-col justify-between">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const text = prompt.trim()
                      if (!text) return
                      sendDockCommand('text-command', { text, intent: 'queue' })
                      setPrompt('')
                    } else if (e.key === 'Escape') {
                      setDockExpanded(false)
                    }
                  }}
                  className="w-full flex-1 resize-none bg-transparent text-xs font-mono text-emerald-100 outline-none placeholder:text-zinc-500 scrollbar-none"
                  placeholder="Type command for Nexus AI... (Enter to send, Shift+Enter for newline)"
                  rows={2}
                />
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest text-zinc-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Dynamic Island Pinned</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!prompt.trim()) return
                        sendDockCommand('text-command', { text: prompt, intent: 'steer' })
                        setPrompt('')
                      }}
                      className="h-7 px-3 rounded-full border border-cyan-400/35 bg-cyan-500/10 text-[9px] font-black tracking-wider text-cyan-200 hover:bg-cyan-400 hover:text-black hover:border-cyan-300 flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-95"
                    >
                      <RiGitBranchLine size={12} /> STEER
                    </button>
                    <button
                      type="submit"
                      className="h-7 px-3.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-[9px] font-black tracking-wider text-emerald-200 hover:bg-emerald-400 hover:text-black hover:border-emerald-300 flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] active:scale-95"
                    >
                      <RiSendPlane2Line size={12} /> QUEUE
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Right Column: Dynamic Island Retraction Notch */}
            <button
              type="button"
              onClick={() => setDockExpanded(false)}
              className="group h-[110px] w-8 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-emerald-500/15 hover:border-emerald-400/40 text-zinc-400 hover:text-emerald-300 transition-all flex flex-col items-center justify-center gap-2 shadow-sm"
              title="Collapse Island"
            >
              <RiArrowUpSLine size={18} className="transition-transform group-hover:-translate-y-1" />
              <span className="text-[7px] font-mono tracking-widest text-zinc-500 group-hover:text-emerald-300 uppercase [writing-mode:vertical-lr] rotate-180">
                HIDE
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
