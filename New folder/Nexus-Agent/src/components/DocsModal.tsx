import React from 'react'
import { X, Terminal, Mic, Shield, Palette, FileText, Zap, BookOpen } from 'lucide-react'

interface DocsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  const commands = [
    {
      category: 'Voice & Bidi Streaming',
      icon: Mic,
      color: 'text-cyan-400',
      items: [
        { cmd: 'Hey Nexus, listen', desc: 'Activates microphone stream and starts real-time conversation.' },
        { cmd: 'Silence / Stop', desc: 'Interrupts Nexus immediately and releases audio session.' },
        { cmd: 'Consult oracle [query]', desc: 'Executes frontier research and web reasoning across sources.' }
      ]
    },
    {
      category: 'Telekinesis & Spatial Windows',
      icon: Zap,
      color: 'text-purple-400',
      items: [
        { cmd: 'Arrange 2x2 grid', desc: 'Tiles current active apps equally across primary monitor.' },
        { cmd: 'Focus center [app]', desc: 'Centers primary app at 70% width and minimizes clutter.' },
        { cmd: 'Move to monitor 2', desc: 'Teleports targeted window across virtual monitor coordinates.' }
      ]
    },
    {
      category: 'Deep Work Focus Shield',
      icon: Shield,
      color: 'text-emerald-400',
      items: [
        { cmd: 'Start focus [minutes]', desc: 'Activates persistent 15-second background distraction killer.' },
        { cmd: 'Disengage focus', desc: 'Releases blacklist shield and outputs summary metrics.' },
        { cmd: 'Open focus protocol', desc: 'Pops up interactive HUD focus widget with live countdown.' }
      ]
    },
    {
      category: 'Doc & Office Synthesis',
      icon: FileText,
      color: 'text-sky-400',
      items: [
        { cmd: 'Forge presentation [topic]', desc: 'Generates structured multi-slide deck with bullet points.' },
        { cmd: 'Forge spreadsheet [topic]', desc: 'Creates CSV / Excel data table and auto-saves to Downloads.' },
        { cmd: 'Open doc forge', desc: 'Opens interactive visual document editor HUD on screen.' }
      ]
    },
    {
      category: 'System & Wallpapers',
      icon: Palette,
      color: 'text-pink-400',
      items: [
        { cmd: 'Set wallpaper [preset]', desc: 'Applies cyber-matrix, tokyo-neon, or quantum-core preset.' },
        { cmd: 'Open wallpaper forge', desc: 'Opens the generative dynamic wallpaper selector widget.' }
      ]
    }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#090d16] border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0d1422] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Nexus Agent Command Reference</h3>
              <p className="text-xs text-slate-400">Complete Voice, Terminal & Macro Protocol Specification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {commands.map((cat, i) => {
            const Icon = cat.icon
            return (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-white/5 pb-1">
                  <Icon className={`w-4 h-4 ${cat.color}`} />
                  <span className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    {cat.category}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cat.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 transition-colors"
                    >
                      <code className="text-xs font-mono font-bold text-cyan-300 block mb-1">
                        "{item.cmd}"
                      </code>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#0d1422] border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Nexus OS Command Protocol v2.1.1</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-bold hover:bg-cyan-400"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  )
}
