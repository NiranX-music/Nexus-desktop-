import { useState, useEffect } from 'react'
import {
  RiSubtractLine,
  RiCloseLine,
  RiCheckboxBlankLine,
  RiCheckboxMultipleBlankLine
} from 'react-icons/ri'
import { IS_TRIAL_BUILD } from '@renderer/config/app-mode'

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
    <div className="drag-region relative z-1000 flex h-9 w-full select-none items-center justify-between overflow-hidden border-b border-emerald-300/12 bg-[#030706]/96 px-3 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-300/45 to-transparent" />
      <div className="absolute left-10 top-1/2 h-5 w-32 -translate-y-1/2 rounded-full bg-emerald-300/10 blur-xl" />
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

      <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-3">
        <div className="grid h-6 w-6 place-items-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-[10px] font-black tracking-[0.16em] text-emerald-200">
          NX
        </div>
        <div className="hidden min-[720px]:block">
          <div className="text-[8px] font-black uppercase tracking-[0.26em] text-emerald-300/70">
            {IS_TRIAL_BUILD ? 'Nexus Trial Runtime' : 'Nexus Runtime'}
          </div>
          <div className="mt-0.5 text-[9px] font-semibold tracking-[0.1em] text-zinc-400">
            {IS_TRIAL_BUILD ? 'Light local desktop surface' : 'Local desktop command surface'}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 opacity-60 xl:flex">
        <div className="h-1.5 w-1.5 animate-pulse bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />
        <div className="text-[9px] font-black tracking-[0.28em] text-zinc-300">
          NEXUS CONTROL // {isMac ? 'MAC' : 'SYSTEM'}
        </div>
      </div>

      {!isMac && (
        <div className="no-drag z-50 -mr-3 ml-auto flex h-full">
          <button
            onClick={minimize}
            className="flex h-full w-10 items-center justify-center text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RiSubtractLine size={16} />
          </button>
          <button
            onClick={toggleMaximize}
            className="flex h-full w-10 items-center justify-center text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            {isMaximized ? (
              <RiCheckboxMultipleBlankLine size={14} />
            ) : (
              <RiCheckboxBlankLine size={14} />
            )}
          </button>
          <button
            onClick={close}
            className="flex h-full w-10 items-center justify-center text-zinc-500 transition-colors hover:bg-red-600 hover:text-white"
          >
            <RiCloseLine size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default TitleBar
