import React from 'react'
import { Github, Terminal, Heart, Shield, Cpu, ExternalLink } from 'lucide-react'

export const Footer: React.FC = () => {
  return (
    <footer className="py-14 bg-[#020409] border-t border-white/5 relative z-10 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/5">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#090d16] border border-cyan-500/30 flex items-center justify-center p-1">
              <img src="/logo.svg" alt="Nexus Agent" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight">NEXUS AGENT</span>
              <p className="text-[11px] text-slate-500 font-mono">Autonomous Desktop Operating Layer</p>
            </div>
          </div>

          {/* Quick External Links */}
          <div className="flex flex-wrap items-center gap-6">
            <a
              href="https://github.com/NiranX-music/Nexus-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors flex items-center gap-1.5"
            >
              <Github className="w-4 h-4" />
              <span>Nexus-Agent GitHub</span>
            </a>
            <a
              href="https://github.com/NiranX-music/Nexus-desktop-"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors flex items-center gap-1.5"
            >
              <Terminal className="w-4 h-4" />
              <span>Nexus-desktop- Core</span>
            </a>
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Cloudflare Pages Hosted</span>
            </div>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500">
          <p>
            © 2026 Nexus Agent • Developed by{' '}
            <a
              href="https://github.com/NiranX-music"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white font-medium underline underline-offset-2"
            >
              NiranX
            </a>{' '}
            • Powered by Antigravity & Nexdune.
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Local-First Sovereign AI</span>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
