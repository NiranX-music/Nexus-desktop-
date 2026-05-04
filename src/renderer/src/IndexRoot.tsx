import { useState, useEffect, useRef } from 'react'
import MiniOverlay from './components/MiniOverlay'
import { nexusService } from './services/nexus-voice-ai'
import { getScreenSourceId } from './hooks/CaptureDesktop'
import Nexus from './UI/nexus'
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
    const prewarmTimer = setTimeout(() => {
      nexusService.prewarm()
    }, 700)

    window.electron.ipcRenderer.on('overlay-mode', (_e, mode) => setIsOverlay(mode))
    return () => {
      clearTimeout(prewarmTimer)
      window.electron.ipcRenderer.removeAllListeners('overlay-mode')
    }
  }, [])

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (isSystemActive && !isSystemStarting && !nexusService.isConnected) {
        setIsSystemActive(false)
        setIsMicMuted(true)
        stopVision()
      }
    }, 1000)
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
      } catch (err: any) {
        if (err.message === 'NO_API_KEY') {
          alert(
            '⚠️ CRITICAL ERROR: Gemini API Key is missing. Please enter it in the Command Center Vault (Settings Tab).'
          )
        } else {
          alert(`Connection failed: ${err.message}`)
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
          sendTextCommand={sendTextCommand}
        />
      </div>
    )
  }

  return (
    <div className="nexus-desktop-frame flex flex-col h-screen w-screen overflow-hidden relative border border-emerald-400/25 rounded-md">
      <TitleBar />
      <div className="min-h-0 flex-1 relative">
        <Nexus
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
