import { useEffect, useRef, useState } from 'react'
import {
  RiDownloadCloud2Line,
  RiLoader4Line,
  RiRefreshLine,
  RiShieldFlashLine
} from 'react-icons/ri'
import MiniOverlay from '@renderer/components/MiniOverlay'
import { getScreenSourceId } from '@renderer/hooks/CaptureDesktop'
import { nexusService } from '@renderer/services/nexus-voice-ai'
import TrialShell from './TrialShell'
import type { TrialAssistantVisualState, TrialVisionMode } from './types'

interface MandatoryUpdateStatus {
  success: boolean
  updateRequired: boolean
  currentVersion: string
  latestVersion: string
  releaseDate?: string
  installerUrl?: string
  error?: string
}

const TrialMandatoryUpdateGate = ({ children }: { children: React.ReactNode }) => {
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
    void refreshStatus()

    const unsubscribe = window.electron.ipcRenderer.on('updater-event', (_event: any, event: any) => {
      if (!event) return
      if (event.status === 'checking') setUpdatePhase('Checking for update')
      if (event.status === 'available') setUpdatePhase(`Update ${event.data?.version || ''} available`)
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
    })

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
      <div className="grid h-screen w-screen place-items-center bg-[#020507] text-zinc-100">
        <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">
          <RiLoader4Line className="animate-spin text-xl" />
          Checking required update
        </div>
      </div>
    )
  }

  if (!status?.updateRequired) return <>{children}</>

  return (
    <div className="relative grid h-screen w-screen place-items-center overflow-hidden border border-emerald-400/20 bg-[#020507] p-6 text-zinc-100">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-emerald-300/22 bg-black/70 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="mb-5 flex items-center gap-4 border-b border-white/10 pb-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-2xl text-emerald-200">
            <RiShieldFlashLine />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black uppercase tracking-[0.16em] text-white">
              Trial update required
            </h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300/70">
              Update before the trial app can run
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Installed</p>
            <p className="mt-2 text-lg font-black text-zinc-100">{status.currentVersion}</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/70">Required</p>
            <p className="mt-2 text-lg font-black text-emerald-100">{status.latestVersion}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/45 p-4">
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
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              <RiRefreshLine />
              Install and restart
            </button>
          ) : (
            <button
              onClick={downloadRequiredUpdate}
              disabled={isBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
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

export default function TrialRoot() {
  const [isOverlay, setIsOverlay] = useState(false)
  const [assistantVisualState, setAssistantVisualState] =
    useState<TrialAssistantVisualState>('offline')
  const [isSystemActive, setIsSystemActive] = useState(false)
  const [isSystemStarting, setIsSystemStarting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [visionMode, setVisionMode] = useState<TrialVisionMode>('none')

  const processingVideoRef = useRef<HTMLVideoElement>(document.createElement('video'))
  const activeStreamRef = useRef<MediaStream | null>(null)
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    void window.electron.ipcRenderer
      .invoke('overlay-mode:get')
      .then((mode) => setIsOverlay(Boolean(mode)))
      .catch(() => {})

    const unsubscribeStatus = nexusService.subscribeStatus((status) => {
      setAssistantVisualState(
        status.isConnected ? (status.isSpeaking ? 'speaking' : 'running') : 'offline'
      )
    })

    window.electron.ipcRenderer.on('overlay-mode', (_event, mode) => setIsOverlay(Boolean(mode)))
    return () => {
      window.electron.ipcRenderer.removeAllListeners('overlay-mode')
      unsubscribeStatus()
    }
  }, [])

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (isSystemActive && !isSystemStarting && !nexusService.isConnected) {
        setIsSystemActive(false)
        setIsMicMuted(true)
        stopVision()
      }
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
    if (isSystemStarting) {
      await waitForCoreReady()
      return
    }

    setIsSystemStarting(true)
    try {
      await nexusService.connect()
      setIsSystemActive(true)
      setIsMicMuted(false)
      nexusService.setMute(false)
      waitForCoreReady()
        .then(() => setIsSystemStarting(false))
        .catch(() => {
          setIsSystemActive(false)
          setIsMicMuted(true)
          setIsSystemStarting(false)
        })
    } catch (error) {
      setIsSystemStarting(false)
      throw error
    }
  }

  const toggleSystem = async () => {
    if (!isSystemActive) {
      try {
        await startSystem()
      } catch (error: any) {
        if (error?.message === 'NO_API_KEY') {
          alert('Gemini API key is missing. Add it in Trial Settings to use local routing.')
        } else {
          alert(`Connection failed: ${error?.message || 'Unknown error'}`)
        }
        setIsSystemActive(false)
        setIsSystemStarting(false)
      }
    } else {
      nexusService.disconnect()
      setIsSystemActive(false)
      setIsSystemStarting(false)
      setIsMicMuted(true)
      nexusService.setMute(true)
      stopVision()
    }
  }

  const sendTextCommand = async (command: string) => {
    if (!isSystemActive || !nexusService.isConnected) {
      await startSystem()
      await waitForCoreReady()
    } else if (isSystemStarting) {
      await waitForCoreReady()
    }

    await nexusService.sendTextCommand(command)
  }

  const toggleMic = () => {
    const nextValue = !isMicMuted
    setIsMicMuted(nextValue)
    nexusService.setMute(nextValue)
  }

  const startVision = async (mode: 'camera' | 'screen') => {
    if (!isSystemActive) return

    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop())
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
    } catch {
      stopVision()
    }
  }

  const stopVision = () => {
    setIsVideoOn(false)
    setVisionMode('none')

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop())
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
      const video = processingVideoRef.current
      if (video && video.readyState === 4 && nexusService.socket?.readyState === WebSocket.OPEN) {
        const canvas = document.createElement('canvas')
        canvas.width = 800
        canvas.height = 450
        const context = canvas.getContext('2d')
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]
          nexusService.sendVideoFrame(base64)
        }
      }
    }, 2000)
  }

  const openFullExperience = () => {
    window.open(
      `${import.meta.env.VITE_NEXUS_WEB_APP_URL || 'https://niranx-nexus-agent.vercel.app'}/installer`,
      '_blank'
    )
  }

  if (isOverlay) {
    return (
      <TrialMandatoryUpdateGate>
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
      </TrialMandatoryUpdateGate>
    )
  }

  return (
    <TrialMandatoryUpdateGate>
      <TrialShell
        assistantVisualState={assistantVisualState}
        isSystemActive={isSystemActive}
        isSystemStarting={isSystemStarting}
        isMicMuted={isMicMuted}
        isVideoOn={isVideoOn}
        visionMode={visionMode}
        activeStream={activeStreamRef.current}
        toggleSystem={toggleSystem}
        toggleMic={toggleMic}
        startVision={startVision}
        stopVision={stopVision}
        sendTextCommand={sendTextCommand}
        onUpgrade={openFullExperience}
      />
    </TrialMandatoryUpdateGate>
  )
}
