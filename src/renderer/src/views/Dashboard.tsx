import { FormEvent, useEffect, useCallback, useRef, useState } from 'react'
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
  RiBatteryChargeLine,
  RiTimeLine
} from 'react-icons/ri'
import { FaMemory } from 'react-icons/fa6'
import { GiTinker } from 'react-icons/gi'
import { HiComputerDesktop } from 'react-icons/hi2'
import * as faceapi from 'face-api.js'
import { VisionMode } from '@renderer/IndexRoot'
import type { SystemStats } from '@renderer/services/system-info'

interface NexusProps {
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
}

interface DashboardViewProps {
  props: NexusProps
  stats: SystemStats | null
  chatHistory: any[]
  onVisionClick: () => void
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

export default function DashboardView({
  props,
  stats,
  chatHistory,
  onVisionClick
}: DashboardViewProps) {
  const {
    isSystemActive,
    isVideoOn,
    visionMode,
    startVision,
    activeStream,
    toggleMic,
    toggleSystem,
    isMicMuted,
    isSystemStarting,
    sendTextCommand
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const faceScanInterval = useRef<NodeJS.Timeout | null>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [textCommand, setTextCommand] = useState('')
  const [textCommandStatus, setTextCommandStatus] = useState('')
  const [isSendingTextCommand, setIsSendingTextCommand] = useState(false)

  const submitTextCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = textCommand.trim()
    if (!command || isSendingTextCommand) return

    setIsSendingTextCommand(true)
    setTextCommandStatus(isSystemActive ? 'Sending command...' : 'Starting core...')

    try {
      await sendTextCommand(command)
      setTextCommand('')
      setTextCommandStatus('Voice response queued.')
    } catch (error: any) {
      setTextCommandStatus(error?.message || 'Unable to send text command.')
    } finally {
      setIsSendingTextCommand(false)
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatHistory])

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

  const liveNetwork = stats?.network ?? {
    rxBytesPerSecond: 0,
    txBytesPerSecond: 0,
    totalBytesPerSecond: 0,
    activeInterfaces: 0,
    updatedAt: 0
  }
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

  const systemMetrics = [
    {
      icon: <RiCpuLine />,
      bgIcon: <RiCpuLine size={140} />,
      label: 'CPU LOAD',
      val: isSystemActive && stats ? `${stats.cpu}%` : '--',
      raw: isSystemActive && stats ? metricPercent(stats.cpu) : 0,
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
      raw: isSystemActive && stats ? metricPercent(stats.memory.usedPercentage) : 0,
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
      val: isSystemActive && stats ? batteryValue : '--',
      raw: isSystemActive && batteryPercent !== null ? batteryPercent : 0,
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
      val: isSystemActive && stats ? temperatureValue : '--',
      raw: isSystemActive ? temperatureRaw : 0,
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
      val: isSystemActive && stats ? `${stats.os.type}` : '--',
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
      val: isSystemActive && stats ? `${stats.os.uptime}` : '--',
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
    { label: 'Voice Layer', value: isMicMuted ? 'Muted' : 'Listening', tone: 'text-emerald-300' },
    { label: 'NVIDIA Build', value: 'Ready', tone: 'text-cyan-300' },
    { label: 'Local Actions', value: isSystemActive ? 'Armed' : 'Standby', tone: 'text-orange-200' }
  ]

  return (
    <div className="nexus-dashboard-arena flex-1 p-2 grid grid-cols-12 gap-2 min-h-0 h-full overflow-hidden relative animate-in fade-in zoom-in duration-300 w-full">
      <div className="pointer-events-none absolute inset-x-4 top-2 z-0 flex items-center justify-between rounded-lg border border-emerald-300/15 bg-black/35 px-4 py-1.5 text-[8px] font-black tracking-[0.26em] text-zinc-500 backdrop-blur-xl">
        <span>COMMAND KERNEL STREAM</span>
        <span className={isSystemActive ? 'text-emerald-300' : 'text-orange-200/70'}>
          {isSystemActive ? 'AUTONOMY ACTIVE' : 'STANDBY MODE'}
        </span>
      </div>
      <div className="hidden lg:flex col-span-3 flex-col gap-2 h-full min-h-0 z-40">
        <div
          className={`${glassPanel} h-[clamp(9rem,24vh,13rem)] shrink-0 flex flex-col p-1 overflow-hidden relative group`}
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
          className={`${glassPanel} h-[8.35rem] shrink-0 p-3 flex flex-col justify-between relative overflow-hidden`}
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

          <div className="grid grid-cols-3 gap-1.5 mt-2 relative z-10">
            <div className="border border-white/5 bg-black/25 p-2">
              <span className="text-[7px] text-zinc-500 font-mono tracking-[0.18em] flex items-center gap-1">
                ADAPTERS
              </span>
              <span className="mt-1 text-[11px] font-bold text-emerald-50 font-mono flex items-center gap-1.5 transition-all">
                <RiWifiLine className={isSystemActive ? 'text-emerald-400' : 'text-zinc-600'} />
                {isSystemActive && stats ? liveNetwork.activeInterfaces : '--'}
              </span>
            </div>

            <div className="border border-white/5 bg-black/25 p-2">
              <span className="text-[7px] text-zinc-500 font-mono tracking-[0.18em]">DOWNLINK</span>
              <span className="mt-1 block text-[11px] font-bold text-emerald-50 font-mono transition-all">
                {isSystemActive && stats
                  ? formatBytesPerSecond(liveNetwork.rxBytesPerSecond)
                  : '--'}
              </span>
            </div>

            <div className="border border-white/5 bg-black/25 p-2">
              <span className="text-[7px] text-zinc-500 font-mono tracking-[0.18em]">UPLINK</span>
              <span className="mt-1 text-[11px] font-bold text-emerald-50 font-mono flex items-center gap-1.5">
                {isSystemActive && stats
                  ? formatBytesPerSecond(liveNetwork.txBytesPerSecond)
                  : '--'}
                {isSystemActive ? (
                  <RiEarthLine className="text-cyan-400" />
                ) : (
                  <RiServerLine className="text-zinc-500" />
                )}
              </span>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-2 mt-2 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-zinc-500 w-4">TX</span>
              <div className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981] transition-all duration-300 ease-out"
                  style={{ width: `${isSystemActive ? txRatio : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-mono text-zinc-500 w-4">RX</span>
              <div className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] transition-all duration-300 ease-out delay-75"
                  style={{ width: `${isSystemActive ? rxRatio : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`${glassPanel} min-h-0 flex-1 p-3 flex flex-col gap-2`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-bold tracking-widest text-zinc-400">
              <RiLayoutGridLine className="inline mr-1" /> CORE METRICS
            </span>
          </div>
          <div className="grid grid-cols-2 auto-rows-fr gap-2 h-full min-h-0 pb-1">
            {systemMetrics.map((m, i) => (
              <div
                key={i}
                className={`cursor-pointer relative rounded-xl p-2 flex flex-col justify-between border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300 bg-linear-to-br ${m.bgGradient}`}
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

                <div className="relative z-10 flex min-w-0 flex-col gap-1 mt-1.5">
                  <span
                    className="max-w-full truncate text-right text-[12px] font-bold text-white font-mono tracking-wider drop-shadow-md"
                    title={String(m.val)}
                  >
                    {m.val}
                  </span>
                  {'detail' in m && m.detail && (
                    <span className="max-w-full truncate text-right text-[7px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      {m.detail}
                    </span>
                  )}

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

      <div className="col-span-12 lg:col-span-6 relative z-30 flex min-h-0 flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          <div className={`${glassPanel} p-3`}>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Agent State
            </p>
            <p className="mt-1 text-sm font-black uppercase text-emerald-200">
              {isSystemActive ? 'Online' : 'Standby'}
            </p>
          </div>
          <div className={`${glassPanel} p-3`}>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Vision</p>
            <p className="mt-1 text-sm font-black uppercase text-cyan-200">
              {isVideoOn ? visionMode : 'Offline'}
            </p>
          </div>
          <div className={`${glassPanel} p-3`}>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">Voice</p>
            <p className="mt-1 text-sm font-black uppercase text-orange-100">
              {isMicMuted ? 'Muted' : 'Open'}
            </p>
          </div>
        </div>

        <div className={`${glassPanel} flex min-h-0 flex-1 flex-col p-3`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              Agent Core
            </span>
            <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-500">
              {isSystemStarting ? 'Starting low-latency link' : 'Compact Command Matrix'}
            </span>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-5 gap-2 pt-3">
            <div className="relative col-span-3 flex min-h-0 items-center justify-center overflow-hidden border border-emerald-300/15 bg-black/35">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(rgba(16,185,129,0.08)_1px,transparent_1px)] bg-[size:22px_22px]" />
              <div className="absolute inset-x-0 top-0 h-12 bg-linear-to-b from-emerald-300/10 to-transparent" />
              <div className="absolute bottom-3 left-3 z-10 border border-emerald-300/20 bg-black/70 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-200">
                Neural Kernel
              </div>
              <div
                className={`relative z-10 aspect-square h-[36vh] min-h-[11rem] max-h-[21rem] transition-all duration-700 ${isSystemActive ? 'opacity-100 scale-100' : 'opacity-80 scale-95 grayscale'}`}
              >
                <Sphere />
              </div>
            </div>

            <div className="col-span-2 flex min-h-0 flex-col gap-2">
              {agentStages.map((stage) => (
                <div key={stage.label} className="border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    {stage.label}
                  </p>
                  <p className={`mt-2 text-lg font-black uppercase ${stage.tone}`}>{stage.value}</p>
                </div>
              ))}
              <div className="min-h-0 flex-1 border border-white/10 bg-black/30 p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Command Intent
                </p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                  Local-first control layer with chat, voice, optics, macros, notes, and device
                  uplink in one Nexus console.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={submitTextCommand}
            className="mt-3 flex shrink-0 items-center gap-2 border border-emerald-300/15 bg-black/45 p-2"
          >
            <input
              value={textCommand}
              onChange={(event) => setTextCommand(event.target.value)}
              placeholder="Type command, Nexus replies in voice..."
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs font-semibold text-white outline-none placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={!textCommand.trim() || isSendingTextCommand}
              className="grid h-10 w-10 shrink-0 place-items-center border border-emerald-300/25 bg-emerald-400/15 text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
              title="Send text command with voice response"
            >
              <RiSendPlane2Line size={18} />
            </button>
            {textCommandStatus && (
              <span className="hidden max-w-[8rem] truncate text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300/70 xl:block">
                {textCommandStatus}
              </span>
            )}
          </form>
        </div>

        <div
          className={`lg:hidden absolute top-24 right-4 w-32 h-24 ${glassPanel} z-50 overflow-hidden ${isVideoOn ? 'block' : 'hidden'}`}
        >
          <video
            ref={setMobileVideoRef}
            className={`w-full h-full object-cover ${visionMode === 'camera' ? '-scale-x-100' : ''}`}
            autoPlay
            playsInline
            muted
          />
        </div>

        <div className="nexus-manual-control-rail z-50">
          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.28em] text-emerald-300/70">
              Manual Controls
            </span>
            <span className="mt-1 text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-500">
              Tactical override bus
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <button
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
              onClick={toggleSystem}
              disabled={isSystemStarting}
              className={`nexus-control-switch ${isSystemActive ? 'is-active' : isSystemStarting ? 'is-idle' : 'is-danger'}`}
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
              onClick={toggleMic}
              className={`nexus-control-switch ${isMicMuted ? 'is-danger' : 'is-active'}`}
            >
              <span className="nexus-control-icon">
                {isMicMuted ? <RiMicOffLine size={17} /> : <RiMicLine size={17} />}
              </span>
              <span>
                <span className="block text-[10px]">Voice</span>
                <span className="block text-[7px] opacity-55">{isMicMuted ? 'Muted' : 'Live'}</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex col-span-3 flex-col overflow-hidden h-full z-40">
        <div className={`${glassPanel} h-full p-3 flex flex-col`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
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
