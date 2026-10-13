/**
 * Nexus Media Device Manager
 * Handles enumeration, selection, persistence, and dynamic routing
 * for Audio Input (Microphone), Audio Output (Speaker/Sink), and Video Input (Camera).
 */

export interface MediaDeviceItem {
  deviceId: string
  label: string
  groupId: string
  kind: MediaDeviceKind
}

export interface MediaDevicesState {
  audioInputs: MediaDeviceItem[]
  audioOutputs: MediaDeviceItem[]
  videoInputs: MediaDeviceItem[]
  selectedAudioInputId: string
  selectedAudioOutputId: string
  selectedVideoInputId: string
  permissionGranted: boolean
}

type DeviceChangeListener = (state: MediaDevicesState) => void

const STORAGE_KEYS = {
  AUDIO_INPUT: 'nexus_audio_input_device_id',
  AUDIO_OUTPUT: 'nexus_audio_output_device_id',
  VIDEO_INPUT: 'nexus_video_input_device_id'
} as const

class MediaDeviceManager {
  private static instance: MediaDeviceManager | null = null

  private audioInputs: MediaDeviceItem[] = []
  private audioOutputs: MediaDeviceItem[] = []
  private videoInputs: MediaDeviceItem[] = []
  private selectedAudioInputId: string = 'default'
  private selectedAudioOutputId: string = 'default'
  private selectedVideoInputId: string = 'default'
  private permissionGranted: boolean = false
  private listeners: Set<DeviceChangeListener> = new Set()
  private initialized: boolean = false

  private constructor() {
    this.selectedAudioInputId = localStorage.getItem(STORAGE_KEYS.AUDIO_INPUT) || 'default'
    this.selectedAudioOutputId = localStorage.getItem(STORAGE_KEYS.AUDIO_OUTPUT) || 'default'
    this.selectedVideoInputId = localStorage.getItem(STORAGE_KEYS.VIDEO_INPUT) || 'default'

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        this.enumerateDevices()
      })
    }
  }

  public static getInstance(): MediaDeviceManager {
    if (!MediaDeviceManager.instance) {
      MediaDeviceManager.instance = new MediaDeviceManager()
    }
    return MediaDeviceManager.instance
  }

  public getState(): MediaDevicesState {
    return {
      audioInputs: [...this.audioInputs],
      audioOutputs: [...this.audioOutputs],
      videoInputs: [...this.videoInputs],
      selectedAudioInputId: this.selectedAudioInputId,
      selectedAudioOutputId: this.selectedAudioOutputId,
      selectedVideoInputId: this.selectedVideoInputId,
      permissionGranted: this.permissionGranted
    }
  }

  public subscribe(listener: DeviceChangeListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    if (!this.initialized) {
      this.init()
    }
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const state = this.getState()
    this.listeners.forEach((l) => {
      try {
        l(state)
      } catch (err) {
        console.error('[MediaDeviceManager] Listener error:', err)
      }
    })

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexus-media-devices-updated', { detail: state }))
    }
  }

  public async init(): Promise<MediaDevicesState> {
    if (this.initialized) {
      return this.getState()
    }
    this.initialized = true
    return this.enumerateDevices()
  }

  public async requestPermissions(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false
    }

    try {
      // Request temporary combined stream to unlock device labels
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      })
      this.permissionGranted = true
      stream.getTracks().forEach((track) => track.stop())
      await this.enumerateDevices()
      return true
    } catch (err) {
      // User may not have camera or mic, try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        this.permissionGranted = true
        audioStream.getTracks().forEach((track) => track.stop())
        await this.enumerateDevices()
        return true
      } catch (audioErr) {
        console.warn('[MediaDeviceManager] Permission request skipped or rejected:', audioErr)
        await this.enumerateDevices()
        return false
      }
    }
  }

  public async enumerateDevices(): Promise<MediaDevicesState> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return this.getState()
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      const audioIn: MediaDeviceItem[] = []
      const audioOut: MediaDeviceItem[] = []
      const videoIn: MediaDeviceItem[] = []

      let hasLabels = false

      devices.forEach((d) => {
        if (d.label) hasLabels = true
        const item: MediaDeviceItem = {
          deviceId: d.deviceId,
          label: d.label || (d.kind === 'audioinput' ? `Microphone (${d.deviceId.slice(0, 5)})` : d.kind === 'audiooutput' ? `Speaker (${d.deviceId.slice(0, 5)})` : `Camera (${d.deviceId.slice(0, 5)})`),
          groupId: d.groupId,
          kind: d.kind
        }

        if (d.kind === 'audioinput') {
          audioIn.push(item)
        } else if (d.kind === 'audiooutput') {
          audioOut.push(item)
        } else if (d.kind === 'videoinput') {
          videoIn.push(item)
        }
      })

      this.audioInputs = audioIn
      this.audioOutputs = audioOut
      this.videoInputs = videoIn
      if (hasLabels) this.permissionGranted = true

      // Re-validate current selections against available devices
      if (this.selectedAudioInputId !== 'default' && !audioIn.some((d) => d.deviceId === this.selectedAudioInputId)) {
        this.selectedAudioInputId = 'default'
        localStorage.setItem(STORAGE_KEYS.AUDIO_INPUT, 'default')
      }

      if (this.selectedAudioOutputId !== 'default' && !audioOut.some((d) => d.deviceId === this.selectedAudioOutputId)) {
        this.selectedAudioOutputId = 'default'
        localStorage.setItem(STORAGE_KEYS.AUDIO_OUTPUT, 'default')
      }

      if (this.selectedVideoInputId !== 'default' && !videoIn.some((d) => d.deviceId === this.selectedVideoInputId)) {
        this.selectedVideoInputId = 'default'
        localStorage.setItem(STORAGE_KEYS.VIDEO_INPUT, 'default')
      }

      this.notify()
    } catch (err) {
      console.warn('[MediaDeviceManager] enumerateDevices failed:', err)
    }

    return this.getState()
  }

  public setSelectedAudioInputId(deviceId: string): void {
    this.selectedAudioInputId = deviceId || 'default'
    localStorage.setItem(STORAGE_KEYS.AUDIO_INPUT, this.selectedAudioInputId)
    this.notify()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexus-audio-input-changed', { detail: { deviceId } }))
    }
  }

  public async setSelectedAudioOutputId(deviceId: string): Promise<void> {
    this.selectedAudioOutputId = deviceId || 'default'
    localStorage.setItem(STORAGE_KEYS.AUDIO_OUTPUT, this.selectedAudioOutputId)
    this.notify()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexus-audio-output-changed', { detail: { deviceId } }))
    }
  }

  public setSelectedVideoInputId(deviceId: string): void {
    this.selectedVideoInputId = deviceId || 'default'
    localStorage.setItem(STORAGE_KEYS.VIDEO_INPUT, this.selectedVideoInputId)
    this.notify()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nexus-video-input-changed', { detail: { deviceId } }))
    }
  }

  public getSelectedAudioInputId(): string {
    return this.selectedAudioInputId
  }

  public getSelectedAudioOutputId(): string {
    return this.selectedAudioOutputId
  }

  public getSelectedVideoInputId(): string {
    return this.selectedVideoInputId
  }

  /**
   * Routes an AudioContext or HTMLMediaElement to the configured output device (speakers/headphones).
   */
  public async applyAudioOutput(
    target: HTMLMediaElement | AudioContext | null,
    sinkId?: string
  ): Promise<boolean> {
    if (!target) return false
    const id = sinkId !== undefined ? sinkId : this.selectedAudioOutputId
    const effectiveSinkId = id === 'default' ? '' : id

    try {
      if ('setSinkId' in target && typeof (target as any).setSinkId === 'function') {
        await (target as any).setSinkId(effectiveSinkId)
        return true
      }
    } catch (err) {
      console.warn('[MediaDeviceManager] applyAudioOutput failed on target:', err)
    }
    return false
  }

  /**
   * Helper that builds MediaTrackConstraints targeting the selected audio device
   */
  public getAudioConstraints(baseConstraints?: MediaTrackConstraints | boolean): MediaTrackConstraints | boolean {
    if (baseConstraints === false) return false
    const base = typeof baseConstraints === 'object' ? baseConstraints : {}
    if (this.selectedAudioInputId && this.selectedAudioInputId !== 'default') {
      return {
        ...base,
        deviceId: { ideal: this.selectedAudioInputId }
      }
    }
    return base
  }

  /**
   * Helper that builds MediaTrackConstraints targeting the selected video (camera) device
   */
  public getVideoConstraints(baseConstraints?: MediaTrackConstraints | boolean): MediaTrackConstraints | boolean {
    if (baseConstraints === false) return false
    const base = typeof baseConstraints === 'object' ? baseConstraints : {}
    if (this.selectedVideoInputId && this.selectedVideoInputId !== 'default') {
      return {
        ...base,
        deviceId: { ideal: this.selectedVideoInputId }
      }
    }
    return base
  }

  /**
   * Convenient getUserMedia wrapper that defaults to selected devices
   */
  public async getUserMediaStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
    const finalConstraints: MediaStreamConstraints = {}

    if (constraints.audio) {
      finalConstraints.audio = this.getAudioConstraints(constraints.audio)
    }
    if (constraints.video) {
      finalConstraints.video = this.getVideoConstraints(constraints.video)
    }

    try {
      return await navigator.mediaDevices.getUserMedia(finalConstraints)
    } catch (err) {
      // If ideal constraint failed, fallback to base request
      console.warn('[MediaDeviceManager] Preferred device request failed, falling back to default:', err)
      return await navigator.mediaDevices.getUserMedia(constraints)
    }
  }

  /**
   * Plays a pleasant test chime through the currently selected or specified audio output device.
   */
  public async testAudioOutput(sinkId?: string): Promise<void> {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    const audioCtx = new AudioContextClass()
    const targetSink = sinkId !== undefined ? sinkId : this.selectedAudioOutputId

    if (targetSink && targetSink !== 'default') {
      await this.applyAudioOutput(audioCtx, targetSink)
    }

    const now = audioCtx.currentTime
    const osc1 = audioCtx.createOscillator()
    const osc2 = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    gainNode.gain.setValueAtTime(0.001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.3, now + 0.05)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523.25, now) // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.15) // E5
    osc1.frequency.setValueAtTime(783.99, now + 0.3) // G5

    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(1046.5, now) // C6
    osc2.frequency.setValueAtTime(1318.5, now + 0.15) // E6

    osc1.connect(gainNode)
    osc2.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.55)
    osc2.stop(now + 0.55)

    setTimeout(() => {
      audioCtx.close().catch(() => {})
    }, 600)
  }
}

export const mediaDeviceManager = MediaDeviceManager.getInstance()
