import { useState, useEffect, useCallback, useRef } from 'react'
import {
  mediaDeviceManager,
  MediaDevicesState
} from '../services/media-devices'

export function useMediaDevices() {
  const [deviceState, setDeviceState] = useState<MediaDevicesState>(() =>
    mediaDeviceManager.getState()
  )
  const [micLevel, setMicLevel] = useState<number>(0)
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false)
  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false)

  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const unsubscribe = mediaDeviceManager.subscribe((newState) => {
      setDeviceState(newState)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const selectAudioInput = useCallback((deviceId: string) => {
    mediaDeviceManager.setSelectedAudioInputId(deviceId)
  }, [])

  const selectAudioOutput = useCallback((deviceId: string) => {
    mediaDeviceManager.setSelectedAudioOutputId(deviceId)
  }, [])

  const selectVideoInput = useCallback((deviceId: string) => {
    mediaDeviceManager.setSelectedVideoInputId(deviceId)
  }, [])

  const refreshDevices = useCallback(async () => {
    return await mediaDeviceManager.enumerateDevices()
  }, [])

  const requestPermissions = useCallback(async () => {
    return await mediaDeviceManager.requestPermissions()
  }, [])

  const testAudioOutput = useCallback(async (sinkId?: string) => {
    await mediaDeviceManager.testAudioOutput(sinkId)
  }, [])

  // Microphone level test
  const stopMicTest = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    setMicLevel(0)
    setIsTestingMic(false)
  }, [])

  const startMicTest = useCallback(async () => {
    stopMicTest()
    try {
      const constraints: MediaStreamConstraints = {
        audio: mediaDeviceManager.getAudioConstraints({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        })
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      micStreamRef.current = stream

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!micStreamRef.current) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        const normalized = Math.min(100, Math.round((average / 128) * 100))
        setMicLevel(normalized)
        animFrameRef.current = requestAnimationFrame(updateLevel)
      }

      setIsTestingMic(true)
      updateLevel()
    } catch (err) {
      console.warn('[useMediaDevices] startMicTest failed:', err)
      stopMicTest()
    }
  }, [stopMicTest])

  // Camera preview test
  const stopCameraPreview = useCallback(() => {
    if (cameraPreviewStream) {
      cameraPreviewStream.getTracks().forEach((t) => t.stop())
      setCameraPreviewStream(null)
    }
    setIsCameraActive(false)
  }, [cameraPreviewStream])

  const startCameraPreview = useCallback(async () => {
    stopCameraPreview()
    try {
      const constraints: MediaStreamConstraints = {
        video: mediaDeviceManager.getVideoConstraints({
          width: { ideal: 640 },
          height: { ideal: 480 }
        })
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setCameraPreviewStream(stream)
      setIsCameraActive(true)
    } catch (err) {
      console.warn('[useMediaDevices] startCameraPreview failed:', err)
      stopCameraPreview()
    }
  }, [stopCameraPreview])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopMicTest()
      stopCameraPreview()
    }
  }, [stopMicTest, stopCameraPreview])

  return {
    ...deviceState,
    selectAudioInput,
    selectAudioOutput,
    selectVideoInput,
    refreshDevices,
    requestPermissions,
    testAudioOutput,
    // Live mic test
    isTestingMic,
    micLevel,
    startMicTest,
    stopMicTest,
    // Live camera preview
    isCameraActive,
    cameraPreviewStream,
    startCameraPreview,
    stopCameraPreview
  }
}
