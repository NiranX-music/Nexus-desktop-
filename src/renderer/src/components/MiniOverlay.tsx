import { FormEvent, useState, useEffect, useRef } from 'react'
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
import { nexusService } from '@renderer/services/nexus-voice-ai'
import { VisionMode } from '@renderer/IndexRoot'

interface OverlayProps {
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
  const [isTalking, setIsTalking] = useState(false)
  const [textCommand, setTextCommand] = useState('')
  const [isSendingText, setIsSendingText] = useState(false)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | any | null>(null)

  useEffect(() => {
    if (isSystemActive && nexusService.analyser) {
      analyzerRef.current = nexusService.analyser
      dataArrayRef.current = new Uint8Array(nexusService.analyser.frequencyBinCount)
      const checkAudio = () => {
        if (analyzerRef.current && dataArrayRef.current) {
          analyzerRef.current.getByteFrequencyData(dataArrayRef.current)
          const avg = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length
          setIsTalking(avg > 10)
        }
        if (isSystemActive) requestAnimationFrame(checkAudio)
      }
      checkAudio()
    } else {
      setIsTalking(false)
    }
  }, [isSystemActive])

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
    <div className="group/dock inline-flex max-w-[calc(100vw-14px)] items-center justify-center gap-1 rounded-full border border-emerald-300/30 bg-zinc-950/80 px-2.5 py-2 text-zinc-100 shadow-[0_20px_70px_rgba(0,0,0,0.55),0_0_36px_rgba(16,185,129,0.14)] backdrop-blur-2xl drag-region transition-all duration-300 hover:border-emerald-200/55 hover:bg-black/90">
      <div className="flex min-w-0 items-center gap-2 pr-1 no-drag">
        <div
          className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all duration-300 ${isSystemActive ? (isTalking ? 'border-emerald-300 bg-emerald-400/20 shadow-[0_0_24px_rgba(52,211,153,0.55)]' : 'border-emerald-400/45 bg-emerald-900/25') : 'border-zinc-700 bg-zinc-900'}`}
          title={isSystemActive ? (isTalking ? 'Nexus speaking' : 'Nexus online') : 'Nexus standby'}
        >
          <RiSparklingLine className={`absolute text-[18px] ${isTalking ? 'text-emerald-100 animate-pulse' : 'text-emerald-500/70'}`} />
          <div
            className={`absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full border border-black transition-colors duration-300 ${isSystemActive ? (isTalking ? 'bg-emerald-200' : 'bg-emerald-500') : 'bg-red-700'}`}
          />
        </div>
        <div className="hidden min-w-0 pr-1 sm:block">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
            Nexus Dock
          </p>
          <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            Win+Shift+N
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 no-drag">
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
          <GiPowerButton size={20} className={isSystemActive || isSystemStarting ? 'animate-pulse' : ''} />
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
          className={`group/text flex h-11 min-w-0 items-center overflow-hidden rounded-full border border-emerald-300/18 bg-black/55 text-zinc-100 transition-all duration-300 ease-out ${textCommand ? 'w-72' : 'w-11 group-hover/dock:w-72 hover:w-72 focus-within:w-72'}`}
          title="Text command"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center text-emerald-200">
            <RiChat3Line size={17} />
          </div>
          <input
            value={textCommand}
            onChange={(event) => setTextCommand(event.target.value)}
            placeholder="Type command..."
            className={`min-w-0 flex-1 bg-transparent pr-2 text-xs font-semibold text-white outline-none placeholder:text-zinc-600 transition-opacity duration-200 ${textCommand ? 'opacity-100' : 'opacity-0 group-hover/dock:opacity-100 group-hover/text:opacity-100 group-focus-within/text:opacity-100'}`}
          />
          <button
            type="submit"
            disabled={!textCommand.trim() || isSendingText}
            className={`mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-35 ${textCommand ? 'opacity-100' : 'opacity-0 group-hover/dock:opacity-100 group-hover/text:opacity-100 group-focus-within/text:opacity-100'}`}
            aria-label="Send text command"
          >
            {isSendingText ? <RiLoader4Line className="animate-spin" size={15} /> : <RiSendPlane2Line size={15} />}
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

      <div className="ml-1 flex shrink-0 items-center gap-1 border-l border-emerald-300/15 pl-2 no-drag">
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
  )
}

export default MiniOverlay
