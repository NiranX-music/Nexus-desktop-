import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiCloseLine,
  RiShieldCheckLine,
  RiShieldFlashLine,
  RiPlayFill,
  RiStopFill,
  RiVolumeMuteLine,
  RiVolumeUpLine,
  RiHeadphoneLine,
  RiFullscreenLine,
  RiFullscreenExitLine
} from 'react-icons/ri'
import { startFocusSession, stopFocusSession, getFocusStatus } from '@renderer/tools/focus-api'

export default function FocusWidget() {
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimal, setIsMinimal] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [plannedMinutes, setPlannedMinutes] = useState(25)
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60)
  const [terminatedApps, setTerminatedApps] = useState<string[]>([])
  const [ambientSound, setAmbientSound] = useState<'off' | 'binaural' | 'pink'>('off')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioNodeRef = useRef<any>(null)

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsVisible(true)
      if (e.detail?.minutes) {
        setPlannedMinutes(e.detail.minutes)
        setSecondsRemaining(e.detail.minutes * 60)
      }
    }
    const handleStatusChanged = (e: any) => {
      if (e.detail?.isActive !== undefined) {
        setIsActive(e.detail.isActive)
        if (!e.detail.isActive) stopAmbientSound()
      }
    }

    window.addEventListener('show-focus', handleOpen)
    window.addEventListener('focus-status-changed', handleStatusChanged)

    getFocusStatus().then((res) => {
      if (res.session?.isActive) {
        setIsActive(true)
        const elapsed = (Date.now() - res.session.startTime) / 1000
        const total = (res.session.plannedMinutes || 25) * 60
        setSecondsRemaining(Math.max(0, Math.floor(total - elapsed)))
      }
    })

    return () => {
      window.removeEventListener('show-focus', handleOpen)
      window.removeEventListener('focus-status-changed', handleStatusChanged)
      stopAmbientSound()
    }
  }, [])

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            handleComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, secondsRemaining])

  const handleStart = async () => {
    setStatusMsg('ENGAGING SHIELD & PURGING DISTRACTIONS...')
    const res = await startFocusSession(plannedMinutes)
    setIsActive(true)
    setSecondsRemaining(plannedMinutes * 60)
    setStatusMsg('DEEP WORK PROTOCOL ENGAGED')
    setTimeout(() => setStatusMsg(null), 3000)
  }

  const handleStop = async () => {
    await stopFocusSession()
    setIsActive(false)
    stopAmbientSound()
    setStatusMsg('PROTOCOL DEACTIVATED')
    setTimeout(() => setStatusMsg(null), 3000)
  }

  const handleComplete = async () => {
    await stopFocusSession()
    setIsActive(false)
    stopAmbientSound()
    setStatusMsg('SESSION COMPLETE! EXCELLENT FOCUS.')
  }

  // Web Audio Synth for Ambient Sound (Zero latency / no network needed)
  const toggleAmbientSound = (mode: 'binaural' | 'pink') => {
    if (ambientSound === mode) {
      stopAmbientSound()
      setAmbientSound('off')
      return
    }

    stopAmbientSound()
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContextClass()
      audioCtxRef.current = ctx

      if (mode === 'binaural') {
        // 432 Hz + 442 Hz Binaural Beat for deep neural focus
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()

        osc1.frequency.setValueAtTime(432, ctx.currentTime)
        osc2.frequency.setValueAtTime(442, ctx.currentTime)
        gain.gain.setValueAtTime(0.04, ctx.currentTime)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)

        osc1.start()
        osc2.start()
        audioNodeRef.current = { osc1, osc2, gain }
      } else {
        // Pink / Brown Noise Buffer
        const bufferSize = ctx.sampleRate * 2
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const output = noiseBuffer.getChannelData(0)
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1
          b0 = 0.99886 * b0 + white * 0.0555179
          b1 = 0.99332 * b1 + white * 0.0750759
          b2 = 0.969 * b2 + white * 0.153852
          b3 = 0.8665 * b3 + white * 0.3104856
          b4 = 0.55 * b4 + white * 0.5329522
          b5 = -0.7616 * b5 - white * 0.016898
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.03
          b6 = white * 0.115926
        }

        const whiteNoise = ctx.createBufferSource()
        whiteNoise.buffer = noiseBuffer
        whiteNoise.loop = true

        const gainNode = ctx.createGain()
        gainNode.gain.setValueAtTime(0.04, ctx.currentTime)

        whiteNoise.connect(gainNode)
        gainNode.connect(ctx.destination)

        whiteNoise.start()
        audioNodeRef.current = { whiteNoise, gainNode }
      }

      setAmbientSound(mode)
    } catch (err) {
      console.error('[FocusAudio] Failed to initialize ambient generator:', err)
    }
  }

  const stopAmbientSound = () => {
    try {
      if (audioNodeRef.current) {
        if (audioNodeRef.current.osc1) {
          audioNodeRef.current.osc1.stop()
          audioNodeRef.current.osc2.stop()
        }
        if (audioNodeRef.current.whiteNoise) {
          audioNodeRef.current.whiteNoise.stop()
        }
        audioNodeRef.current = null
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
    } catch {}
    setAmbientSound('off')
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!isVisible) return null

  // Minimal Pill Mode (Pinned at Screen Edge)
  if (isMinimal) {
    return (
      <div className="fixed bottom-6 right-6 z-9700">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-950/90 border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.25)] backdrop-blur-xl cursor-pointer"
          onClick={() => setIsMinimal(false)}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-xs font-bold text-white tracking-widest">
            {formatTime(secondsRemaining)}
          </span>
          <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">
            {isActive ? 'FOCUS ENGAGED' : 'PAUSED'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsMinimal(false)
            }}
            className="text-zinc-500 hover:text-white ml-1"
          >
            <RiFullscreenLine size={13} />
          </button>
        </motion.div>
      </div>
    )
  }

  // Maximal Control HUD
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-9700 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-xl bg-zinc-950/85 border border-white/10 rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <RiShieldCheckLine size={18} />
              </div>
              <div>
                <h2 className="text-white text-sm font-bold tracking-wide uppercase">
                  Deep Work Protocol
                </h2>
                <p className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">
                  Distraction Shield • Ambient Focus Audio • Pomodoro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {statusMsg && (
                <span className="text-[11px] font-mono px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 animate-pulse">
                  {statusMsg}
                </span>
              )}
              <button
                onClick={() => setIsMinimal(true)}
                title="Minimize to HUD Pill"
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
              >
                <RiFullscreenExitLine size={17} />
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
              >
                <RiCloseLine size={20} />
              </button>
            </div>
          </div>

          {/* Main Body */}
          <div className="p-6 flex flex-col items-center gap-6">
            {/* Countdown Circle */}
            <div className="relative flex flex-col items-center justify-center w-56 h-56 rounded-full border border-emerald-500/20 bg-emerald-950/10 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
              <div
                className={`absolute inset-0 rounded-full border border-emerald-500/40 ${
                  isActive ? 'animate-pulse' : ''
                }`}
              />
              <span className="text-4xl font-mono font-bold text-white tracking-widest">
                {formatTime(secondsRemaining)}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mt-1">
                {isActive ? 'DISTRACTION SHIELD ACTIVE' : 'STANDBY MODE'}
              </span>
            </div>

            {/* Duration Selector */}
            {!isActive && (
              <div className="flex items-center gap-2">
                {[15, 25, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setPlannedMinutes(mins)
                      setSecondsRemaining(mins * 60)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition border ${
                      plannedMinutes === mins
                        ? 'bg-emerald-500 text-black font-bold border-emerald-400'
                        : 'bg-zinc-900/80 text-zinc-400 hover:text-white border-white/5'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            )}

            {/* Ambient Sound Toggles */}
            <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2">
                <RiHeadphoneLine className="text-zinc-400" size={16} />
                <span className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider">
                  Neural Ambient Audio
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAmbientSound('binaural')}
                  className={`px-3 py-1 rounded text-[10px] font-mono uppercase transition border ${
                    ambientSound === 'binaural'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-white/5'
                  }`}
                >
                  432Hz Binaural
                </button>
                <button
                  onClick={() => toggleAmbientSound('pink')}
                  className={`px-3 py-1 rounded text-[10px] font-mono uppercase transition border ${
                    ambientSound === 'pink'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border-white/5'
                  }`}
                >
                  Pink Noise
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex gap-3">
              {isActive ? (
                <button
                  onClick={handleStop}
                  className="flex-1 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 font-mono font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2"
                >
                  <RiStopFill size={16} />
                  Deactivate Protocol
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  className="flex-1 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                >
                  <RiPlayFill size={16} />
                  Engage Deep Work Protocol ({plannedMinutes}m)
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
