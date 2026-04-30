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

const glassPanel = 'bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl'

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

  return (
    <div className="h-screen w-full text-zinc-100 font-sans overflow-hidden select-none flex flex-col relative">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-32 top-10 h-82 w-82 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-orange-500/8 blur-3xl" />
        <div className="nexus-radar-grid absolute inset-0 opacity-35" />
      </div>

      <div className="relative z-50 mx-4 mt-3 h-16 shrink-0 flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/15 bg-black/45 px-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div className="hidden lg:flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 shadow-[0_0_28px_rgba(16,185,129,0.22)]">
            <RiShieldFlashLine className="text-emerald-300 text-xl animate-pulse" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black tracking-[0.22em] text-sm text-zinc-100 uppercase">
              Nexus AI
            </span>
            <span className="text-[10px] font-mono text-cyan-300/65 tracking-[0.24em]">
              AUTONOMOUS COMMAND RIBBON
            </span>
          </div>
        </div>

        <div className="hidden md:flex gap-1.5 bg-white/[0.03] p-1.5 rounded-2xl border border-white/8 shadow-inner shadow-black/40">
          {[
            { id: 'DASHBOARD', icon: <RiLayoutGridLine /> },
            { id: 'AI CHAT', icon: <RiChatSmile3Line /> },
            { id: 'Macros', icon: <RiBrainLine /> },
            { id: 'Apps', icon: <RiFolderOpenLine /> },
            { id: 'NOTES', icon: <RiFolderOpenLine /> },
            { id: 'GALLERY', icon: <RiImageLine /> },
            { id: 'PHONE', icon: <RiPhoneLine /> },
            { id: 'SETTINGS', icon: <RiSettings4Line /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer px-4 py-2 text-[10px] font-black tracking-widest rounded-xl transition-all duration-300 flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-emerald-400/18 text-emerald-200 border border-emerald-300/25 shadow-[0_0_24px_rgba(16,185,129,0.16)]'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/7'
              }`}
            >
              {tab.icon} {tab.id}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono font-bold">
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/8 px-3 py-1.5 text-emerald-300">
            <RiWifiLine /> <span>LINKED</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-cyan-300/12 bg-cyan-300/6 px-3 py-1.5 text-cyan-100/70">
            <RiBatteryChargeLine /> <span>100%</span>
          </div>
          <div className="rounded-full border border-orange-300/15 bg-orange-300/8 px-3 py-1.5 text-orange-100/75">
            {time.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="relative z-10 m-4 mt-3 flex-1 min-h-0 overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-zinc-900/60 via-black to-[#020403] shadow-[inset_0_1px_rgba(255,255,255,0.04)]">
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
              {activeTab === 'SETTINGS' && <SettingsView isSystemActive={props.isSystemActive} />}
              {activeTab === 'GALLERY' && <GalleryView />}
            </div>
          )}
        </Suspense>
      </div>

      {showSourceModal && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
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
