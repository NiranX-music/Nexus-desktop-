import { useState, useEffect, Suspense, lazy } from 'react'
import {
  RiWifiLine,
  RiShieldFlashLine,
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
  RiPencilLine,
  RiDashboardLine,
  RiVideoLine,
  RiUserLine
} from 'react-icons/ri'
import { getSystemStatus } from '@renderer/services/system-info'
import { getHistory } from '@renderer/services/nexus-ai-brain'
import { nexusService } from '@renderer/services/nexus-voice-ai'
import { trackSiteVisit } from '@renderer/services/analytics'
import ViewSkeleton from '@renderer/components/ViewSkelrton'

import DashboardView from '../views/Dashboard'
import PhoneView from '../views/Phone'
import { VisionMode } from '@renderer/IndexRoot'

const AppsView = lazy(() => import('../views/APP'))
const WorkFlowEditorView = lazy(() => import('../views/WorkFlowEditor'))
const AiChatView = lazy(() => import('../views/AiChat'))
const NotesView = lazy(() => import('../views/Notes'))
const SettingsView = lazy(() => import('../views/Settings'))
const ProfileView = lazy(() => import('../views/Profile'))
const GalleryView = lazy(() => import('../views/Gallery'))
const BrowserControlView = lazy(() => import('../views/BrowserControl'))
const WhiteboardView = lazy(() => import('../views/Whiteboard'))
const VideoStudioView = lazy(() => import('../views/VideoStudio'))

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

const glassPanel =
  'rounded-xl border border-white/10 bg-zinc-950/55 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl'

const NEXUS = (props: NexusProps) => {
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

  const tabs = [
    { id: 'DASHBOARD', icon: <RiDashboardLine />, label: 'Agent' },
    { id: 'PROFILE', icon: <RiUserLine />, label: 'Profile' },
    { id: 'AI CHAT', icon: <RiChatSmile3Line />, label: 'AI Chat' },
    { id: 'Macros', icon: <RiBrainLine />, label: 'Macros' },
    { id: 'Apps', icon: <RiFolderOpenLine />, label: 'Apps' },
    { id: 'BROWSER CONTROL', icon: <RiGlobalLine />, label: 'Browser' },
    { id: 'WHITEBOARD', icon: <RiPencilLine />, label: 'Board' },
    { id: 'VIDEO', icon: <RiVideoLine />, label: 'Video' },
    { id: 'NOTES', icon: <RiFolderOpenLine />, label: 'Notes' },
    { id: 'GALLERY', icon: <RiImageLine />, label: 'Gallery' },
    { id: 'PHONE', icon: <RiPhoneLine />, label: 'Phone' },
    { id: 'SETTINGS', icon: <RiSettings4Line />, label: 'Settings' }
  ]

  useEffect(() => {
    const pageMap: Record<string, string> = {
      agent: 'DASHBOARD',
      dashboard: 'DASHBOARD',
      profile: 'PROFILE',
      account: 'PROFILE',
      chat: 'AI CHAT',
      'ai chat': 'AI CHAT',
      macros: 'Macros',
      apps: 'Apps',
      files: 'Apps',
      browser: 'BROWSER CONTROL',
      whiteboard: 'WHITEBOARD',
      board: 'WHITEBOARD',
      media: 'VIDEO',
      video: 'VIDEO',
      notes: 'NOTES',
      gallery: 'GALLERY',
      phone: 'PHONE',
      settings: 'SETTINGS'
    }

    const sendTextToAgent = async (text: string) => {
      const cleaned = text.trim()
      if (!cleaned) return

      try {
        if (!props.isSystemActive && !props.isSystemStarting) {
          await props.toggleSystem()
        }
        await nexusService.sendTextPrompt(cleaned, 'steer')
      } catch {
        localStorage.setItem(
          'nexus_pending_dock_command',
          JSON.stringify({ text: cleaned, intent: 'steer', createdAt: Date.now() })
        )
      }
    }

    const handleMobileCommand = async (_event: unknown, command: any) => {
      const type = String(command?.type || '').trim()
      const payload = String(command?.payload || '').trim()
      if (!type) return

      localStorage.setItem(
        'nexus_last_mobile_command',
        JSON.stringify({ ...command, receivedAt: Date.now() })
      )

      if (type === 'page') {
        setActiveTab(pageMap[payload.toLowerCase()] || 'DASHBOARD')
        return
      }

      if (type === 'voice') {
        setActiveTab('DASHBOARD')
        if (payload === 'online' && !props.isSystemActive && !props.isSystemStarting) {
          await props.toggleSystem()
        }
        if ((payload === 'offline' || payload === 'off') && props.isSystemActive) {
          await props.toggleSystem()
          return
        }
        if ((payload === 'online' || payload === 'unmuted') && props.isMicMuted) {
          props.toggleMic()
        }
        if (payload === 'muted' && !props.isMicMuted) {
          props.toggleMic()
        }
        return
      }

      if (type.startsWith('whiteboard')) {
        setActiveTab('WHITEBOARD')
        window.dispatchEvent(new CustomEvent('nexus-mobile-command', { detail: command }))
        return
      }

      if (type.startsWith('files')) {
        setActiveTab('Apps')
        window.dispatchEvent(new CustomEvent('nexus-mobile-command', { detail: command }))
        return
      }

      if (['weather', 'stocks', 'maps', 'research'].includes(type)) {
        setActiveTab('DASHBOARD')
        await sendTextToAgent(`${type}: ${payload}`)
        return
      }

      if (type === 'command') {
        await sendTextToAgent(payload)
      }
    }

    window.electron.ipcRenderer.on('mobile-command', handleMobileCommand)
    return () => window.electron.ipcRenderer.removeAllListeners('mobile-command')
  }, [
    props.isSystemActive,
    props.isSystemStarting,
    props.isMicMuted,
    props.toggleMic,
    props.toggleSystem
  ])

  useEffect(() => {
    void trackSiteVisit(`nexus-tab:${activeTab}`, {
      surface: 'nexus-tab',
      tab: activeTab
    }).catch(() => {})
  }, [activeTab])

  return (
    <div className="nexus-shell-bg nexus-shell-scan h-screen w-full text-zinc-100 font-sans overflow-hidden select-none flex flex-col relative pb-5">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35" />

      <div className="group/sidebar fixed left-0 top-14 bottom-5 z-70 w-16 hover:w-56 transition-all duration-200 border-r border-emerald-400/20 bg-zinc-950/82 backdrop-blur-2xl overflow-hidden shadow-[18px_0_35px_rgba(0,0,0,0.55)]">
        <div className="border-b border-white/5 p-2">
          <div className="flex h-10 items-center gap-3 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.08] px-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400 text-[10px] font-black text-black shadow-[0_0_18px_rgba(52,211,153,0.4)]">
              NX
            </span>
            <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-[9px] font-black uppercase tracking-[0.22em] text-emerald-100 whitespace-nowrap">
              Nexus 9.1
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group/nav relative h-11 rounded-lg flex items-center gap-3 px-3 transition-all border ${
                activeTab === tab.id
                  ? 'bg-emerald-400/[0.14] border-emerald-300/30 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.09)]'
                  : 'bg-white/[0.025] border-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-200 hover:bg-white/[0.055]'
              }`}
              title={tab.label}
            >
              {activeTab === tab.id && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
              )}
              <span className="text-xl shrink-0">{tab.icon}</span>
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-[10px] font-black tracking-widest uppercase whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="relative z-50 h-14 w-full flex items-center justify-between pl-20 pr-6 border-b border-emerald-300/10 bg-zinc-950/75 shadow-[0_14px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300 shadow-[0_0_22px_rgba(16,185,129,0.14)]">
            <RiShieldFlashLine className="text-xl animate-pulse" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black tracking-[0.2em] text-sm text-zinc-100">Nexus AI</span>
            <span className="text-[11px] font-mono text-emerald-500/60 tracking-widest">
              NEURAL INTERFACE
            </span>
          </div>
        </div>

        <div className="hidden md:flex gap-2 bg-black/45 p-1 rounded-lg border border-white/10 shadow-inner">
          <span className="px-5 py-1.5 text-[10px] font-bold tracking-widest rounded-md text-emerald-200 border border-emerald-400/20 bg-emerald-400/10">
            {tabs.find((tab) => tab.id === activeTab)?.label || activeTab}
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 text-[11px] font-mono font-bold">
          <div className="flex items-center gap-2 text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            <RiWifiLine /> <span className="hidden sm:inline">LINKED</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-zinc-400">
            <RiBatteryChargeLine /> <span>100%</span>
          </div>
          <div className="rounded-md border border-white/10 bg-black/45 px-2 py-1 text-zinc-300">
            {time.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative ml-16 bg-[radial-gradient(circle_at_center,#11182780_0%,#020202_62%,#000_100%)]">
        <div className={`absolute inset-0 ${activeTab === 'DASHBOARD' ? 'block' : 'hidden'}`}>
          <DashboardView
            props={props}
            stats={stats}
            chatHistory={chatHistory}
            onVisionClick={handleVisionClick}
          />
        </div>

        <div className={`absolute inset-0 ${activeTab === 'PHONE' ? 'block' : 'hidden'}`}>
          <PhoneView glassPanel={glassPanel} />
        </div>

        <Suspense fallback={<ViewSkeleton />}>
          {activeTab === 'AI CHAT' && (
            <AiChatView
              isSystemActive={props.isSystemActive}
              isSystemStarting={props.isSystemStarting}
              isMicMuted={props.isMicMuted}
              toggleSystem={props.toggleSystem}
              toggleMic={props.toggleMic}
            />
          )}
          {activeTab === 'PROFILE' && <ProfileView />}
          {activeTab === 'Macros' && <WorkFlowEditorView />}
          {activeTab === 'Apps' && <AppsView />}
          {activeTab === 'BROWSER CONTROL' && (
            <BrowserControlView
              isSystemActive={props.isSystemActive}
              isSystemStarting={props.isSystemStarting}
              isMicMuted={props.isMicMuted}
              toggleSystem={props.toggleSystem}
              toggleMic={props.toggleMic}
              sendTextCommand={async (command) => {
                if (!props.isSystemActive) await props.toggleSystem()
                await nexusService.sendTextPrompt(command, 'steer')
              }}
            />
          )}
          {activeTab === 'WHITEBOARD' && <WhiteboardView />}
          {activeTab === 'VIDEO' && <VideoStudioView />}
          {activeTab === 'NOTES' && <NotesView glassPanel={glassPanel} />}
          {activeTab === 'SETTINGS' && <SettingsView isSystemActive={props.isSystemActive} />}
          {activeTab === 'GALLERY' && <GalleryView />}
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

export default NEXUS
