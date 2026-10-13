import React, { useState, useEffect } from 'react'
import {
  RiRocketLine,
  RiRestartLine,
  RiCloseLine,
  RiTimeLine,
  RiFolderOpenLine,
  RiCheckLine,
  RiSparklingLine,
  RiShieldCheckLine
} from 'react-icons/ri'

export interface UpdateInfo {
  version?: string
  releaseName?: string
  releaseNotes?: string
  assetName?: string
  filePath?: string
  isDownloaded?: boolean
  deferred?: boolean
}

interface UpdatePromptModalProps {
  isOpen: boolean
  updateInfo: UpdateInfo | null
  onClose: () => void
  onInstall: () => void
  onDefer: () => void
}

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
  onInstall,
  onDefer
}) => {
  const [isInstalling, setIsInstalling] = useState(false)

  if (!isOpen || !updateInfo) return null

  const handleInstallNow = async () => {
    setIsInstalling(true)
    try {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('install-update')
      }
      onInstall()
    } catch (err) {
      console.error('[UpdatePromptModal] Error launching installer:', err)
      setIsInstalling(false)
    }
  }

  const handleDoItLater = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('defer-update')
      }
      onDefer()
    } catch (err) {
      console.error('[UpdatePromptModal] Error deferring update:', err)
    } finally {
      onClose()
    }
  }

  const handleOpenFolder = () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('open-updates-folder')
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-zinc-950/95 p-6 shadow-[0_20px_70px_rgba(16,185,129,0.25)] backdrop-blur-2xl flex flex-col gap-5 text-zinc-100">
        {/* Glow Accent */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-emerald-500/15 blur-[60px] rounded-full" />

        {/* Top Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]">
              <RiRocketLine size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                  System Update Ready
                </span>
                <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                  <RiShieldCheckLine size={12} /> Verified
                </span>
              </div>
              <h3 className="text-lg font-black tracking-wide text-zinc-100 mt-0.5">
                Nexus AI v{updateInfo.version || 'Latest'}
              </h3>
            </div>
          </div>
          <button
            onClick={handleDoItLater}
            className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors"
            title="Decide Later"
          >
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex flex-col gap-3 relative z-10 text-xs text-zinc-300">
          <div className="rounded-xl border border-white/10 bg-black/60 p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <RiCheckLine size={14} className="text-emerald-400" /> Package Downloaded & Saved
              </span>
              {updateInfo.filePath && (
                <button
                  onClick={handleOpenFolder}
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-emerald-300 hover:underline transition-colors"
                  title="View downloaded file in Explorer"
                >
                  <RiFolderOpenLine size={12} /> View File
                </button>
              )}
            </div>
            {updateInfo.assetName && (
              <p className="font-mono text-[11px] text-zinc-300 truncate bg-zinc-900/90 px-2.5 py-1.5 rounded-lg border border-white/5">
                {updateInfo.assetName}
              </p>
            )}
            <p className="text-zinc-400 leading-relaxed text-[11.5px]">
              The installer package has been downloaded and preserved on your local drive. You can apply the update now and restart the app, or continue your current session and update later.
            </p>
          </div>

          {/* Release Notes */}
          {updateInfo.releaseNotes && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                What's New in this Release:
              </span>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-white/5 bg-zinc-950/70 p-3 text-[11px] text-zinc-300 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-700">
                <pre className="whitespace-pre-wrap font-sans font-normal text-zinc-300">
                  {updateInfo.releaseNotes}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Action Choice Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 relative z-10 border-t border-white/10">
          <button
            onClick={handleDoItLater}
            disabled={isInstalling}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-bold tracking-widest text-[11px] uppercase transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RiTimeLine size={16} /> Do It Later
          </button>

          <button
            onClick={handleInstallNow}
            disabled={isInstalling}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black tracking-widest text-[11px] uppercase transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isInstalling ? (
              <>
                <RiRestartLine size={16} className="animate-spin" /> Restarting...
              </>
            ) : (
              <>
                <RiRestartLine size={16} /> Update & Restart Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpdatePromptModal
