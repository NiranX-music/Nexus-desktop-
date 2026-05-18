import { FormEvent, useEffect, useCallback, useRef, useState } from 'react'
import Sphere from '@renderer/components/Sphere'
import MarkdownMath from '@renderer/components/MarkdownMath'
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
  RiEarthLine,
  RiSendPlane2Line,
  RiBatteryChargeLine,
  RiTimeLine,
  RiMusic2Line,
  RiPauseFill,
  RiPlayFill,
  RiRefreshLine,
  RiSkipBackFill,
  RiSkipForwardFill,
  RiComputerLine
} from 'react-icons/ri'
import { FaMemory } from 'react-icons/fa6'
import { GiTinker } from 'react-icons/gi'
import { HiComputerDesktop } from 'react-icons/hi2'
import * as faceapi from 'face-api.js'
import type { AssistantVisualState, VisionMode } from '@renderer/IndexRoot'
import type { RequestQueueItem, RequestRoutingMode } from '@renderer/hooks/useNexusRequestQueue'
import {
  controlMediaSession,
  getMediaSessions,
  MediaSessionItem
} from '@renderer/functions/media-control-api'
import type { SystemStats } from '@renderer/services/system-info'

interface NexusProps {
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
  activeStream: MediaStream | null
  sendTextCommand: (command: string) => Promise<void>
  activeRequest: RequestQueueItem | null
  requestQueue: RequestQueueItem[]
  requestRoutingMode: RequestRoutingMode
  setRequestRoutingMode: (mode: RequestRoutingMode) => void
}

interface DashboardViewProps {
  props: NexusProps
  stats: SystemStats | null
  chatHistory: any[]
  onVisionClick: () => void
  assistantVisualState: AssistantVisualState
  isActive: boolean
}

const glassPanel = 'nexus-glass-card'

const formatBytesPerSecond = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

const metricPercent = (value: unknown) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.max(0, Math.min(100, numericValue))
}

const formatMediaTime = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function DashboardView({
  props,
  stats,
  chatHistory,
  onVisionClick,
  assistantVisualState,
  isActive
}: DashboardViewProps) {
  const {
    assistantVisualState: propAssistantVisualState,
    isSystemActive,
    isVideoOn,
    visionMode,
    startVision,
    activeStream,
    toggleMic,
    toggleSystem,
    isMicMuted,
    isSystemStarting,
    sendTextCommand,
    activeRequest,
    requestQueue,
    requestRoutingMode,
    setRequestRoutingMode
  } = props
  const resolvedAssistantVisualState = assistantVisualState || propAssistantVisualState

  const scrollRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceScanInterval = useRef<NodeJS.Timeout | null>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [textCommand, setTextCommand] = useState('')
  const [textCommandStatus, setTextCommandStatus] = useState('')
  const [isSendingTextCommand, setIsSendingTextCommand] = useState(false)
  const [mediaSessions, setMediaSessions] = useState<MediaSessionItem[]>([])
  const [mediaStatus, setMediaStatus] = useState('Scanning media')

  const submitTextCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = textCommand.trim()
    if (!command || isSendingTextCommand) return

    setIsSendingTextCommand(true)

    try {
      const wasSteering = requestRoutingMode === 'steer'
      const requestPromise = sendTextCommand(command)
      setTextCommand('')
      setTextCommandStatus(
        wasSteering
          ? 'Steering request moved to the front.'
          : activeRequest || requestQueue.length > 0
            ? 'Request added to queue.'
            : isSystemActive
              ? 'Request accepted.'
              : 'Request queued. Core will start.'
      )
      requestPromise.catch((error: any) => {
        setTextCommandStatus(error?.message || 'Queued request failed.')
      })
    } catch (error: any) {
      setTextCommandStatus(error?.message || 'Unable to send text command.')
    } finally {
      setIsSendingTextCommand(false)
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatHistory])

  const refreshMediaSessions = useCallback(async () => {
    const sessions = await getMediaSessions()
    setMediaSessions(sessions)
    setMediaStatus(
      sessions.length > 0
        ? `${sessions.length} session${sessions.length === 1 ? '' : 's'}`
        : 'No media'
    )
  }, [])

  useEffect(() => {
    if (!isActive) return

    refreshMediaSessions()
    const timer = setInterval(() => {
      if (!document.hidden) {
        void refreshMediaSessions()
      }
    }, 10000)
    return () => clearInterval(timer)
  }, [isActive, refreshMediaSessions])

  const handleMediaControl = async (
    session: MediaSessionItem,
    action: 'play' | 'pause' | 'toggle' | 'next' | 'previous'
  ) => {
    setMediaStatus('Sending command')
    const result = await controlMediaSession(session.index, action)
    setMediaStatus(result.success ? 'Command sent' : result.error || 'Command failed')
    setTimeout(refreshMediaSessions, 450)
  }

  useEffect(() => {
    if (!isActive || !isVideoOn || visionMode !== 'camera' || modelsLoaded) return

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
    void loadModels()
  }, [isActive, isVideoOn, visionMode, modelsLoaded])

  useEffect(() => {
    if (
      isActive &&
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
      }, 650)
    } else {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    }

    return () => {
      if (faceScanInterval.current) clearInterval(faceScanInterval.current)
    }
  }, [isActive, isVideoOn, visionMode, modelsLoaded])

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

  const toggleSource = () => {
    if (!isSystemActive) return
    const nextMode = visionMode === 'camera' ? 'screen' : 'camera'
    startVision(nextMode)
  }

  const liveNetwork = stats?.network ?? {
    rxBytesPerSecond: 0,
    txBytesPerSecond: 0,
    totalBytesPerSecond: 0,
    activeInterfaces: 0,
    updatedAt: 0
  }
  const networkLabel = formatBytesPerSecond(liveNetwork.totalBytesPerSecond)
  const txRatio = metricPercent((liveNetwork.txBytesPerSecond / (5 * 1024 * 1024)) * 100)
  const rxRatio = metricPercent((liveNetwork.rxBytesPerSecond / (5 * 1024 * 1024)) * 100)
  const batteryPercent =
    stats?.battery?.isPresent && typeof stats.battery.percentage === 'number'
      ? stats.battery.percentage
      : null
  const batteryValue =
    batteryPercent !== null ? `${batteryPercent}%` : stats?.battery?.isPresent ? '--%' : 'AC'
  const batteryDetail = stats?.battery?.isPresent ? stats.battery.status : 'Plugged'
  const temperatureValue =
    typeof stats?.temperature === 'number' ? `${stats.temperature.toFixed(1)}°C` : '--'
  const temperatureRaw =
    typeof stats?.temperature === 'number' ? metricPercent((stats.temperature / 95) * 100) : 0
  const prioritizedMediaSessions = [...mediaSessions].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    if (a.status === 'Playing' && b.status !== 'Playing') return -1
    if (b.status === 'Playing' && a.status !== 'Playing') return 1
    return 0
  })
  const featuredMedia = prioritizedMediaSessions[0]
  const featuredProgress =
    featuredMedia && featuredMedia.durationMs > 0
      ? metricPercent((featuredMedia.positionMs / featuredMedia.durationMs) * 100)
      : 0
  const assistantStateLabel =
    resolvedAssistantVisualState === 'speaking'
      ? 'Speaking'
      : resolvedAssistantVisualState === 'running'
        ? 'Online'
        : isSystemStarting
          ? 'Booting'
          : 'Standby'
  const runtimeRibbonLabel =
    resolvedAssistantVisualState === 'speaking'
      ? 'VOICE RESPONSE ACTIVE'
      : resolvedAssistantVisualState === 'running'
        ? 'SYSTEM MONITORING'
        : 'STANDBY MODE'

  const systemMetrics = [
    {
      icon: <RiCpuLine />,
      bgIcon: <RiCpuLine size={140} />,
      label: 'CPU LOAD',
      val: stats ? `${stats.cpu}%` : '--',
      raw: stats ? metricPercent(stats.cpu) : 0,
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
      val: stats ? `${stats.memory.usedPercentage}%` : '--',
      raw: stats ? metricPercent(stats.memory.usedPercentage) : 0,
      colorClass: 'text-cyan-400',
      bgClass: 'bg-cyan-500',
      glowClass: 'via-cyan-500/50',
      shadowClass: 'shadow-[0_0_8px_#06b6d4]',
      bgGradient: 'from-cyan-950/30 to-black/60',
      pattern: 'bg-[radial-gradient(#06b6d415_1px,transparent_1px)] bg-[size:10px_10px]'
    },
    {
      icon: <RiBatteryChargeLine />,
      bgIcon: <RiBatteryChargeLine size={140} />,
      label: 'BATTERY',
      val: stats ? batteryValue : '--',
      raw: batteryPercent !== null ? batteryPercent : 0,
      colorClass: 'text-lime-300',
      bgClass: 'bg-lime-400',
      glowClass: 'via-lime-400/50',
      shadowClass: 'shadow-[0_0_8px_#a3e635]',
      bgGradient: 'from-lime-950/25 to-black/60',
      pattern: 'bg-[linear-gradient(90deg,#a3e6350d_1px,transparent_1px)] bg-[size:16px_16px]',
      detail: batteryDetail,
      hideBar: batteryPercent === null
    },
    {
      icon: <GiTinker />,
      bgIcon: <GiTinker size={140} />,
      label: 'TEMP',
      val: stats ? temperatureValue : '--',
      raw: stats ? temperatureRaw : 0,
      colorClass: 'text-orange-400',
      bgClass: 'bg-orange-500',
      glowClass: 'via-orange-500/50',
      shadowClass: 'shadow-[0_0_8px_#f97316]',
      bgGradient: 'from-orange-950/30 to-black/60',
      pattern: 'bg-[radial-gradient(ellipse_at_top_right,#f9731620,transparent_60%)]',
      detail: typeof stats?.temperature === 'number' ? 'Thermal zone' : 'Sensor unavailable',
      hideBar: typeof stats?.temperature !== 'number'
    },
    {
      icon: <HiComputerDesktop />,
      bgIcon: <HiComputerDesktop size={140} />,
      label: 'OS',
      val: stats ? `${stats.os.type}` : '--',
      raw: 0,
      colorClass: 'text-purple-400',
      bgClass: 'bg-purple-500',
      glowClass: 'via-purple-500/50',
      shadowClass: '',
      bgGradient: 'from-purple-950/30 to-black/60',
      pattern:
        'bg-[linear-gradient(45deg,#a855f708_25%,transparent_25%,transparent_50%,#a855f708_50%,#a855f708_75%,transparent_75%,transparent)] bg-[size:24px_24px]',
      detail: stats?.os?.arch ?? '',
      hideBar: true
    },
    {
      icon: <RiTimeLine />,
      bgIcon: <RiTimeLine size={140} />,
      label: 'UPTIME',
      val: stats ? `${stats.os.uptime}` : '--',
      raw: 0,
      colorClass: 'text-sky-300',
      bgClass: 'bg-sky-400',
      glowClass: 'via-sky-400/50',
      shadowClass: '',
      bgGradient: 'from-sky-950/25 to-black/60',
      pattern: 'bg-[radial-gradient(circle_at_top_left,#38bdf820,transparent_56%)]',
      hideBar: true
    }
  ]

  const agentStages = [
    {
      label: 'Voice Layer',
      value: isMicMuted
        ? 'Muted'
        : resolvedAssistantVisualState === 'speaking'
          ? 'Speaking'
          : 'Listening',
      tone:
        resolvedAssistantVisualState === 'speaking' ? 'text-fuchsia-200' : 'text-emerald-300'
    },
    { label: 'Gemini API', value: 'Ready', tone: 'text-cyan-300' },
    {
      label: 'Local Actions',
      value:
        resolvedAssistantVisualState === 'speaking'
          ? 'Executing'
          : isSystemActive
            ? 'Armed'
            : 'Standby',
      tone: 'text-orange-200'
    }
  ]

  const statusOverview = [
    {
      label: 'Runtime',
      value: assistantStateLabel,
      detail: runtimeRibbonLabel,
      tone:
        resolvedAssistantVisualState === 'speaking'
          ? 'text-fuchsia-100'
          : resolvedAssistantVisualState === 'running'
            ? 'text-emerald-200'
            : isSystemStarting
              ? 'text-amber-100'
              : 'text-zinc-200'
    },
    {
      label: 'Vision',
      value: isVideoOn ? (visionMode === 'camera' ? 'Camera' : 'Screen') : 'Offline',
      detail: isVideoOn ? 'Live input armed' : 'Select a source',
      tone: 'text-cyan-200'
    },
    {
      label: 'Voice',
      value: isMicMuted ? 'Muted' : 'Open',
      detail: isMicMuted ? 'Responses paused' : 'Listening live',
      tone: 'text-orange-100'
    },
    {
      label: 'Battery',
      value: batteryValue,
      detail: batteryDetail,
      tone: batteryPercent !== null ? 'text-lime-200' : 'text-zinc-200'
    }
  ]

  return (
    <div className="nexus-dashboard-arena relative min-h-full w-full animate-in fade-in zoom-in duration-300 overflow-visible p-2 lg:p-3">
      <div className="grid min-h-full grid-cols-12 gap-2">
        <section className="nexus-status-strip col-span-12 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {statusOverview.map((item) => (
            <div key={item.label} className={`${glassPanel} nexus-status-tile`}>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="nexus-status-tile-label">
                    {item.label}
                  </p>
                  <p className={`nexus-status-tile-value ${item.tone}`}>{item.value}</p>
                </div>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    item.label === 'Runtime' && resolvedAssistantVisualState === 'speaking'
                      ? 'bg-fuchsia-300 shadow-[0_0_12px_rgba(244,114,182,0.8)]'
                      : item.label === 'Runtime' && resolvedAssistantVisualState === 'running'
                        ? 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                        : 'bg-white/15'
                  }`}
                />
              </div>
              <p className="nexus-status-tile-detail">
                {item.detail}
              </p>
            </div>
          ))}
        </section>

        <aside className="hidden">
          <div className={`${glassPanel} shrink-0 p-3`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                <RiCameraLine className="text-cyan-300" /> Vision Feed
              </span>
              <span className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-500">
                {isVideoOn ? (visionMode === 'camera' ? 'Camera' : 'Screen') : 'Offline'}
              </span>
            </div>

            <div className="mt-3 overflow-hidden border border-white/10 bg-black/35 aspect-video">
              {isVideoOn ? (
                <div className="relative h-full w-full">
                  <video
                    ref={setVideoRef}
                    className={`h-full w-full object-cover ${
                      visionMode === 'camera' ? '-scale-x-100' : ''
                    }`}
                    autoPlay
                    playsInline
                    muted
                  />
                  {visionMode === 'camera' ? (
                    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                  ) : null}
                </div>
              ) : (
                <div className="grid h-full place-items-center text-center">
                  <div className="space-y-2 text-zinc-700">
                    <RiCameraLine className="mx-auto text-2xl" />
                    <p className="text-[9px] font-black uppercase tracking-[0.22em]">
                      Awaiting source
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={onVisionClick}
                className="flex items-center justify-center gap-2 border border-white/10 bg-black/35 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/35 hover:text-cyan-100"
              >
                {isVideoOn ? <RiSwapBoxLine /> : <RiCameraLine />}
                {isVideoOn ? 'Switch feed' : 'Start vision'}
              </button>
              <button
                onClick={toggleSource}
                disabled={!isSystemActive || !isVideoOn}
                className="flex items-center justify-center gap-2 border border-emerald-300/25 bg-emerald-300/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100 transition hover:bg-emerald-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
              >
                <RiComputerLine />
                Swap source
              </button>
            </div>
          </div>

          <div className={`${glassPanel} shrink-0 p-3`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                <RiMusic2Line className="text-emerald-400" /> Current Media
              </span>
              <button
                onClick={refreshMediaSessions}
                className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-black/35 text-zinc-500 transition hover:border-emerald-300/35 hover:text-emerald-200"
                title="Refresh media sessions"
              >
                <RiRefreshLine size={13} />
              </button>
            </div>

            {featuredMedia ? (
              <div className="min-h-0 pt-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-xl text-emerald-200">
                    <RiMusic2Line />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white" title={featuredMedia.title}>
                      {featuredMedia.title}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-semibold text-zinc-500">
                      {featuredMedia.artist || featuredMedia.source || 'System media'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[8px] font-mono text-zinc-500">
                  <span>{formatMediaTime(featuredMedia.positionMs)}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/55">
                    <div
                      className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      style={{ width: `${featuredProgress}%` }}
                    />
                  </div>
                  <span>{formatMediaTime(featuredMedia.durationMs)}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleMediaControl(featuredMedia, 'previous')}
                    className="grid h-8 place-items-center border border-white/10 bg-black/35 text-zinc-300 transition hover:border-emerald-300/35 hover:text-emerald-200"
                    title="Previous"
                  >
                    <RiSkipBackFill />
                  </button>
                  <button
                    onClick={() => handleMediaControl(featuredMedia, 'toggle')}
                    className="grid h-8 place-items-center border border-emerald-300/25 bg-emerald-300/15 text-emerald-100 transition hover:bg-emerald-300 hover:text-black"
                    title="Play or pause"
                  >
                    {featuredMedia.status === 'Playing' ? <RiPauseFill /> : <RiPlayFill />}
                  </button>
                  <button
                    onClick={() => handleMediaControl(featuredMedia, 'next')}
                    className="grid h-8 place-items-center border border-white/10 bg-black/35 text-zinc-300 transition hover:border-emerald-300/35 hover:text-emerald-200"
                    title="Next"
                  >
                    <RiSkipForwardFill />
                  </button>
                  <span className="grid h-8 place-items-center border border-white/10 bg-black/35 text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                    {featuredMedia.status}
                  </span>
                </div>
                {prioritizedMediaSessions.length > 1 ? (
                  <div className="mt-2 flex gap-1 overflow-x-auto scrollbar-small">
                    {prioritizedMediaSessions.slice(1, 5).map((session) => (
                      <button
                        key={`${session.source}-${session.index}`}
                        onClick={() => handleMediaControl(session, 'toggle')}
                        className="max-w-[7rem] shrink-0 truncate border border-white/10 bg-white/[0.03] px-2 py-1.5 text-left text-[9px] font-semibold text-zinc-500 transition hover:border-emerald-300/25 hover:text-zinc-200"
                        title={`${session.title} - ${session.status}`}
                      >
                        {session.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid min-h-[9rem] place-items-center text-center">
                <div className="space-y-2 text-zinc-700">
                  <RiMusic2Line className="mx-auto text-2xl" />
                  <p className="text-[9px] font-black uppercase tracking-[0.22em]">{mediaStatus}</p>
                </div>
              </div>
            )}
          </div>

          <div className={`${glassPanel} shrink-0 p-3`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                <RiPulseLine className={isSystemActive ? 'animate-pulse text-emerald-500' : ''} />
                Network Telemetry
              </span>
              <span
                className={`rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${
                  isSystemActive
                    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300'
                    : 'border-white/10 bg-black/30 text-zinc-500'
                }`}
              >
                {isSystemActive ? 'Secure uplink' : 'Standby'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="border border-white/5 bg-black/25 p-2">
                <span className="text-[7px] font-mono tracking-[0.18em] text-zinc-500">LINKS</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-50 font-mono">
                  <RiWifiLine className={stats ? 'text-emerald-400' : 'text-zinc-600'} />
                  {stats ? liveNetwork.activeInterfaces : '--'}
                </span>
              </div>
              <div className="border border-white/5 bg-black/25 p-2">
                <span className="text-[7px] font-mono tracking-[0.18em] text-zinc-500">RX</span>
                <span className="mt-1 block text-[11px] font-bold text-emerald-50 font-mono">
                  {stats ? formatBytesPerSecond(liveNetwork.rxBytesPerSecond) : '--'}
                </span>
              </div>
              <div className="border border-white/5 bg-black/25 p-2">
                <span className="text-[7px] font-mono tracking-[0.18em] text-zinc-500">TX</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-50 font-mono">
                  {stats ? formatBytesPerSecond(liveNetwork.txBytesPerSecond) : '--'}
                  <RiEarthLine className={stats ? 'text-cyan-400' : 'text-zinc-600'} />
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-5 text-[7px] font-mono text-zinc-500">TX</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60">
                  <div
                    className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981] transition-all duration-300 ease-out"
                    style={{ width: `${stats ? txRatio : 0}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 text-[7px] font-mono text-zinc-500">RX</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60">
                  <div
                    className="h-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] transition-all duration-300 ease-out delay-75"
                    style={{ width: `${stats ? rxRatio : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`${glassPanel} min-h-0 flex-1 p-3`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                <RiLayoutGridLine className="mr-1 inline" /> System Snapshot
              </span>
              <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                Live sensors
              </span>
            </div>
            <div className="mt-3 grid h-full min-h-0 grid-cols-2 gap-2">
              {systemMetrics.map((m, i) => (
                <div
                  key={i}
                  className={`group relative flex flex-col justify-between overflow-hidden border border-white/5 bg-linear-to-br ${m.bgGradient} p-2 transition-all duration-300 hover:border-white/10`}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 ${m.pattern} opacity-30 transition-opacity duration-500 group-hover:opacity-60`}
                  />
                  <div
                    className={`pointer-events-none absolute -bottom-8 -right-8 opacity-[0.03] transition-all duration-500 group-hover:scale-110 group-hover:opacity-[0.08] ${m.colorClass}`}
                  >
                    {m.bgIcon}
                  </div>
                  <div
                    className={`pointer-events-none absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent ${m.glowClass} to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                  />

                  <div className="relative z-10 flex items-start justify-between text-zinc-500">
                    <span className={`text-base ${m.colorClass} opacity-70 transition-opacity group-hover:opacity-100`}>
                      {m.icon}
                    </span>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-300 opacity-70 transition-opacity group-hover:opacity-100">
                      {m.label}
                    </span>
                  </div>

                  <div className="relative z-10 mt-2 flex min-w-0 flex-col gap-1">
                    <span
                      className="max-w-full truncate text-right font-mono text-[15px] font-black tracking-[0.08em] text-white drop-shadow-md"
                      title={String(m.val)}
                    >
                      {m.val}
                    </span>
                    {'detail' in m && m.detail ? (
                      <span className="max-w-full truncate text-right text-[7px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        {m.detail}
                      </span>
                    ) : null}

                    {!m.hideBar ? (
                      <div className="h-1 overflow-hidden rounded-full border border-white/5 bg-black/40 backdrop-blur-sm">
                        <div
                          className={`h-full ${m.bgClass} ${m.shadowClass} transition-all duration-700 ease-out`}
                          style={{ width: `${m.raw}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="nexus-core-command-column nexus-fixed-sphere-column col-span-12 flex min-h-[34rem] flex-col gap-2 xl:col-span-8">
          <div className={`${glassPanel} nexus-agent-core-panel nexus-fixed-sphere-panel flex min-h-0 flex-1 flex-col p-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                  Agent Core
                </span>
                <p className="mt-1 text-xs font-semibold leading-snug text-zinc-400">
                  Live voice and command kernel.
                </p>
              </div>
              <span className="max-w-full rounded-md border border-white/10 bg-black/35 px-2.5 py-1.5 text-[8px] font-black uppercase leading-tight tracking-[0.14em] text-zinc-500">
                {isSystemStarting ? 'Starting low-latency link' : runtimeRibbonLabel}
              </span>
            </div>

            <div className="nexus-core-focus-grid grid min-h-0 flex-1 gap-2 pt-2">
              <div className="nexus-core-orb-stage relative flex min-h-[26rem] items-center justify-center overflow-visible border border-emerald-300/15 bg-black/35">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(rgba(16,185,129,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-emerald-300/10 to-transparent" />
                <div className="nexus-core-sphere-fallback" aria-hidden="true" />
                <div className="absolute bottom-3 left-3 z-10 border border-emerald-300/20 bg-black/70 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  Neural Kernel
                </div>
                <div
                  className={`nexus-core-orb relative z-20 aspect-square h-[54vh] min-h-[18rem] max-h-[30rem] transition-all duration-700 ${
                    isSystemActive ? 'scale-100 opacity-100' : 'scale-100 opacity-95'
                  }`}
                >
                  <Sphere
                    visualState={resolvedAssistantVisualState}
                    isSystemActive={isSystemActive}
                  />
                </div>
                <div className="nexus-core-stage-strip">
                  {agentStages.map((stage) => (
                    <div key={stage.label} className="nexus-core-stage-chip">
                      <span>{stage.label}</span>
                      <strong className={stage.tone}>{stage.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden">
                {agentStages.map((stage) => (
                  <div key={stage.label} className="border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      {stage.label}
                    </p>
                    <p className={`mt-2 text-lg font-black uppercase ${stage.tone}`}>{stage.value}</p>
                  </div>
                ))}

                <div className="border border-white/10 bg-black/30 p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Command Intent
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                    Type once, get a spoken response back. Use the switches below to bring optics,
                    core runtime, and live voice online without leaving the dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={submitTextCommand}
            className="nexus-manual-control-rail nexus-command-control-rail nexus-fixed-control-rail min-w-0"
          >
            <div className="nexus-inline-command min-w-0">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.28em] text-emerald-300/70">
                    Manual Controls
                  </span>
                  <span className="mt-1 text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                    AI text command bus
                  </span>
                </div>
                <span className="hidden text-[8px] font-black uppercase tracking-[0.16em] text-emerald-300/70 sm:inline">
                  {activeRequest ? 'Running queue' : requestQueue.length ? `${requestQueue.length} queued` : 'Gemini live'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex border border-white/10 bg-black/35 p-1">
                  {(['queue', 'steer'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRequestRoutingMode(mode)}
                      className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em] transition ${
                        requestRoutingMode === mode
                          ? 'bg-emerald-300 text-black'
                          : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <span className="max-w-[14rem] truncate text-[8px] font-mono uppercase tracking-[0.12em] text-zinc-600">
                  {activeRequest
                    ? `Now: ${activeRequest.command}`
                    : requestQueue.length
                      ? `Next: ${requestQueue[0].command}`
                      : 'Queue idle'}
                </span>
              </div>
              <div className="nexus-command-input-wrap mt-2 flex items-center gap-2">
                <input
                  value={textCommand}
                  onChange={(event) => setTextCommand(event.target.value)}
                  placeholder="Command Nexus AI..."
                  className="nexus-command-input min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
                />
                <button
                  type="submit"
                  disabled={!textCommand.trim() || isSendingTextCommand}
                  className="grid h-11 w-11 shrink-0 place-items-center border border-emerald-300/25 bg-emerald-400/15 text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
                  title="Send text command with voice response"
                >
                  <RiSendPlane2Line size={18} />
                </button>
              </div>
              <div className="nexus-command-status mt-1 min-h-[0.9rem] text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {textCommandStatus || 'Low-latency text prompt path is ready.'}
              </div>
              {(activeRequest || requestQueue.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeRequest && (
                    <span className="max-w-full truncate border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-200">
                      Running: {activeRequest.command}
                    </span>
                  )}
                  {requestQueue.slice(0, 2).map((item, index) => (
                    <span
                      key={item.id}
                      className={`max-w-full truncate border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${
                        item.mode === 'steer'
                          ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                          : 'border-white/10 bg-white/[0.04] text-zinc-400'
                      }`}
                    >
                      {item.mode === 'steer' ? 'Steer' : `Q${index + 1}`}: {item.command}
                    </span>
                  ))}
                  {requestQueue.length > 2 && (
                    <span className="border border-white/10 bg-white/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                      +{requestQueue.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>

              <div className="nexus-control-switch-group flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onVisionClick}
                  className={`nexus-control-switch ${isVideoOn ? 'is-danger' : 'is-idle'}`}
                >
                  <span className="nexus-control-icon">
                    {isVideoOn ? <RiSwapBoxLine size={17} /> : <RiCameraLine size={17} />}
                  </span>
                  <span>
                    <span className="block text-[10px]">Vision</span>
                    <span className="block text-[7px] opacity-55">
                      {isVideoOn ? 'Switch feed' : 'Optics'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleSystem}
                  disabled={isSystemStarting}
                  className={`nexus-control-switch ${
                    isSystemActive ? 'is-active' : isSystemStarting ? 'is-idle' : 'is-danger'
                  }`}
                >
                  <span className="nexus-control-icon">
                    <RiPhoneFill size={17} />
                  </span>
                  <span>
                    <span className="block text-[10px]">Core</span>
                    <span className="block text-[7px] opacity-55">
                      {isSystemActive ? 'Online' : isSystemStarting ? 'Starting' : 'Standby'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`nexus-control-switch ${isMicMuted ? 'is-danger' : 'is-active'}`}
                >
                  <span className="nexus-control-icon">
                    {isMicMuted ? <RiMicOffLine size={17} /> : <RiMicLine size={17} />}
                  </span>
                  <span>
                    <span className="block text-[10px]">Voice</span>
                    <span className="block text-[7px] opacity-55">
                      {isMicMuted ? 'Muted' : 'Live'}
                    </span>
                  </span>
                </button>
              </div>
          </form>
        </section>

        <aside className="col-span-12 flex min-h-[34rem] flex-col gap-2 xl:col-span-4">
          <div className={`${glassPanel} shrink-0 p-3`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Live Session
                </p>
                <p className="mt-2 text-sm font-black uppercase text-zinc-100">{networkLabel}</p>
              </div>
              <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-200">
                {chatHistory.length} entries
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-zinc-500">
              Live transcript for commands and spoken responses.
            </p>
          </div>

          <div className={`${glassPanel} min-h-0 flex-1 p-3 flex flex-col`}>
            <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                <RiTerminalBoxLine className="mr-1 inline" /> Transcript
              </span>
              <span className="text-[8px] font-mono uppercase tracking-[0.16em] text-emerald-500/50">
                Live log
              </span>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-small">
              {chatHistory.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-700 opacity-50">
                  <RiHistoryLine size={24} />
                  <span className="text-[9px] font-mono uppercase tracking-widest">No data stream</span>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[95%] rounded-lg border px-3 py-2 font-mono text-[11px] font-semibold leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-br-none border-emerald-500/20 bg-emerald-900/20 text-emerald-100/90'
                          : 'rounded-bl-none border-white/5 bg-zinc-900/50 text-zinc-400'
                      }`}
                    >
                      <MarkdownMath content={msg.parts && msg.parts[0] ? msg.parts[0].text : msg.content} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
