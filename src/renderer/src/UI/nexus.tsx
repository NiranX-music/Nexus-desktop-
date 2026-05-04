import { useState, useEffect, Suspense, lazy } from 'react'
import {
  RiWifiLine,
  RiShieldFlashLine,
  RiLayoutGridLine,
  RiBrainLine,
  RiFolderOpenLine,
  RiPhoneLine,
  RiSettings4Line,
  RiBatteryChargeLine,
  RiCameraLine,
  RiComputerLine,
  RiCloseLine,
  RiImageLine,
  RiChatSmile3Line
} from 'react-icons/ri'
import { getSystemStatus } from '@renderer/services/system-info'
import type { SystemStats } from '@renderer/services/system-info'
import { getHistory } from '@renderer/services/nexus-ai-brain'
import ViewSkeleton from '@renderer/components/ViewSkelrton'

import DashboardView from '../views/Dashboard'
import PhoneView from '../views/Phone'
import { VisionMode } from '@renderer/IndexRoot'

const AppsView = lazy(() => import('../views/APP'))
const WorkFlowEditorView = lazy(() => import('../views/WorkFlowEditor'))
const NotesView = lazy(() => import('../views/Notes'))
const SettingsView = lazy(() => import('../views/Settings'))
const GalleryView = lazy(() => import('../views/Gallery'))
const AiChatView = lazy(() => import('../views/AiChat'))

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

const glassPanel = 'nexus-glass-card'

const navTabs = [
  { id: 'DASHBOARD', label: 'Command', detail: 'Core overview', icon: <RiLayoutGridLine /> },
  { id: 'AI CHAT', label: 'AI Chat', detail: 'NVIDIA Build', icon: <RiChatSmile3Line /> },
  { id: 'Macros', label: 'Macros', detail: 'Automation flow', icon: <RiBrainLine /> },
  { id: 'Apps', label: 'Apps', detail: 'Local tools', icon: <RiFolderOpenLine /> },
  { id: 'NOTES', label: 'Notes', detail: 'Vault memory', icon: <RiFolderOpenLine /> },
  { id: 'GALLERY', label: 'Gallery', detail: 'Vision archive', icon: <RiImageLine /> },
  { id: 'PHONE', label: 'Phone', detail: 'Device uplink', icon: <RiPhoneLine /> },
  { id: 'SETTINGS', label: 'Settings', detail: 'System config', icon: <RiSettings4Line /> }
]

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
  if (!stats?.battery?.isPresent) return 'AC Power'
  return typeof stats.battery.percentage === 'number' ? `${stats.battery.percentage}%` : '--%'
}

const Nexus = (props: NexusProps) => {
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [time, setTime] = useState<Date>(new Date())
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [showSourceModal, setShowSourceModal] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    const refreshStats = async () => {
      const nextStats = await getSystemStatus()
      if (!cancelled) setStats(nextStats)
    }

    refreshStats()
    const timer = setInterval(refreshStats, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const fetchHistory = async () => {
      const history = await getHistory()
      if (Array.isArray(history)) setChatHistory(history.slice(-15))
    }
    fetchHistory()
    const interval = setInterval(fetchHistory, 500)
    return () => clearInterval(interval)
  }, [])

  const handleVisionClick = () => {
    if (props.isVideoOn) {
      props.stopVision()
    } else {
      setShowSourceModal(true)
    }
  }

  const activeNav = navTabs.find((tab) => tab.id === activeTab) ?? navTabs[0]
  const batteryLabel = getBatteryLabel(stats)
  const batteryStatus = stats?.battery?.status ?? 'Power'
  const batteryTone =
    stats?.battery?.isPresent && stats.battery.isOnBattery ? 'text-cyan-200' : 'text-emerald-300'
  const networkLabel = formatBytesPerSecond(stats?.network?.totalBytesPerSecond ?? 0)

  return (
    <div className="nexus-app-shell h-full w-full overflow-hidden select-none text-zinc-100">
      <div className="nexus-liquid-orb nexus-liquid-orb-one" />
      <div className="nexus-liquid-orb nexus-liquid-orb-two" />
      <div className="nexus-radar-grid absolute inset-0 opacity-45" />
      <div className="nexus-scanline" />

      <div className="relative z-10 flex h-full min-h-0 p-2">
        <main className="flex min-w-0 min-h-0 flex-1 flex-col gap-2">
          <header className="nexus-command-bar nexus-top-command-bar">
            <div className="nexus-header-main">
              <div className="nexus-header-brand">
                <div className="nexus-brand-core">
                  <RiShieldFlashLine />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-300">
                    Nexus Tech
                  </p>
                  <h1 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
                    Nexus AI
                  </h1>
                </div>
              </div>

              <div className="nexus-header-title min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300">
                  Autonomous Desktop Agent
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-3">
                  <h2 className="text-2xl font-black uppercase text-white md:text-3xl">
                    {activeNav.label}
                  </h2>
                  <span className="mb-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    {activeNav.detail}
                  </span>
                </div>
              </div>

              <div className="nexus-header-status">
                <span
                  className="nexus-status-pill text-emerald-300"
                  title="Live network throughput"
                >
                  <RiWifiLine /> {networkLabel}
                </span>
                <span className={`nexus-status-pill ${batteryTone}`} title={batteryStatus}>
                  <RiBatteryChargeLine /> {batteryLabel}
                </span>
                <span className="nexus-status-pill text-orange-100">
                  {time.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <nav className="nexus-header-nav scrollbar-small" aria-label="Nexus sections">
              {navTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nexus-header-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  title={`${tab.label} - ${tab.detail}`}
                >
                  <span className="nexus-header-tab-icon">{tab.icon}</span>
                  <span className="nexus-header-tab-copy">
                    <span>{tab.label}</span>
                    <small>{tab.detail}</small>
                  </span>
                </button>
              ))}
            </nav>
          </header>

          <section className="nexus-content-stage relative min-h-0 flex-1 overflow-hidden">
            <div
              className={`absolute inset-0 overflow-y-auto scrollbar-small ${activeTab === 'DASHBOARD' ? 'block' : 'hidden'}`}
            >
              <DashboardView
                props={props}
                stats={stats}
                chatHistory={chatHistory}
                onVisionClick={handleVisionClick}
              />
            </div>

            <div
              className={`absolute inset-0 overflow-y-auto scrollbar-small ${activeTab === 'PHONE' ? 'block' : 'hidden'}`}
            >
              <PhoneView glassPanel={glassPanel} />
            </div>

            <Suspense fallback={<ViewSkeleton />}>
              {activeTab !== 'DASHBOARD' && activeTab !== 'PHONE' && (
                <div className="absolute inset-0 overflow-y-auto scrollbar-small">
                  {activeTab === 'Macros' && <WorkFlowEditorView />}
                  {activeTab === 'AI CHAT' && <AiChatView />}
                  {activeTab === 'Apps' && <AppsView />}
                  {activeTab === 'NOTES' && <NotesView glassPanel={glassPanel} />}
                  {activeTab === 'SETTINGS' && (
                    <SettingsView isSystemActive={props.isSystemActive} />
                  )}
                  {activeTab === 'GALLERY' && <GalleryView />}
                </div>
              )}
            </Suspense>
          </section>
        </main>
      </div>

      {showSourceModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`${glassPanel} w-96 p-1 border-emerald-500/30 flex flex-col shadow-2xl`}>
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
              <span className="text-xs font-bold tracking-widest text-emerald-400">
                ESTABLISH UPLINK
              </span>
              <button
                onClick={() => setShowSourceModal(false)}
                className="cursor-pointer text-zinc-500 hover:text-white"
              >
                <RiCloseLine size={18} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  props.startVision('camera')
                  setShowSourceModal(false)
                }}
                className="cursor-pointer group flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-black/40 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all"
              >
                <div className="p-3 rounded-full bg-zinc-900 group-hover:bg-emerald-500 text-zinc-400 group-hover:text-black transition-colors">
                  <RiCameraLine size={28} />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-zinc-300 group-hover:text-emerald-400">
                  CAMERA FEED
                </span>
              </button>

              <button
                onClick={() => {
                  props.startVision('screen')
                  setShowSourceModal(false)
                }}
                className="cursor-pointer group flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-black/40 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all"
              >
                <div className="p-3 rounded-full bg-zinc-900 group-hover:bg-emerald-500 text-zinc-400 group-hover:text-black transition-colors">
                  <RiComputerLine size={28} />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-zinc-300 group-hover:text-emerald-400">
                  SCREEN SHARE
                </span>
              </button>
            </div>

            <div className="p-3 bg-black/20 text-center">
              <p className="text-[9px] text-zinc-600 font-mono">
                SELECT INPUT SOURCE FOR NEURAL PROCESSING
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Nexus
