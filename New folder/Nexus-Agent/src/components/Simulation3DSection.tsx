import React, { useState } from 'react'
import { Nexus3DCanvas, Simulation3DMode } from './Nexus3DCanvas.tsx'
import { Sparkles, Box, Volume2, VolumeX, Shield, Zap, Layers, RefreshCw } from 'lucide-react'

export const Simulation3DSection: React.FC = () => {
  const [audioSimulation, setAudioSimulation] = useState(false)

  return (
    <section className="py-20 relative bg-[#02050e] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-3">
              <Box className="w-3.5 h-3.5" />
              <span>IMMERSIVE 3D SPATIAL SIMULATION</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Real-Time{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
                3D Holographic Matrix
              </span>
            </h2>
            <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-2xl">
              Interact directly with the WebGL 3D simulation of the agent core. Explore spatial window telekinesis,
              hexagonal focus defense domes, and quantum particle flow in 3D perspective.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAudioSimulation(!audioSimulation)}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
                audioSimulation
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {audioSimulation ? <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
              <span>{audioSimulation ? 'Voice Frequency Audio Pulse: ON' : 'Simulate Audio Pulse: OFF'}</span>
            </button>
          </div>
        </div>

        {/* 3D Canvas Container */}
        <Nexus3DCanvas isAudioActive={audioSimulation} />
      </div>
    </section>
  )
}
