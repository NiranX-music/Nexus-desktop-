import { useState, useEffect } from 'react'
import {
  RiSubtractLine,
  RiCloseLine,
  RiCheckboxBlankLine,
  RiCheckboxMultipleBlankLine
} from 'react-icons/ri'

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    if (window.electron && window.electron.process) {
      setIsMac(window.electron.process.platform === 'darwin')
    } else {
      setIsMac(navigator.userAgent.toLowerCase().includes('mac'))
    }
  }, [])

  const minimize = () => window.electron.ipcRenderer.send('window-min')
  const toggleMaximize = () => {
    setIsMaximized(!isMaximized)
    window.electron.ipcRenderer.send('window-max')
  }
  const close = () => window.electron.ipcRenderer.send('window-close')

  return (
    <div className="w-full h-8 flex items-center justify-between px-3 bg-[#030706]/95 border-b border-emerald-300/15 drag-region select-none z-1000 relative overflow-hidden shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-300/45 to-transparent" />
      <div className="absolute left-8 top-1/2 h-5 w-28 -translate-y-1/2 rounded-full bg-emerald-300/10 blur-xl" />
      {isMac && (
        <div className="flex items-center gap-2 no-drag z-50">
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
        </div>
      )}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 opacity-60 pointer-events-none">
        <div className="h-1.5 w-1.5 bg-emerald-300 animate-pulse shadow-[0_0_10px_#6ee7b7]" />
        <div className="text-[9px] font-black text-zinc-300 tracking-[0.32em]">
          NEXUS CONTROL // {isMac ? 'MAC' : 'SYSTEM'}
        </div>
      </div>

      {!isMac && (
        <div className="flex h-full no-drag ml-auto -mr-3 z-50">
          <button
            onClick={minimize}
            className="w-10 h-full flex items-center justify-center text-zinc-500 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RiSubtractLine size={16} />
          </button>
          <button
            onClick={toggleMaximize}
            className="w-10 h-full flex items-center justify-center text-zinc-500 hover:bg-white/10 hover:text-white transition-colors"
          >
            {isMaximized ? (
              <RiCheckboxMultipleBlankLine size={14} />
            ) : (
              <RiCheckboxBlankLine size={14} />
            )}
          </button>
          <button
            onClick={close}
            className="w-10 h-full flex items-center justify-center text-zinc-500 hover:bg-red-600 hover:text-white transition-colors"
          >
            <RiCloseLine size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default TitleBar
