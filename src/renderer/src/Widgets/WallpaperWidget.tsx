import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiCloseLine,
  RiPaintBrushLine,
  RiCheckLine,
  RiSparklingFill,
  RiComputerLine,
  RiRefreshLine
} from 'react-icons/ri'
import {
  getWallpaperPresets,
  setDesktopWallpaper,
  WallpaperPreset
} from '@renderer/tools/wallpaper-api'

export default function WallpaperWidget() {
  const [isVisible, setIsVisible] = useState(false)
  const [presets, setPresets] = useState<WallpaperPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<WallpaperPreset | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const [appliedPath, setAppliedPath] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsVisible(true)
      if (e.detail?.initialPrompt) {
        setCustomPrompt(e.detail.initialPrompt)
      }
    }
    window.addEventListener('show-wallpaper-forge', handleOpen)
    return () => window.removeEventListener('show-wallpaper-forge', handleOpen)
  }, [])

  useEffect(() => {
    if (isVisible) {
      getWallpaperPresets().then((res) => {
        setPresets(res)
        if (res.length > 0 && !selectedPreset) {
          setSelectedPreset(res[0])
        }
      })
    }
  }, [isVisible])

  const handleApply = async (source?: string) => {
    const targetSource = source || selectedPreset?.url
    if (!targetSource) return

    setIsApplying(true)
    setStatusMessage('APPLYING DESKTOP WALLPAPER...')

    const result = await setDesktopWallpaper(targetSource)
    setIsApplying(false)
    if (result.includes('✅')) {
      setAppliedPath(targetSource)
      setStatusMessage('WALLPAPER ENGAGED ON DESKTOP')
      setTimeout(() => setStatusMessage(null), 4000)
    } else {
      setStatusMessage('FAILED TO SET WALLPAPER')
      setTimeout(() => setStatusMessage(null), 4000)
    }
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-9700 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-4xl bg-zinc-950/80 border border-white/10 rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden flex flex-col"
        >
          {/* Top Telemetry Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <RiPaintBrushLine size={18} />
              </div>
              <div>
                <h2 className="text-white text-sm font-bold tracking-wide uppercase">
                  AI Wallpaper Engine
                </h2>
                <p className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">
                  System Parameter Visual Grounding • 4K Neural Presets
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {statusMessage && (
                <span className="text-[11px] font-mono px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 animate-pulse">
                  {statusMessage}
                </span>
              )}
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
              >
                <RiCloseLine size={20} />
              </button>
            </div>
          </div>

          {/* Main Body */}
          <div className="grid grid-cols-12 gap-6 p-6">
            {/* Left Column: Preset Gallery & Custom Prompt */}
            <div className="col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase">
                  Curated Neural Presets
                </span>
                <span className="text-[10px] font-mono text-emerald-400/80">
                  {presets.length} PROFILES LOADED
                </span>
              </div>

              {/* Preset Cards Grid */}
              <div className="grid grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1 scrollbar-small">
                {presets.map((preset) => {
                  const isSelected = selectedPreset?.id === preset.id
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset)}
                      className={`group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden ${
                        isSelected
                          ? 'bg-zinc-900/90 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                          : 'bg-zinc-900/40 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="relative h-24 w-full rounded-lg overflow-hidden mb-2 bg-zinc-950">
                        <img
                          src={preset.url}
                          alt={preset.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-zinc-300 border border-white/10">
                          {preset.category}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-white tracking-wide truncate">
                          {preset.title}
                        </h4>
                        {appliedPath === preset.url && (
                          <RiCheckLine className="text-emerald-400 flex-shrink-0" size={14} />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Generative Prompt Bar */}
              <div className="mt-2 flex flex-col gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <RiSparklingFill className="text-cyan-400" size={12} />
                  Generative Atmospheric Synthesis
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter prompt (e.g. Cyberpunk rain over Neo-Seoul, 8K wallpaper)..."
                    className="flex-1 bg-zinc-900/90 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 font-sans"
                  />
                  <button
                    onClick={() => {
                      if (customPrompt) {
                        const unsplashUrl = `https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2560&auto=format&fit=crop`
                        handleApply(unsplashUrl)
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-mono tracking-wider uppercase transition flex items-center gap-1.5"
                  >
                    <RiSparklingFill size={13} />
                    Synthesize
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: High-Res Glass Preview & Direct Action */}
            <div className="col-span-5 flex flex-col justify-between p-4 rounded-xl bg-zinc-900/50 border border-white/5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
                    Stage Preview
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500">2560 × 1440 UHD</span>
                </div>

                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black">
                  {selectedPreset ? (
                    <img
                      src={selectedPreset.url}
                      alt={selectedPreset.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-mono">
                      NO PREVIEW ACTIVE
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3 text-left">
                    <p className="text-white text-xs font-bold truncate">
                      {selectedPreset?.title || 'System Default'}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate font-mono">
                      {selectedPreset?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  disabled={isApplying || !selectedPreset}
                  onClick={() => handleApply()}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-50"
                >
                  {isApplying ? (
                    <>
                      <RiRefreshLine className="animate-spin" size={16} />
                      ENGAGING WALLPAPER...
                    </>
                  ) : (
                    <>
                      <RiComputerLine size={16} />
                      APPLY TO DESKTOP
                    </>
                  )}
                </button>
                <p className="text-[9px] font-mono text-zinc-500 text-center uppercase tracking-widest">
                  Direct Hook • Win32 SystemParametersInfo
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
