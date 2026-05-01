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
  toggleSystem: () => void
  isMicMuted: boolean
  toggleMic: () => void
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
  activeStream: MediaStream | null
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

const Nexus = (props: NexusProps) => {
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [stats, setStats] = useState<any>(null)
  const [time, setTime] = useState<Date>(new Date())
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [showSourceModal, setShowSourceModal] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
      getSystemStatus().then(setStats)
    }, 500)
    return () => clearInterval(timer)
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

  return (
    <div className="nexus-app-shell h-screen w-full overflow-hidden select-none text-zinc-100">
      <div className="nexus-liquid-orb nexus-liquid-orb-one" />
      <div className="nexus-liquid-orb nexus-liquid-orb-two" />
      <div className="nexus-radar-grid absolute inset-0 opacity-45" />
      <div className="nexus-scanline" />

      <div className="relative z-10 flex h-full gap-4 p-4">
        <aside className="nexus-side-dock hidden w-[282px] shrink-0 flex-col overflow-hidden xl:flex">
          <div className="relative border-b border-white/10 p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
            <div className="flex items-center gap-4">
              <div className="nexus-brand-core">
                <RiShieldFlashLine />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.38em] text-emerald-300">
                  Nexus Tech
                </p>
                <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.08em] text-white">
                  Nexus AI
                </h1>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Current Deck
              </p>
              <p className="mt-2 text-lg font-black text-white">{activeNav.label}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-100/55">{activeNav.detail}</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 scrollbar-small">
            <div className="space-y-2">
              {navTabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nexus-nav-tile group ${activeTab === tab.id ? 'is-active' : ''}`}
                >
                  <span className="text-[10px] font-black text-zinc-600">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-black/30 text-lg">
                    {tab.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[12px] font-black uppercase tracking-[0.16em]">
                      {tab.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {tab.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-3 text-emerald-300">
                <RiWifiLine className="mb-2 text-lg" />
                Linked
              </div>
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-3 text-cyan-200">
                <RiBatteryChargeLine className="mb-2 text-lg" />
                100%
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="nexus-command-bar">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-emerald-300">
                Autonomous Desktop Agent
              </p>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <h2 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
                  {activeNav.label}
                </h2>
                <span className="mb-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  {activeNav.detail}
                </span>
              </div>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <span className="nexus-status-pill text-emerald-300">
                <RiWifiLine /> Linked
              </span>
              <span className="nexus-status-pill text-cyan-200">
                <RiBatteryChargeLine /> 100%
              </span>
              <span className="nexus-status-pill text-orange-100">
                {time.toLocaleTimeString()}
              </span>
            </div>

            <div className="flex gap-1 overflow-x-auto scrollbar-small xl:hidden">
              {navTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-lg transition ${
                    activeTab === tab.id
                      ? 'border-emerald-300/50 bg-emerald-300/20 text-emerald-100'
                      : 'border-white/10 bg-black/30 text-zinc-500'
                  }`}
                >
                  {tab.icon}
                </button>
              ))}
            </div>
          </header>

          <section className="nexus-content-stage relative min-h-0 flex-1 overflow-hidden">
            <div className={`absolute inset-0 ${activeTab === 'DASHBOARD' ? 'block' : 'hidden'}`}>
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
