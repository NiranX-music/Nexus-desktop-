import React, { useState, useEffect } from 'react'
import {
  Mic,
  MicOff,
  LayoutGrid,
  Zap,
  FileText,
  Shield,
  Palette,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Sparkles,
  Maximize2,
  Sliders,
  ChevronRight,
  FolderDown,
  Monitor,
  Eye,
  Terminal,
  Send
} from 'lucide-react'

type TabType = 'voice' | 'telekinesis' | 'ghost' | 'doc_forge' | 'focus' | 'wallpaper'

export const AgentPlayground: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('voice')
  const [commandInput, setCommandInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] Nexus Agent Runtime 2.1.1 online.',
    '[READY] Voice Bidi WebSocket connected (PCM 24kHz).',
    '[READY] Telekinesis Win32 & Ghost Sequence automation active.'
  ])

  // --- Voice Tab State ---
  const [isListening, setIsListening] = useState(false)
  const [audioBars, setAudioBars] = useState<number[]>([12, 24, 45, 80, 50, 30, 60, 90, 40, 20, 15, 35])
  const [voiceTranscript, setVoiceTranscript] = useState(
    'Nexus, arrange my screen for coding and start a 30-minute focus session.'
  )

  useEffect(() => {
    let interval: any
    if (isListening) {
      interval = setInterval(() => {
        setAudioBars(Array.from({ length: 16 }, () => Math.floor(Math.random() * 85) + 10))
      }, 90)
    } else {
      setAudioBars([10, 15, 25, 35, 20, 15, 12, 10, 14, 18, 22, 15, 10, 8, 12, 10])
    }
    return () => clearInterval(interval)
  }, [isListening])

  // --- Telekinesis State ---
  const [windowLayout, setWindowLayout] = useState<'grid' | 'split' | 'focus'>('grid')

  // --- Ghost Sequence State ---
  const [ghostStep, setGhostStep] = useState(0)
  const [ghostRunning, setGhostRunning] = useState(false)

  const runGhostSequence = () => {
    setGhostRunning(true)
    setGhostStep(1)
    setTimeout(() => setGhostStep(2), 800)
    setTimeout(() => setGhostStep(3), 1600)
    setTimeout(() => setGhostStep(4), 2400)
    setTimeout(() => {
      setGhostStep(5)
      setGhostRunning(false)
      addLog('[GHOST] Autonomous macro completed in 2.4 seconds.')
    }, 3200)
  }

  // --- Doc Forge State ---
  const [slideIndex, setSlideIndex] = useState(0)
  const slides = [
    {
      title: 'Quantum Advantage in 2026',
      sub: 'Scaling Beyond Classical Supercomputing',
      bullets: [
        'Fault-tolerant logical qubits demonstrated at scale',
        'Hybrid quantum-classical algorithmic acceleration',
        'Direct integration with autonomous agent workflows'
      ]
    },
    {
      title: 'Decentralized Neural Architecture',
      sub: 'Local-First Sovereign AI Agents',
      bullets: [
        'Zero cloud leakage: Bcrypt encrypted local vault',
        'Sub-70ms streaming bidirectional speech models',
        'Direct NutJS operating system hardware bindings'
      ]
    },
    {
      title: 'Automated Desktop Telekinesis',
      sub: 'Spatial OS Window Coordination',
      bullets: [
        'Multi-monitor window teleportation without fixed pixels',
        'Native Win32 PowerShell fallbacks for 100% portability',
        'Context-aware workspace auto-tiling'
      ]
    }
  ]

  // --- Focus Protocol State ---
  const [focusSeconds, setFocusSeconds] = useState(1500)
  const [focusActive, setFocusActive] = useState(false)
  const [blockedCount, setBlockedCount] = useState(3)

  useEffect(() => {
    let timer: any
    if (focusActive && focusSeconds > 0) {
      timer = setInterval(() => setFocusSeconds((s) => s - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [focusActive, focusSeconds])

  // --- Wallpaper Forge State ---
  const [wallpaperPreset, setWallpaperPreset] = useState<'matrix' | 'tokyo' | 'quantum'>('matrix')

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-7), msg])
  }

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commandInput.trim()) return

    const cmd = commandInput.trim()
    setCommandInput('')
    setIsProcessing(true)
    addLog(`[COMMAND] > ${cmd}`)

    setTimeout(() => {
      setIsProcessing(false)
      if (cmd.toLowerCase().includes('focus')) {
        setActiveTab('focus')
        setFocusActive(true)
        addLog('[ACTION] Deep Work Focus Protocol activated for 25 minutes.')
      } else if (cmd.toLowerCase().includes('tile') || cmd.toLowerCase().includes('window')) {
        setActiveTab('telekinesis')
        setWindowLayout('grid')
        addLog('[ACTION] Telekinesis tiled 4 windows in balanced 2x2 grid.')
      } else if (cmd.toLowerCase().includes('slide') || cmd.toLowerCase().includes('deck') || cmd.toLowerCase().includes('doc')) {
        setActiveTab('doc_forge')
        addLog('[ACTION] Doc Forge created Quantum Advantage presentation.')
      } else if (cmd.toLowerCase().includes('wallpaper')) {
        setActiveTab('wallpaper')
        addLog('[ACTION] Wallpaper Forge engaged procedural cyber canvas.')
      } else if (cmd.toLowerCase().includes('ghost') || cmd.toLowerCase().includes('auto')) {
        setActiveTab('ghost')
        runGhostSequence()
      } else {
        addLog(`[AGENT RESPONSE] Plan executed successfully. Nexus operating smoothly.`)
      }
    }, 600)
  }

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <section id="simulator" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>INTERACTIVE BROWSER SANDBOX</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Experience{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Nexus Agent Live
            </span>
          </h2>
          <p className="text-slate-400 mt-3 text-base sm:text-lg">
            Interact with the core subsystems below. Test real voice streaming, window telekinesis,
            ghost automation, and deep work shielding right inside your browser.
          </p>
        </div>

        {/* Main Simulator Container */}
        <div className="rounded-3xl border border-white/10 bg-[#070b13]/90 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl overflow-hidden">
          {/* Top Control Bar with Subsystem Tabs */}
          <div className="border-b border-white/10 bg-[#0c121e]/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveTab('voice')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'voice'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Mic className="w-4 h-4 text-cyan-400" />
                <span>Voice Bidi AI</span>
              </button>

              <button
                onClick={() => setActiveTab('telekinesis')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'telekinesis'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-4 h-4 text-purple-400" />
                <span>Telekinesis Windows</span>
              </button>

              <button
                onClick={() => setActiveTab('ghost')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'ghost'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Zap className="w-4 h-4 text-teal-400" />
                <span>Ghost Sequences</span>
              </button>

              <button
                onClick={() => setActiveTab('doc_forge')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'doc_forge'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <FileText className="w-4 h-4 text-sky-400" />
                <span>Doc & Office Forge</span>
              </button>

              <button
                onClick={() => setActiveTab('focus')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'focus'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Focus Protocol</span>
              </button>

              <button
                onClick={() => setActiveTab('wallpaper')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'wallpaper'
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Palette className="w-4 h-4 text-pink-400" />
                <span>Wallpaper Forge</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>SIMULATOR LIVE</span>
            </div>
          </div>

          {/* Interactive Playground Canvas Area */}
          <div className="p-6 sm:p-8 min-h-[460px] flex flex-col justify-between">
            {/* TAB 1: VOICE BIDI AI */}
            {activeTab === 'voice' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-[#0e1626] border border-cyan-500/20">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        const next = !isListening
                        setIsListening(next)
                        if (next) addLog('[VOICE] Inbound stream activated. Listening to microphone...')
                        else addLog('[VOICE] Stream closed.')
                      }}
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                        isListening
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/20 hover:scale-105'
                      }`}
                    >
                      {isListening ? <MicOff className="w-6 h-6 animate-pulse" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <div>
                      <h4 className="text-white font-bold text-base">Gemini Live Bidi Voice Stream</h4>
                      <p className="text-xs text-slate-400">
                        {isListening ? 'Streaming live audio (PCM 24kHz) • Speak naturally' : 'Click microphone to test voice recognition stream'}
                      </p>
                    </div>
                  </div>

                  {/* Frequency Visualizer Bars */}
                  <div className="flex items-end gap-1.5 h-12 px-4 py-2 bg-black/40 rounded-xl border border-white/5">
                    {audioBars.map((h, i) => (
                      <div
                        key={i}
                        className={`w-1.5 rounded-full transition-all duration-75 ${
                          isListening ? 'bg-gradient-to-t from-cyan-500 to-sky-300' : 'bg-slate-700'
                        }`}
                        style={{ height: `${Math.max(h, 8)}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Sample Prompt Chips */}
                <div>
                  <span className="text-xs font-mono uppercase text-slate-400 mb-2 block font-semibold">
                    Simulate Quick Voice Commands:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Nexus, arrange my screen in 2x2 grid',
                      'Start 30-minute deep work session',
                      'Forge a presentation on Autonomous AI Agents',
                      'Set desktop wallpaper to cyber matrix',
                      'Automate daily standup update sequence'
                    ].map((p, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setVoiceTranscript(p)
                          setCommandInput(p)
                          addLog(`[VOICE RECOGNIZED] "${p}"`)
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs text-slate-300 hover:text-cyan-300 transition-colors"
                      >
                        "{p}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Transcript Box */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/10 font-mono text-sm space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>LIVE RECOGNITION BUFFER</span>
                    <span className="text-cyan-400">CONFIDENCE: 99.4%</span>
                  </div>
                  <p className="text-cyan-200">"{voiceTranscript}"</p>
                </div>
              </div>
            )}

            {/* TAB 2: TELEKINESIS WINDOWS */}
            {activeTab === 'telekinesis' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-base">Spatial Window Telekinesis</h4>
                    <p className="text-xs text-slate-400">
                      Snap, arrange, and manage operating system windows without coordinate brittleness.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWindowLayout('grid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        windowLayout === 'grid' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      2x2 Grid
                    </button>
                    <button
                      onClick={() => setWindowLayout('split')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        windowLayout === 'split' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      70/30 Split
                    </button>
                    <button
                      onClick={() => setWindowLayout('focus')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        windowLayout === 'focus' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Full Center
                    </button>
                  </div>
                </div>

                {/* Virtual Display Preview */}
                <div className="p-4 rounded-2xl bg-[#02050c] border border-purple-500/30 h-64 relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-mono text-purple-400 border-b border-purple-500/20 pb-2">
                    <span>VIRTUAL DISPLAY [1920x1080 @ 144Hz]</span>
                    <span>NATIVE WIN32 POWER-SHELL HOOKS</span>
                  </div>

                  {/* Window Boxes depending on layout */}
                  {windowLayout === 'grid' && (
                    <div className="grid grid-cols-2 grid-rows-2 gap-3 h-48 py-1">
                      <div className="rounded-lg bg-slate-900/90 border border-cyan-500/40 p-2.5 flex flex-col justify-between">
                        <span className="text-[11px] font-mono text-cyan-300">VSCode: /Nexus-Agent</span>
                        <span className="text-[10px] text-slate-500 font-mono">PID: 1042 • 50% x 50%</span>
                      </div>
                      <div className="rounded-lg bg-slate-900/90 border border-purple-500/40 p-2.5 flex flex-col justify-between">
                        <span className="text-[11px] font-mono text-purple-300">Chrome: Agent Hub</span>
                        <span className="text-[10px] text-slate-500 font-mono">PID: 8840 • 50% x 50%</span>
                      </div>
                      <div className="rounded-lg bg-slate-900/90 border border-emerald-500/40 p-2.5 flex flex-col justify-between">
                        <span className="text-[11px] font-mono text-emerald-300">PowerShell: Kernel</span>
                        <span className="text-[10px] text-slate-500 font-mono">PID: 1420 • 50% x 50%</span>
                      </div>
                      <div className="rounded-lg bg-slate-900/90 border border-amber-500/40 p-2.5 flex flex-col justify-between">
                        <span className="text-[11px] font-mono text-amber-300">Spotify: Synthwave</span>
                        <span className="text-[10px] text-slate-500 font-mono">PID: 9231 • 50% x 50%</span>
                      </div>
                    </div>
                  )}

                  {windowLayout === 'split' && (
                    <div className="grid grid-cols-3 gap-3 h-48 py-1">
                      <div className="col-span-2 rounded-lg bg-slate-900/90 border border-cyan-500/40 p-3 flex flex-col justify-between">
                        <span className="text-xs font-mono text-cyan-300">Primary Workspace: VSCode</span>
                        <span className="text-[10px] text-slate-500 font-mono">Width: 67% • Priority: HIGH</span>
                      </div>
                      <div className="col-span-1 rounded-lg bg-slate-900/90 border border-purple-500/40 p-3 flex flex-col justify-between">
                        <span className="text-xs font-mono text-purple-300">Reference: Chrome Docs</span>
                        <span className="text-[10px] text-slate-500 font-mono">Width: 33% • Snap Right</span>
                      </div>
                    </div>
                  )}

                  {windowLayout === 'focus' && (
                    <div className="h-48 py-1 flex items-center justify-center">
                      <div className="w-4/5 h-full rounded-xl bg-slate-900 border border-purple-500/60 p-4 flex flex-col justify-between shadow-xl shadow-purple-500/10">
                        <span className="text-sm font-mono text-purple-200">Full Focus Mode: Terminal & IDE</span>
                        <span className="text-xs text-slate-400">All background non-essential windows minimized.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: GHOST SEQUENCES */}
            {activeTab === 'ghost' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-base">Ghost Sequence Desktop Automation</h4>
                    <p className="text-xs text-slate-400">
                      NutJS keyboard, mouse, and process execution pipeline with zero latency.
                    </p>
                  </div>
                  <button
                    onClick={runGhostSequence}
                    disabled={ghostRunning}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 text-black font-bold text-xs flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{ghostRunning ? 'Executing...' : 'Run Macro Sequence'}</span>
                  </button>
                </div>

                {/* Steps Timeline */}
                <div className="space-y-3">
                  {[
                    { title: 'Launch Target Workspace & Open Terminal', desc: 'exec("code . && wt")' },
                    { title: 'Focus Terminal Window & Send Git Sync', desc: 'nutjs.keyTap("enter", "git pull --rebase")' },
                    { title: 'Check Active Production Port 3000', desc: 'curl -s localhost:3000/health' },
                    { title: 'Trigger Audio Ping & Toast Notification', desc: 'system_toast("Workspace Ready")' }
                  ].map((s, idx) => {
                    const stepNum = idx + 1
                    const isDone = ghostStep > stepNum
                    const isCurrent = ghostStep === stepNum
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          isDone
                            ? 'bg-teal-950/20 border-teal-500/40 text-teal-200'
                            : isCurrent
                            ? 'bg-cyan-950/40 border-cyan-400 text-white animate-pulse'
                            : 'bg-black/30 border-white/5 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isDone
                                ? 'bg-teal-500 text-black'
                                : isCurrent
                                ? 'bg-cyan-400 text-black'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {stepNum}
                          </span>
                          <div>
                            <span className="text-xs font-semibold block">{s.title}</span>
                            <span className="text-[10px] font-mono opacity-80">{s.desc}</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono">
                          {isDone ? 'COMPLETED' : isCurrent ? 'RUNNING...' : 'WAITING'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: DOC FORGE */}
            {activeTab === 'doc_forge' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-base">Doc & Office Forge Subsystem</h4>
                    <p className="text-xs text-slate-400">
                      Synthesize structured presentation decks and spreadsheets directly from voice or text.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                      disabled={slideIndex === 0}
                      className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300 disabled:opacity-30"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-mono text-slate-400">
                      Slide {slideIndex + 1} / {slides.length}
                    </span>
                    <button
                      onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                      disabled={slideIndex === slides.length - 1}
                      className="px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300 disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Presentation Card Preview */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0b1322] to-[#040810] border border-sky-500/30 shadow-xl min-h-[200px] flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-500/30">
                      PRESENTATION SLIDE • PPTX / PDF
                    </span>
                    <h3 className="text-xl font-bold text-white mt-2">{slides[slideIndex].title}</h3>
                    <p className="text-xs text-sky-300 font-mono mt-0.5">{slides[slideIndex].sub}</p>
                    <ul className="mt-4 space-y-2">
                      {slides[slideIndex].bullets.map((b, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Generated in 820ms via Nexus Forge</span>
                    <button
                      onClick={() => addLog('[DOWNLOAD] Presentation saved to Downloads/quantum-2026.pptx')}
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                      <span>Download Sample Deck</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: FOCUS PROTOCOL */}
            {activeTab === 'focus' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-base">Deep Work Focus Protocol</h4>
                    <p className="text-xs text-slate-400">
                      Continuous background process shield terminating distracting gaming & social apps.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !focusActive
                      setFocusActive(next)
                      if (next) addLog('[FOCUS] Shield engaged. Continuous process termination active.')
                      else addLog('[FOCUS] Shield released.')
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      focusActive
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-emerald-500 text-black hover:bg-emerald-400'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>{focusActive ? 'Disengage Shield' : 'Engage Focus Shield'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-[#09151c] border border-emerald-500/30 flex flex-col items-center justify-center">
                    <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">REMAINING FOCUS</span>
                    <div className="text-4xl font-extrabold text-white font-mono my-2">
                      {formatTimer(focusSeconds)}
                    </div>
                    <span className="text-[11px] text-slate-400">Auto-terminates distracting processes</span>
                  </div>

                  <div className="md:col-span-2 p-5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                      Shield Telemetry & Blacklist Rules
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Active Shield Interval</span>
                        <span className="text-emerald-400 font-mono font-bold">15-Second Loop</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Distractions Terminated</span>
                        <span className="text-emerald-400 font-mono font-bold">{blockedCount} apps purged</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Blacklist: discord.exe, steam.exe, epicgames.exe, riotclient.exe, spotify.exe
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: WALLPAPER FORGE */}
            {activeTab === 'wallpaper' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-bold text-base">Wallpaper Engine & Forge</h4>
                    <p className="text-xs text-slate-400">
                      Procedural cyberpunk desktop canvases with direct OS wallpaper synchronization.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWallpaperPreset('matrix')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wallpaperPreset === 'matrix' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Cyber Matrix
                    </button>
                    <button
                      onClick={() => setWallpaperPreset('tokyo')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wallpaperPreset === 'tokyo' ? 'bg-pink-500 text-black' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Tokyo Neon
                    </button>
                    <button
                      onClick={() => setWallpaperPreset('quantum')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wallpaperPreset === 'quantum' ? 'bg-purple-500 text-black' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Quantum Core
                    </button>
                  </div>
                </div>

                <div
                  className={`h-56 rounded-2xl border p-5 flex flex-col justify-between transition-all duration-500 ${
                    wallpaperPreset === 'matrix'
                      ? 'bg-gradient-to-tr from-cyan-950 via-slate-950 to-teal-900 border-cyan-500/40'
                      : wallpaperPreset === 'tokyo'
                      ? 'bg-gradient-to-tr from-purple-950 via-slate-950 to-pink-900 border-pink-500/40'
                      : 'bg-gradient-to-tr from-indigo-950 via-slate-950 to-violet-900 border-purple-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                      {wallpaperPreset === 'matrix'
                        ? 'CYBER-MATRIX PRESET'
                        : wallpaperPreset === 'tokyo'
                        ? 'TOKYO-NEON PRESET'
                        : 'QUANTUM-CORE PRESET'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 text-slate-300">
                      4K UHD 3840x2160
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-300 font-mono">
                      Cross-platform OS wallpaper setter (Win32 PowerShell, macOS AppleScript, Linux gsettings).
                    </p>
                    <button
                      onClick={() => addLog(`[WALLPAPER] Applied preset ${wallpaperPreset} to host desktop.`)}
                      className="px-3.5 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-slate-200 transition-colors"
                    >
                      Apply Wallpaper
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Live System Log Terminal */}
            <div className="mt-8 pt-4 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>NEXUS TELEMETRY LOG</span>
                </div>
                <button
                  onClick={() => setLogs(['[RESET] Telemetry log buffer cleared.'])}
                  className="hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="p-3 rounded-xl bg-black/60 border border-white/5 font-mono text-xs space-y-1 max-h-28 overflow-y-auto">
                {logs.map((l, i) => (
                  <div key={i} className="text-slate-300">
                    {l}
                  </div>
                ))}
              </div>

              {/* Command Input Bar */}
              <form onSubmit={handleCommandSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    placeholder="Type command (e.g. 'start focus 45', 'tile windows', 'forge presentation Quantum')..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 focus:border-cyan-400 focus:outline-none text-xs sm:text-sm text-white placeholder-slate-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-bold text-xs sm:text-sm flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Dispatch</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
