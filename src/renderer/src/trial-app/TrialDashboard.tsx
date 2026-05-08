import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  RiArrowRightUpLine,
  RiBattery2ChargeLine,
  RiCameraLine,
  RiCpuLine,
  RiGlobalLine,
  RiLoader4Line,
  RiMicLine,
  RiMicOffLine,
  RiPulseLine,
  RiSendPlane2Line,
  RiShieldFlashLine,
  RiSparklingLine,
  RiWifiLine
} from 'react-icons/ri'
import { getSystemStatus, type SystemStats } from '@renderer/services/system-info'
import type { TrialRuntimeProps } from './types'

interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
}

const formatBytesPerSecond = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Idle'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

const getBatteryLabel = (stats: SystemStats | null) => {
  if (!stats?.battery?.isPresent) return 'AC power'
  return typeof stats.battery.percentage === 'number' ? `${stats.battery.percentage}%` : '--%'
}

const getAssistantLabel = (props: TrialRuntimeProps) => {
  if (props.assistantVisualState === 'speaking') return 'Speaking'
  if (props.assistantVisualState === 'running') return 'Live'
  if (props.isSystemStarting) return 'Booting'
  return 'Standby'
}

const cardClass =
  'rounded-3xl border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(8,14,14,0.96),rgba(4,7,8,0.92))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]'

export default function TrialDashboard(props: TrialRuntimeProps) {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [command, setCommand] = useState('')
  const [isSending, setIsSending] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const syncStats = async () => {
      const nextStats = await getSystemStatus()
      setStats(nextStats)
    }

    void syncStats()
    const timer = setInterval(syncStats, 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const syncTranscript = async () => {
      try {
        const history = await window.electron.ipcRenderer.invoke('get-history')
        const nextItems = Array.isArray(history)
          ? history
              .slice(-8)
              .map((entry: any) => ({
                role: (entry?.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                text: String(entry?.parts?.[0]?.text || '')
              }))
              .filter((entry) => entry.text.trim().length > 0)
          : []
        setTranscript(nextItems)
      } catch {
        setTranscript([])
      }
    }

    void syncTranscript()
    const timer = setInterval(syncTranscript, 3500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    element.srcObject = props.activeStream
    if (props.activeStream) {
      void element.play().catch(() => {})
    }
  }, [props.activeStream])

  const sendQuickCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextCommand = command.trim()
    if (!nextCommand || isSending) return

    setIsSending(true)
    try {
      await props.sendTextCommand(nextCommand)
      setCommand('')
    } finally {
      setIsSending(false)
    }
  }

  const systemCards = useMemo(
    () => [
      {
        label: 'Assistant',
        value: getAssistantLabel(props),
        detail: props.isSystemActive ? 'Core connected' : 'Core offline',
        icon: <RiSparklingLine />
      },
      {
        label: 'Voice',
        value: props.isMicMuted ? 'Muted' : 'Live',
        detail: props.isSystemActive ? 'Mic route ready' : 'Start assistant to speak',
        icon: props.isMicMuted ? <RiMicOffLine /> : <RiMicLine />
      },
      {
        label: 'Vision',
        value:
          props.visionMode === 'camera'
            ? 'Camera'
            : props.visionMode === 'screen'
              ? 'Screen'
              : 'Off',
        detail: props.isVideoOn ? 'Feed active' : 'No active feed',
        icon: <RiCameraLine />
      },
      {
        label: 'Battery',
        value: getBatteryLabel(stats),
        detail: stats?.battery?.status || 'Power status',
        icon: <RiBattery2ChargeLine />
      }
    ],
    [props, stats]
  )

  return (
    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="flex min-h-0 flex-col gap-5">
        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">
                Trial Command Surface
              </p>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white">
                Light, local, and actually usable
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                The trial build keeps the core Nexus loop intact: start the assistant, speak or
                type commands, preview vision input, and test browser control without signing in.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[22rem]">
              <button
                type="button"
                onClick={() => void props.toggleSystem()}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  props.isSystemActive
                    ? 'border-emerald-300/35 bg-emerald-400/12 text-emerald-50'
                    : 'border-white/10 bg-black/35 text-zinc-200 hover:border-emerald-300/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                    {props.isSystemActive ? 'Stop Assistant' : 'Start Assistant'}
                  </span>
                  {props.isSystemStarting ? <RiLoader4Line className="animate-spin" /> : <RiPulseLine />}
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {props.isSystemActive
                    ? 'Shut down live voice and tool routing.'
                    : 'Bring the core voice runtime online.'}
                </p>
              </button>

              <button
                type="button"
                onClick={props.onUpgrade}
                className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-left text-amber-50 transition hover:bg-amber-300/16"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                    Unlock Full
                  </span>
                  <RiArrowRightUpLine />
                </div>
                <p className="mt-2 text-sm text-amber-100/75">
                  Download the full Nexus build with auth, macros, gallery, apps, and phone tools.
                </p>
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {systemCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/8 bg-black/28 px-4 py-4"
              >
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                    {card.label}
                  </span>
                  <span className="text-base">{card.icon}</span>
                </div>
                <div className="mt-3 text-2xl font-black uppercase tracking-[0.04em] text-white">
                  {card.value}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{card.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid min-h-0 gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className={`${cardClass} flex min-h-[23rem] flex-col`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                  Vision Preview
                </p>
                <h3 className="mt-2 text-lg font-black uppercase tracking-[0.08em] text-white">
                  Camera or screen
                </h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
                {props.visionMode === 'none' ? 'No source' : props.visionMode}
              </span>
            </div>

            <div className="mt-4 flex-1 overflow-hidden rounded-2xl border border-white/8 bg-black/55">
              {props.activeStream ? (
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center px-6 text-center text-zinc-500">
                  <div>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-black/40 text-2xl">
                      <RiCameraLine />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-zinc-300">No live source yet</p>
                    <p className="mt-2 text-xs leading-relaxed">
                      Start the assistant and pick camera or screen to see what the trial build can
                      send into the voice core.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => props.startVision('camera')}
                className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-emerald-300/20"
              >
                Start Camera
              </button>
              <button
                type="button"
                onClick={() => props.startVision('screen')}
                className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/20"
              >
                Share Screen
              </button>
              <button
                type="button"
                onClick={props.stopVision}
                className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-red-300/20"
              >
                Stop Vision
              </button>
            </div>
          </div>

          <div className={`${cardClass} flex min-h-[23rem] flex-col`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                  Trial Commands
                </p>
                <h3 className="mt-2 text-lg font-black uppercase tracking-[0.08em] text-white">
                  Send something useful
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={props.toggleMic}
                  className={`rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                    props.isMicMuted
                      ? 'border-red-300/18 bg-red-400/10 text-red-100'
                      : 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100'
                  }`}
                >
                  {props.isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                </button>
              </div>
            </div>

            <form onSubmit={sendQuickCommand} className="mt-4 flex gap-3">
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Type a command for Nexus..."
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/35"
              />
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
              >
                {isSending ? <RiLoader4Line className="animate-spin" /> : <RiSendPlane2Line />}
                Send
              </button>
            </form>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                'Open Spotify and play my focus mix',
                'Summarize my current machine status',
                'Search the web for NVIDIA Build model updates'
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCommand(preset)}
                  className="rounded-2xl border border-white/10 bg-black/28 px-4 py-3 text-left text-xs leading-relaxed text-zinc-300 transition hover:border-white/20"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/28 px-4 py-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  <RiCpuLine /> System Snapshot
                </div>
                <div className="mt-4 space-y-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>CPU</span>
                    <span className="font-semibold text-white">{stats?.cpu || '--'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Memory</span>
                    <span className="font-semibold text-white">
                      {stats?.memory?.usedPercentage || '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Network</span>
                    <span className="font-semibold text-white">
                      {formatBytesPerSecond(stats?.network?.totalBytesPerSecond ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/28 px-4 py-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  <RiShieldFlashLine /> Trial Limits
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-300">
                  <li>Local-only settings and no account login.</li>
                  <li>No macros, phone tools, gallery, or app launcher.</li>
                  <li>Focused on voice core, AI chat, browser control, and updates.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="flex min-h-0 flex-col gap-5">
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Live Session
              </p>
              <h3 className="mt-2 text-lg font-black uppercase tracking-[0.08em] text-white">
                Machine telemetry
              </h3>
            </div>
            <span className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
              Trial
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2">
                  <RiWifiLine /> Throughput
                </span>
                <span className="font-semibold text-white">
                  {formatBytesPerSecond(stats?.network?.totalBytesPerSecond ?? 0)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2">
                  <RiBattery2ChargeLine /> Battery
                </span>
                <span className="font-semibold text-white">{getBatteryLabel(stats)}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2">
                  <RiGlobalLine /> OS
                </span>
                <span className="font-semibold text-white">{stats?.os?.type || 'Windows'}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={`${cardClass} flex min-h-0 flex-1 flex-col`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Transcript
              </p>
              <h3 className="mt-2 text-lg font-black uppercase tracking-[0.08em] text-white">
                Recent local exchange
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
              {transcript.length} items
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {transcript.length ? (
              transcript.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                    entry.role === 'user'
                      ? 'border-emerald-300/18 bg-emerald-400/10 text-emerald-50'
                      : 'border-white/8 bg-black/32 text-zinc-300'
                  }`}
                >
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    {entry.role === 'user' ? 'Operator' : 'Nexus'}
                  </p>
                  <p>{entry.text}</p>
                </div>
              ))
            ) : (
              <div className="grid h-full min-h-[12rem] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 text-center text-zinc-500">
                Start the assistant and send a prompt to build up a local transcript.
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}
