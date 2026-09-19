import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiCloseLine,
  RiFilePpt2Line,
  RiTableLine,
  RiArrowRightLine,
  RiCheckLine,
  RiDownload2Line,
  RiSparklingFill
} from 'react-icons/ri'
import { forgePresentation, forgeSpreadsheet, SlideItem } from '@renderer/tools/doc-forge-api'

const SLIDE_PRESETS: { title: string; topic: string; slides: SlideItem[] }[] = [
  {
    title: 'Nexus Neural OS 9.1 Architecture',
    topic: 'High-Performance Local-First Desktop Agentic OS',
    slides: [
      {
        title: 'NEXUS NEURAL OS',
        subtitle: 'Next-Generation Autonomous Desktop Computing',
        bullets: [
          'Direct Electron IPC Native Bridge with zero-latency threading',
          'Gemini 3.1 Live API real-time WebRTC audio streaming',
          'Hardware-accelerated Three.js / R3F neural visualization'
        ],
        footer: 'CONFIDENTIAL • FOR ARCHITECT EYES ONLY'
      },
      {
        title: 'CORE SUBSYSTEMS',
        subtitle: 'Decoupled Microservice Topology',
        bullets: [
          'Telekinesis: Coordinate-based OS window teleportation & macros',
          'ScreenPeeler: Sub-pixel rectangular OCR vision grounding',
          'Mobile Bridge: ADB wireless command transport on port 17173'
        ],
        footer: 'NEXUS ENGINE SUBSYSTEMS'
      },
      {
        title: 'PERFORMANCE GUARANTEES',
        subtitle: 'Zero Garbage Collection Stutters',
        bullets: [
          'Memory pre-allocation via useMemo vector lerping',
          'Cap DPR scaling to prevent GPU thermal throttling',
          'Direct Win32 kernel integration for background tasks'
        ],
        footer: 'HARDWARE LEVEL OPTIMIZATIONS'
      }
    ]
  },
  {
    title: 'Q3 Autonomous Agent Fleet Roadmap',
    topic: 'Distributed Agentic Workers & Tool Swarms',
    slides: [
      {
        title: 'FLEET SCALING PROTOCOL',
        subtitle: 'Autonomous Worker Swarms',
        bullets: [
          'Subagent isolation with ephemeral sandbox execution',
          'Bi-directional messaging bus with reactive wakeups',
          'Auto-pruning process lifecycles on task completion'
        ],
        footer: 'AGENT FLEET PROTOCOL'
      },
      {
        title: 'DEPLOYMENT MILESTONES',
        subtitle: 'Desktop & Mobile Convergence',
        bullets: [
          'Nexus Desktop (Electron + Vite) packaged installer',
          'Nexus-X C++/Rust core engine integration',
          'Cross-device clipboard and APK hot-reloading'
        ],
        footer: 'Q3 MILESTONES'
      }
    ]
  }
]

const SPREADSHEET_PRESETS = [
  {
    title: 'Nexus System Telemetry & Latency Matrix',
    columns: [
      { key: 'subsystem', label: 'SUBSYSTEM' },
      { key: 'latency', label: 'LATENCY (MS)' },
      { key: 'memory', label: 'MEM WORKING SET' },
      { key: 'status', label: 'HEALTH STATUS' }
    ],
    rows: [
      { subsystem: 'WebRTC Audio Pipeline', latency: '42ms', memory: '185MB', status: 'OPTIMAL' },
      { subsystem: 'ScreenPeeler Multimodal OCR', latency: '180ms', memory: '92MB', status: 'READY' },
      { subsystem: 'Mobile Command Bridge', latency: '12ms', memory: '48MB', status: 'CONNECTED' },
      { subsystem: 'Permanent Vector Memory', latency: '65ms', memory: '210MB', status: 'INDEXED' },
      { subsystem: 'Deep Research Crawler', latency: '450ms', memory: '320MB', status: 'STANDBY' }
    ]
  },
  {
    title: 'Model Inference & Token Expenditure Q3',
    columns: [
      { key: 'model', label: 'MODEL DEPLOYED' },
      { key: 'requests', label: 'INVOCATIONS' },
      { key: 'avgTokens', label: 'AVG TOKENS/CALL' },
      { key: 'costEfficiency', label: 'COST EFFICIENCY' }
    ],
    rows: [
      { model: 'Gemini 2.5 Flash Live', requests: '14,200', avgTokens: '1,450', costEfficiency: '99.4%' },
      { model: 'Groq Llama-3-70B', requests: '8,950', avgTokens: '820', costEfficiency: '98.8%' },
      { model: 'Tavily Web Search', requests: '3,120', avgTokens: '3,200', costEfficiency: '95.1%' },
      { model: 'Local Face-API MobileNet', requests: '26,400', avgTokens: '0 (LOCAL)', costEfficiency: '100%' }
    ]
  }
]

export default function DocForgeWidget() {
  const [isVisible, setIsVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'presentation' | 'spreadsheet'>('presentation')
  const [selectedSlidePreset, setSelectedSlidePreset] = useState(SLIDE_PRESETS[0])
  const [selectedSheetPreset, setSelectedSheetPreset] = useState(SPREADSHEET_PRESETS[0])
  const [activeSlideIdx, setActiveSlideIdx] = useState(0)
  const [isForging, setIsForging] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsVisible(true)
      if (e.detail?.type === 'spreadsheet') setActiveTab('spreadsheet')
      else setActiveTab('presentation')
    }
    window.addEventListener('show-doc-forge', handleOpen)
    return () => window.removeEventListener('show-doc-forge', handleOpen)
  }, [])

  const handleForgePresentation = async () => {
    setIsForging(true)
    setStatusMsg('FORGING PRESENTATION DECK...')
    const res = await forgePresentation(
      selectedSlidePreset.title,
      selectedSlidePreset.topic,
      selectedSlidePreset.slides,
      true
    )
    setIsForging(false)
    setStatusMsg(res.includes('📊') ? 'PRESENTATION FORGED & LAUNCHED' : 'FORGE FAILED')
    setTimeout(() => setStatusMsg(null), 4000)
  }

  const handleForgeSpreadsheet = async () => {
    setIsForging(true)
    setStatusMsg('FORGING CSV SPREADSHEET...')
    const res = await forgeSpreadsheet(selectedSheetPreset, true)
    setIsForging(false)
    setStatusMsg(res.includes('📈') ? 'SPREADSHEET FORGED & LAUNCHED' : 'FORGE FAILED')
    setTimeout(() => setStatusMsg(null), 4000)
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-9700 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-4xl bg-zinc-950/85 border border-white/10 rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                {activeTab === 'presentation' ? <RiFilePpt2Line size={18} /> : <RiTableLine size={18} />}
              </div>
              <div>
                <h2 className="text-white text-sm font-bold tracking-wide uppercase">
                  Autonomous Document Forge
                </h2>
                <p className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">
                  Instant Slide Decks • Structured Spreadsheets • Direct OS Export
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {statusMsg && (
                <span className="text-[11px] font-mono px-3 py-1 rounded bg-purple-950/60 border border-purple-500/30 text-purple-300 animate-pulse">
                  {statusMsg}
                </span>
              )}
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition"
              >
                <RiCloseLine size={20} />
              </button>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center px-6 pt-4 gap-2">
            <button
              onClick={() => setActiveTab('presentation')}
              className={`px-4 py-2 rounded-lg text-xs font-mono tracking-wider uppercase transition flex items-center gap-2 border ${
                activeTab === 'presentation'
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 font-bold'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <RiFilePpt2Line size={14} />
              Slide Presentations ({SLIDE_PRESETS.length})
            </button>
            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`px-4 py-2 rounded-lg text-xs font-mono tracking-wider uppercase transition flex items-center gap-2 border ${
                activeTab === 'spreadsheet'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <RiTableLine size={14} />
              Data Spreadsheets ({SPREADSHEET_PRESETS.length})
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {activeTab === 'presentation' ? (
              <div className="grid grid-cols-12 gap-6">
                {/* Preset List */}
                <div className="col-span-5 flex flex-col gap-3">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                    Available Presentation Blueprints
                  </span>
                  <div className="flex flex-col gap-2">
                    {SLIDE_PRESETS.map((preset, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSlidePreset(preset)
                          setActiveSlideIdx(0)
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          selectedSlidePreset.title === preset.title
                            ? 'bg-purple-950/40 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                            : 'bg-zinc-900/40 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <h4 className="text-xs font-semibold text-white truncate">{preset.title}</h4>
                        <p className="text-[10px] text-zinc-400 truncate font-sans mt-0.5">{preset.topic}</p>
                        <span className="text-[9px] font-mono text-purple-400 mt-2 block">
                          {preset.slides.length} SLIDES GENERATED
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    disabled={isForging}
                    onClick={handleForgePresentation}
                    className="mt-4 w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.3)] disabled:opacity-50"
                  >
                    <RiDownload2Line size={16} />
                    Forge & Launch Slides (.html)
                  </button>
                </div>

                {/* Live Slide Preview */}
                <div className="col-span-7 flex flex-col justify-between p-6 rounded-xl bg-zinc-900/70 border border-white/10 min-h-[300px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase">
                        SLIDE {activeSlideIdx + 1} OF {selectedSlidePreset.slides.length}
                      </span>
                      <div className="flex gap-1.5">
                        {selectedSlidePreset.slides.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveSlideIdx(i)}
                            className={`w-2.5 h-2.5 rounded-full transition ${
                              activeSlideIdx === i ? 'bg-purple-400 scale-110' : 'bg-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">
                      {selectedSlidePreset.slides[activeSlideIdx].title}
                    </h3>
                    <p className="text-xs text-zinc-400 mb-4 font-sans">
                      {selectedSlidePreset.slides[activeSlideIdx].subtitle}
                    </p>

                    <ul className="space-y-2">
                      {selectedSlidePreset.slides[activeSlideIdx].bullets.map((bullet, bi) => (
                        <li key={bi} className="text-xs text-zinc-300 flex items-center gap-2 font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-zinc-500">
                    <span>{selectedSlidePreset.slides[activeSlideIdx].footer}</span>
                    <span>STANDALONE HTML DECK</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Spreadsheet View */
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-5 flex flex-col gap-3">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                    Spreadsheet Blueprints
                  </span>
                  <div className="flex flex-col gap-2">
                    {SPREADSHEET_PRESETS.map((sheet, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSheetPreset(sheet)}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          selectedSheetPreset.title === sheet.title
                            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                            : 'bg-zinc-900/40 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <h4 className="text-xs font-semibold text-white truncate">{sheet.title}</h4>
                        <span className="text-[9px] font-mono text-emerald-400 mt-2 block">
                          {sheet.rows.length} ROWS • {sheet.columns.length} COLUMNS
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    disabled={isForging}
                    onClick={handleForgeSpreadsheet}
                    className="mt-4 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-50"
                  >
                    <RiDownload2Line size={16} />
                    Forge & Open Spreadsheet (.csv)
                  </button>
                </div>

                {/* Table Data Preview */}
                <div className="col-span-7 flex flex-col p-4 rounded-xl bg-zinc-900/70 border border-white/10 overflow-hidden">
                  <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase mb-3">
                    Structured Data Matrix Preview
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-zinc-400 font-mono text-[10px]">
                          {selectedSheetPreset.columns.map((c) => (
                            <th key={c.key} className="pb-2 px-2 uppercase">{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {selectedSheetPreset.rows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-white/[0.02]">
                            {selectedSheetPreset.columns.map((c) => (
                              <td key={c.key} className="py-2 px-2 text-zinc-300 font-mono text-[11px]">
                                {row[c.key]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
