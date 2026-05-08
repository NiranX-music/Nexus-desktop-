export type TrialTabKey = 'overview' | 'chat' | 'browser' | 'settings'
export type TrialAssistantVisualState = 'offline' | 'running' | 'speaking'
export type TrialVisionMode = 'camera' | 'screen' | 'none'

export interface TrialRuntimeProps {
  assistantVisualState: TrialAssistantVisualState
  isSystemActive: boolean
  isSystemStarting: boolean
  isMicMuted: boolean
  isVideoOn: boolean
  visionMode: TrialVisionMode
  activeStream: MediaStream | null
  toggleSystem: () => Promise<void> | void
  toggleMic: () => void
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
  sendTextCommand: (command: string) => Promise<void>
  onUpgrade: () => void
}
