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
  RiChatSmile3Line,
  RiGlobalLine,
  RiLogoutBoxRLine,
  RiPulseLine
} from 'react-icons/ri'
import { getSystemStatus } from '@renderer/services/system-info'
import type { SystemStats } from '@renderer/services/system-info'
import { getHistory } from '@renderer/services/nexus-ai-brain'
import ViewSkeleton from '@renderer/components/ViewSkelrton'
import { IS_TRIAL_BUILD, TRIAL_ALLOWED_TABS, TRIAL_LIMITATION_COPY } from '@renderer/config/app-mode'

import DashboardView from '../views/Dashboard'
import type { AssistantVisualState, VisionMode } from '@renderer/IndexRoot'

const AppsView = !IS_TRIAL_BUILD ? lazy(() => import('../views/APP')) : null
const WorkFlowEditorView = !IS_TRIAL_BUILD ? lazy(() => import('../views/WorkFlowEditor')) : null
const BrowserControlView = lazy(() => import('../views/BrowserControl'))
const NotesView = lazy(() => import('../views/Notes'))
const SettingsView = lazy(() => import('../views/Settings'))
const GalleryView = !IS_TRIAL_BUILD ? lazy(() => import('../views/Gallery')) : null
const AiChatView = lazy(() => import('../views/AiChat'))
const PhoneView = !IS_TRIAL_BUILD ? lazy(() => import('../views/Phone')) : null

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
  onLogout: () => void
  onUpgrade: () => void
  isTrialBuild: boolean
}

const glassPanel = 'nexus-glass-card'

const fullNavTabs = [
  { id: 'DASHBOARD', label: 'Command', detail: 'Core overview', icon: <RiLayoutGridLine /> },
  { id: 'AI CHAT', label: 'AI Chat', detail: 'NVIDIA Build', icon: <RiChatSmile3Line /> },
  {
    id: 'BROWSER CONTROL',
    label: 'Browser',
    detail: 'Voice + text',
    icon: <RiGlobalLine />
  },
  { id: 'Macros', label: 'Macros', detail: 'Automation flow', icon: <RiBrainLine /> },
  { id: 'Apps', label: 'Apps', detail: 'Local tools', icon: <RiFolderOpenLine /> },
  { id: 'NOTES', label: 'Notes', detail: 'Vault memory', icon: <RiFolderOpenLine /> },
  { id: 'GALLERY', label: 'Gallery', detail: 'Vision archive', icon: <RiImageLine /> },
  { id: 'PHONE', label: 'Phone', detail: 'Device uplink', icon: <RiPhoneLine /> },
  { id: 'SETTINGS', label: 'Settings', detail: 'System config', icon: <RiSettings4Line /> }
]

const trialNavTabs = fullNavTabs
  .filter((tab) => TRIAL_ALLOWED_TABS.includes(tab.id as (typeof TRIAL_ALLOWED_TABS)[number]))
  .map((tab) =>
    tab.id === 'SETTINGS' ? { ...tab, detail: 'Local device only' } : tab
  )

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
  const navTabs = props.isTrialBuild ? trialNavTabs : fullNavTabs
  const [activeTab, setActiveTab] = useState(navTabs[0]?.id || 'DASHBOARD')
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [time, setTime] = useState<Date>(new Date())
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [showSourceModal, setShowSourceModal] = useState(false)

  useEffect(() => {
    if (navTabs.some((tab) => tab.id === activeTab)) return
    setActiveTab(navTabs[0]?.id || 'DASHBOARD')
  }, [activeTab, navTabs])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    const refreshStats = async () => {
      if (document.hidden) return
      const nextStats = await getSystemStatus()
      if (!cancelled) setStats(nextStats)
    }

    refreshStats()
    const timer = setInterval(refreshStats, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'DASHBOARD') return

    let cancelled = false

    const fetchHistory = async () => {
      if (document.hidden) return
      const history = await getHistory()
      if (!cancelled && Array.isArray(history)) setChatHistory(history.slice(-15))
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [activeTab])

  const handleVisionClick = () => {
    if (props.isVideoOn) {
      props.stopVision()
    } else {
      setShowSourceModal(true)
    }
  }

  const activeNav = navTabs.find((tab) => tab.id === activeTab) ?? navTabs[0]
  const activeNavIndex = Math.max(
    0,
    navTabs.findIndex((tab) => tab.id === activeNav.id)
  )
  const batteryLabel = getBatteryLabel(stats)
  const batteryStatus = stats?.battery?.status ?? 'Power'
  const batteryTone =
    stats?.battery?.isPresent && stats.battery.isOnBattery ? 'text-cyan-200' : 'text-emerald-300'
  const networkLabel = formatBytesPerSecond(stats?.network?.totalBytesPerSecond ?? 0)
  const assistantStateLabel =
    props.assistantVisualState === 'speaking'
      ? 'Speaking'
      : props.assistantVisualState === 'running'
        ? 'Running'
        : props.isSystemStarting
          ? 'Booting'
          : 'Standby'
  const assistantStateTone =
    props.assistantVisualState === 'speaking'
      ? 'text-fuchsia-100'
      : props.assistantVisualState === 'running'
        ? 'text-emerald-200'
        : props.isSystemStarting
          ? 'text-amber-100'
          : 'text-zinc-300'

  return (
    <div
      className={`nexus-app-shell nexus-agent-${props.assistantVisualState} h-full w-full overflow-hidden select-none text-zinc-100`}
    >
      <div className="nexus-liquid-orb nexus-liquid-orb-one" />
      <div className="nexus-liquid-orb nexus-liquid-orb-two" />
      <div className="nexus-runtime-aura" />
      <div className="nexus-runtime-sweep" />
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
                  {props.isTrialBuild && (
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.24em] text-amber-200">
                      Trial Build
                    </p>
                  )}
                </div>
              </div>

              <div className="nexus-header-title min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300/80">
                  Desktop Control Surface
                </p>
                <div className="nexus-header-route mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="nexus-header-route-index">
                    {String(activeNavIndex + 1).padStart(2, '0')}
                  </span>
                  <h2 className="truncate text-2xl font-black uppercase text-white md:text-[1.75rem]">
                    {activeNav.label}
                  </h2>
                  <span className="nexus-header-route-detail">
                    {activeNav.detail}
                  </span>
                </div>
              </div>

              <div className="nexus-header-status">
                <span className={`nexus-status-pill ${assistantStateTone}`} title="Assistant state">
                  <RiPulseLine /> {assistantStateLabel}
                </span>
                <span
                  className="nexus-status-pill text-emerald-300"
                  title="Live network throughput"
                >
                  <RiWifiLine /> Link {networkLabel}
                </span>
                <span className={`nexus-status-pill ${batteryTone}`} title={batteryStatus}>
                  <RiBatteryChargeLine /> {batteryLabel}
                </span>
                <span className="nexus-status-pill text-orange-100">
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {props.isTrialBuild ? (
                  <button
                    type="button"
                    className="nexus-status-pill nexus-logout-button"
                    onClick={props.onUpgrade}
                    title="Unlock the full Nexus build"
                  >
                    <RiShieldFlashLine /> <span className="hidden sm:inline">Unlock Full</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="nexus-status-pill nexus-logout-button"
                    onClick={props.onLogout}
                    title="Logout account"
                  >
                    <RiLogoutBoxRLine /> <span className="hidden sm:inline">Logout</span>
                  </button>
                )}
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
            {props.isTrialBuild && (
              <div className="mx-3 mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/8 px-4 py-3 text-[11px] text-amber-50 shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black uppercase tracking-[0.18em] text-amber-200">
                      Trial runtime active
                    </p>
                    <p className="mt-1 text-zinc-300">
                      This lighter build skips login, keeps settings local, and focuses on the core Nexus surfaces.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={props.onUpgrade}
                    className="rounded-xl border border-amber-300/25 bg-amber-300/14 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100 transition hover:bg-amber-300/22"
                  >
                    Unlock Full Experience
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TRIAL_LIMITATION_COPY.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'DASHBOARD' && (
              <div className="absolute inset-0 overflow-y-auto scrollbar-small">
                <DashboardView
                  props={props}
                  stats={stats}
                  chatHistory={chatHistory}
                  onVisionClick={handleVisionClick}
                  assistantVisualState={props.assistantVisualState}
                  isActive={true}
                />
              </div>
            )}

            {activeTab === 'PHONE' && (
              <Suspense fallback={<ViewSkeleton />}>
                <div className="absolute inset-0 overflow-y-auto scrollbar-small">
                  {PhoneView && <PhoneView glassPanel={glassPanel} />}
                </div>
              </Suspense>
            )}

            <Suspense fallback={<ViewSkeleton />}>
              {activeTab !== 'DASHBOARD' && activeTab !== 'PHONE' && (
                <div className="absolute inset-0 overflow-y-auto scrollbar-small">
                  {activeTab === 'Macros' && WorkFlowEditorView && <WorkFlowEditorView />}
                  {activeTab === 'BROWSER CONTROL' && (
                    <BrowserControlView
                      isSystemActive={props.isSystemActive}
                      isSystemStarting={props.isSystemStarting}
                      isMicMuted={props.isMicMuted}
                      toggleSystem={props.toggleSystem}
                      toggleMic={props.toggleMic}
                      sendTextCommand={props.sendTextCommand}
                    />
                  )}
                  {activeTab === 'AI CHAT' && <AiChatView />}
                  {activeTab === 'Apps' && AppsView && <AppsView />}
                  {activeTab === 'NOTES' && <NotesView glassPanel={glassPanel} />}
                  {activeTab === 'SETTINGS' && (
                    <SettingsView isSystemActive={props.isSystemActive} />
                  )}
                  {activeTab === 'GALLERY' && GalleryView && <GalleryView />}
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
