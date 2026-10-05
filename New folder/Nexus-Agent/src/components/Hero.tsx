import React, { useState } from 'react'
import {
  Terminal,
  Download,
  Github,
  Play,
  Volume2,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
  Sparkles,
  Key,
  ArrowRight
} from 'lucide-react'

interface HeroProps {
  onScrollToSimulator: () => void
  onOpenDocs: () => void
  onOpenAuthBridge: () => void
}

export const Hero: React.FC<HeroProps> = ({ onScrollToSimulator, onOpenDocs, onOpenAuthBridge }) => {
  const [activeVoicePrompt, setActiveVoicePrompt] = useState(
    'Hey Nexus, organize my dual displays, start 45m deep focus, and forge a slide deck on Quantum Computing.'
  )

  return (
    <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
      {/* Radial Gradient Glow in background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-cyan-600/20 via-sky-500/10 to-purple-600/20 blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Pill Announcement Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-xs text-slate-300 mb-8 backdrop-blur-xl shadow-lg shadow-cyan-950/20 hover:border-cyan-500/60 transition-all cursor-pointer">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-mono text-cyan-300 font-semibold tracking-wide">NEXUS AGENT v2.1.1</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-medium">Bidi Voice AI • Ghost OS Automation • Deep Focus Shield</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            The Autonomous{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent glow-text-cyan">
              Desktop Operating
            </span>{' '}
            Layer
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 font-normal leading-relaxed">
            Nexus Agent turns your computer into an intelligent, voice-first autonomous workstation.
            Control desktop windows via <span className="text-cyan-400 font-medium">Telekinesis</span>, run automated <span className="text-purple-400 font-medium">Ghost Sequences</span>, synthesis documents on the fly, and shield deep work with zero cloud friction.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <button
              onClick={onScrollToSimulator}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-300 to-teal-300 text-slate-950 font-bold text-base shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5"
            >
              <Sparkles className="w-5 h-5 text-slate-950" />
              <span>Launch Live Simulator</span>
            </button>

            <a
              href="#downloads"
              className="px-7 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-cyan-500/40 text-slate-100 font-semibold text-base transition-all flex items-center gap-2.5 shadow-lg"
            >
              <Download className="w-5 h-5 text-cyan-400" />
              <span>Download Desktop Client</span>
            </a>

            <button
              onClick={onOpenAuthBridge}
              className="px-6 py-3.5 rounded-2xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/50 text-cyan-300 font-bold text-base transition-all flex items-center gap-2 shadow-lg shadow-cyan-950/40"
            >
              <Key className="w-5 h-5 text-cyan-400" />
              <span>Pair Desktop App (Bridge)</span>
            </button>

            <a
              href="https://github.com/NiranX-music/Nexus-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white font-medium text-base transition-all flex items-center gap-2"
            >
              <Github className="w-5 h-5" />
              <span>GitHub</span>
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-14 text-left">
            <div className="glass-panel p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase mb-1">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Voice Latency</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">&lt;65ms</div>
              <p className="text-xs text-slate-400 mt-0.5">Gemini Live Bidi audio streaming</p>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase mb-1">
                <Zap className="w-3.5 h-3.5" />
                <span>OS Execution</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">NutJS Native</div>
              <p className="text-xs text-slate-400 mt-0.5">Direct window & input telemetry</p>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Security</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">Zero-Leak</div>
              <p className="text-xs text-slate-400 mt-0.5">Local Bcrypt + Supabase optional</p>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-sky-400 text-xs font-mono uppercase mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Extensibility</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">MCP Ready</div>
              <p className="text-xs text-slate-400 mt-0.5">Model Context Protocol tools</p>
            </div>
          </div>
        </div>

        {/* Hero Interactive Terminal & HUD Preview */}
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-3xl p-1 bg-gradient-to-b from-cyan-500/30 via-slate-700/20 to-purple-600/30 shadow-2xl shadow-cyan-950/40">
            <div className="rounded-[22px] bg-[#070b13] border border-white/10 overflow-hidden">
              {/* Window Title Bar */}
              <div className="px-4 py-3 bg-[#0c121e] border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
                  <span className="text-xs font-mono text-slate-400 ml-2">nexus-agent-daemon // live-session</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    WEBSOCKET CONNECTED
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">PORT 9100</span>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="p-6 font-mono text-sm space-y-4">
                <div className="flex items-start gap-3 text-slate-400">
                  <span className="text-cyan-400 font-bold">$</span>
                  <div className="space-y-1">
                    <p className="text-slate-200">nexus --daemon --listen-voice --enable-telekinesis</p>
                    <p className="text-xs text-slate-500">[INIT] Kernel booted in 12ms. Native Telekinesis Win32 hooks initialized.</p>
                  </div>
                </div>

                {/* Voice Input Preview */}
                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-cyan-400 font-semibold block">
                        Bidirectional Voice Stream [Inbound]
                      </span>
                      <span className="text-slate-200 text-xs sm:text-sm">"{activeVoicePrompt}"</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                    <span>STATUS: 200 OK</span>
                  </div>
                </div>

                {/* Agent Execution Plan Output */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>[AGENT EXECUTION] Plan synthesized with 3 autonomous operations:</span>
                  </div>
                  <div className="pl-4 space-y-1.5 border-l-2 border-slate-800 text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">1. telekinesis_tile_windows(layout="dual-monitor-grid", snap=true)</span>
                      <span className="text-emerald-400 font-bold">✓ Executed (14ms)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">2. focus_protocol_start(minutes=45, blacklist=["discord","steam","twitter"])</span>
                      <span className="text-emerald-400 font-bold">✓ Distraction Shield Active</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">3. doc_forge_presentation(topic="Quantum Computing", slides=8, format="pptx")</span>
                      <span className="text-cyan-400 font-bold">⚡ Generating Slides...</span>
                    </div>
                  </div>
                </div>

                {/* Footer simulation button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={onScrollToSimulator}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <span>Open full interactive simulator</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
