import React, { useState, useEffect, useMemo } from 'react'
import {
  RiCloseLine,
  RiComputerLine,
  RiWindowLine,
  RiCameraLine,
  RiGlobalLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiRefreshLine,
  RiSearchLine,
  RiCheckLine,
  RiVideoUploadLine,
  RiSparklingFill
} from 'react-icons/ri'
import { DesktopSourceItem, getDesktopSources } from '../hooks/CaptureDesktop'

export interface StartVisionOptions {
  sourceId?: string
  shareAudio?: boolean
  dualCamera?: boolean
}

interface VisionSourceModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (mode: 'camera' | 'screen' | 'dual', options?: StartVisionOptions) => void
}

type TabType = 'screens' | 'windows' | 'browser' | 'camera'

export default function VisionSourceModal({
  isOpen,
  onClose,
  onSelect
}: VisionSourceModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('screens')
  const [sources, setSources] = useState<DesktopSourceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [shareAudio, setShareAudio] = useState(true)
  const [dualCamera, setDualCamera] = useState(false)

  const loadSources = async () => {
    setLoading(true)
    try {
      const items = await getDesktopSources(['screen', 'window'])
      setSources(items)
      if (items.length > 0 && !selectedSourceId) {
        setSelectedSourceId(items[0].id)
      }
    } catch (err) {
      console.error('Failed to load screen sources:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadSources()
    }
  }, [isOpen])

  const screens = useMemo(() => sources.filter((s) => s.type === 'screen'), [sources])

  const windows = useMemo(
    () =>
      sources.filter(
        (s) =>
          s.type === 'window' &&
          !/nexus/i.test(s.name) // don't show self window mirror
      ),
    [sources]
  )

  const browserTabs = useMemo(
    () =>
      sources.filter(
        (s) =>
          s.type === 'window' &&
          /(chrome|edge|firefox|brave|safari|opera|arc|browser|youtube|github)/i.test(s.name)
      ),
    [sources]
  )

  const displayedSources = useMemo(() => {
    let list: DesktopSourceItem[] = []
    if (activeTab === 'screens') list = screens
    else if (activeTab === 'windows') list = windows
    else if (activeTab === 'browser') list = browserTabs

    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter((item) => item.name.toLowerCase().includes(q))
  }, [activeTab, screens, windows, browserTabs, searchQuery])

  // Auto-select first in tab if current selection is not in list
  useEffect(() => {
    if (activeTab !== 'camera' && displayedSources.length > 0) {
      const stillInList = displayedSources.some((s) => s.id === selectedSourceId)
      if (!stillInList) {
        setSelectedSourceId(displayedSources[0].id)
      }
    }
  }, [activeTab, displayedSources, selectedSourceId])

  if (!isOpen) return null

  const handleLaunch = () => {
    if (activeTab === 'camera') {
      onSelect('camera')
    } else {
      const mode = dualCamera ? 'dual' : 'screen'
      onSelect(mode, {
        sourceId: selectedSourceId,
        shareAudio,
        dualCamera
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-emerald-500/30 bg-zinc-950/95 shadow-[0_25px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-black font-black shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <RiVideoUploadLine size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-widest text-emerald-300 uppercase">
                  Optical Uplink Studio
                </h2>
                <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  DUAL FEED READY
                </span>
              </div>
              <p className="text-[10px] font-mono text-zinc-400">
                Select desktop display, app window, or simultaneous screen + camera stream
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSources}
              disabled={loading}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/30 transition-all cursor-pointer"
              title="Refresh source list"
            >
              <RiRefreshLine size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
              title="Cancel"
            >
              <RiCloseLine size={18} />
            </button>
          </div>
        </div>

        {/* Top Controls & Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-white/5 bg-black/40">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/5">
            <button
              onClick={() => setActiveTab('screens')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === 'screens'
                  ? 'bg-emerald-500 text-black shadow-[0_0_14px_rgba(16,185,129,0.5)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <RiComputerLine size={15} />
              <span>Screens ({screens.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('windows')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === 'windows'
                  ? 'bg-emerald-500 text-black shadow-[0_0_14px_rgba(16,185,129,0.5)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <RiWindowLine size={15} />
              <span>Windows ({windows.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('browser')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === 'browser'
                  ? 'bg-emerald-500 text-black shadow-[0_0_14px_rgba(16,185,129,0.5)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <RiGlobalLine size={15} />
              <span>Web Tabs ({browserTabs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === 'camera'
                  ? 'bg-cyan-400 text-black shadow-[0_0_14px_rgba(6,182,212,0.5)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <RiCameraLine size={15} />
              <span>Camera Only</span>
            </button>
          </div>

          {activeTab !== 'camera' && (
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
              <input
                type="text"
                placeholder="Search windows & displays..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          )}
        </div>

        {/* Feature Switches: Audio Share & Dual Mode */}
        {activeTab !== 'camera' && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-zinc-900/40 border-b border-white/5">
            {/* Audio Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={shareAudio}
                onChange={(e) => setShareAudio(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${
                  shareAudio ? 'bg-emerald-500 justify-end' : 'bg-zinc-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black shadow-sm" />
              </div>
              <div className="flex items-center gap-1.5">
                {shareAudio ? (
                  <RiVolumeUpLine className="text-emerald-400" size={16} />
                ) : (
                  <RiVolumeMuteLine className="text-zinc-500" size={16} />
                )}
                <div>
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300 transition-colors">
                    Share Screen Audio
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500">
                    Streams system & app audio into Gemini Live uplink
                  </div>
                </div>
              </div>
            </label>

            {/* Simultaneous Dual Vision Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={dualCamera}
                onChange={(e) => setDualCamera(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${
                  dualCamera ? 'bg-cyan-400 justify-end' : 'bg-zinc-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black shadow-sm" />
              </div>
              <div className="flex items-center gap-1.5">
                <RiSparklingFill
                  className={dualCamera ? 'text-cyan-300 animate-pulse' : 'text-zinc-500'}
                  size={15}
                />
                <div>
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                    <span>Dual Vision (Screen + Webcam PIP)</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300">
                      NEW
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500">
                    Simultaneously streams your screen and face overlay to AI
                  </div>
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Source Cards Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-small min-h-[300px]">
          {activeTab === 'camera' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-20 w-20 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300 mb-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <RiCameraLine size={40} />
              </div>
              <h3 className="text-base font-bold text-zinc-100 mb-1">Direct Camera Feed</h3>
              <p className="text-xs text-zinc-400 max-w-md font-mono mb-6">
                Connects your primary webcam directly to the Nexus vision engine with real-time facial
                expression scanning and environment perception.
              </p>
              <button
                onClick={handleLaunch}
                className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                Engage Camera Uplink
              </button>
            </div>
          ) : displayedSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
              <RiComputerLine size={36} className="mb-2 opacity-50" />
              <p className="text-xs font-mono">No matching windows or displays found.</p>
              <button
                onClick={loadSources}
                className="mt-3 text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer"
              >
                Reload sources
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {displayedSources.map((source) => {
                const isSelected = selectedSourceId === source.id
                return (
                  <div
                    key={source.id}
                    onClick={() => setSelectedSourceId(source.id)}
                    className={`group relative rounded-xl border p-2 flex flex-col gap-2 transition-all cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                      {source.thumbnail ? (
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <RiComputerLine size={32} className="text-zinc-600" />
                      )}

                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-emerald-400 text-black flex items-center justify-center shadow-lg">
                          <RiCheckLine size={16} />
                        </div>
                      )}

                      {/* Source Type Pill */}
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[8px] font-mono uppercase font-bold text-zinc-300 border border-white/10">
                        {source.type}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 min-w-0 px-1">
                      {source.appIcon && (
                        <img
                          src={source.appIcon}
                          alt=""
                          className="w-4 h-4 rounded shrink-0 object-contain"
                        />
                      )}
                      <div className="truncate text-xs font-semibold text-zinc-200 group-hover:text-emerald-300 transition-colors">
                        {source.name}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/60">
          <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {activeTab === 'camera'
                ? 'Camera feed selected'
                : dualCamera
                  ? `Dual stream: Screen + Webcam (${shareAudio ? 'with PC audio' : 'muted audio'})`
                  : `Screen capture (${shareAudio ? 'with PC audio' : 'muted audio'})`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_24px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center gap-2"
            >
              <RiVideoUploadLine size={16} />
              <span>
                {activeTab === 'camera'
                  ? 'Launch Camera'
                  : dualCamera
                    ? 'Launch Dual Vision'
                    : 'Launch Uplink'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
