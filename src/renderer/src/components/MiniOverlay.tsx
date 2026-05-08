import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import {
  RiChat3Line,
  RiMicLine,
  RiMicOffLine,
  RiComputerLine,
  RiCameraLine,
  RiFullscreenLine,
  RiDragMove2Fill,
  RiLoader4Line,
  RiSendPlane2Line,
  RiSparklingLine
} from 'react-icons/ri'
import { GiPowerButton } from 'react-icons/gi'
import type { AssistantVisualState, VisionMode } from '@renderer/IndexRoot'
import { IS_TRIAL_BUILD } from '@renderer/config/app-mode'

interface OverlayProps {
  assistantVisualState: AssistantVisualState
  isSystemActive: boolean
  isSystemStarting: boolean
  toggleSystem: () => void
  isMicMuted: boolean
  toggleMic: () => void
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
  sendTextCommand: (command: string) => Promise<void>
}

const MiniOverlay = ({
  assistantVisualState,
  isSystemActive,
  isSystemStarting,
  toggleSystem,
  isMicMuted,
  toggleMic,
  isVideoOn,
  visionMode,
  startVision,
  stopVision,
  sendTextCommand
}: OverlayProps) => {
  const dockRef = useRef<HTMLDivElement | null>(null)
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [textCommand, setTextCommand] = useState('')
  const [isSendingText, setIsSendingText] = useState(false)
  const [isDockExpanded, setIsDockExpanded] = useState(false)
  const [isComposerFocused, setIsComposerFocused] = useState(false)

  const isSpeaking = assistantVisualState === 'speaking'
  const isRunning = assistantVisualState === 'running' || assistantVisualState === 'speaking'
  const dockStateClass = isSpeaking
    ? 'is-speaking'
    : isRunning || isSystemStarting
      ? 'is-running'
      : 'is-offline'

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
  }

  const setDockExpanded = (expanded: boolean) => {
    setIsDockExpanded((current) => {
      if (current !== expanded) {
        window.electron.ipcRenderer.send('overlay-dock:set-expanded', expanded)
      }

      return expanded
    })
  }

  const resetDockMotion = () => {
    if (!dockRef.current) return

    dockRef.current.style.setProperty('--dock-cursor-x', '50%')
    dockRef.current.style.setProperty('--dock-cursor-y', '18%')
    dockRef.current.style.setProperty('--dock-pan-x', '0px')
    dockRef.current.style.setProperty('--dock-lift-y', '0px')
    dockRef.current.style.setProperty('--dock-tilt-x', '0deg')
    dockRef.current.style.setProperty('--dock-tilt-y', '0deg')
  }

  const collapseDock = () => {
    if (textCommand.trim() || isSendingText || isComposerFocused) return
    setDockExpanded(false)
    resetDockMotion()
  }

  const scheduleCollapse = () => {
    clearCollapseTimer()
    collapseTimerRef.current = setTimeout(() => {
      collapseDock()
    }, 140)
  }

  useEffect(() => {
    resetDockMotion()

    return () => {
      clearCollapseTimer()
      window.electron.ipcRenderer.send('overlay-dock:set-expanded', false)
    }
  }, [])

  useEffect(() => {
    if (textCommand.trim()) {
      clearCollapseTimer()
      setDockExpanded(true)
      return
    }

    if (!isComposerFocused && !isSendingText) scheduleCollapse()
  }, [textCommand, isComposerFocused, isSendingText])

  const handleVisionClick = (mode: 'camera' | 'screen') => {
    if (isVideoOn && visionMode === mode) {
      stopVision()
    } else {
      startVision(mode)
    }
  }

  const expand = () => {
    window.electron.ipcRenderer.send('toggle-overlay')
  }

  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    const element = dockRef.current
    if (!element) return

    const bounds = element.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    const offsetX = (x - 0.5) * (isDockExpanded ? 18 : 6)
    const offsetY = (0.5 - y) * (isDockExpanded ? 6 : 2)

    element.style.setProperty('--dock-cursor-x', `${(x * 100).toFixed(2)}%`)
    element.style.setProperty('--dock-cursor-y', `${(y * 100).toFixed(2)}%`)
    element.style.setProperty('--dock-pan-x', `${offsetX.toFixed(2)}px`)
    element.style.setProperty('--dock-lift-y', `${offsetY.toFixed(2)}px`)
    element.style.setProperty('--dock-tilt-x', `${((0.5 - y) * 2.4).toFixed(2)}deg`)
    element.style.setProperty('--dock-tilt-y', `${((x - 0.5) * 4.6).toFixed(2)}deg`)
  }

  const submitTextCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = textCommand.trim()
    if (!command || isSendingText) return

    setIsSendingText(true)
    try {
      await sendTextCommand(command)
      setTextCommand('')
    } finally {
      setIsSendingText(false)
    }
  }

  return (
    <div
      ref={dockRef}
      onMouseEnter={() => {
        clearCollapseTimer()
        setDockExpanded(true)
      }}
      onMouseLeave={() => {
        scheduleCollapse()
      }}
      onMouseMove={handlePointerMove}
      className={`nexus-dock-shell ${dockStateClass} ${isDockExpanded ? 'is-expanded' : 'is-collapsed'} drag-region inline-flex max-w-[calc(100vw-10px)] items-center text-zinc-100 backdrop-blur-2xl`}
    >
      <div className="nexus-dock-spectrum" />
      <div className="nexus-dock-scan" />
      <div className="nexus-dock-cursor-glow" />

      <div className="nexus-dock-core no-drag">
        <div
          className={`relative grid shrink-0 place-items-center rounded-full border transition-all duration-300 ${isDockExpanded ? 'h-10 w-10' : 'h-6 w-6'} ${isSystemActive ? (isSpeaking ? 'border-emerald-300 bg-emerald-400/20 shadow-[0_0_24px_rgba(52,211,153,0.55)]' : 'border-emerald-400/45 bg-emerald-900/25') : 'border-zinc-700 bg-zinc-900'}`}
          title={
            isSystemActive ? (isSpeaking ? 'Nexus speaking' : 'Nexus online') : 'Nexus standby'
          }
        >
          <RiSparklingLine
            className={`${isDockExpanded ? 'text-[18px]' : 'text-[12px]'} absolute ${isSpeaking ? 'text-emerald-100 animate-pulse' : 'text-emerald-500/70'}`}
          />
          <div
            className={`absolute rounded-full border border-black transition-colors duration-300 ${isDockExpanded ? 'bottom-1.5 right-1.5 h-2.5 w-2.5' : 'bottom-0.5 right-0.5 h-1.5 w-1.5'} ${isSystemActive ? (isSpeaking ? 'bg-emerald-200' : 'bg-emerald-500') : 'bg-red-700'}`}
          />
        </div>

        <div className="nexus-dock-core-copy min-w-0 pr-1">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
            {IS_TRIAL_BUILD ? 'Nexus Trial Dock' : 'Nexus Dock'}
          </p>
          <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            {IS_TRIAL_BUILD
              ? 'Local core controls'
              : isSpeaking
                ? 'Voice live'
                : isRunning
                  ? 'Always ready'
                  : 'Win+Shift+N'}
          </p>
        </div>
      </div>

      <div className="nexus-dock-expanded-content no-drag">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            onClick={toggleMic}
            disabled={!isSystemActive}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all ${!isSystemActive ? 'cursor-not-allowed border-white/5 bg-white/5 text-zinc-700' : isMicMuted ? 'border-red-400/25 bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'}`}
            title={isMicMuted ? 'Unmute voice' : 'Mute voice'}
            aria-label={isMicMuted ? 'Unmute voice' : 'Mute voice'}
          >
            {isMicMuted ? <RiMicOffLine size={18} /> : <RiMicLine size={18} />}
          </button>

          <button
            onClick={toggleSystem}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-all duration-500 shadow-lg ${isSystemActive ? 'border-emerald-300 bg-emerald-400/18 text-emerald-100 shadow-emerald-500/20' : isSystemStarting ? 'border-amber-300/70 bg-amber-400/15 text-amber-100' : 'border-zinc-600 bg-zinc-900 text-zinc-500 hover:border-emerald-300/35 hover:text-emerald-200'}`}
            title={isSystemActive ? 'Turn voice assistant off' : 'Start voice assistant'}
            aria-label={isSystemActive ? 'Turn voice assistant off' : 'Start voice assistant'}
          >
            <GiPowerButton
              size={20}
              className={isSystemActive || isSystemStarting ? 'animate-pulse' : ''}
            />
          </button>

          <button
            onClick={() => handleVisionClick('camera')}
            disabled={!isSystemActive}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all ${!isSystemActive ? 'cursor-not-allowed border-white/5 bg-white/5 text-zinc-700' : isVideoOn && visionMode === 'camera' ? 'animate-pulse border-cyan-300/45 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-cyan-300/25 hover:bg-cyan-300/10 hover:text-cyan-100'}`}
            title="Toggle Camera"
            aria-label="Toggle camera"
          >
            <RiCameraLine size={18} />
          </button>

          <form
            onSubmit={submitTextCommand}
            className={`nexus-dock-text-command flex h-11 min-w-0 items-center overflow-hidden rounded-full border border-emerald-300/18 bg-black/55 text-zinc-100 transition-all duration-300 ease-out ${textCommand || isComposerFocused ? 'is-active' : ''}`}
            title="Text command"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center text-emerald-200">
              <RiChat3Line size={17} />
            </div>
            <input
              value={textCommand}
              onChange={(event) => setTextCommand(event.target.value)}
              onFocus={() => {
                clearCollapseTimer()
                setIsComposerFocused(true)
                setDockExpanded(true)
              }}
              onBlur={() => {
                setIsComposerFocused(false)
                scheduleCollapse()
              }}
              placeholder="Type command..."
              className="min-w-0 flex-1 bg-transparent pr-2 text-xs font-semibold text-white outline-none placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={!textCommand.trim() || isSendingText}
              className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Send text command"
            >
              {isSendingText ? (
                <RiLoader4Line className="animate-spin" size={15} />
              ) : (
                <RiSendPlane2Line size={15} />
              )}
            </button>
          </form>

          <button
            onClick={() => handleVisionClick('screen')}
            disabled={!isSystemActive}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all ${!isSystemActive ? 'cursor-not-allowed border-white/5 bg-white/5 text-zinc-700' : isVideoOn && visionMode === 'screen' ? 'animate-pulse border-orange-300/45 bg-orange-300/15 text-orange-100' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-orange-300/25 hover:bg-orange-300/10 hover:text-orange-100'}`}
            title="Toggle Screen"
            aria-label="Toggle screen capture"
          >
            <RiComputerLine size={18} />
          </button>
        </div>

        <div className="ml-1 flex shrink-0 items-center gap-1 border-l border-emerald-300/15 pl-2">
          <button
            onClick={expand}
            className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 transition-all hover:bg-emerald-500/10 hover:text-emerald-300"
            title="Expand Nexus"
            aria-label="Expand Nexus"
          >
            <RiFullscreenLine size={16} />
          </button>
          <div className="drag-region cursor-move px-1 text-emerald-500/30" title="Drag dock">
            <RiDragMove2Fill size={14} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default MiniOverlay
