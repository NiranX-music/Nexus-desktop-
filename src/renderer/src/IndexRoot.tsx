import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RiDownloadCloud2Line,
  RiLoader4Line,
  RiRefreshLine,
  RiShieldFlashLine
} from 'react-icons/ri'
import MiniOverlay from './components/MiniOverlay'
import { nexusService } from './services/nexus-voice-ai'
import { saveMessage } from './services/nexus-ai-brain'
import { generateWithNexusGeminiClient } from './services/nexus-gemini-api'
import {
  WHITEBOARD_SYSTEM_PROMPT,
  createWhiteboardPayload,
  extractWhiteboardQuestion,
  isWhiteboardCommand,
  publishWhiteboardWrite
} from './services/whiteboard'
import { getScreenSourceId } from './hooks/CaptureDesktop'
import { useNexusRequestQueue } from './hooks/useNexusRequestQueue'
import Nexus from './UI/nexus'
import TitleBar from './components/Titlebar'
import { useAuthStore } from './store/auth-store'
import { IS_TRIAL_BUILD } from './config/app-mode'

const TerminalOverlay = !IS_TRIAL_BUILD ? lazy(() => import('./components/TerminalOverlay')) : null
const SmartDropZonesWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/SmartZoneWidget')) : null
const SemanticWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/SematicSearch')) : null
const OracleWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/RagOrcaleWidget')) : null
const WormholeWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/WormholeWidget')) : null
const LeafletMapWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/MapView')) : null
const StockWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/StockWidget')) : null
const WeatherWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/WeatherWidget')) : null
const ImageWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/ImageWidget')) : null
const EmailWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/EmailWidget')) : null
const LiveCodingWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/LiveCodingWidget')) : null
const ResearchWidget = !IS_TRIAL_BUILD ? lazy(() => import('./Widgets/DeepResearch')) : null

export type VisionMode = 'camera' | 'screen' | 'none'
export type AssistantVisualState = 'offline' | 'running' | 'speaking'

interface MandatoryUpdateStatus {
  success: boolean
  updateRequired: boolean
  currentVersion: string
  latestVersion: string
  releaseDate?: string
  installerUrl?: string
  error?: string
}

const MandatoryUpdateGate = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<MandatoryUpdateStatus | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [updatePhase, setUpdatePhase] = useState('Checking update policy')
  const [progress, setProgress] = useState(0)
  const [isBusy, setIsBusy] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)

  const refreshStatus = async () => {
    setIsChecking(true)
    setUpdatePhase('Checking update policy')
    const nextStatus = await window.electron.ipcRenderer.invoke('mandatory-update:status')
    setStatus(nextStatus)
    setIsChecking(false)
  }

  useEffect(() => {
    refreshStatus()

    const unsubscribe = window.electron.ipcRenderer.on(
      'updater-event',
      (_event: any, event: any) => {
        if (!event) return
        if (event.status === 'checking') setUpdatePhase('Checking for update')
        if (event.status === 'available')
          setUpdatePhase(`Update ${event.data?.version || ''} available`)
        if (event.status === 'downloading') {
          setUpdatePhase('Downloading required update')
          setProgress(Math.round(Number(event.data?.percent || 0)))
        }
        if (event.status === 'downloaded') {
          setUpdatePhase('Update ready to install')
          setProgress(100)
          setIsDownloaded(true)
          setIsBusy(false)
        }
        if (event.status === 'error') {
          setUpdatePhase(event.error || 'Update failed')
          setIsBusy(false)
        }
      }
    )

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const downloadRequiredUpdate = async () => {
    setIsBusy(true)
    setProgress(0)
    setUpdatePhase('Preparing required update')

    const check = await window.electron.ipcRenderer.invoke('check-for-updates')
    if (!check?.success) {
      setUpdatePhase(check?.error || 'Unable to check for update')
      setIsBusy(false)
      return
    }

    const download = await window.electron.ipcRenderer.invoke('download-update')
    if (!download?.success) {
      setUpdatePhase(download?.error || 'Unable to download update')
      setIsBusy(false)
    }
  }

  const installRequiredUpdate = async () => {
    setIsBusy(true)
    setUpdatePhase('Installing update')
    await window.electron.ipcRenderer.invoke('install-update')
  }

  if (isChecking) {
    return (
      <div className="nexus-desktop-frame grid h-screen w-screen place-items-center text-zinc-100">
        <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">
          <RiLoader4Line className="animate-spin text-xl" />
          Checking required update
        </div>
      </div>
    )
  }

  if (!status?.updateRequired) return <>{children}</>

  return (
    <div className="nexus-desktop-frame relative grid h-screen w-screen place-items-center overflow-hidden border border-emerald-400/25 p-6 text-zinc-100">
      <div className="nexus-radar-grid absolute inset-0 opacity-45" />
      <div className="relative z-10 w-full max-w-xl border border-emerald-300/25 bg-black/70 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="mb-5 flex items-center gap-4 border-b border-white/10 pb-4">
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-emerald-300/30 bg-emerald-300/10 text-2xl text-emerald-200">
            <RiShieldFlashLine />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black uppercase tracking-[0.16em] text-white">
              Required Update
            </h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300/70">
              Nexus must update before the app can run
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
              Installed
            </p>
            <p className="mt-2 text-lg font-black text-zinc-100">{status.currentVersion}</p>
          </div>
          <div className="border border-emerald-300/20 bg-emerald-300/10 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/70">
              Required
            </p>
            <p className="mt-2 text-lg font-black text-emerald-100">{status.latestVersion}</p>
          </div>
        </div>

        <div className="mt-5 border border-white/10 bg-black/45 p-4">
          <div className="mb-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
            <span>{updatePhase}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/70">
            <div
              className="h-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.85)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {isDownloaded ? (
            <button
              onClick={installRequiredUpdate}
              disabled={isBusy}
              className="flex flex-1 items-center justify-center gap-2 border border-emerald-300/25 bg-emerald-400 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              <RiRefreshLine />
              Install and restart
            </button>
          ) : (
            <button
              onClick={downloadRequiredUpdate}
              disabled={isBusy}
              className="flex flex-1 items-center justify-center gap-2 border border-emerald-300/25 bg-emerald-400 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {isBusy ? <RiLoader4Line className="animate-spin" /> : <RiDownloadCloud2Line />}
              Download update
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const IndexRoot = () => {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [isOverlay, setIsOverlay] = useState(false)
  const [assistantVisualState, setAssistantVisualState] = useState<AssistantVisualState>('offline')

  const [isSystemActive, setIsSystemActive] = useState(false)
  const [isSystemStarting, setIsSystemStarting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)

  const [isVideoOn, setIsVideoOn] = useState(false)
  const [visionMode, setVisionMode] = useState<VisionMode>('none')

  const processingVideoRef = useRef<HTMLVideoElement>(document.createElement('video'))
  const activeStreamRef = useRef<MediaStream | null>(null)
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const coreIntentActiveRef = useRef(false)
  const coreReconnectBusyRef = useRef(false)
  const coreReconnectFailuresRef = useRef(0)

  const setCoreActiveState = (active: boolean) => {
    coreIntentActiveRef.current = active
    setIsSystemActive(active)
  }

  useEffect(() => {
    void window.electron.ipcRenderer
      .invoke('overlay-mode:get')
      .then((mode) => setIsOverlay(Boolean(mode)))
      .catch(() => {})

    const unsubscribeStatus = nexusService.subscribeStatus((status) => {
      setAssistantVisualState(
        status.isConnected
          ? status.isSpeaking
            ? 'speaking'
            : 'running'
          : coreIntentActiveRef.current
            ? 'running'
            : 'offline'
      )
      if (status.isConnected) {
        coreReconnectFailuresRef.current = 0
      }
    })

    window.electron.ipcRenderer.on('overlay-mode', (_e, mode) => setIsOverlay(Boolean(mode)))
    return () => {
      window.electron.ipcRenderer.removeAllListeners('overlay-mode')
      unsubscribeStatus()
    }
  }, [])

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (
        !isSystemActive ||
        isSystemStarting ||
        nexusService.isConnected ||
        coreReconnectBusyRef.current
      ) {
        return
      }

      coreReconnectBusyRef.current = true

      nexusService
        .connect()
        .then(() => {
          coreReconnectFailuresRef.current = 0
          setCoreActiveState(true)
          setIsMicMuted(false)
          nexusService.setMute(false)
        })
        .catch((error: any) => {
          coreReconnectFailuresRef.current += 1
          const message = String(error?.message || '')
          const isMissingKey =
            message === 'NO_API_KEY' || message.toLowerCase().includes('gemini api key')

          if (isMissingKey || coreReconnectFailuresRef.current >= 3) {
            setCoreActiveState(false)
            setIsMicMuted(true)
            stopVision()
          }
        })
        .finally(() => {
          coreReconnectBusyRef.current = false
        })
    }, 2500)
    return () => clearInterval(watchdog)
  }, [isSystemActive, isSystemStarting])

  const waitForCoreReady = (timeoutMs = 8000) =>
    new Promise<void>((resolve, reject) => {
      if (nexusService.isConnected && nexusService.socket?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      const start = Date.now()
      const interval = setInterval(() => {
        if (nexusService.isConnected && nexusService.socket?.readyState === WebSocket.OPEN) {
          clearInterval(interval)
          resolve()
          return
        }

        if (Date.now() - start > timeoutMs) {
          clearInterval(interval)
          reject(new Error('Core is taking too long to start. Check the Gemini API key/network.'))
        }
      }, 100)
    })

  const startSystem = async () => {
    if (isSystemActive && nexusService.isConnected) return
    if (coreReconnectBusyRef.current) {
      await waitForCoreReady()
      return
    }
    if (isSystemStarting) {
      await waitForCoreReady()
      return
    }

    setIsSystemStarting(true)
    try {
      await nexusService.connect()
      setCoreActiveState(true)
      setIsMicMuted(false)
      nexusService.setMute(false)
    } catch (error) {
      setCoreActiveState(false)
      setIsMicMuted(true)
      throw error
    } finally {
      setIsSystemStarting(false)
    }
  }

  const toggleSystem = async () => {
    if (!isSystemActive) {
      try {
        await startSystem()
      } catch (err: any) {
        if (err.message === 'NO_API_KEY') {
          alert(
            'Hosted Gemini text commands are ready. Add a local Gemini Live key in Settings only when you want the live voice/action core.'
          )
        } else {
          alert(`Connection failed: ${err.message}`)
        }
        setCoreActiveState(false)
        setIsSystemStarting(false)
      }
    } else {
      nexusService.disconnect()
      setCoreActiveState(false)
      setIsSystemStarting(false)
      setIsMicMuted(true)
      nexusService.setMute(true)
      stopVision()
    }
  }

  const writeCommandToWhiteboard = async (command: string) => {
    const prompt = extractWhiteboardQuestion(command)
    await saveMessage('user', command)

    const response = await generateWithNexusGeminiClient({
      prompt,
      system: WHITEBOARD_SYSTEM_PROMPT,
      temperature: 0.35,
      maxOutputTokens: 1100
    })

    publishWhiteboardWrite(createWhiteboardPayload(prompt, response, 'command'))
    await saveMessage('nexus', `I wrote the solution on the whiteboard.\n\n${response}`)

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance('I wrote it on the whiteboard.'))
    }
  }

  const executeTextCommand = async (command: string) => {
    if (isWhiteboardCommand(command)) {
      await writeCommandToWhiteboard(command)
      return
    }

    try {
      if (!isSystemActive || !nexusService.isConnected) {
        await startSystem()
        await waitForCoreReady()
      } else if (isSystemStarting) {
        await waitForCoreReady()
      }

      await nexusService.sendTextCommand(command)
    } catch (error: any) {
      const message = String(error?.message || '')
      const liveConnectionGlitch =
        message.toLowerCase().includes('core is still starting') ||
        message.toLowerCase().includes('socket') ||
        message.toLowerCase().includes('closed')
      const liveVoiceSilent =
        message.toLowerCase().includes('live voice did not return') ||
        message.toLowerCase().includes('live voice finished without') ||
        message.toLowerCase().includes('live voice disconnected') ||
        message.toLowerCase().includes('live voice was interrupted')

      if (liveConnectionGlitch) {
        try {
          await startSystem()
          await waitForCoreReady()
          await nexusService.sendTextCommand(command)
          return
        } catch (retryError) {
          error = retryError
        }
      }

      const fallbackAllowed =
        error?.message === 'NO_API_KEY' ||
        String(error?.message || '').toLowerCase().includes('gemini api key') ||
        liveConnectionGlitch ||
        liveVoiceSilent

      if (!fallbackAllowed) throw error

      if (!error?.userMessageSaved) {
        await saveMessage('user', command)
      }
      const response = await generateWithNexusGeminiClient({
        prompt: command,
        system:
          'You are Nexus AI inside the desktop command console. Reply directly and briefly. The local Live voice socket was slow or silent, so answer normally through the hosted Nexus Gemini API.'
      })
      await saveMessage('nexus', response)

      if (window.speechSynthesis && response) {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(response))
      }
    }
  }

  const {
    activeRequest,
    requestQueue,
    requestRoutingMode,
    setRequestRoutingMode,
    submitRequest: sendTextCommand
  } = useNexusRequestQueue(executeTextCommand)

  const toggleMic = () => {
    const s = !isMicMuted
    setIsMicMuted(s)
    nexusService.setMute(s)
  }

  const logoutAccount = () => {
    if (IS_TRIAL_BUILD) {
      window.open(
        `${import.meta.env.VITE_NEXUS_WEB_APP_URL || 'https://niranx-nexus-agent.vercel.app'}/installer`,
        '_blank'
      )
      return
    }

    nexusService.disconnect()
    setCoreActiveState(false)
    setIsSystemStarting(false)
    setIsMicMuted(true)
    nexusService.setMute(true)
    stopVision()
    logout()
    navigate('/login', { replace: true })
  }

  const startVision = async (mode: 'camera' | 'screen') => {
    if (!isSystemActive) return

    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop())
      }

      let stream: MediaStream

      if (mode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })
      } else {
        const sourceId = await getScreenSourceId()
        if (!sourceId) return
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: 1280,
              maxHeight: 720
            }
          }
        })
      }

      activeStreamRef.current = stream

      processingVideoRef.current.srcObject = stream
      await processingVideoRef.current.play()

      setVisionMode(mode)
      setIsVideoOn(true)

      startAIProcessing()

      stream.getVideoTracks()[0].onended = () => stopVision()
    } catch (e) {
      stopVision()
    }
  }

  const openFullExperience = () => {
    window.open(
      `${import.meta.env.VITE_NEXUS_WEB_APP_URL || 'https://niranx-nexus-agent.vercel.app'}/installer`,
      '_blank'
    )
  }

  const stopVision = () => {
    setIsVideoOn(false)
    setVisionMode('none')

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop())
      activeStreamRef.current = null
    }

    if (processingVideoRef.current) {
      processingVideoRef.current.srcObject = null
    }

    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current)
      aiIntervalRef.current = null
    }
  }

  const startAIProcessing = () => {
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current)

    aiIntervalRef.current = setInterval(() => {
      const vid = processingVideoRef.current
      if (vid && vid.readyState === 4 && nexusService.socket?.readyState === WebSocket.OPEN) {
        const canvas = document.createElement('canvas')
        canvas.width = 800
        canvas.height = 450
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
          const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]
          nexusService.sendVideoFrame(base64)
        }
      }
    }, 2000)
  }

  if (isOverlay) {
    return (
      <MandatoryUpdateGate>
        <div className="flex h-screen w-screen items-start justify-center overflow-hidden bg-transparent">
          <MiniOverlay
            assistantVisualState={assistantVisualState}
            isSystemActive={isSystemActive}
            isSystemStarting={isSystemStarting}
            toggleSystem={toggleSystem}
            isMicMuted={isMicMuted}
            toggleMic={toggleMic}
            isVideoOn={isVideoOn}
            visionMode={visionMode}
            startVision={startVision}
            stopVision={stopVision}
            sendTextCommand={sendTextCommand}
          />
        </div>
      </MandatoryUpdateGate>
    )
  }

  return (
    <MandatoryUpdateGate>
      <div className="nexus-desktop-frame flex flex-col h-screen w-screen overflow-hidden relative border border-emerald-400/25 rounded-md">
        <TitleBar />
        <div className="min-h-0 flex-1 relative">
          <Nexus
            assistantVisualState={assistantVisualState}
            isSystemActive={isSystemActive}
            isSystemStarting={isSystemStarting}
            toggleSystem={toggleSystem}
            isMicMuted={isMicMuted}
            toggleMic={toggleMic}
            isVideoOn={isVideoOn}
            visionMode={visionMode}
            startVision={startVision}
            stopVision={stopVision}
            activeStream={activeStreamRef.current}
            sendTextCommand={sendTextCommand}
            activeRequest={activeRequest}
            requestQueue={requestQueue}
            requestRoutingMode={requestRoutingMode}
            setRequestRoutingMode={setRequestRoutingMode}
            onLogout={logoutAccount}
            onUpgrade={openFullExperience}
            isTrialBuild={IS_TRIAL_BUILD}
          />
        </div>
        {!IS_TRIAL_BUILD && (
          <Suspense fallback={null}>
            {TerminalOverlay && <TerminalOverlay />}
            {SmartDropZonesWidget && <SmartDropZonesWidget />}
            {SemanticWidget && <SemanticWidget />}
            {OracleWidget && <OracleWidget />}
            {WormholeWidget && <WormholeWidget />}
            {LeafletMapWidget && <LeafletMapWidget />}
            {StockWidget && <StockWidget />}
            {WeatherWidget && <WeatherWidget />}
            {ImageWidget && <ImageWidget />}
            {EmailWidget && <EmailWidget />}
            {LiveCodingWidget && <LiveCodingWidget />}
            {ResearchWidget && <ResearchWidget />}
          </Suspense>
        )}
      </div>
    </MandatoryUpdateGate>
  )
}

export default IndexRoot
