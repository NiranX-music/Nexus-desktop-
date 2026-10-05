import React, { useState, useEffect } from 'react'
import { Terminal, Github, Cpu, Download, BookOpen, Sparkles, Menu, X, Key, ShieldCheck } from 'lucide-react'

interface NavbarProps {
  onOpenDocs: () => void
  onScrollToSimulator: () => void
  onOpenAuthBridge: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenDocs, onScrollToSimulator, onOpenAuthBridge }) => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#030712]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-cyan-950/20 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-10 h-10 rounded-xl bg-[#090d16] border border-cyan-500/30 flex items-center justify-center p-1.5">
                <img src="/logo.svg" alt="Nexus Agent" className="w-full h-full object-contain" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
                  NEXUS AGENT
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold tracking-wider">
                  OS v2.1.1
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 tracking-wider hidden sm:block">
                AUTONOMOUS DESKTOP COMMAND LAYER
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <button
              onClick={onScrollToSimulator}
              className="hover:text-cyan-400 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Simulator
            </button>
            <a href="#features" className="hover:text-cyan-400 transition-colors">
              Features
            </a>
            <a href="#architecture" className="hover:text-cyan-400 transition-colors">
              Architecture
            </a>
            <button
              onClick={onOpenDocs}
              className="hover:text-cyan-400 transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4 text-purple-400" />
              Command Docs
            </button>
            <a href="#downloads" className="hover:text-cyan-400 transition-colors">
              Downloads
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {/* System Online Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute"></span>
              <span>CORE ACTIVE</span>
            </div>

            {/* Web Bridge & Auth Button */}
            <button
              onClick={onOpenAuthBridge}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-sm font-semibold text-cyan-300 transition-all shadow-sm shadow-cyan-950/40"
            >
              <Key className="w-4 h-4 text-cyan-400" />
              <span>Web Bridge</span>
            </button>

            {/* GitHub Repo Link */}
            <a
              href="https://github.com/NiranX-music/Nexus-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-sm font-medium text-slate-200 transition-all hover:border-slate-500"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>

            {/* Launch / Download Primary CTA */}
            <button
              onClick={onScrollToSimulator}
              className="relative group overflow-hidden px-4 py-2 rounded-xl text-sm font-semibold text-black transition duration-300"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-sky-300 to-teal-300 group-hover:scale-105 transition-transform duration-300"></span>
              <span className="relative flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span>Launch Agent</span>
              </span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 px-4 py-5 bg-[#090d16]/95 backdrop-blur-2xl border-b border-white/10 space-y-4">
          <button
            onClick={() => {
              onScrollToSimulator()
              setMobileMenuOpen(false)
            }}
            className="w-full text-left py-2 text-cyan-400 font-medium flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Simulator
          </button>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 hover:text-white font-medium"
          >
            Features
          </a>
          <a
            href="#architecture"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 hover:text-white font-medium"
          >
            Architecture
          </a>
          <button
            onClick={() => {
              onOpenDocs()
              setMobileMenuOpen(false)
            }}
            className="w-full text-left py-2 text-purple-400 font-medium flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" /> Command Docs
          </button>
          <a
            href="#downloads"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 hover:text-white font-medium"
          >
            Downloads
          </a>
          <button
            onClick={() => {
              onOpenAuthBridge()
              setMobileMenuOpen(false)
            }}
            className="w-full text-left py-2 text-cyan-300 font-medium flex items-center gap-2"
          >
            <Key className="w-4 h-4" /> Web Bridge & Authentication
          </button>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="https://github.com/NiranX-music/Nexus-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm font-medium"
            >
              <Github className="w-4 h-4" /> View GitHub Repo
            </a>
            <button
              onClick={() => {
                onScrollToSimulator()
                setMobileMenuOpen(false)
              }}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4" /> Launch Interactive Agent
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
