import { useState, useEffect } from 'react'
import {
  RiSubtractLine,
  RiCloseLine,
  RiCheckboxBlankLine,
  RiCheckboxMultipleBlankLine,
  RiRocketLine,
  RiRefreshLine
} from 'react-icons/ri'
import { refreshAllSystemsAndAgents } from '../services/system-refresh'

interface TitleBarProps {
  hasDownloadedUpdate?: boolean
  updateVersion?: string
  onOpenUpdateModal?: () => void
}

const TitleBar = ({ hasDownloadedUpdate, updateVersion, onOpenUpdateModal }: TitleBarProps) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (window.electron && window.electron.process) {
      setIsMac(window.electron.process.platform === 'darwin')
    } else {
      setIsMac(navigator.userAgent.toLowerCase().includes('mac'))
    }

    const handleRefreshEvent = () => {
      setIsRefreshing(true)
      setTimeout(() => setIsRefreshing(false), 1200)
    }
    window.addEventListener('nexus-system-refresh-all', handleRefreshEvent)
    return () => window.removeEventListener('nexus-system-refresh-all', handleRefreshEvent)
  }, [])

  const handleManualRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await refreshAllSystemsAndAgents()
    } finally {
      setTimeout(() => setIsRefreshing(false), 800)
    }
  }

  const minimize = () => window.electron.ipcRenderer.send('window-min')
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized)
    window.electron.ipcRenderer.send('window-max')
  }
  const close = () => window.electron.ipcRenderer.send('window-close')

  return (
    <div className="w-full h-10 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 drag-region select-none z-1000 relative">
      <div className="flex items-center gap-2 no-drag z-50">
        {isMac ? (
          <>
            <button
              onClick={close}
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 border border-red-600 flex items-center justify-center group"
            >
              <span className="hidden group-hover:block text-[8px] text-red-900 font-bold">×</span>
            </button>
            <button
              onClick={minimize}
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 border border-yellow-600 flex items-center justify-center group"
            >
              <span className="hidden group-hover:block text-[8px] text-yellow-900 font-bold">−</span>
            </button>
            <button
              onClick={toggleMaximize}
              className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 border border-emerald-600 flex items-center justify-center group"
            >
              <span className="hidden group-hover:block text-[6px] text-emerald-900 font-bold">
                ↗
              </span>
            </button>
          </>
        ) : (
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 hover:border-emerald-400 hover:bg-emerald-500/20 text-[9px] font-mono font-bold text-emerald-400 tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.15)] transition cursor-pointer group"
            title="Click to refresh all ecosystem features and autonomous agents (or press Ctrl+Shift+R)"
          >
            <RiRefreshLine
              size={12}
              className={`text-emerald-400 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
            />
            <span>{isRefreshing ? 'SYNCING AGENTS & SYSTEMS...' : 'ALL SYSTEMS ACTIVE'}</span>
          </button>
        )}

        {hasDownloadedUpdate && (
          <button
            onClick={onOpenUpdateModal}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[9px] font-mono font-bold text-cyan-300 tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:bg-cyan-500/30 transition cursor-pointer animate-pulse"
            title="Update downloaded and ready. Click to restart now or manage."
          >
            <RiRocketLine size={12} className="text-cyan-300" />
            <span>UPDATE READY (v{updateVersion || 'NEW'})</span>
          </button>
        )}
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 opacity-60 pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
        <div className="text-[11px] font-bold text-zinc-300 tracking-[0.3em]">
          Nexus AI // {isMac ? 'MAC' : 'SYSTEM'}
        </div>
      </div>

      {!isMac && (
        <div className="flex h-full no-drag ml-auto -mr-4 z-50">
          <button
            onClick={minimize}
            className="w-12 h-full flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RiSubtractLine size={16} />
          </button>
          <button
            onClick={toggleMaximize}
            className="w-12 h-full flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            {isMaximized ? (
              <RiCheckboxMultipleBlankLine size={14} />
            ) : (
              <RiCheckboxBlankLine size={14} />
            )}
          </button>
          <button
            onClick={close}
            className="w-12 h-full flex items-center justify-center text-zinc-400 hover:bg-red-600 hover:text-white transition-colors"
          >
            <RiCloseLine size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default TitleBar
