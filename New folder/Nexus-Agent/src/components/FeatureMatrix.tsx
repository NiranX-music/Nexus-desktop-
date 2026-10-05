import React from 'react'
import {
  Mic,
  LayoutGrid,
  Zap,
  ShieldAlert,
  FileSpreadsheet,
  Palette,
  Lock,
  Layers,
  Database,
  Terminal,
  Cpu,
  MonitorCheck
} from 'lucide-react'

export const FeatureMatrix: React.FC = () => {
  const features = [
    {
      icon: Mic,
      color: 'from-cyan-500 to-blue-500',
      badge: 'AUDIO PROTOCOL',
      title: 'Gemini Live Bidirectional Voice',
      desc: 'Real-time WebSocket streaming (PCM 24kHz) enables seamless natural speech conversation with interruption support and sub-70ms response latency.'
    },
    {
      icon: LayoutGrid,
      color: 'from-purple-500 to-indigo-500',
      badge: 'SPATIAL TELEMETRY',
      title: 'Telekinesis Window Engine',
      desc: 'Automated multi-display window tiling, centering, and focus management. Includes native Win32 PowerShell user32 fallbacks for total portability.'
    },
    {
      icon: Zap,
      color: 'from-amber-400 to-orange-500',
      badge: 'AUTONOMOUS ACTIONS',
      title: 'Ghost Sequences (NutJS)',
      desc: 'Execute multi-step OS workflows, keyboard combinations, clicks, and script dispatches without fragile hardcoded pixel coordinates.'
    },
    {
      icon: ShieldAlert,
      color: 'from-emerald-400 to-teal-500',
      badge: 'DEEP WORK DEFENSE',
      title: 'Focus Protocol & Distraction Shield',
      desc: 'Enforces distraction-free deep work sprints. A persistent 15-second background guard actively terminates blacklisted gaming and social media processes.'
    },
    {
      icon: FileSpreadsheet,
      color: 'from-sky-400 to-blue-600',
      badge: 'OFFICE FORGE',
      title: 'Doc & Office Synthesis',
      desc: 'Generate complete presentation slide decks and structured spreadsheets instantly. Saves directly to host Downloads with instant opening.'
    },
    {
      icon: Palette,
      color: 'from-pink-500 to-rose-500',
      badge: 'SYSTEM STYLING',
      title: 'Wallpaper Forge & Ambient HUD',
      desc: 'Procedural cyber wallpapers synced directly to your desktop background across Windows, macOS, and Linux with customizable themes.'
    },
    {
      icon: Lock,
      color: 'from-emerald-500 to-cyan-500',
      badge: 'ZERO-KNOWLEDGE AUTH',
      title: 'Dual-Tier Privacy & Bcrypt Auth',
      desc: 'Local-first architecture. Store credentials in offline Bcrypt vaults with 1-click Local Operator Direct Access or sync via Supabase.'
    },
    {
      icon: Layers,
      color: 'from-indigo-400 to-purple-600',
      badge: 'EXTENSIBILITY',
      title: 'MCP Server Ecosystem',
      desc: 'Extensible Model Context Protocol connectivity. Seamlessly bridge external developer tools, file systems, browsers, and custom agents.'
    },
    {
      icon: Database,
      color: 'from-cyan-400 to-teal-400',
      badge: 'NEURAL MEMORY',
      title: 'Vector RAG & Codebase Ingestion',
      desc: 'Indexes entire code repositories and project directories with LanceDB/Chroma embeddings for instant contextual retrieval.'
    }
  ]

  return (
    <section id="features" className="py-24 relative border-t border-white/5 bg-[#040711]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-mono mb-3">
            <Cpu className="w-3.5 h-3.5" />
            <span>ENTERPRISE SPECIFICATIONS</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Engineered for Autonomous{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Desktop Sovereignty
            </span>
          </h2>
          <p className="text-slate-400 mt-3 text-base sm:text-lg">
            Everything you need to orchestrate complex desktop computing tasks using pure voice, vision, and deterministic local code execution.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-slate-900/40 hover:bg-slate-900/80 border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} p-0.5 flex items-center justify-center`}
                    >
                      <div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                        <Icon className="w-6 h-6 text-cyan-300" />
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>Subsystem Ready</span>
                  <span className="text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
