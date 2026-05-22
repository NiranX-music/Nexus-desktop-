import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  RiArrowUpSLine,
  RiCloseLine,
  RiComputerLine,
  RiGitBranchLine,
  RiMicLine,
  RiMicOffLine,
  RiPhoneFill,
  RiSendPlane2Line
} from 'react-icons/ri'

const sendDockCommand = (command: string, payload?: any) => {
  window.electron?.ipcRenderer?.send('dock-command', command, payload)
}

export default function NexusDock() {
  const [prompt, setPrompt] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [sessionState, setSessionState] = useState('STANDBY')
  const [voiceState, setVoiceState] = useState('MUTED')
  const collapseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const api = window.electron?.ipcRenderer
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
    window.electron?.ipcRenderer?.send(value ? 'dock-expand' : 'dock-collapse')
  }

  const scheduleDockCollapse = () => {
    clearCollapseTimer()
    collapseTimerRef.current = window.setTimeout(() => {
      setExpanded(false)
      window.electron?.ipcRenderer?.send('dock-collapse')
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
      className="h-screen w-screen bg-transparent text-zinc-100 select-none overflow-hidden"
    >
      <div
        className={`mx-auto w-full h-full overflow-hidden border-x border-b border-emerald-500/30 bg-black/90 backdrop-blur-2xl shadow-[0_0_35px_rgba(16,185,129,0.2)] transition-all duration-200 ${expanded ? 'rounded-b-2xl p-3' : 'rounded-b-md p-0'}`}
      >
        {!expanded && (
          <div className="h-full w-full drag-region bg-emerald-400/80 shadow-[0_0_18px_rgba(52,211,153,0.6)]" />
        )}

        {expanded && (
          <>
        <div className="h-8 flex items-center justify-between gap-3 drag-region">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center text-[10px] font-black text-emerald-300 no-drag">
              NX
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-[0.24em] text-emerald-300 uppercase truncate">
                Nexus 9.1 Dock
              </div>
              {!expanded && (
                <div className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase truncate">
                  Hover for command controls
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 no-drag">
            <span
              className={`hidden sm:inline-flex h-6 items-center rounded-md border px-2 text-[8px] font-black tracking-widest ${sessionState === 'STARTING' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : sessionState === 'ONLINE' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-zinc-500'}`}
            >
              {sessionState}
            </span>
            <button
              onClick={() => sendDockCommand('open-desktop')}
              className="h-7 w-7 rounded-md border border-white/10 bg-white/5 text-zinc-400 hover:text-emerald-300"
              title="Open desktop app"
            >
              <RiComputerLine className="mx-auto" />
            </button>
            <button
              onClick={() => sendDockCommand('close-dock')}
              className="h-7 w-7 rounded-md border border-white/10 bg-white/5 text-zinc-400 hover:text-red-300"
              title="Close dock"
            >
              <RiCloseLine className="mx-auto" />
            </button>
          </div>
        </div>

          <div className="pt-3 grid grid-cols-[auto_1fr_auto] gap-3 items-stretch no-drag">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => sendDockCommand('start-session')}
                className="h-20 w-24 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-400 hover:text-black flex flex-col items-center justify-center gap-1"
              >
                <RiPhoneFill size={20} />
                <span className="text-[8px] font-black tracking-widest">SESSION</span>
              </button>
              <button
                onClick={() => sendDockCommand('toggle-mute')}
                className="h-20 w-24 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-300 hover:text-black flex flex-col items-center justify-center gap-1"
              >
                {voiceState === 'MUTED' ? <RiMicOffLine size={20} /> : <RiMicLine size={20} />}
                <span className="text-[8px] font-black tracking-widest">{voiceState}</span>
              </button>
            </div>

            <form onSubmit={submitPrompt} className="min-w-0 flex flex-col gap-2">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="h-20 w-full resize-none rounded-xl border border-emerald-500/20 bg-black/70 p-3 text-xs font-mono text-emerald-50 outline-none placeholder:text-zinc-600 focus:border-emerald-400/60"
                placeholder="Type command for Nexus AI..."
              />
              <div className="flex items-center justify-between gap-2">
                <div className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
                  Dock is pinned to screen top
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!prompt.trim()) return
                      sendDockCommand('text-command', { text: prompt, intent: 'steer' })
                      setPrompt('')
                    }}
                    className="h-8 px-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-[9px] font-black tracking-widest text-cyan-200 hover:bg-cyan-300 hover:text-black flex items-center gap-2"
                  >
                    <RiGitBranchLine /> STEER
                  </button>
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-black tracking-widest text-emerald-200 hover:bg-emerald-400 hover:text-black flex items-center gap-2"
                  >
                    <RiSendPlane2Line /> QUEUE
                  </button>
                </div>
              </div>
            </form>

            <button
              onClick={() => setDockExpanded(false)}
              className="h-full w-10 rounded-xl border border-white/10 bg-white/5 text-zinc-500 hover:text-emerald-300"
              title="Collapse"
            >
              <RiArrowUpSLine className="mx-auto" size={24} />
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
