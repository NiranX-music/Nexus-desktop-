import React, { useState, useEffect } from 'react'
import { demandComponentManager, DemandTelemetry } from '../services/demand-component-manager'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiLeafLine,
  RiDashboardLine,
  RiMoonLine,
  RiFlashlightLine,
  RiCloseLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiShieldCheckLine
} from 'react-icons/ri'

export default function DemandResourceHUD() {
  const [isOpen, setIsOpen] = useState(false)
  const [telemetry, setTelemetry] = useState<DemandTelemetry>(demandComponentManager.getTelemetry())

  useEffect(() => {
    const update = () => setTelemetry(demandComponentManager.getTelemetry())
    update()
    const unsubscribe = demandComponentManager.subscribe(update)
    const interval = setInterval(update, 2000)
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const handleToggleMode = () => {
    demandComponentManager.setDemandMode(!telemetry.demandModeEnabled)
  }

  const handleHibernateAll = () => {
    const all = demandComponentManager.getAllComponents()
    for (const c of all) {
      if (c.status === 'active') {
        demandComponentManager.releaseComponent(c.definition.id, 'manual-hibernate-all')
      }
    }
  }

  const handleWake = (id: string) => {
    demandComponentManager.demandComponent(id, undefined, 'hud-manual-wake')
  }

  const allComponents = demandComponentManager.getAllComponents()

  return (
    <div className="fixed bottom-3 left-6 z-9000 font-sans select-none">
      {/* Collapsed Pill Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2.5 rounded-full border border-emerald-500/40 bg-zinc-950/85 px-3.5 py-1.5 text-xs font-mono text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.18)] backdrop-blur-xl transition hover:border-emerald-400 hover:bg-zinc-900/90"
      >
        <div className="relative flex h-2 w-2">
          {telemetry.demandModeEnabled ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </>
          ) : (
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          )}
        </div>
        <RiLeafLine className="text-emerald-400" size={14} />
        <span className="font-semibold tracking-wide text-zinc-200">
          DEMAND ENGINE: <span className="text-emerald-400">{telemetry.activeCount} ACTIVE</span>
        </span>
        <span className="text-emerald-500/80">+{telemetry.estimatedRamSavedMb} MB SAVED</span>
        {isOpen ? <RiArrowDownSLine size={16} /> : <RiArrowUpSLine size={16} />}
      </motion.button>

      {/* Expanded System Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="absolute bottom-12 left-0 w-96 rounded-2xl border border-emerald-500/30 bg-zinc-950/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2">
                <RiShieldCheckLine className="text-emerald-400" size={18} />
                <div>
                  <h3 className="font-mono text-xs font-bold text-zinc-100 uppercase tracking-wider">
                    Dedicated Demand Governor
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Zero-waste just-in-time component lifecycle
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-zinc-400 hover:text-white transition"
              >
                <RiCloseLine size={16} />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 my-3">
              <div className="rounded-xl border border-white/5 bg-white/2 p-2.5 text-center">
                <div className="font-mono text-[10px] text-zinc-400 uppercase">Status</div>
                <div className="font-mono text-xs font-bold text-emerald-400">
                  {telemetry.demandModeEnabled ? 'Optimal' : 'All Online'}
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/2 p-2.5 text-center">
                <div className="font-mono text-[10px] text-zinc-400 uppercase">Active</div>
                <div className="font-mono text-xs font-bold text-cyan-400">
                  {telemetry.activeCount} / {telemetry.totalComponents}
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/2 p-2.5 text-center">
                <div className="font-mono text-[10px] text-zinc-400 uppercase">RAM Saved</div>
                <div className="font-mono text-xs font-bold text-emerald-400">
                  +{telemetry.estimatedRamSavedMb} MB
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handleToggleMode}
                className={`flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold transition ${
                  telemetry.demandModeEnabled
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                {telemetry.demandModeEnabled ? '✓ Mode: On-Demand' : '⚠ Mode: All Running'}
              </button>
              {telemetry.activeCount > 0 && (
                <button
                  onClick={handleHibernateAll}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition flex items-center gap-1"
                >
                  <RiMoonLine size={12} /> Sleep All
                </button>
              )}
            </div>

            {/* Component Status List */}
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
              <div className="text-[10px] uppercase font-bold text-zinc-500 px-1 pt-1">
                Subsystems & Components ({allComponents.length})
              </div>
              {allComponents.map((c) => {
                const isActive = c.status === 'active'
                return (
                  <div
                    key={c.definition.id}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border transition ${
                      isActive
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                        : 'border-white/5 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          isActive ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-zinc-600'
                        }`}
                      />
                      <span className="truncate">{c.definition.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-zinc-500">
                        {isActive ? 'ACTIVE' : `+${c.definition.estimatedRamMb}MB`}
                      </span>
                      {isActive ? (
                        <button
                          onClick={() => demandComponentManager.releaseComponent(c.definition.id, 'hud-sleep')}
                          title="Hibernate component"
                          className="rounded p-1 text-zinc-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
                        >
                          <RiMoonLine size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleWake(c.definition.id)}
                          title="Wake on-demand"
                          className="rounded p-1 text-zinc-500 hover:bg-cyan-500/20 hover:text-cyan-300 transition"
                        >
                          <RiFlashlightLine size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
