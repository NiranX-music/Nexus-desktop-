import { useState, useEffect, useCallback } from 'react'
import { refreshAllSystemsAndAgents } from '../services/system-refresh'

export interface ShortcutsOptions {
  onNavigateTab?: (tabId: string) => void
  toggleMic?: () => void
  toggleSystem?: () => void
  isMicMuted?: boolean
  isSystemActive?: boolean
  isVideoOn?: boolean
  onToggleVision?: () => void
}

export function useNexusShortcuts(options?: ShortcutsOptions) {
  // Zoom level state
  const [zoomFactor, setZoomFactor] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('nexus_ui_zoom_factor')
      return stored ? parseFloat(stored) : 1.0
    } catch {
      return 1.0
    }
  })

  // HUD notification indicators
  const [zoomHud, setZoomHud] = useState<string | null>(null)
  const [refreshHud, setRefreshHud] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Context menu coordinates
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    x: number
    y: number
  }>({
    isOpen: false,
    x: 0,
    y: 0
  })

  // Apply zoom factor
  const applyZoom = useCallback((factor: number) => {
    const clamped = Math.round(Math.max(0.5, Math.min(2.0, factor)) * 100) / 100
    setZoomFactor(clamped)
    try {
      localStorage.setItem('nexus_ui_zoom_factor', String(clamped))
      if (window.electron?.webFrame) {
        window.electron.webFrame.setZoomFactor(clamped)
      }
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.invoke('window-set-zoom', clamped).catch(() => {})
      }
    } catch {}

    const pct = Math.round(clamped * 100)
    setZoomHud(`🔍 ZOOM: ${pct}%`)
    const t = setTimeout(() => setZoomHud(null), 1400)
    return () => clearTimeout(t)
  }, [])

  // Initialize stored zoom on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nexus_ui_zoom_factor')
      if (stored) {
        const factor = parseFloat(stored)
        if (Number.isFinite(factor) && factor >= 0.5 && factor <= 2.0) {
          if (window.electron?.webFrame) {
            window.electron.webFrame.setZoomFactor(factor)
          }
          if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.invoke('window-set-zoom', factor).catch(() => {})
          }
        }
      }
    } catch {}

    // Listen to zoom-changed from electron main process if any
    if (window.electron?.ipcRenderer) {
      const remove = window.electron.ipcRenderer.on('zoom-changed', (factor: number) => {
        if (typeof factor === 'number') {
          setZoomFactor(factor)
          setZoomHud(`🔍 ZOOM: ${Math.round(factor * 100)}%`)
          setTimeout(() => setZoomHud(null), 1400)
        }
      })
      return () => {
        remove?.()
      }
    }
    return undefined
  }, [])

  const zoomIn = useCallback(() => {
    applyZoom(zoomFactor + 0.1)
  }, [zoomFactor, applyZoom])

  const zoomOut = useCallback(() => {
    applyZoom(zoomFactor - 0.1)
  }, [zoomFactor, applyZoom])

  const resetZoom = useCallback(() => {
    applyZoom(1.0)
  }, [applyZoom])

  // Refresh all systems and agents
  const handleRefreshAll = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setRefreshHud('🔄 Refreshing all systems, telemetry, and agent fleet...')
    try {
      const res = await refreshAllSystemsAndAgents()
      setRefreshHud(`✨ ALL SYSTEMS & AGENTS REFRESHED\n${res.message}`)
      setTimeout(() => setRefreshHud(null), 4500)
    } catch (e: any) {
      setRefreshHud(`⚠️ Refresh completed with warnings: ${e?.message || 'Check terminal'}`)
      setTimeout(() => setRefreshHud(null), 3500)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing])

  // Listen for electron main shortcut trigger
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      const remove = window.electron.ipcRenderer.on('nexus-trigger-refresh-all', () => {
        void handleRefreshAll()
      })
      return () => {
        remove?.()
      }
    }
    return undefined
  }, [handleRefreshAll])

  // Global Context Menu listener
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Don't override if inside an input unless user wants full menu
      e.preventDefault()
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY
      })
    }

    window.addEventListener('contextmenu', handleContextMenu)
    return () => window.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey
      const activeEl = document.activeElement as HTMLElement | null
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable)

      // Zoom In: Ctrl + = or Ctrl + + or NumpadAdd
      if (isCtrlOrMeta && (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        zoomIn()
        return
      }

      // Zoom Out: Ctrl + - or NumpadSubtract
      if (isCtrlOrMeta && (e.key === '-' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        zoomOut()
        return
      }

      // Reset Zoom: Ctrl + 0 or Numpad0
      if (isCtrlOrMeta && (e.key === '0' || e.code === 'Numpad0')) {
        e.preventDefault()
        resetZoom()
        return
      }

      // Refresh All Systems: Ctrl + Shift + R
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault()
        void handleRefreshAll()
        return
      }

      // Reload View: Ctrl + R (when not Shift) or F5
      if ((isCtrlOrMeta && !e.shiftKey && (e.key === 'r' || e.key === 'R')) || e.key === 'F5') {
        // Allow soft ecosystem refresh or native reload
        e.preventDefault()
        void handleRefreshAll()
        return
      }

      // Settings: Ctrl + ,
      if (isCtrlOrMeta && (e.key === ',' || e.key === '<')) {
        e.preventDefault()
        options?.onNavigateTab?.('SETTINGS')
        return
      }

      // Toggle Mic: Ctrl + M (only when not typing in an input)
      if (isCtrlOrMeta && (e.key === 'm' || e.key === 'M') && !isInputFocused) {
        e.preventDefault()
        options?.toggleMic?.()
        return
      }

      // Toggle Vision: Ctrl + Shift + V
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'v' || e.key === 'V') && !isInputFocused) {
        e.preventDefault()
        options?.onToggleVision?.()
        return
      }

      // Tab switching: Ctrl + 1..9 (only when not in input)
      if (isCtrlOrMeta && !e.shiftKey && !isInputFocused) {
        const tabMap: Record<string, string> = {
          '1': 'DASHBOARD',
          '2': 'AGENTIC',
          '3': 'PROFILE',
          '4': 'AI CHAT',
          '5': 'Macros',
          '6': 'Apps',
          '7': 'BROWSER CONTROL',
          '8': 'WHITEBOARD',
          '9': 'NOTES'
        }
        if (tabMap[e.key]) {
          e.preventDefault()
          options?.onNavigateTab?.(tabMap[e.key])
          return
        }
      }

      // Escape: close context menu
      if (e.key === 'Escape') {
        if (contextMenu.isOpen) {
          setContextMenu((prev) => ({ ...prev, isOpen: false }))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    zoomIn,
    zoomOut,
    resetZoom,
    handleRefreshAll,
    options,
    contextMenu.isOpen
  ])

  return {
    zoomFactor,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomHud,
    refreshHud,
    isRefreshing,
    handleRefreshAll,
    contextMenu,
    closeContextMenu: () => setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }
}
export default useNexusShortcuts
