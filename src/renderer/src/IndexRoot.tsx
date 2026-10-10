import { useState, useEffect, useRef } from 'react'
import MiniOverlay from './components/MiniOverlay'
import { nexusService } from './services/nexus-voice-ai'
import { getScreenSourceId } from './hooks/CaptureDesktop'
import NEXUS from './UI/nexus'
import TerminalOverlay from './components/TerminalOverlay'
import LeafletMapWidget from './Widgets/MapView'
import ImageWidget from './Widgets/ImageWidget'
import EmailWidget from './Widgets/EmailWidget'
import WeatherWidget from './Widgets/WeatherWidget'
import StockWidget from './Widgets/StockWidget'
import LiveCodingWidget from './Widgets/LiveCodingWidget'
import WormholeWidget from './Widgets/WormholeWidget'
import OracleWidget from './Widgets/RagOrcaleWidget'
import ResearchWidget from './Widgets/DeepResearch'
import SemanticWidget from './Widgets/SematicSearch'
import SmartDropZonesWidget from './Widgets/SmartZoneWidget'
import AgentFleetWidget from './Widgets/AgentFleetWidget'
import WallpaperWidget from './Widgets/WallpaperWidget'
import WhatsAppWidget from './Widgets/WhatsAppWidget'
import DocForgeWidget from './Widgets/DocForgeWidget'
import FocusWidget from './Widgets/FocusWidget'
import TitleBar from './components/Titlebar'

export type VisionMode = 'camera' | 'screen' | 'dual' | 'none'

export interface StartVisionOptions {
  sourceId?: string
  shareAudio?: boolean
  dualCamera?: boolean
}

const IndexRoot = () => {
  const [isOverlay, setIsOverlay] = useState(false)

  const [isSystemActive, setIsSystemActive] = useState(false)
  const [isSystemStarting, setIsSystemStarting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)

  const [isVideoOn, setIsVideoOn] = useState(false)
  const [visionMode, setVisionMode] = useState<VisionMode>('none')
  const [toastError, setToastError] = useState<string | null>(null)

  const [activeStream, setActiveStream] = useState<MediaStream | null>(null)
  const [activeCameraStream, setActiveCameraStream] = useState<MediaStream | null>(null)

  const processingVideoRef = useRef<HTMLVideoElement>(document.createElement('video'))
  const processingCameraVideoRef = useRef<HTMLVideoElement>(document.createElement('video'))
  const activeStreamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    window.electron.ipcRenderer.on('overlay-mode', (_e, mode) => setIsOverlay(mode))
    window.electron.ipcRenderer.on('dock-command', async (_e, message) => {
      if (!message?.command) return

      if (message.command === 'start-session') {
        if (!nexusService.isConnected && !isSystemStarting) {
          await toggleSystem()
        }
      } else if (message.command === 'toggle-mute') {
        toggleMic()
      } else if (message.command === 'text-command') {
        const text = message.payload?.text || ''
        const intent = message.payload?.intent || 'queue'
        if (text.trim()) {
          try {
            if (!nexusService.isConnected) await toggleSystem()
            await nexusService.sendTextPrompt(text, intent)
          } catch {
            localStorage.setItem(
              'nexus_pending_dock_command',
              JSON.stringify({ text, intent, createdAt: Date.now() })
            )
          }
        }
      }
    })
    const handleSessionError = (event: any) => {
      if (nexusService.wantsLiveSession) {
        setIsSystemActive(true)
        setIsSystemStarting(nexusService.isRecovering)
        setIsMicMuted(false)
        nexusService.setMute(false)
        return
      }
      setIsSystemStarting(false)
      setIsSystemActive(false)
      setIsMicMuted(true)
      nexusService.setMute(true)
      stopVision()
      const message = event.detail || 'Gemini Live session closed.'
      console.warn('[NexusVoice] Session stopped:', message)
      setToastError(message)
      setTimeout(() => setToastError(null), 6000)
    }
    const handleSessionReconnecting = () => {
      setIsSystemActive(true)
      setIsSystemStarting(true)
      setIsMicMuted(false)
      nexusService.setMute(false)
    }
    const handleSessionReconnected = () => {
      setIsSystemActive(true)
      setIsSystemStarting(false)
      setIsMicMuted(false)
      nexusService.setMute(false)
    }
    window.addEventListener('nexus-session-error', handleSessionError)
    window.addEventListener('nexus-session-reconnecting', handleSessionReconnecting)
    window.addEventListener('nexus-session-reconnected', handleSessionReconnected)
    return () => {
      window.electron.ipcRenderer.removeAllListeners('overlay-mode')
      window.electron.ipcRenderer.removeAllListeners('dock-command')
      window.removeEventListener('nexus-session-error', handleSessionError)
      window.removeEventListener('nexus-session-reconnecting', handleSessionReconnecting)
      window.removeEventListener('nexus-session-reconnected', handleSessionReconnected)
    }
  }, [isSystemActive, isSystemStarting, isMicMuted])

  useEffect(() => {
    window.electron.ipcRenderer.send('dock-command', 'session-state', {
      active: isSystemActive,
      starting: isSystemStarting,
      muted: isMicMuted
    })
  }, [isSystemActive, isSystemStarting, isMicMuted])

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!nexusService.isConnected) return
      const pending = localStorage.getItem('nexus_pending_dock_command')
      if (!pending) return
      try {
        const command = JSON.parse(pending)
        await nexusService.sendTextPrompt(command.text, command.intent)
        localStorage.removeItem('nexus_pending_dock_command')
      } catch {}
    }, 1500)

    return () => clearInterval(timer)
  }, [])

  const startingSinceRef = useRef<number | null>(null)

  useEffect(() => {
    if (isSystemStarting) {
      if (!startingSinceRef.current) startingSinceRef.current = Date.now()
    } else {
      startingSinceRef.current = null
    }
  }, [isSystemStarting])

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (nexusService.isConnected && isSystemStarting) {
        setIsSystemStarting(false)
        return
      }
      if (isSystemStarting && startingSinceRef.current && Date.now() - startingSinceRef.current > 3500) {
        setIsSystemStarting(false)
        if (!nexusService.isConnected) {
          setIsSystemActive(false)
          setIsMicMuted(true)
          nexusService.setMute(true)
        }
        return
      }
      if (isSystemStarting) return
      if (isSystemActive && !nexusService.isConnected) {
        if (nexusService.wantsLiveSession && nexusService.isRecovering) {
          setIsSystemStarting(true)
          return
        }
        setIsSystemActive(false)
        setIsMicMuted(true)
        stopVision()
      }
    }, 350)
    return () => clearInterval(watchdog)
  }, [isSystemActive, isSystemStarting])

  const toggleSystem = async () => {
    if (isSystemStarting) return

    if (!isSystemActive) {
      setIsSystemActive(true)
      setIsSystemStarting(true)
      setIsMicMuted(false)
      nexusService.setMute(false)
      try {
        await nexusService.connect()
        setIsSystemActive(true)
        setIsSystemStarting(false)
        setIsMicMuted(false)
        nexusService.setMute(false)
      } catch (err: any) {
        console.warn('[Nexus] Connection failed:', err?.message)
        if (!nexusService.wantsLiveSession || !nexusService.isRecovering) {
          setIsSystemActive(false)
          setIsMicMuted(true)
          nexusService.setMute(true)
        }
      } finally {
        setIsSystemStarting(nexusService.isConnected ? false : nexusService.isRecovering)
      }
    } else {
      setIsSystemStarting(false)
      nexusService.disconnect()
      setIsSystemActive(false)
      setIsMicMuted(true)
      nexusService.setMute(true)
      stopVision()
    }
  }

  const toggleMic = () => {
    const s = !isMicMuted
    setIsMicMuted(s)
    nexusService.setMute(s)
  }

  const startVision = async (
    mode: 'camera' | 'screen' | 'dual',
    options?: StartVisionOptions
  ) => {
    if (!isSystemActive) return

    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop())
        activeStreamRef.current = null
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop())
        cameraStreamRef.current = null
      }
      nexusService.detachScreenAudio()

      let primaryStream: MediaStream | null = null
      let camStream: MediaStream | null = null

      if (mode === 'camera') {
        primaryStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })
        activeStreamRef.current = primaryStream
        setActiveStream(primaryStream)
        setActiveCameraStream(null)

        processingVideoRef.current.srcObject = primaryStream
        await processingVideoRef.current.play().catch(() => {})
      } else {
        const sourceId = options?.sourceId || (await getScreenSourceId())
        if (!sourceId) return

        const shouldCaptureAudio = options?.shareAudio !== false

        try {
          primaryStream = await navigator.mediaDevices.getUserMedia({
            audio: shouldCaptureAudio
              ? {
                  // @ts-ignore
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId
                  }
                }
              : false,
            video: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
                maxWidth: 1920,
                maxHeight: 1080
              }
            }
          })
        } catch (audioErr) {
          console.warn('[Vision] Audio capture fallback to video-only for source:', audioErr)
          primaryStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
                maxWidth: 1920,
                maxHeight: 1080
              }
            }
          })
        }

        activeStreamRef.current = primaryStream
        setActiveStream(primaryStream)

        if (primaryStream.getAudioTracks().length > 0) {
          nexusService.attachScreenAudio(primaryStream)
        }

        processingVideoRef.current.srcObject = primaryStream
        await processingVideoRef.current.play().catch(() => {})

        if (mode === 'dual' || options?.dualCamera) {
          try {
            camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: 640, height: 480 }
            })
            cameraStreamRef.current = camStream
            setActiveCameraStream(camStream)

            processingCameraVideoRef.current.srcObject = camStream
            await processingCameraVideoRef.current.play().catch(() => {})
          } catch (camErr) {
            console.warn('[Vision] Could not open webcam for dual vision mode:', camErr)
          }
        } else {
          setActiveCameraStream(null)
        }
      }

      setVisionMode(mode)
      setIsVideoOn(true)
      startAIProcessing(mode)

      primaryStream.getVideoTracks()[0].onended = () => stopVision()
      if (camStream) {
        camStream.getVideoTracks()[0].onended = () => {
          if (cameraStreamRef.current) {
            cameraStreamRef.current = null
            setActiveCameraStream(null)
            setVisionMode('screen')
          }
        }
      }
    } catch (e) {
      console.error('[Vision] Failed to start optical uplink:', e)
      stopVision()
    }
  }

  const stopVision = () => {
    setIsVideoOn(false)
    setVisionMode('none')

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop())
      activeStreamRef.current = null
    }
    setActiveStream(null)

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
    }
    setActiveCameraStream(null)

    nexusService.detachScreenAudio()

    if (processingVideoRef.current) {
      processingVideoRef.current.srcObject = null
    }
    if (processingCameraVideoRef.current) {
      processingCameraVideoRef.current.srcObject = null
    }

    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current)
      aiIntervalRef.current = null
    }
  }

  const startAIProcessing = (currentMode?: VisionMode) => {
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current)

    aiIntervalRef.current = setInterval(() => {
      const mode = currentMode || visionMode
      const vid = processingVideoRef.current
      const camVid = processingCameraVideoRef.current
      if (!vid || vid.readyState < 2 || nexusService.socket?.readyState !== WebSocket.OPEN) return

      const canvas = document.createElement('canvas')
      canvas.width = 960
      canvas.height = 540
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (mode === 'dual' && camVid && camVid.readyState >= 2) {
        // Draw primary screen share full canvas
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)

        // Draw camera PIP in bottom-right corner
        const pipW = 240
        const pipH = 145
        const pipX = canvas.width - pipW - 16
        const pipY = canvas.height - pipH - 16

        // PIP backdrop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4)

        // Draw mirrored webcam
        ctx.save()
        ctx.translate(pipX + pipW, pipY)
        ctx.scale(-1, 1)
        ctx.drawImage(camVid, 0, 0, pipW, pipH)
        ctx.restore()

        // Neon cyan cyber border
        ctx.strokeStyle = '#00f5ff'
        ctx.lineWidth = 2.5
        ctx.strokeRect(pipX, pipY, pipW, pipH)

        // Camera Feed Label Badge
        ctx.fillStyle = 'rgba(0, 245, 255, 0.9)'
        ctx.fillRect(pipX + 6, pipY + 6, 72, 16)
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 9px monospace'
        ctx.fillText('CAM FEED', pipX + 10, pipY + 18)
      } else {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
      }

      const base64 = canvas.toDataURL('image/jpeg', 0.65).split(',')[1]
      nexusService.sendVideoFrame(base64)
    }, 1800)
  }

  if (isOverlay) {
    return (
      <div className="w-screen h-screen overflow-hidden flex items-center justify-center bg-transparent">
        <MiniOverlay
          isSystemActive={isSystemActive}
          isSystemStarting={isSystemStarting}
          toggleSystem={toggleSystem}
          isMicMuted={isMicMuted}
          toggleMic={toggleMic}
          isVideoOn={isVideoOn}
          visionMode={visionMode}
          startVision={startVision}
          stopVision={stopVision}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden relative border border-emerald-500/20 rounded-xl">
      <TitleBar />
      {toastError && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-xl border border-rose-500/40 bg-zinc-950/95 px-4 py-2 text-xs text-rose-200 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
          <div className="h-2 w-2 rounded-full bg-rose-400 animate-ping shrink-0" />
          <span className="max-w-lg truncate font-medium">{toastError}</span>
          <button
            onClick={() => setToastError(null)}
            className="ml-2 rounded px-1.5 py-0.5 text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex-1 relative">
        <NEXUS
          isSystemActive={isSystemActive}
          isSystemStarting={isSystemStarting}
          toggleSystem={toggleSystem}
          isMicMuted={isMicMuted}
          toggleMic={toggleMic}
          isVideoOn={isVideoOn}
          visionMode={visionMode}
          startVision={startVision}
          stopVision={stopVision}
          activeStream={activeStream}
          activeCameraStream={activeCameraStream}
        />
      </div>
      <SmartDropZonesWidget />
      <SemanticWidget />
      <OracleWidget />
      <WormholeWidget />
      <LeafletMapWidget />
      <StockWidget />
      <WeatherWidget />
      <ImageWidget />
      <EmailWidget />
      <TerminalOverlay />
      <LiveCodingWidget />
      <ResearchWidget />
      <AgentFleetWidget />
      <WallpaperWidget />
      <WhatsAppWidget />
      <DocForgeWidget />
      <FocusWidget />
    </div>
  )
}

export default IndexRoot
