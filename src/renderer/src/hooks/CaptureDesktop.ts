export interface DesktopSourceItem {
  id: string
  name: string
  type: 'screen' | 'window'
  thumbnail: string
  appIcon?: string | null
  display_id?: string
}

export const getScreenSourceId = async (): Promise<string | null> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-screen-source')
  } catch (err) {
    return null
  }
}

export const getDesktopSources = async (
  types: ('screen' | 'window')[] = ['screen', 'window']
): Promise<DesktopSourceItem[]> => {
  try {
    return await window.electron.ipcRenderer.invoke('get-desktop-sources', { types })
  } catch (err) {
    console.error('Failed to get desktop sources:', err)
    return []
  }
}