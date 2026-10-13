import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiRefreshLine,
  RiFileCopyLine,
  RiClipboardLine,
  RiScissorsLine,
  RiCheckboxMultipleLine,
  RiZoomInLine,
  RiZoomOutLine,
  RiFullscreenLine,
  RiMicLine,
  RiMicOffLine,
  RiCameraLine,
  RiRobot2Line,
  RiSettings4Line,
  RiChatSmile3Line,
  RiShieldFlashLine,
  RiDashboardLine,
  RiFolderOpenLine,
  RiTerminalBoxLine,
  RiGlobalLine,
  RiCloseLine
} from 'react-icons/ri'

export interface ContextMenuProps {
  isOpen: boolean
  x: number
  y: number
  onClose: () => void
  onRefreshAll: () => Promise<void> | void
  isRefreshing?: boolean
  zoomFactor: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  activeTab: string
  onNavigate: (tabId: string) => void
  isSystemActive?: boolean
  toggleSystem?: () => void
  isMicMuted?: boolean
  toggleMic?: () => void
  isVideoOn?: boolean
  onToggleVision?: () => void
}

export const NexusContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  x,
  y,
  onClose,
  onRefreshAll,
  isRefreshing = false,
  zoomFactor,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onNavigate,
  isMicMuted = true,
  toggleMic,
  isVideoOn = false,
  onToggleVision
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', onClose, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Ensure menu stays within window boundaries
  const menuWidth = 270
  const menuHeight = 490
  const screenW = window.innerWidth
  const screenH = window.innerHeight

  const safeX = Math.max(10, Math.min(x, screenW - menuWidth - 14))
  const safeY = Math.max(10, Math.min(y, screenH - menuHeight - 14))

  // Clipboard operations
  const handleCopy = async () => {
    try {
      const selected = window.getSelection()?.toString()
      if (selected) {
        await navigator.clipboard.writeText(selected)
      } else {
        document.execCommand('copy')
      }
    } catch {}
    onClose()
  }

  const handleCut = () => {
    try {
      document.execCommand('cut')
    } catch {}
    onClose()
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const start = activeEl.selectionStart || 0
        const end = activeEl.selectionEnd || 0
        const val = activeEl.value
        activeEl.value = val.substring(0, start) + text + val.substring(end)
        activeEl.selectionStart = activeEl.selectionEnd = start + text.length
        activeEl.dispatchEvent(new Event('input', { bubbles: true }))
      } else {
        document.execCommand('paste')
      }
    } catch {}
    onClose()
  }

  const handleSelectAll = () => {
    try {
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.select()
      } else {
        document.execCommand('selectAll')
      }
    } catch {}
    onClose()
  }

  const handleToggleFullscreen = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('window-toggle-fullscreen')
    }
    onClose()
  }

  const handleToggleDevTools = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('window-toggle-devtools')
    }
    onClose()
  }

  const handleReload = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('window-reload')
    } else {
      window.location.reload()
    }
    onClose()
  }

  const zoomPercent = Math.round(zoomFactor * 100)

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-99998 pointer-events-none"
        style={{ width: '100vw', height: '100vh' }}
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'absolute',
            left: `${safeX}px`,
            top: `${safeY}px`
          }}
          className="pointer-events-auto w-68 rounded-2xl border border-emerald-500/35 bg-zinc-950/95 p-1.5 text-zinc-200 shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl font-sans select-none overflow-hidden"
        >
          {/* Header pill */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 mb-1">
            <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              Nexus Command
            </span>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-200 rounded p-0.5 transition"
            >
              <RiCloseLine size={13} />
            </button>
          </div>

          {/* Section 1: System & Agents Refresh */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => {
                onRefreshAll()
                onClose()
              }}
              className="group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiRefreshLine
                  className={`text-emerald-400 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
                  size={15}
                />
                <span>Refresh Systems & Agents</span>
              </div>
              <kbd className="font-mono text-[9px] text-emerald-400/80 bg-emerald-950/50 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Ctrl+⇧+R
              </kbd>
            </button>

            {toggleMic && (
              <button
                onClick={() => {
                  toggleMic()
                  onClose()
                }}
                className="group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  {isMicMuted ? (
                    <RiMicOffLine className="text-zinc-400 group-hover:text-amber-300" size={15} />
                  ) : (
                    <RiMicLine className="text-emerald-400" size={15} />
                  )}
                  <span>{isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}</span>
                </div>
                <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                  Ctrl+M
                </kbd>
              </button>
            )}

            {onToggleVision && (
              <button
                onClick={() => {
                  onToggleVision()
                  onClose()
                }}
                className="group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <RiCameraLine
                    className={`text-cyan-400 ${isVideoOn ? 'animate-pulse' : ''}`}
                    size={15}
                  />
                  <span>{isVideoOn ? 'Disconnect Vision' : 'Optical Uplink'}</span>
                </div>
                <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                  Ctrl+⇧+V
                </kbd>
              </button>
            )}

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('nexus-toggle-fleet-widget'))
                onClose()
              }}
              className="group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiRobot2Line className="text-emerald-400" size={15} />
                <span>Agent Fleet HQ</span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400/80">4 AGENTS</span>
            </button>
          </div>

          <div className="my-1 border-b border-white/5" />

          {/* Section 2: Clipboard & Edit */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={handleCut}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiScissorsLine className="text-zinc-400" size={15} />
                <span>Cut</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl+X
              </kbd>
            </button>

            <button
              onClick={handleCopy}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiFileCopyLine className="text-zinc-400" size={15} />
                <span>Copy</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl+C
              </kbd>
            </button>

            <button
              onClick={handlePaste}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiClipboardLine className="text-zinc-400" size={15} />
                <span>Paste</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl+V
              </kbd>
            </button>

            <button
              onClick={handleSelectAll}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiCheckboxMultipleLine className="text-zinc-400" size={15} />
                <span>Select All</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl+A
              </kbd>
            </button>
          </div>

          <div className="my-1 border-b border-white/5" />

          {/* Section 3: Zoom & Display */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => {
                onZoomIn()
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiZoomInLine className="text-cyan-400" size={15} />
                <span>Zoom In (+10%)</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl + +
              </kbd>
            </button>

            <button
              onClick={() => {
                onZoomOut()
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiZoomOutLine className="text-cyan-400" size={15} />
                <span>Zoom Out (-10%)</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl + -
              </kbd>
            </button>

            <button
              onClick={() => {
                onResetZoom()
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-cyan-400 font-bold">{zoomPercent}%</span>
                <span>Reset Zoom</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl + 0
              </kbd>
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiFullscreenLine className="text-zinc-400" size={15} />
                <span>Toggle Fullscreen</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                F11
              </kbd>
            </button>
          </div>

          <div className="my-1 border-b border-white/5" />

          {/* Section 4: Quick Navigation */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => {
                onNavigate('SETTINGS')
                onClose()
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiSettings4Line className="text-emerald-400" size={15} />
                <span>Settings & Keys</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl + ,
              </kbd>
            </button>

            <button
              onClick={() => {
                onNavigate('AGENTIC')
                onClose()
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiShieldFlashLine className="text-cyan-400" size={15} />
                <span>Agentic Studio</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl + 2
              </kbd>
            </button>

            <button
              onClick={() => {
                onNavigate('AI CHAT')
                onClose()
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiChatSmile3Line className="text-emerald-400" size={15} />
                <span>AI Chat Gateway</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl + 4
              </kbd>
            </button>
          </div>

          <div className="my-1 border-b border-white/5" />

          {/* Section 5: App Controls */}
          <div className="flex flex-col gap-0.5">
            <button
              onClick={handleReload}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiRefreshLine size={14} />
                <span>Reload Window</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl + R
              </kbd>
            </button>

            <button
              onClick={handleToggleDevTools}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <RiTerminalBoxLine size={14} />
                <span>Developer Tools</span>
              </div>
              <kbd className="font-mono text-[9px] text-zinc-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                Ctrl+⇧+I
              </kbd>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
export default NexusContextMenu
