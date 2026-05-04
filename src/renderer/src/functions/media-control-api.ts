export interface MediaSessionItem {
  id: string
  index: number
  source: string
  title: string
  artist: string
  albumTitle: string
  status: string
  isCurrent: boolean
  positionMs: number
  durationMs: number
  canPlay: boolean
  canPause: boolean
  canNext: boolean
  canPrevious: boolean
}

export type MediaControlAction = 'play' | 'pause' | 'toggle' | 'next' | 'previous'

export const getMediaSessions = async (): Promise<MediaSessionItem[]> => {
  try {
    const sessions = await window.electron.ipcRenderer.invoke('media:get-sessions')
    return Array.isArray(sessions) ? sessions : []
  } catch {
    return []
  }
}

export const controlMediaSession = async (
  sessionIndex: number,
  action: MediaControlAction
): Promise<{ success: boolean; error?: string }> => {
  try {
    return await window.electron.ipcRenderer.invoke('media:control', { sessionIndex, action })
  } catch (error: any) {
    return { success: false, error: error?.message || 'Media command failed.' }
  }
}
