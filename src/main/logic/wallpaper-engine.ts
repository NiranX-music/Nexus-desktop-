import { IpcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface WallpaperPreset {
  id: string
  title: string
  category: string
  url: string
  accentColor: string
  description: string
}

const PRESET_WALLPAPERS: WallpaperPreset[] = [
  {
    id: 'cyber-matrix',
    title: 'NEURAL MATRIX RUNNER',
    category: 'CYBERPUNK',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#10b981',
    description: 'Cascading digital phosphors across an obsidian terminal grid.'
  },
  {
    id: 'tokyo-neon',
    title: 'SHINJUKU VOLUMETRIC RAIN',
    category: 'SYNTHWAVE',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#06b6d4',
    description: 'High-density neon reflection in downpour with anamorphic flare.'
  },
  {
    id: 'quantum-core',
    title: 'DARK QUANTUM SINGULARITY',
    category: 'MINIMAL',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#8b5cf6',
    description: 'Abstract obsidian curvature with sub-surface neural refraction.'
  },
  {
    id: 'deep-space',
    title: 'VOID HORIZON TELEMETRY',
    category: 'DEEP SPACE',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2560&auto=format&fit=crop',
    accentColor: '#3b82f6',
    description: 'Orbital dawn over dark planet curvature with telemetry glow.'
  }
]

export default function registerWallpaperEngine(ipcMain: IpcMain) {
  const wallpaperDir = path.join(app.getPath('pictures'), 'NexusWallpapers')
  if (!fs.existsSync(wallpaperDir)) {
    fs.mkdirSync(wallpaperDir, { recursive: true })
  }

  // Get wallpaper presets
  ipcMain.handle('wallpaper-get-presets', async () => {
    return { success: true, presets: PRESET_WALLPAPERS }
  })

  // Set wallpaper from base64 data or image URL or local file
  ipcMain.handle('wallpaper-set', async (_event, payload: { source: string; filename?: string }) => {
    try {
      const { source, filename = `nexus_${Date.now()}.png` } = payload
      let targetFilePath = ''

      if (source.startsWith('data:image/')) {
        // Base64 data URL
        const base64Data = source.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        targetFilePath = path.join(wallpaperDir, filename)
        fs.writeFileSync(targetFilePath, buffer)
      } else if (source.startsWith('http://') || source.startsWith('https://')) {
        // Remote URL download
        const res = await fetch(source)
        if (!res.ok) throw new Error(`Failed to download wallpaper: ${res.statusText}`)
        const arrayBuffer = await res.arrayBuffer()
        targetFilePath = path.join(wallpaperDir, filename)
        fs.writeFileSync(targetFilePath, Buffer.from(arrayBuffer))
      } else if (fs.existsSync(source)) {
        // Local file path
        targetFilePath = source
      } else {
        throw new Error('Invalid wallpaper source specified.')
      }

      if (process.platform === 'win32') {
        const normalizedPath = targetFilePath.replace(/\\/g, '\\\\')
        const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Wallpaper {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
[Wallpaper]::SystemParametersInfo(0x0014, 0, "${normalizedPath}", 0x0001 -bor 0x0002)
`
        const encodedScript = Buffer.from(psScript, 'utf16le').toString('base64')
        await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedScript}`)
      }

      return {
        success: true,
        path: targetFilePath,
        message: 'Wallpaper successfully updated in desktop environment.'
      }
    } catch (error: any) {
      console.error('[WallpaperEngine] Error setting wallpaper:', error)
      return {
        success: false,
        error: error?.message || 'Failed to update system wallpaper.'
      }
    }
  })
}
