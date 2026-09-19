export interface WallpaperPreset {
  id: string
  title: string
  category: string
  url: string
  accentColor: string
  description: string
}

export const getWallpaperPresets = async (): Promise<WallpaperPreset[]> => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('wallpaper-get-presets')
    return res.presets || []
  } catch {
    return []
  }
}

export const setDesktopWallpaper = async (source: string, filename?: string) => {
  try {
    const res = await (window as any).electron.ipcRenderer.invoke('wallpaper-set', {
      source,
      filename
    })
    if (res.success) {
      window.dispatchEvent(
        new CustomEvent('wallpaper-applied', {
          detail: { source, path: res.path }
        })
      )
      return `✅ Desktop wallpaper updated successfully: ${res.path}`
    }
    return `❌ Failed to set wallpaper: ${res.error}`
  } catch (err: any) {
    return `❌ Error executing wallpaper change: ${err.message}`
  }
}

export const openWallpaperHUD = (initialPrompt = '') => {
  window.dispatchEvent(
    new CustomEvent('show-wallpaper-forge', {
      detail: { initialPrompt }
    })
  )
  return '🖥️ AI Wallpaper Forge HUD summoned.'
}
