import React, { useState } from 'react'
import { Download, Monitor, Apple, Terminal, Copy, Check, Sparkles, ShieldCheck } from 'lucide-react'

export const DownloadSection: React.FC = () => {
  const [copied, setCopied] = useState(false)

  const copyCloneCmd = () => {
    navigator.clipboard.writeText('git clone https://github.com/NiranX-music/Nexus-Agent.git\ncd Nexus-Agent\nnpm install\nnpm run dev')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="downloads" className="py-24 relative bg-[#030611] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CROSS-PLATFORM BUILDS</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Deploy Nexus Agent to Your{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Workstation
            </span>
          </h2>
          <p className="text-slate-400 mt-3 text-base sm:text-lg">
            Download pre-packaged production installers or compile from source. Fully signed binaries for
            Windows, macOS, and Linux.
          </p>
        </div>

        {/* Operating System Download Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Windows Card */}
          <div className="p-6 rounded-3xl bg-slate-900/50 border border-cyan-500/40 relative overflow-hidden flex flex-col justify-between shadow-xl shadow-cyan-950/20">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-bold">
              RECOMMENDED
            </div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 mb-4">
                <Monitor className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Windows 10 / 11</h3>
              <p className="text-xs text-slate-400 mt-1">Full Win32 Telekinesis & NutJS Hardware Automation</p>
              <div className="mt-4 space-y-1 text-xs text-slate-300 font-mono">
                <p>• Installer (.exe) — 118 MB</p>
                <p>• Portable Standalone (.zip) — 98 MB</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
              <a
                href="https://github.com/NiranX-music/Nexus-desktop-/releases/download/v2.1.1/nexus-ai-2.1.1-setup.exe"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
              >
                <Download className="w-4 h-4" />
                <span>Download Windows Installer (.exe)</span>
              </a>
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 pt-1">
                <a
                  href="https://github.com/NiranX-music/Nexus-desktop-/releases/download/v2.1.1/Nexus.AI.2.1.1.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Portable .exe
                </a>
                <span>•</span>
                <a
                  href="https://github.com/NiranX-music/Nexus-desktop-/releases/download/v2.1.1/Nexus-AI-2.1.1-Direct-Run.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Direct-Run .zip
                </a>
              </div>
              <span className="text-[10px] font-mono text-slate-500 block text-center">Version 2.1.1 Production Release</span>
            </div>
          </div>

          {/* macOS Card */}
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/5 hover:border-purple-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 mb-4">
                <Apple className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">macOS 12+</h3>
              <p className="text-xs text-slate-400 mt-1">Universal Binary (Apple Silicon M-Series & Intel x64)</p>
              <div className="mt-4 space-y-1 text-xs text-slate-300 font-mono">
                <p>• Apple Silicon DMG — 122 MB</p>
                <p>• Intel x64 DMG — 124 MB</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
              <a
                href="https://github.com/NiranX-music/Nexus-desktop-/releases/tag/v2.1.1"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
              >
                <Download className="w-4 h-4 text-purple-400" />
                <span>Download macOS (.dmg)</span>
              </a>
              <span className="text-[10px] font-mono text-slate-500 block text-center">Apple Notarized</span>
            </div>
          </div>

          {/* Linux Card */}
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300 mb-4">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Linux</h3>
              <p className="text-xs text-slate-400 mt-1">Ubuntu, Debian, Fedora, Arch & Generic X11/Wayland</p>
              <div className="mt-4 space-y-1 text-xs text-slate-300 font-mono">
                <p>• AppImage Portable — 114 MB</p>
                <p>• Debian (.deb) Package — 92 MB</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
              <a
                href="https://github.com/NiranX-music/Nexus-desktop-/releases/tag/v2.1.1"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Linux (.AppImage)</span>
              </a>
              <span className="text-[10px] font-mono text-slate-500 block text-center">GPG Verified</span>
            </div>
          </div>
        </div>

        {/* Developer Quickstart / Clone Block */}
        <div className="max-w-4xl mx-auto rounded-2xl bg-slate-950 border border-white/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono text-cyan-400 font-semibold block uppercase">
              DEVELOPER QUICKSTART (FROM SOURCE)
            </span>
            <code className="text-sm font-mono text-slate-300 block">
              git clone https://github.com/NiranX-music/Nexus-Agent.git
            </code>
          </div>

          <button
            onClick={copyCloneCmd}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-2 transition-all hover:border-cyan-500"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Commands'}</span>
          </button>
        </div>
      </div>
    </section>
  )
}
