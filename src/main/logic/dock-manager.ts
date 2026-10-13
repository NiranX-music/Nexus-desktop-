import { app, BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

export type DockLocation =
  | 'top-center'
  | 'taskbar-left'
  | 'bottom-center'
  | 'top-left'
  | 'top-right'
  | 'custom'

export type DockStyle = 'pill' | 'line'

export interface DockConfig {
  location: DockLocation
  style: DockStyle
  customX?: number
  customY?: number
  setupCompleted: boolean
}

export const DOCK_PILL_COLLAPSED_WIDTH = 204
export const DOCK_PILL_COLLAPSED_HEIGHT = 40
export const DOCK_LINE_COLLAPSED_WIDTH = 180
export const DOCK_LINE_COLLAPSED_HEIGHT = 14
export const DOCK_EXPANDED_WIDTH = 620
export const DOCK_EXPANDED_HEIGHT = 188
export const DOCK_TOP_MARGIN = 8
export const DOCK_LINE_TOP_MARGIN = 2

const DOCK_CONFIG_FILE = 'nexus_dock_config.json'

const DEFAULT_CONFIG: DockConfig = {
  location: 'top-center',
  style: 'pill',
  setupCompleted: false
}

export class DockManager {
  private config: DockConfig = { ...DEFAULT_CONFIG }
  private dockWindow: BrowserWindow | null = null
  private mainWindow: BrowserWindow | null = null
  private isExpanded = false
  private collapseTimer: NodeJS.Timeout | null = null
  private configPath: string

  constructor() {
    this.configPath = join(app.getPath('userData'), DOCK_CONFIG_FILE)
    this.loadConfig()
  }

  public setWindows(dockWindow: BrowserWindow | null, mainWindow: BrowserWindow | null) {
    this.dockWindow = dockWindow
    this.mainWindow = mainWindow
    this.attachWindowEvents()
  }

  public getConfig(): DockConfig {
    return { ...this.config }
  }

  public loadConfig(): DockConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8')
        const parsed = JSON.parse(raw)
        this.config = {
          ...DEFAULT_CONFIG,
          ...parsed
        }
      } else {
        this.config = { ...DEFAULT_CONFIG }
      }
    } catch (err) {
      console.warn('[DockManager] Failed to read dock config:', err)
      this.config = { ...DEFAULT_CONFIG }
    }
    return this.getConfig()
  }

  public saveConfig(newConfig: Partial<DockConfig>): DockConfig {
    this.config = {
      ...this.config,
      ...newConfig
    }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8')
    } catch (err) {
      console.error('[DockManager] Failed to write dock config:', err)
    }

    this.applyCurrentBounds()
    this.broadcastConfig()
    return this.getConfig()
  }

  public computeCollapsedBounds(): { x: number; y: number; width: number; height: number } {
    const primaryDisplay = screen.getPrimaryDisplay()
    const bounds = primaryDisplay.bounds
    const workArea = primaryDisplay.workArea

    const style = this.config.style || 'pill'
    const location = this.config.location || 'top-center'

    const collapsedWidth = style === 'line' ? DOCK_LINE_COLLAPSED_WIDTH : DOCK_PILL_COLLAPSED_WIDTH
    const collapsedHeight = style === 'line' ? DOCK_LINE_COLLAPSED_HEIGHT : DOCK_PILL_COLLAPSED_HEIGHT

    let x = bounds.x + Math.floor((bounds.width - collapsedWidth) / 2)
    let y = bounds.y + (style === 'line' ? DOCK_LINE_TOP_MARGIN : DOCK_TOP_MARGIN)

    if (location === 'top-center') {
      x = bounds.x + Math.floor((bounds.width - collapsedWidth) / 2)
      y = bounds.y + (style === 'line' ? DOCK_LINE_TOP_MARGIN : DOCK_TOP_MARGIN)
    } else if (location === 'taskbar-left') {
      // Empty section of the taskbar: sits to the right of Weather widget (typically 160-200px)
      const taskbarLeftOffset = Math.max(160, Math.min(220, Math.floor(bounds.width * 0.12)))
      x = bounds.x + taskbarLeftOffset

      // Taskbar on Windows typically sits at the bottom
      const taskbarTop = workArea.y + workArea.height
      const taskbarHeight = Math.max(40, bounds.height - (workArea.y + workArea.height))

      // Vertically center dock in taskbar bar
      y = taskbarTop + Math.max(0, Math.floor((taskbarHeight - collapsedHeight) / 2))
      if (y + collapsedHeight > bounds.y + bounds.height) {
        y = bounds.y + bounds.height - collapsedHeight - 4
      }
    } else if (location === 'bottom-center') {
      x = bounds.x + Math.floor((bounds.width - collapsedWidth) / 2)
      const taskbarTop = workArea.y + workArea.height
      y = taskbarTop - collapsedHeight - 6
      if (y < bounds.y) {
        y = bounds.y + bounds.height - collapsedHeight - 10
      }
    } else if (location === 'top-left') {
      x = bounds.x + 24
      y = bounds.y + (style === 'line' ? DOCK_LINE_TOP_MARGIN : DOCK_TOP_MARGIN)
    } else if (location === 'top-right') {
      x = bounds.x + bounds.width - collapsedWidth - 24
      y = bounds.y + (style === 'line' ? DOCK_LINE_TOP_MARGIN : DOCK_TOP_MARGIN)
    } else if (location === 'custom') {
      if (typeof this.config.customX === 'number' && typeof this.config.customY === 'number') {
        x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - collapsedWidth, this.config.customX))
        y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - collapsedHeight, this.config.customY))
      }
    }

    return { x, y, width: collapsedWidth, height: collapsedHeight }
  }

  public computeExpandedBounds(): { x: number; y: number; width: number; height: number } {
    const primaryDisplay = screen.getPrimaryDisplay()
    const bounds = primaryDisplay.bounds

    const collapsed = this.computeCollapsedBounds()
    const expandedWidth = Math.min(DOCK_EXPANDED_WIDTH, Math.max(DOCK_PILL_COLLAPSED_WIDTH, bounds.width - 40))
    const expandedHeight = DOCK_EXPANDED_HEIGHT

    // Check if dock is located in bottom half of screen
    const isBottom = collapsed.y > (bounds.y + bounds.height / 2)

    let x: number
    let y: number

    if (isBottom) {
      // Expand upwards so dock stays fully on screen
      y = collapsed.y - (expandedHeight - collapsed.height)
      if (this.config.location === 'taskbar-left') {
        x = Math.max(bounds.x + 12, collapsed.x - Math.floor((expandedWidth - collapsed.width) / 4))
      } else if (this.config.location === 'bottom-center') {
        x = bounds.x + Math.floor((bounds.width - expandedWidth) / 2)
      } else {
        x = collapsed.x - Math.floor((expandedWidth - collapsed.width) / 2)
      }
    } else {
      // Top half of screen
      y = collapsed.y
      if (this.config.location === 'top-center') {
        x = bounds.x + Math.floor((bounds.width - expandedWidth) / 2)
      } else {
        x = collapsed.x - Math.floor((expandedWidth - collapsed.width) / 2)
      }
    }

    // Clamp coordinates safely within screen bounds
    x = Math.max(bounds.x + 12, Math.min(bounds.x + bounds.width - expandedWidth - 12, x))
    y = Math.max(bounds.y + 4, Math.min(bounds.y + bounds.height - expandedHeight - 4, y))

    return { x, y, width: expandedWidth, height: expandedHeight }
  }

  public setExpanded(expanded: boolean) {
    if (!this.dockWindow || this.dockWindow.isDestroyed()) return

    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer)
      this.collapseTimer = null
    }

    if (!expanded) {
      this.collapseTimer = setTimeout(() => {
        this.collapseTimer = null
        this.isExpanded = false
        this.applyCurrentBounds()
      }, 280)
      return
    }

    this.isExpanded = true
    this.applyCurrentBounds()
  }

  public applyCurrentBounds() {
    if (!this.dockWindow || this.dockWindow.isDestroyed()) return
    const bounds = this.isExpanded ? this.computeExpandedBounds() : this.computeCollapsedBounds()
    this.dockWindow.setBounds(bounds)
  }

  private broadcastConfig() {
    const payload = this.getConfig()
    this.mainWindow?.webContents.send('dock-config-updated', payload)
    this.dockWindow?.webContents.send('dock-config-updated', payload)
  }

  private attachWindowEvents() {
    if (!this.dockWindow || this.dockWindow.isDestroyed()) return

    this.dockWindow.on('moved', () => {
      // Only capture custom coordinates when window was user-dragged in collapsed mode
      if (this.isExpanded || !this.dockWindow || this.dockWindow.isDestroyed()) return
      const bounds = this.dockWindow.getBounds()
      this.config.location = 'custom'
      this.config.customX = bounds.x
      this.config.customY = bounds.y
      try {
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8')
      } catch {}
      this.broadcastConfig()
    })
  }

  public registerIpcHandlers() {
    ipcMain.removeHandler('get-dock-config')
    ipcMain.handle('get-dock-config', () => {
      return this.getConfig()
    })

    ipcMain.removeHandler('set-dock-config')
    ipcMain.handle('set-dock-config', (_event, newConfig: Partial<DockConfig>) => {
      return { success: true, config: this.saveConfig(newConfig) }
    })
  }
}

export const dockManager = new DockManager()
