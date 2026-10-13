import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiCloseLine,
  RiCheckLine,
  RiSparklingLine,
  RiLayoutBottomLine,
  RiLayoutTopLine,
  RiCompass3Line,
  RiMacbookLine
} from 'react-icons/ri'

interface DockSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

export type DockLocationOption = 'taskbar-left' | 'top-center' | 'bottom-center' | 'top-right'
export type DockStyleOption = 'line' | 'pill'

export default function DockSetupModal({ isOpen, onClose }: DockSetupModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<DockLocationOption>('taskbar-left')
  const [selectedStyle, setSelectedStyle] = useState<DockStyleOption>('line')
  const [isApplying, setIsApplying] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsApplying(true)
    try {
      if ((window as any).electron?.ipcRenderer) {
        await (window as any).electron.ipcRenderer.invoke('set-dock-config', {
          location: selectedLocation,
          style: selectedStyle,
          setupCompleted: true
        })
      }
      localStorage.setItem('nexus_dock_setup_completed', 'true')
      localStorage.setItem('nexus_dock_location', selectedLocation)
      localStorage.setItem('nexus_dock_style', selectedStyle)
    } catch (err) {
      console.warn('[DockSetupModal] Failed to save dock config:', err)
    } finally {
      setIsApplying(false)
      onClose()
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-2xl rounded-3xl border border-white/20 bg-[#070b0a]/95 p-6 md:p-8 text-zinc-100 shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-2xl overflow-hidden font-sans"
        >
          {/* Ambient Cyber Background Lighting */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Dismiss Setup"
          >
            <RiCloseLine size={18} />
          </button>

          {/* Modal Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl border border-emerald-400/40 bg-gradient-to-tr from-emerald-600/30 to-teal-400/20 flex items-center justify-center text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)] shrink-0">
              <RiCompass3Line size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Initial Setup
                </span>
                <span className="text-[10px] font-mono text-zinc-400">NEXUS HUD 9.1</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1">
                Choose Your Dock Placement
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Select where the Nexus AI dock will live on your desktop. You can change this anytime in Settings.
              </p>
            </div>
          </div>

          {/* Section 1: Location Presets */}
          <div className="mb-6">
            <label className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-1.5 mb-2.5">
              <RiLayoutBottomLine size={13} className="text-emerald-400" /> 1. Desktop Placement
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Taskbar Empty Slot (Recommended) */}
              <div
                onClick={() => setSelectedLocation('taskbar-left')}
                className={`group relative rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedLocation === 'taskbar-left'
                    ? 'border-emerald-400/80 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <RiLayoutBottomLine
                      size={16}
                      className={selectedLocation === 'taskbar-left' ? 'text-emerald-300' : 'text-zinc-400'}
                    />
                    <span className="text-xs font-bold text-white">Taskbar Empty Slot</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                    RECOMMENDED
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Nestles right into the empty section next to the Weather widget on Windows 11.
                </p>
                {selectedLocation === 'taskbar-left' && (
                  <div className="absolute top-3 right-3 h-4 w-4 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                    <RiCheckLine size={12} />
                  </div>
                )}
              </div>

              {/* Camera Notch (Standard) */}
              <div
                onClick={() => setSelectedLocation('top-center')}
                className={`group relative rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedLocation === 'top-center'
                    ? 'border-emerald-400/80 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <RiLayoutTopLine
                      size={16}
                      className={selectedLocation === 'top-center' ? 'text-emerald-300' : 'text-zinc-400'}
                    />
                    <span className="text-xs font-bold text-white">Camera Notch</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300">
                    TOP CENTER
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Floats centered right under your webcam bezel like a hardware dynamic island.
                </p>
                {selectedLocation === 'top-center' && (
                  <div className="absolute top-3 right-3 h-4 w-4 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                    <RiCheckLine size={12} />
                  </div>
                )}
              </div>

              {/* Bottom Center */}
              <div
                onClick={() => setSelectedLocation('bottom-center')}
                className={`group relative rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedLocation === 'bottom-center'
                    ? 'border-emerald-400/80 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <RiMacbookLine
                      size={16}
                      className={selectedLocation === 'bottom-center' ? 'text-emerald-300' : 'text-zinc-400'}
                    />
                    <span className="text-xs font-bold text-white">Bottom Center</span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Floats centrally at the bottom of the screen right above the taskbar.
                </p>
                {selectedLocation === 'bottom-center' && (
                  <div className="absolute top-3 right-3 h-4 w-4 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                    <RiCheckLine size={12} />
                  </div>
                )}
              </div>

              {/* Top Right Corner */}
              <div
                onClick={() => setSelectedLocation('top-right')}
                className={`group relative rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  selectedLocation === 'top-right'
                    ? 'border-emerald-400/80 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <RiSparklingLine
                      size={16}
                      className={selectedLocation === 'top-right' ? 'text-emerald-300' : 'text-zinc-400'}
                    />
                    <span className="text-xs font-bold text-white">Top Right Corner</span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Corner telemetry docked discreetly at the upper right edge of your screen.
                </p>
                {selectedLocation === 'top-right' && (
                  <div className="absolute top-3 right-3 h-4 w-4 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                    <RiCheckLine size={12} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Dock Style & Density */}
          <div className="mb-6">
            <label className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase flex items-center gap-1.5 mb-2.5">
              <RiSparklingLine size={13} className="text-cyan-400" /> 2. Visual Density & Dock Style
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Extra-Compact Cyber Line (2mm) */}
              <div
                onClick={() => setSelectedStyle('line')}
                className={`group relative rounded-2xl border p-3.5 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedStyle === 'line'
                    ? 'border-emerald-400/80 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">2mm Cyber Line</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                      EXTRA COMPACT
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug mb-3">
                    Futuristic neon laser strip below camera (~2mm). Expands smoothly on hover.
                  </p>
                </div>

                {/* Cyber Line Interactive Mini Preview */}
                <div className="h-9 w-full rounded-xl bg-black/60 border border-white/5 flex items-center justify-center px-4">
                  <div className="relative h-[3px] w-28 rounded-full bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 shadow-[0_0_10px_#10b981,0_0_20px_rgba(6,182,212,0.8)]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_4px_#fff]" />
                    </div>
                  </div>
                </div>

                {selectedStyle === 'line' && (
                  <div className="absolute top-3 right-3 h-4 w-4 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                    <RiCheckLine size={12} />
                  </div>
                )}
              </div>

              {/* Dynamic Island Pill (Standard) */}
              <div
                onClick={() => setSelectedStyle('pill')}
                className={`group relative rounded-2xl border p-3.5 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedStyle === 'pill'
                    ? 'border-emerald-400/80 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">Dynamic Island Pill</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300">
                      STANDARD
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug mb-3">
                    Curved glass capsule (40px) with NX LIVE status badge, equalizer, and mic button.
                  </p>
                </div>

                {/* Dynamic Island Mini Preview */}
                <div className="h-9 w-full rounded-xl bg-black/60 border border-white/5 flex items-center justify-center px-4">
                  <div className="h-6 w-32 rounded-full border border-white/20 bg-slate-900/60 px-2 flex items-center justify-between text-[8px] font-bold text-emerald-300">
                    <div className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-emerald-500/30 text-[7px] flex items-center justify-center border border-emerald-400/40">
                        NX
                      </span>
                      <span>LIVE</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="h-2 w-0.5 bg-emerald-400 rounded-full" />
                      <span className="h-3 w-0.5 bg-teal-300 rounded-full" />
                      <span className="h-1.5 w-0.5 bg-emerald-400 rounded-full" />
                    </div>
                  </div>
                </div>

                {selectedStyle === 'pill' && (
                  <div className="absolute top-3 right-3 h-4 w-4 rounded-full bg-emerald-400 flex items-center justify-center text-black">
                    <RiCheckLine size={12} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
            <span className="text-[11px] text-zinc-400 text-center sm:text-left">
              💡 You can also drag the dock anywhere anytime on your monitors.
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-300 transition-all cursor-pointer"
              >
                Skip for Now
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isApplying}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RiCheckLine size={16} /> Confirm & Place Dock
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
