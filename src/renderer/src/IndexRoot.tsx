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
import TitleBar from './components/Titlebar'

export type VisionMode = 'camera' | 'screen' | 'none'

const IndexRoot = () => {
  const [isOverlay, setIsOverlay] = useState(false)

  const [isSystemActive, setIsSystemActive] = useState(false)
  const [isSystemStarting, setIsSystemStarting] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)

  const [isVideoOn, setIsVideoOn] = useState(false)
  const [visionMode, setVisionMode] = useState<VisionMode>('none')

  const processingVideoRef = useRef<HTMLVideoElement>(document.createElement('video'))
  const activeStreamRef = useRef<MediaStream | null>(null)
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
      alert(`AI session stopped: ${message}`)
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

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (nexusService.isConnected && isSystemStarting) {
        setIsSystemStarting(false)
        return
      }
      if (isSystemStarting) return
      if (isSystemActive && !nexusService.isConnected) {
        if (nexusService.wantsLiveSession) {
          setIsSystemStarting(nexusService.isRecovering)
          return
        }
        setIsSystemActive(false)
        setIsMicMuted(true)
        stopVision()
      }
    }, 1000)
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
        setIsMicMuted(false)
        nexusService.setMute(false)
      } catch (err: any) {
        if (err.message === 'NO_API_KEY') {
          alert(
            '⚠️ CRITICAL ERROR: Gemini API Key is missing. Please enter it in the Command Center Vault (Settings Tab).'
          )
          nexusService.disconnect()
        } else if (/microphone access denied/i.test(err.message || '')) {
          alert(`Connection failed: ${err.message}`)
          nexusService.disconnect()
        } else {
          if (nexusService.wantsLiveSession && nexusService.isRecovering) {
            setIsSystemActive(true)
            setIsMicMuted(false)
            nexusService.setMute(false)
          } else {
            alert(`Connection failed: ${err.message}`)
          }
        }
        if (!nexusService.wantsLiveSession) {
          setIsSystemActive(false)
          setIsMicMuted(true)
          nexusService.setMute(true)
        }
      } finally {
        setIsSystemStarting(nexusService.isRecovering)
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
          activeStream={activeStreamRef.current}
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
    </div>
  )
}

export default IndexRoot
