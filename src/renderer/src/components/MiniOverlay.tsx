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
  RiSendPlane2Line
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
    <div className="w-full h-full flex items-center justify-between gap-2 px-3 bg-zinc-950/90 backdrop-blur-xl rounded-full border border-emerald-500/30 drag-region overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-3 no-drag">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 ${isSystemActive ? (isTalking ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_#10b981]' : 'border-emerald-500/50 bg-emerald-900/20') : 'border-zinc-700 bg-zinc-900'}`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${isSystemActive ? (isTalking ? 'bg-emerald-400' : 'bg-emerald-600') : 'bg-red-900'}`}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 no-drag">
        <button
          onClick={toggleMic}
          disabled={!isSystemActive}
          className={`p-2.5 rounded-full transition-all ml-1 ${!isSystemActive ? 'opacity-30' : isMicMuted ? 'text-red-500 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}
        >
          {isMicMuted ? <RiMicOffLine size={18} /> : <RiMicLine size={18} />}
        </button>

        <button
          onClick={toggleSystem}
          className={`p-3 rounded-full border transition-all duration-500 shadow-lg mx-1 ${isSystemActive ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : isSystemStarting ? 'bg-amber-500/15 border-amber-400 text-amber-200' : 'bg-zinc-800 border-zinc-600 text-zinc-500 hover:text-red-400'}`}
        >
          <GiPowerButton size={20} className={isSystemActive || isSystemStarting ? 'animate-pulse' : ''} />
        </button>

        <button
          onClick={() => handleVisionClick('camera')}
          disabled={!isSystemActive}
          className={`p-2.5 rounded-full transition-all ${!isSystemActive ? 'opacity-30' : isVideoOn && visionMode === 'camera' ? 'text-red-400 bg-red-500/10 animate-pulse border border-red-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Toggle Camera"
        >
          <RiCameraLine size={18} />
        </button>

        <form
          onSubmit={submitTextCommand}
          className={`group flex h-11 items-center overflow-hidden rounded-full border border-emerald-400/20 bg-black/45 text-zinc-100 transition-all duration-300 ease-out ${textCommand ? 'w-72' : 'w-11 hover:w-72 focus-within:w-72'}`}
          title="Text command"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center text-emerald-300">
            <RiChat3Line size={17} />
          </div>
          <input
            value={textCommand}
            onChange={(event) => setTextCommand(event.target.value)}
            placeholder="Type command..."
            className={`min-w-0 flex-1 bg-transparent pr-2 text-xs font-semibold text-white outline-none placeholder:text-zinc-600 transition-opacity duration-200 ${textCommand ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
          />
          <button
            type="submit"
            disabled={!textCommand.trim() || isSendingText}
            className={`mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-35 ${textCommand ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
          >
            {isSendingText ? <RiLoader4Line className="animate-spin" size={15} /> : <RiSendPlane2Line size={15} />}
          </button>
        </form>

        <button
          onClick={() => handleVisionClick('screen')}
          disabled={!isSystemActive}
          className={`p-2.5 rounded-full transition-all ${!isSystemActive ? 'opacity-30' : isVideoOn && visionMode === 'screen' ? 'text-red-400 bg-red-500/10 animate-pulse border border-red-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
          title="Toggle Screen"
        >
          <RiComputerLine size={18} />
        </button>
      </div>

      <div className="pl-4 border-l border-emerald-500/20 no-drag flex items-center gap-2">
        <button
          onClick={expand}
          className="p-2 rounded-full text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
        >
          <RiFullscreenLine size={16} />
        </button>
        <div className="drag-region cursor-move text-emerald-500/30">
          <RiDragMove2Fill size={14} />
        </div>
      </div>
    </div>
  )
}

export default MiniOverlay
