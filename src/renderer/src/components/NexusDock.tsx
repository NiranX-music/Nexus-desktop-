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
  const collapseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const api = (window as any).electron?.ipcRenderer
    if (!api) return

    api.on('dock-command', (_event: any, message: any) => {
      if (message?.command === 'session-state') {
        setSessionState(
          message.payload?.starting ? 'STARTING' : message.payload?.active ? 'ONLINE' : 'STANDBY'
        )
        setVoiceState(message.payload?.muted ? 'MUTED' : 'OPEN')
      }
    })

    return () => api.removeAllListeners('dock-command')
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
      className="h-full w-full bg-transparent text-zinc-100 select-none overflow-hidden flex flex-col items-center justify-start pt-1 px-2 pb-1 font-sans"
    >
      {!expanded ? (
        /* COLLAPSED DYNAMIC ISLAND PILL */
        <div
          onClick={() => setDockExpanded(true)}
          className="group relative flex h-10 w-full max-w-[248px] items-center justify-between rounded-full border border-white/20 bg-zinc-950/80 px-3 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_20px_rgba(16,185,129,0.18)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300 hover:max-w-[256px] hover:border-emerald-400/50 hover:shadow-[0_12px_36px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.35),0_0_28px_rgba(16,185,129,0.3)] cursor-pointer drag-region"
        >
          {/* Subtle Ambient Back-Glow */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10 opacity-70 group-hover:opacity-100 transition-opacity" />

          {/* Left: NX Pill Logo & Live Beacon */}
          <div className="relative z-10 flex items-center gap-2 min-w-0 no-drag">
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600/35 to-teal-400/25 border border-emerald-400/50 text-[9px] font-black text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
              <span>NX</span>
              <span
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${
                  sessionState === 'ONLINE'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : sessionState === 'STARTING'
                      ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse'
                      : 'bg-zinc-600'
                }`}
              >
                {sessionState === 'ONLINE' && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold tracking-wider text-zinc-200 group-hover:text-emerald-300 transition-colors uppercase truncate">
                {sessionState === 'ONLINE'
                  ? 'Nexus Live'
                  : sessionState === 'STARTING'
                    ? 'Connecting'
                    : 'Nexus 9.1'}
              </span>
            </div>
          </div>

          {/* Center: Live Soundwave or Breathing Indicator */}
          <div className="relative z-10 flex items-center gap-0.5 h-4 px-1 no-drag">
            {sessionState === 'ONLINE' && voiceState === 'OPEN' ? (
              <div className="flex items-center gap-0.5">
                <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-[island-wave-1_0.7s_ease-in-out_infinite]" />
                <span className="w-0.5 h-4 bg-emerald-300 rounded-full animate-[island-wave-2_0.5s_ease-in-out_infinite_0.1s]" />
                <span className="w-0.5 h-2 bg-teal-300 rounded-full animate-[island-wave-3_0.8s_ease-in-out_infinite_0.2s]" />
                <span className="w-0.5 h-3.5 bg-emerald-400 rounded-full animate-[island-wave-1_0.6s_ease-in-out_infinite_0.15s]" />
              </div>
            ) : (
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <span className="h-1 w-1 rounded-full bg-emerald-400/80" />
                <span className="h-1 w-3 rounded-full bg-white/20 group-hover:bg-emerald-400/40 transition-colors" />
                <span className="h-1 w-1 rounded-full bg-cyan-400/80" />
              </div>
            )}
          </div>

          {/* Right: Mic Status Chip & Expand Chevron */}
          <div className="relative z-10 flex items-center gap-1.5 no-drag">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-all ${
                voiceState === 'OPEN'
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                  : 'border-white/10 bg-white/5 text-zinc-400'
              }`}
            >
              {voiceState === 'MUTED' ? <RiMicOffLine size={12} /> : <RiMicLine size={12} />}
            </div>
            <RiArrowDownSLine
              size={15}
              className="text-zinc-500 group-hover:text-emerald-300 group-hover:translate-y-0.5 transition-all"
            />
          </div>
        </div>
      ) : (
        /* EXPANDED DYNAMIC ISLAND COCKPIT */
        <div className="relative flex flex-col h-full w-full overflow-hidden rounded-[26px] border border-white/20 bg-zinc-950/80 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_35px_rgba(16,185,129,0.18)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300">
          {/* Ambient Lighting Orbs for Glass Morphism */}
          <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-80 rounded-full bg-gradient-to-r from-emerald-500/20 via-teal-400/15 to-cyan-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 right-10 h-20 w-44 rounded-full bg-cyan-500/10 blur-2xl" />

          {/* Header Bar: Dynamic Island Notch Header */}
          <div className="relative z-10 h-7 flex items-center justify-between gap-3 drag-region">
            {/* Brand Emblem & Island Title */}
            <div className="flex items-center gap-2.5 min-w-0 no-drag">
              <div className="h-6 w-6 rounded-full border border-emerald-400/50 bg-gradient-to-tr from-emerald-600/35 to-teal-400/25 flex items-center justify-center text-[10px] font-black text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                NX
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-black tracking-[0.2em] bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent uppercase truncate">
                  Nexus 9.1 Island
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-mono tracking-widest text-emerald-300 uppercase">
                  <RiSparklingLine size={10} /> Dynamic Dock
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
                className={`group relative h-[114px] w-[96px] rounded-2xl border backdrop-blur-xl p-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                  sessionState === 'ONLINE'
                    ? 'border-emerald-400/60 bg-gradient-to-b from-emerald-500/25 to-emerald-950/45 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:bg-emerald-500/35'
                    : sessionState === 'STARTING'
                      ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/20 to-amber-950/35 text-amber-200 animate-pulse'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-emerald-400/40 text-zinc-300 hover:text-emerald-200 shadow-sm'
                }`}
              >
                <div
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                    sessionState === 'ONLINE'
                      ? 'bg-emerald-400/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                      : 'bg-white/5 text-zinc-400 group-hover:text-emerald-300 group-hover:bg-emerald-500/10'
                  }`}
                >
                  <RiPhoneFill size={20} />
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
                className={`group relative h-[114px] w-[96px] rounded-2xl border backdrop-blur-xl p-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                  voiceState === 'OPEN'
                    ? 'border-cyan-400/60 bg-gradient-to-b from-cyan-500/25 to-cyan-950/45 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:bg-cyan-500/35'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-cyan-400/40 text-zinc-300 hover:text-cyan-200 shadow-sm'
                }`}
              >
                <div
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                    voiceState === 'OPEN'
                      ? 'bg-cyan-400/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-white/5 text-zinc-400 group-hover:text-cyan-300 group-hover:bg-cyan-500/10'
                  }`}
                >
                  {voiceState === 'MUTED' ? <RiMicOffLine size={20} /> : <RiMicLine size={20} />}
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
              <div className="relative h-[114px] rounded-2xl border border-white/10 bg-black/45 backdrop-blur-xl p-2.5 transition-all focus-within:border-emerald-400/50 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.15)] flex flex-col justify-between">
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
              className="group h-[114px] w-9 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-emerald-500/15 hover:border-emerald-400/40 text-zinc-400 hover:text-emerald-300 transition-all flex flex-col items-center justify-center gap-2 shadow-sm"
              title="Collapse Island"
            >
              <RiArrowUpSLine size={20} className="transition-transform group-hover:-translate-y-1" />
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
