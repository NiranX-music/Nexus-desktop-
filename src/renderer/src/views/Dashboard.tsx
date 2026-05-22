import { useEffect, useCallback, useRef, useState } from 'react'
import Sphere from '@renderer/components/Sphere'
import {
  RiCpuLine,
  RiCameraLine,
  RiTerminalBoxLine,
  RiSwapBoxLine,
  RiLayoutGridLine,
  RiMicLine,
  RiMicOffLine,
  RiPhoneFill,
  RiHistoryLine,
  RiPulseLine,
  RiWifiLine,
  RiServerLine,
  RiEarthLine,
  RiSendPlane2Line,
  RiGitBranchLine,
  RiListCheck2,
  RiAttachment2,
  RiMusic2Line,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiSkipBackLine,
  RiSkipForwardLine
} from 'react-icons/ri'
import { FaMemory } from 'react-icons/fa6'
import { GiTinker } from 'react-icons/gi'
import { HiComputerDesktop } from 'react-icons/hi2'
import * as faceapi from 'face-api.js'
import { VisionMode } from '@renderer/IndexRoot'
import { nexusService } from '@renderer/services/nexus-voice-ai'
import {
  DEFAULT_LIVE_GEMINI_MODEL,
  GEMINI_MODEL_OPTIONS,
  normalizeGeminiLiveModel
} from '@renderer/config/gemini-models'
import {
  controlMediaSession,
  getMediaSessions,
  MediaControlAction,
  MediaSessionItem
} from '@renderer/functions/media-control-api'

interface NexusProps {
  isSystemActive: boolean
  isSystemStarting: boolean
  toggleSystem: () => void | Promise<void>
  isMicMuted: boolean
  toggleMic: () => void
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
  activeStream: MediaStream | null
}

interface DashboardViewProps {
  props: NexusProps
  stats: any
  chatHistory: any[]
  onVisionClick: () => void
}

const glassPanel =
  'rounded-xl border border-white/10 bg-zinc-950/55 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl'
const liveGeminiModelOptions = GEMINI_MODEL_OPTIONS.filter((model) => model.live)

const formatMediaTime = (milliseconds = 0) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0:00'
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

const getMediaAppLabel = (source = '') => {
  if (!source) return 'System Media'
  if (/spotify/i.test(source)) return 'Spotify'
  if (/chrome/i.test(source)) return 'Chrome'
  if (/edge/i.test(source)) return 'Edge'
  if (/vlc/i.test(source)) return 'VLC'
  return source
    .replace(/!.*$/, '')
    .split('.')
    .filter(Boolean)
    .slice(-2)
    .join(' ')
    .replace(/_/g, ' ')
}

type QueuedCommand = {
  id: string
  text: string
  intent: 'queue' | 'steer'
  createdAt: string
}

export default function DashboardView({
  props,
  stats,
  chatHistory,
  onVisionClick
}: DashboardViewProps) {
  const {
    isSystemActive,
    isSystemStarting,
    isVideoOn,
    visionMode,
    startVision,
    activeStream,
    toggleMic,
    toggleSystem,
    isMicMuted
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const faceScanInterval = useRef<NodeJS.Timeout | null>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)

  const [networkStats, setNetworkStats] = useState({ ping: 24, rate: 1.2, tx: 40, rx: 60 })
  const [commandText, setCommandText] = useState('')
  const [commandQueue, setCommandQueue] = useState<QueuedCommand[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nexus_command_queue') || '[]')
    } catch {
      return []
    }
  })
  const [commandStatus, setCommandStatus] = useState('AI text command path is ready.')
  const [sharedFiles, setSharedFiles] = useState<File[]>([])
  const [mediaSessions, setMediaSessions] = useState<MediaSessionItem[]>([])
  const [mediaStatus, setMediaStatus] = useState('Scanning media transport.')
  const [selectedModel, setSelectedModel] = useState(
    normalizeGeminiLiveModel(localStorage.getItem('nexus_default_ai_model')) ||
      DEFAULT_LIVE_GEMINI_MODEL
  )

  const activeMedia =
    mediaSessions.find((session) => session.status === 'Playing') ||
    mediaSessions.find((session) => session.isCurrent) ||
    mediaSessions[0] ||
    null

  const mediaProgress =
    activeMedia && activeMedia.durationMs > 0
      ? Math.min(100, Math.max(0, (activeMedia.positionMs / activeMedia.durationMs) * 100))
      : 0

  const refreshMediaSessions = useCallback(async () => {
    const sessions = await getMediaSessions()
    const visibleSessions = sessions.filter((session) => session.title || session.artist)
    setMediaSessions(visibleSessions)
    setMediaStatus(
      visibleSessions.length > 0 ? 'Media transport synced.' : 'No active media session.'
    )
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatHistory])

  useEffect(() => {
    localStorage.setItem('nexus_command_queue', JSON.stringify(commandQueue))
  }, [commandQueue])

  useEffect(() => {
    let cancelled = false

    const loadMediaSessions = async () => {
      const sessions = await getMediaSessions()
      if (cancelled) return
      const visibleSessions = sessions.filter((session) => session.title || session.artist)
      setMediaSessions(visibleSessions)
      setMediaStatus(
        visibleSessions.length > 0 ? 'Media transport synced.' : 'No active media session.'
      )
    }

    loadMediaSessions()
    const timer = setInterval(loadMediaSessions, 5000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!isSystemActive || commandQueue.length === 0) return

    const timer = setInterval(async () => {
      const next = commandQueue[0]
      if (!next || !nexusService.isConnected) return

      try {
        await nexusService.sendTextPrompt(next.text, next.intent)
        setCommandQueue((items) => items.slice(1))
        setCommandStatus(`${next.intent === 'steer' ? 'Steered' : 'Queued'} request sent.`)
      } catch {
        setCommandStatus('Queue is waiting for Nexus AI to come online.')
      }
    }, 1800)

    return () => clearInterval(timer)
  }, [isSystemActive, commandQueue])

  useEffect(() => {
    if (!isSystemActive) {
      setNetworkStats({ ping: 0, rate: 0.0, tx: 0, rx: 0 })
      return
    }

    const interval = setInterval(() => {
      setNetworkStats({
        ping: Math.floor(Math.random() * (45 - 12 + 1)) + 12,
        rate: +(Math.random() * 8.5 + 0.5).toFixed(2),
        tx: Math.floor(Math.random() * 100),
        rx: Math.floor(Math.random() * 100)
      })
    }, 1700)

    return () => clearInterval(interval)
  }, [isSystemActive])

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = './models'
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ])
        setModelsLoaded(true)
      } catch (e) {}
    }
    loadModels()
  }, [])

  useEffect(() => {
    if (
      isVideoOn &&
      visionMode === 'camera' &&
      modelsLoaded &&
      videoElementRef.current &&
      canvasRef.current
    ) {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)

      faceScanInterval.current = setInterval(async () => {
        const video = videoElementRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState !== 4 || video.videoWidth === 0) return

        try {
          const vw = video.videoWidth
          const vh = video.videoHeight

          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw
            canvas.height = vh
          }

          const ctx = canvas.getContext('2d')
          if (!ctx) return

          const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
          const detection = await faceapi
            .detectSingleFace(video, options)
            .withFaceExpressions()
            .withAgeAndGender()

          ctx.clearRect(0, 0, vw, vh)

          if (detection) {
            const { x, y, width, height } = detection.detection.box

            const mirroredX = vw - x - width

            ctx.strokeStyle = '#34d399'
            ctx.lineWidth = 4
            const l = 25

            ctx.beginPath()
            ctx.moveTo(mirroredX, y + l)
            ctx.lineTo(mirroredX, y)
            ctx.lineTo(mirroredX + l, y)
            ctx.moveTo(mirroredX + width - l, y)
            ctx.lineTo(mirroredX + width, y)
            ctx.lineTo(mirroredX + width, y + l)
            ctx.moveTo(mirroredX, y + height - l)
            ctx.lineTo(mirroredX, y + height)
            ctx.lineTo(mirroredX + l, y + height)
            ctx.moveTo(mirroredX + width - l, y + height)
            ctx.lineTo(mirroredX + width, y + height)
            ctx.lineTo(mirroredX + width, y + height - l)
            ctx.stroke()

            const expressions = detection.expressions
            const domExp = Object.keys(expressions).reduce((a, b) =>
              expressions[a] > expressions[b] ? a : b
            )
            const gender = detection.gender === 'male' ? 'M' : 'F'
            const age = Math.round(detection.age)
            const labelText = ` ID:${gender} | AGE:${age} | ${domExp.toUpperCase()} `

            ctx.fillStyle = 'rgba(10, 10, 10, 0.85)'
            ctx.fillRect(mirroredX, y - 32, width, 26)

            ctx.fillStyle = '#34d399'
            ctx.font = 'bold 16px monospace'
            ctx.fillText(labelText, mirroredX + 5, y - 14)
          } else {
            ctx.fillStyle = 'rgba(52, 211, 153, 0.8)'
            ctx.font = 'bold 14px monospace'
            ctx.fillText('SCANNING OPTICS...', 20, 30)
          }
        } catch (e) {}
      }, 250)
    } else {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    }

    return () => {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
    }
  }, [isVideoOn, visionMode, modelsLoaded])

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoElementRef.current = node
      if (node && activeStream && isVideoOn) {
        node.srcObject = activeStream
        node.onloadedmetadata = () => node.play().catch(() => {})
      }
    },
    [activeStream, isVideoOn, visionMode]
  )

  const setMobileVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node && activeStream && isVideoOn) {
        node.srcObject = activeStream
        node.onloadedmetadata = () => node.play().catch(() => {})
      }
    },
    [activeStream, isVideoOn, visionMode]
  )

  const toggleSource = () => {
    if (!isSystemActive) return
    const nextMode = visionMode === 'camera' ? 'screen' : 'camera'
    startVision(nextMode)
  }

  const handleMediaAction = async (action: MediaControlAction) => {
    if (!activeMedia) return
    setMediaStatus(`${action} command sent.`)
    const result = await controlMediaSession(activeMedia.index, action)
    setMediaStatus(result.success ? 'Media command acknowledged.' : result.error || 'Media failed.')
    await refreshMediaSessions()
  }

  const readSharedFiles = async () => {
    if (sharedFiles.length === 0) return ''

    const fileBlocks = await Promise.all(
      sharedFiles.slice(0, 5).map(async (file) => {
        const text = await file.text()
        const clipped = text.length > 18000 ? `${text.slice(0, 18000)}\n[TRUNCATED]` : text
        return `\n\n--- FILE: ${file.name} (${Math.round(file.size / 1024)} KB) ---\n${clipped}`
      })
    )

    return `\n\nUse these shared files as context for the answer:${fileBlocks.join('')}`
  }

  const submitTextCommand = async (intent: 'queue' | 'steer') => {
    const text = commandText.trim()
    if (!text && sharedFiles.length === 0) return

    const sharedContext = await readSharedFiles()
    const finalText = `${text || 'Read the shared files and summarize what matters.'}${sharedContext}`

    if (/\b(whiteboard|board|draw|diagram|annotate|solve on board)\b/i.test(finalText)) {
      localStorage.setItem(
        'nexus_whiteboard_request',
        JSON.stringify({ prompt: finalText, createdAt: Date.now() })
      )
      window.dispatchEvent(new CustomEvent('nexus-whiteboard-request', { detail: finalText }))
      setCommandStatus('Whiteboard request sent to the annotation board.')
    }

    if (intent === 'steer' && isSystemActive && nexusService.isConnected) {
      try {
        await nexusService.sendTextPrompt(finalText, 'steer')
        setCommandText('')
        setSharedFiles([])
        setCommandStatus('Steer command sent into the live AI response.')
        return
      } catch {}
    }

    setCommandQueue((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        text: finalText,
        intent,
        createdAt: new Date().toLocaleTimeString()
      }
    ])
    setCommandText('')
    setSharedFiles([])
    setCommandStatus(
      intent === 'steer'
        ? 'Steer command queued until Nexus AI is online.'
        : 'Request added to the AI queue.'
    )
  }

  const systemMetrics = [
    {
      icon: <RiCpuLine />,
      bgIcon: <RiCpuLine size={140} />,
      label: 'CPU LOAD',
      val: isSystemActive && stats ? `${stats.cpu}%` : '--',
      raw: isSystemActive && stats ? stats.cpu : 0,
      colorClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500',
      glowClass: 'via-emerald-500/50',
      shadowClass: 'shadow-[0_0_8px_#10b981]',
      bgGradient: 'from-emerald-950/30 to-black/60',
      pattern:
        'bg-[linear-gradient(to_right,#10b98108_1px,transparent_1px),linear-gradient(to_bottom,#10b98108_1px,transparent_1px)] bg-[size:12px_12px]'
    },
    {
      icon: <FaMemory />,
      bgIcon: <FaMemory size={140} />,
      label: 'RAM USAGE',
      val: isSystemActive && stats ? `${stats.memory.usedPercentage}%` : '--',
      raw: isSystemActive && stats ? stats.memory.usedPercentage : 0,
      colorClass: 'text-cyan-400',
      bgClass: 'bg-cyan-500',
      glowClass: 'via-cyan-500/50',
      shadowClass: 'shadow-[0_0_8px_#06b6d4]',
      bgGradient: 'from-cyan-950/30 to-black/60',
      pattern: 'bg-[radial-gradient(#06b6d415_1px,transparent_1px)] bg-[size:10px_10px]'
    },
    {
      icon: <GiTinker />,
      bgIcon: <GiTinker size={140} />,
      label: 'TEMP',
      val: isSystemActive && stats ? `${stats.temperature}°C` : '--',
      raw: isSystemActive && stats ? Math.min((stats.temperature / 90) * 100, 100) : 0,
      colorClass: 'text-orange-400',
      bgClass: 'bg-orange-500',
      glowClass: 'via-orange-500/50',
      shadowClass: 'shadow-[0_0_8px_#f97316]',
      bgGradient: 'from-orange-950/30 to-black/60',
      pattern:
        'bg-[radial-gradient(ellipse_at_top_right,#f9731626,transparent_64%)]'
    },
    {
      icon: <HiComputerDesktop />,
      bgIcon: <HiComputerDesktop size={140} />,
      label: 'OS',
      val: isSystemActive && stats ? `${stats.os.type}` : '--',
      raw: 0,
      colorClass: 'text-purple-400',
      bgClass: 'bg-purple-500',
      glowClass: 'via-purple-500/50',
      shadowClass: '',
      bgGradient: 'from-purple-950/30 to-black/60',
      pattern:
        'bg-[linear-gradient(45deg,#a855f708_25%,transparent_25%,transparent_50%,#a855f708_50%,#a855f708_75%,transparent_75%,transparent)] bg-[size:24px_24px]',
      hideBar: true
    }
  ]

  return (
    <div className="flex-1 min-h-0 p-4 bg-white/[0.02] grid grid-cols-12 gap-4 h-full overflow-hidden relative animate-in fade-in zoom-in duration-300 w-full">
      <div className="hidden lg:flex col-span-3 min-h-0 flex-col gap-3 overflow-y-auto pr-1 pb-2 z-40 scrollbar-small">
        <div
          className={`${glassPanel} h-[224px] shrink-0 flex flex-col p-1 overflow-hidden relative group`}
        >
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isVideoOn ? 'bg-red-500 animate-pulse shadow-[0_0_8px_red]' : 'bg-zinc-600'}`}
            />
            <span
              className={`text-[9px] font-bold tracking-widest ${isVideoOn ? 'text-red-400/80' : 'text-zinc-600'}`}
            >
              {isVideoOn
                ? visionMode === 'screen'
                  ? 'SCREEN FEED'
                  : 'OPTICAL FEED'
                : 'OPTICS OFFLINE'}
            </span>
          </div>

          {isVideoOn && (
            <button
              onClick={toggleSource}
              className="absolute top-2 right-2 z-30 p-1.5 rounded-md bg-black/50 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all"
            >
              <RiSwapBoxLine size={14} />
            </button>
          )}

          <div
            className={`w-full h-full rounded-xl overflow-hidden bg-black/20 relative border border-white/5 transition-all ${isVideoOn ? 'opacity-100' : 'opacity-30'}`}
          >
            <video
              key={visionMode}
              ref={setVideoRef}
              className={`absolute inset-0 w-full h-full object-cover ${visionMode === 'camera' ? '-scale-x-100' : ''}`}
              autoPlay
              playsInline
              muted
            />

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20"
            />

            {!isVideoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-50">
                <RiCameraLine size={24} />
                <span className="text-[9px] font-mono">NO SIGNAL</span>
              </div>
            )}
          </div>
        </div>

        <div
          className={`${glassPanel} h-[120px] shrink-0 p-3 flex flex-col justify-between relative overflow-hidden`}
        >
          <div
            className={`absolute inset-0 bg-linear-to-r from-emerald-500/5 to-transparent transition-opacity duration-1000 ${isSystemActive ? 'opacity-100' : 'opacity-0'}`}
          />

          <div className="flex items-center justify-between border-b border-white/10 pb-2 relative z-10">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400 flex items-center gap-1">
              <RiPulseLine className={isSystemActive ? 'text-emerald-500 animate-pulse' : ''} />{' '}
              NETWORK TELEMETRY
            </span>
            <span
              className={`text-[8px] px-2 py-0.5 rounded-full font-mono font-bold border ${isSystemActive ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-zinc-600 border-zinc-800 bg-zinc-900'}`}
            >
              {isSystemActive ? 'SECURE UPLINK' : 'STANDBY'}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2 relative z-10">
            <div className="flex flex-col">
              <span className="text-[8px] text-zinc-600 font-mono tracking-widest flex items-center gap-1">
                WSS LATENCY
              </span>
              <span className="text-xs font-bold text-emerald-50 font-mono flex items-center gap-1.5 transition-all">
                <RiWifiLine className={isSystemActive ? 'text-emerald-400' : 'text-zinc-600'} />
                {isSystemActive ? `${networkStats.ping}ms` : '--'}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[8px] text-zinc-600 font-mono tracking-widest">
                PACKET RATE
              </span>
              <span className="text-xs font-bold text-emerald-50 font-mono transition-all">
                {isSystemActive ? `${networkStats.rate} MB/s` : '--'}
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[8px] text-zinc-600 font-mono tracking-widest">ROUTING</span>
              <span className="text-xs font-bold text-emerald-50 font-mono flex items-center gap-1.5">
                {isSystemActive ? 'GLOBAL' : 'LOCAL'}
                {isSystemActive ? (
                  <RiEarthLine className="text-cyan-400" />
                ) : (
                  <RiServerLine className="text-zinc-500" />
                )}
              </span>
            </div>
          </div>

          <div className="w-full flex flex-col gap-1 mt-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-zinc-500 w-3">TX</span>
              <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981] transition-all duration-300 ease-out"
                  style={{ width: `${isSystemActive ? networkStats.tx : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-zinc-500 w-3">RX</span>
              <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] transition-all duration-300 ease-out delay-75"
                  style={{ width: `${isSystemActive ? networkStats.rx : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${glassPanel} h-36 shrink-0 p-3 flex flex-col gap-2 relative overflow-hidden`}
        >
          <div className="absolute inset-0 bg-linear-to-r from-cyan-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold tracking-widest text-zinc-400">
              <RiMusic2Line
                className={activeMedia?.status === 'Playing' ? 'text-cyan-300 animate-pulse' : ''}
              />
              NOW PLAYING
            </span>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-mono font-bold uppercase ${activeMedia?.status === 'Playing' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-white/5 text-zinc-500'}`}
            >
              {activeMedia?.status || 'IDLE'}
            </span>
          </div>

          <div className="relative z-10 min-w-0">
            <div className="truncate text-xs font-black text-zinc-100">
              {activeMedia?.title || 'No media detected'}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-widest text-zinc-500">
              <span className="truncate">
                {activeMedia
                  ? activeMedia.artist ||
                    activeMedia.albumTitle ||
                    getMediaAppLabel(activeMedia.source)
                  : mediaStatus}
              </span>
              <span className="shrink-0 text-cyan-300/70">
                {activeMedia ? getMediaAppLabel(activeMedia.source) : '--'}
              </span>
            </div>
          </div>

          <div className="relative z-10 min-w-0">
            <div className="h-1 overflow-hidden rounded-full border border-white/5 bg-black/60">
              <div
                className="h-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.7)] transition-all duration-500"
                style={{ width: `${activeMedia ? mediaProgress : 0}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[8px] font-mono text-zinc-600">
              <span>{formatMediaTime(activeMedia?.positionMs || 0)}</span>
              <span>{formatMediaTime(activeMedia?.durationMs || 0)}</span>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2">
            <button
              onClick={() => handleMediaAction('previous')}
              disabled={!activeMedia?.canPrevious}
              className="flex h-8 min-w-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-400 transition hover:border-cyan-400/30 hover:text-cyan-200 disabled:opacity-35"
              title="Previous media"
              aria-label="Previous media"
            >
              <RiSkipBackLine />
            </button>
            <button
              onClick={() => handleMediaAction('toggle')}
              disabled={!activeMedia}
              className="flex h-8 min-w-0 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-300 hover:text-black disabled:opacity-35"
              title="Play or pause media"
              aria-label="Play or pause media"
            >
              {activeMedia?.status === 'Playing' ? <RiPauseCircleLine /> : <RiPlayCircleLine />}
            </button>
            <button
              onClick={() => handleMediaAction('next')}
              disabled={!activeMedia?.canNext}
              className="flex h-8 min-w-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-400 transition hover:border-cyan-400/30 hover:text-cyan-200 disabled:opacity-35"
              title="Next media"
              aria-label="Next media"
            >
              <RiSkipForwardLine />
            </button>
          </div>
        </div>

        <div className={`${glassPanel} min-h-[172px] shrink-0 p-3 flex flex-col gap-3`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400">
              <RiLayoutGridLine className="inline mr-1" /> CORE METRICS
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 pb-1">
            {systemMetrics.map((m, i) => (
              <div
                key={i}
                className={`cursor-pointer relative rounded-xl p-2.5 flex flex-col justify-between border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300 bg-linear-to-br ${m.bgGradient}`}
              >
                <div
                  className={`absolute inset-0 ${m.pattern} opacity-30 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none`}
                />

                <div
                  className={`absolute -bottom-8 -right-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 transform group-hover:scale-110 pointer-events-none ${m.colorClass}`}
                >
                  {m.bgIcon}
                </div>

                <div
                  className={`absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent ${m.glowClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                <div className="relative z-10 flex justify-between items-start text-zinc-500">
                  <span
                    className={`text-base ${m.colorClass} opacity-70 group-hover:opacity-100 transition-opacity`}
                  >
                    {m.icon}
                  </span>
                  <span className="text-[8px] font-mono tracking-widest uppercase opacity-70 group-hover:opacity-100 transition-opacity text-zinc-300">
                    {m.label}
                  </span>
                </div>

                <div className="relative z-10 flex flex-col gap-1.5 mt-2">
                  <span className="text-sm font-bold text-white text-right font-mono tracking-wider drop-shadow-md">
                    {m.val}
                  </span>

                  {!m.hideBar && (
                    <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
                      <div
                        className={`h-full ${m.bgClass} ${m.shadowClass} transition-all duration-700 ease-out`}
                        style={{ width: isSystemActive ? `${m.raw}%` : '0%' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-6 relative isolate flex min-h-0 flex-col items-center overflow-hidden pb-3">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute left-1/2 top-[42%] h-[min(58vh,540px)] w-[min(58vh,540px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#10b98126_0%,#06b6d41a_36%,transparent_70%)] blur-3xl" />
          <div className="nexus-core-grid absolute left-1/2 top-[42%] h-[min(62vh,580px)] w-[min(62vh,580px)] -translate-x-1/2 -translate-y-1/2 opacity-60" />
        </div>

        <div
          className={`lg:hidden absolute top-4 right-4 w-32 h-24 ${glassPanel} z-50 overflow-hidden ${isVideoOn ? 'block' : 'hidden'}`}
        >
          <video
            ref={setMobileVideoRef}
            className={`w-full h-full object-cover ${visionMode === 'camera' ? '-scale-x-100' : ''}`}
            autoPlay
            playsInline
            muted
          />
        </div>

        <div className="relative z-10 flex min-h-0 w-full flex-1 items-center justify-center px-2">
          <div
            className={`group/core relative flex aspect-square h-[min(56vh,540px)] min-h-[300px] max-h-[540px] w-full max-w-[540px] items-center justify-center transition-all duration-1000 ${isSystemActive || isSystemStarting ? 'opacity-100 scale-100' : 'opacity-80 scale-95 grayscale'}`}
          >
            <div className="absolute inset-0 rounded-full border border-emerald-300/10 bg-[radial-gradient(circle,#031915_0%,#020807_48%,transparent_68%)] shadow-[0_0_90px_rgba(16,185,129,0.12)]" />
            <div className="absolute inset-[5%] rounded-full border border-emerald-300/15 animate-[nexus-orbit_18s_linear_infinite]" />
            <div className="absolute inset-[13%] rounded-full border border-cyan-300/10 animate-[nexus-orbit-reverse_26s_linear_infinite]" />
            <div className="absolute inset-[22%] rounded-full border border-white/5" />

            <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full border border-emerald-300/20 bg-black/60 px-4 py-1.5 text-center shadow-[0_0_28px_rgba(16,185,129,0.16)] backdrop-blur-md">
              <div className="text-[9px] font-black uppercase tracking-[0.28em] text-emerald-200">
                Nexus Core
              </div>
              <div className="mt-0.5 text-[8px] font-mono uppercase tracking-widest text-zinc-500">
                {isSystemStarting ? 'BOOTING' : isSystemActive ? 'ONLINE' : 'STANDBY'}
              </div>
            </div>

            <div className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-start gap-1 sm:flex">
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">
                Vision
              </span>
              <span
                className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${isVideoOn ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200' : 'border-white/10 bg-white/5 text-zinc-500'}`}
              >
                {isVideoOn ? visionMode : 'Off'}
              </span>
            </div>

            <div className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-1 sm:flex">
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">
                Voice
              </span>
              <span
                className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${isMicMuted ? 'border-red-300/30 bg-red-500/10 text-red-300' : 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'}`}
              >
                {isMicMuted ? 'Muted' : 'Live'}
              </span>
            </div>

            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[8px] font-mono uppercase tracking-widest text-zinc-500 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              Neural lattice synced
            </div>

            <div className="relative h-[78%] w-[78%] overflow-hidden rounded-full">
              <Sphere />
            </div>
          </div>
        </div>

        <div className="relative z-50 w-[min(94vw,620px)] shrink-0">
          <div className="flex flex-col gap-2">
            <div
              className={`${glassPanel} grid grid-cols-3 gap-2 border border-emerald-400/15 p-2 shadow-[0_0_38px_rgba(0,0,0,0.52)]`}
            >
              <button
                onClick={onVisionClick}
                className={`flex h-12 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-widest transition-all ${isVideoOn ? 'border-red-400/30 bg-red-500/15 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.12)]' : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:border-cyan-300/30 hover:text-cyan-200'}`}
                title="Vision source"
              >
                {isVideoOn ? <RiSwapBoxLine size={20} /> : <RiCameraLine size={20} />}
                <span className="hidden sm:inline">Vision</span>
              </button>
              <button
                onClick={toggleSystem}
                className={`relative flex h-12 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${isSystemStarting ? 'border-amber-300/50 bg-amber-400/15 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.2)]' : isSystemActive ? 'border-emerald-300/40 bg-emerald-400 text-black shadow-[0_0_26px_rgba(52,211,153,0.42)]' : 'border-red-400/40 bg-red-500/10 text-red-300'}`}
                title="Core"
              >
                <RiPhoneFill
                  size={21}
                  className={isSystemActive || isSystemStarting ? 'animate-pulse' : ''}
                />
                <span>{isSystemStarting ? 'Booting' : isSystemActive ? 'Online' : 'Core'}</span>
              </button>
              <button
                onClick={toggleMic}
                className={`flex h-12 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-widest transition-all ${isMicMuted ? 'border-red-400/30 bg-red-500/15 text-red-300' : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200 hover:border-emerald-300/45'}`}
                title="Voice"
              >
                {isMicMuted ? <RiMicOffLine size={20} /> : <RiMicLine size={20} />}
                <span className="hidden sm:inline">{isMicMuted ? 'Muted' : 'Voice'}</span>
              </button>
            </div>

            <div className={`${glassPanel} border border-emerald-500/15 p-2`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 px-1 text-[9px] font-mono uppercase tracking-widest text-zinc-500">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
                  <span className="truncate">
                    {sharedFiles.length > 0
                      ? `${sharedFiles.length} file(s) staged`
                      : commandQueue.length > 0
                        ? `${commandQueue.length} queued`
                        : 'Command uplink ready'}
                  </span>
                </div>
                <select
                  value={selectedModel}
                  onChange={(event) => {
                    const nextModel = normalizeGeminiLiveModel(event.target.value)
                    setSelectedModel(nextModel)
                    nexusService.setModel(nextModel)
                  }}
                  className="h-8 max-w-56 shrink-0 rounded-lg border border-white/10 bg-black/70 px-2 text-[9px] font-mono text-zinc-300 outline-none focus:border-emerald-400/50"
                  title="AI model"
                >
                  {liveGeminiModelOptions.map((model) => (
                    <option key={model.id} className="bg-black" value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => setSharedFiles(Array.from(event.target.files || []))}
                />
                <input
                  value={commandText}
                  onChange={(event) => setCommandText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      submitTextCommand('queue')
                    }
                  }}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/70 px-4 text-xs font-mono text-emerald-50 shadow-inner outline-none placeholder:text-zinc-600 focus:border-emerald-400/60 focus:bg-black/85"
                  placeholder="Enter AI text command..."
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-11 w-11 shrink-0 rounded-lg border transition ${sharedFiles.length > 0 ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-400 hover:border-emerald-300/30 hover:text-emerald-300'}`}
                  title="Share files with AI"
                >
                  <RiAttachment2 className="mx-auto" size={18} />
                </button>
                <button
                  onClick={() => submitTextCommand('queue')}
                  className="h-11 w-11 shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-400 hover:text-black"
                  title="Queue request"
                >
                  <RiListCheck2 className="mx-auto" size={18} />
                </button>
                <button
                  onClick={() => submitTextCommand('steer')}
                  className="h-11 w-11 shrink-0 rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 transition hover:bg-cyan-300 hover:text-black"
                  title="Steer live response"
                >
                  <RiGitBranchLine className="mx-auto" size={18} />
                </button>
                <button
                  onClick={() => submitTextCommand('steer')}
                  className="h-11 w-11 shrink-0 rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white hover:text-black"
                  title="Send now"
                >
                  <RiSendPlane2Line className="mx-auto" size={18} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[9px] font-mono uppercase tracking-widest text-zinc-500">
                <span className="truncate">
                  {sharedFiles.length > 0
                    ? `${sharedFiles.length} file(s) ready for AI read`
                    : commandStatus}
                </span>
                <span className="shrink-0 text-emerald-400/70">{commandQueue.length} queued</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex col-span-3 min-h-0 flex-col overflow-hidden h-full z-40">
        <div className={`${glassPanel} h-full p-4 flex flex-col`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400">
              <RiTerminalBoxLine className="inline mr-1" /> TRANSCRIPT
            </span>
            <span className="text-[8px] font-mono text-emerald-500/50">LIVE-LOG</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-small">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-2 opacity-50">
                <RiHistoryLine size={24} />
                <span className="text-[9px] tracking-widest uppercase font-mono">
                  No Data Stream
                </span>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[95%] py-2 px-3 rounded-lg text-[11px] leading-relaxed border font-mono font-semibold ${msg.role === 'user' ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-100/90 rounded-br-none' : 'bg-zinc-900/50 border-white/5 text-zinc-400 rounded-bl-none'}`}
                  >
                    {msg.parts && msg.parts[0] ? msg.parts[0].text : msg.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
