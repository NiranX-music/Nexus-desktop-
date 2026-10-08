import { useState, useEffect, useRef, FormEvent } from 'react'
import {
  RiEyeLine,
  RiCrosshairLine,
  RiPlayFill,
  RiStopCircleLine,
  RiRefreshLine,
  RiSettings3Line,
  RiCursorLine,
  RiKeyboardLine,
  RiTerminalBoxLine,
  RiGlobalLine,
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiComputerLine,
  RiCompass3Line,
  RiSearchEyeLine,
  RiTimeLine,
  RiSendPlane2Line,
  RiInformationLine
} from 'react-icons/ri'
import {
  startSkyvernTask,
  stopSkyvernTask,
  getSkyvernStatus,
  executeSkyvernVisualClick,
  getSkyvernConfig,
  saveSkyvernConfig,
  captureScreenPreview,
  SkyvernTaskState,
  SkyvernStep,
  SkyvernTaskMode,
  SkyvernConfig
} from '@renderer/functions/skyvern-agent-api'

const QUICK_TEMPLATES = [
  {
    label: 'Search & Click',
    icon: <RiSearchEyeLine />,
    goal: 'Open browser, search Google for "Skyvern AI browser workflows", and click on the GitHub repository link.'
  },
  {
    label: 'GitHub Star',
    icon: <RiGlobalLine />,
    goal: 'Navigate to https://github.com/Skyvern-AI/skyvern and click the Star repository button.'
  },
  {
    label: 'Form Fill',
    icon: <RiKeyboardLine />,
    goal: 'Locate the text input on screen, click it to focus, type my query, and press Enter to submit.'
  },
  {
    label: 'Visual Click',
    icon: <RiCrosshairLine />,
    goal: 'Find the download button on screen and click it.'
  },
  {
    label: 'Read & Scroll',
    icon: <RiCompass3Line />,
    goal: 'Scroll down through the page to find the documentation section and click Getting Started.'
  }
]

export default function SkyvernScreenStudio() {
  const [goal, setGoal] = useState('')
  const [mode, setMode] = useState<SkyvernTaskMode>('desktop')
  const [startUrl, setStartUrl] = useState('')
  const [taskState, setTaskState] = useState<SkyvernTaskState | null>(null)
  const [steps, setSteps] = useState<SkyvernStep[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [visualClickTarget, setVisualClickTarget] = useState('')
  const [isVisualClicking, setIsVisualClicking] = useState(false)
  const [visualClickMsg, setVisualClickMsg] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<SkyvernConfig>({
    skyvernApiUrl: 'http://localhost:8000',
    geminiModel: 'gemini-3.8-flash',
    maxSteps: 15,
    stepDelayMs: 900,
    smoothMouse: true
  })
  const [screenPreview, setScreenPreview] = useState<string>('')
  const [isCapturingPreview, setIsCapturingPreview] = useState(false)

  const stepsScrollRef = useRef<HTMLDivElement>(null)

  // Listen to live step and task updates from Electron main process
  useEffect(() => {
    getSkyvernConfig().then(setConfig)
    getSkyvernStatus().then((status) => {
      if (status && 'taskId' in status) {
        setTaskState(status)
        setSteps(status.steps || [])
      }
    })

    const handleStepUpdate = (_event: any, step: SkyvernStep) => {
      setSteps((prev) => {
        const next = [...prev, step]
        return next
      })
      if (step.screenshotDataUrl) {
        setScreenPreview(step.screenshotDataUrl)
      }
    }

    const handleTaskUpdate = (_event: any, task: SkyvernTaskState) => {
      setTaskState(task)
      if (task.steps && task.steps.length > 0) {
        setSteps(task.steps)
      }
      if (task.lastScreenshot) {
        setScreenPreview(task.lastScreenshot)
      }
    }

    const removeStepListener = window.electron.ipcRenderer.on('skyvern:step-update', handleStepUpdate)
    const removeTaskListener = window.electron.ipcRenderer.on('skyvern:task-update', handleTaskUpdate)

    return () => {
      removeStepListener?.()
      removeTaskListener?.()
    }
  }, [])

  useEffect(() => {
    stepsScrollRef.current?.scrollTo({ top: stepsScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [steps])

  const handleStartTask = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    const cleanGoal = goal.trim()
    if (!cleanGoal || isStarting || taskState?.status === 'running') return

    setIsStarting(true)
    setSteps([])
    try {
      const state = await startSkyvernTask(cleanGoal, {
        mode,
        startUrl: startUrl.trim() || undefined,
        maxSteps: config.maxSteps
      })
      setTaskState(state)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopTask = async () => {
    await stopSkyvernTask()
    if (taskState) {
      setTaskState({ ...taskState, status: 'cancelled' })
    }
  }

  const handleInstantVisualClick = async (e: FormEvent) => {
    e.preventDefault()
    const target = visualClickTarget.trim()
    if (!target || isVisualClicking) return

    setIsVisualClicking(true)
    setVisualClickMsg('Locating element on screen with vision AI...')
    try {
      const res = await executeSkyvernVisualClick(target)
      setVisualClickMsg(res.message)
      if (res.success) {
        setVisualClickTarget('')
      }
    } catch (err: any) {
      setVisualClickMsg(`Error: ${err?.message || 'Visual click failed'}`)
    } finally {
      setIsVisualClicking(false)
    }
  }

  const handleRefreshPreview = async () => {
    setIsCapturingPreview(true)
    try {
      const res = await captureScreenPreview()
      if (res.dataUrl) setScreenPreview(res.dataUrl)
    } finally {
      setIsCapturingPreview(false)
    }
  }

  const handleSaveConfig = async (newCfg: Partial<SkyvernConfig>) => {
    const updated = await saveSkyvernConfig(newCfg)
    setConfig(updated)
  }

  const isRunning = taskState?.status === 'running'
  const latestStep = steps[steps.length - 1]

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden text-zinc-100">
      {/* Top Banner / Status Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border border-emerald-400/20 bg-black/40 p-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
            <RiEyeLine size={22} className={isRunning ? 'animate-pulse text-emerald-400' : ''} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">
                Nexus Screen Agent
              </h2>
              <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-300">
                Vision Agent
              </span>
            </div>
            <p className="mt-0.5 text-[9px] font-medium text-zinc-400">
              Autonomous computer & browser workflow automation driven by Gemini multimodal vision
            </p>
          </div>
        </div>

        {/* Mode selector and Action Controls */}
        <div className="flex items-center gap-2">
          {/* Target Mode Toggle */}
          <div className="flex rounded-lg border border-white/10 bg-black/50 p-0.5">
            <button
              type="button"
              onClick={() => setMode('desktop')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition ${
                mode === 'desktop'
                  ? 'border border-emerald-400/30 bg-emerald-400/20 text-emerald-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <RiComputerLine /> Desktop OS
            </button>
            <button
              type="button"
              onClick={() => setMode('browser')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition ${
                mode === 'browser'
                  ? 'border border-cyan-400/30 bg-cyan-400/20 text-cyan-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <RiGlobalLine /> Browser Web
            </button>
          </div>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
              isRunning
                ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300 animate-pulse'
                : taskState?.status === 'completed'
                  ? 'border-green-400/40 bg-green-400/15 text-green-300'
                  : taskState?.status === 'failed'
                    ? 'border-red-400/40 bg-red-400/15 text-red-300'
                    : 'border-white/10 bg-white/[0.04] text-zinc-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isRunning
                  ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                  : taskState?.status === 'completed'
                    ? 'bg-green-400'
                    : taskState?.status === 'failed'
                      ? 'bg-red-400'
                      : 'bg-zinc-600'
              }`}
            />
            {isRunning
              ? `Running (${taskState?.currentStep || steps.length}/${config.maxSteps})`
              : taskState?.status || 'Idle'}
          </div>

          {/* Config Button */}
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
            title="Screen Agent Settings"
          >
            <RiSettings3Line />
          </button>
        </div>
      </div>

      {/* Config Drawer / Modal */}
      {showConfig && (
        <div className="shrink-0 rounded-lg border border-white/10 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Screen Engine Configuration
            </span>
            <button
              onClick={() => setShowConfig(false)}
              className="text-zinc-500 hover:text-white"
            >
              <RiCloseLine />
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                Vision LLM Model
              </label>
              <input
                type="text"
                value={config.geminiModel}
                onChange={(e) => handleSaveConfig({ geminiModel: e.target.value })}
                className="mt-1 w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                Skyvern API Endpoint
              </label>
              <input
                type="text"
                value={config.skyvernApiUrl}
                onChange={(e) => handleSaveConfig({ skyvernApiUrl: e.target.value })}
                placeholder="http://localhost:8000"
                className="mt-1 w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                Max Autonomous Steps
              </label>
              <input
                type="number"
                value={config.maxSteps}
                onChange={(e) => handleSaveConfig({ maxSteps: parseInt(e.target.value) || 15 })}
                className="mt-1 w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                Step Settle Delay (ms)
              </label>
              <input
                type="number"
                value={config.stepDelayMs}
                onChange={(e) => handleSaveConfig({ stepDelayMs: parseInt(e.target.value) || 900 })}
                className="mt-1 w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3 overflow-hidden">
        {/* Left Column: Input, Quick Templates, and Step Execution Timeline */}
        <div className="col-span-12 flex min-h-0 flex-col gap-3 lg:col-span-7">
          {/* Goal Input Card */}
          <form
            onSubmit={handleStartTask}
            className="shrink-0 rounded-lg border border-white/10 bg-black/40 p-3 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                Workflow Goal / Directive
              </span>
              {mode === 'browser' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] uppercase tracking-wider text-zinc-500">Start URL:</span>
                  <input
                    type="text"
                    value={startUrl}
                    onChange={(e) => setStartUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-5 rounded border border-white/10 bg-black/60 px-1.5 text-[9px] font-mono text-cyan-300 outline-none focus:border-cyan-400"
                  />
                </div>
              )}
            </div>

            <textarea
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='e.g., "Go to Google, search for weather forecast, click the first link, and summarize"'
              className="w-full resize-none rounded-lg border border-white/10 bg-black/60 p-2.5 text-xs font-medium text-white placeholder-zinc-600 outline-none focus:border-emerald-400/50"
            />

            {/* Quick Template Chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  type="button"
                  onClick={() => setGoal(tmpl.goal)}
                  className="flex items-center gap-1 rounded border border-white/5 bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-zinc-400 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
                >
                  <span className="text-emerald-400">{tmpl.icon}</span>
                  {tmpl.label}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
              <span className="text-[8px] font-medium text-zinc-500">
                Press Launch to engage autonomous vision-guided loop.
              </span>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={handleStopTask}
                    className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-red-200 transition hover:bg-red-400/30"
                  >
                    <RiStopCircleLine size={14} /> Abort Agent
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!goal.trim() || isStarting}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/20 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {isStarting ? (
                      <RiLoader4Line className="animate-spin" size={14} />
                    ) : (
                      <RiPlayFill size={14} />
                    )}
                    Launch Screen Agent
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Quick One-Click Visual Click Tool */}
          <form
            onSubmit={handleInstantVisualClick}
            className="shrink-0 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-xl"
          >
            <RiCrosshairLine className="text-emerald-400 shrink-0" size={16} />
            <input
              type="text"
              value={visualClickTarget}
              onChange={(e) => setVisualClickTarget(e.target.value)}
              placeholder='Instant Visual Click: e.g. "blue login button", "profile avatar", "search input"'
              className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-600 outline-none"
            />
            <button
              type="submit"
              disabled={!visualClickTarget.trim() || isVisualClicking}
              className="flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-400/15 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400 hover:text-black disabled:opacity-30"
            >
              {isVisualClicking ? <RiLoader4Line className="animate-spin" /> : <RiCursorLine />}
              Click Target
            </button>
          </form>
          {visualClickMsg && (
            <p className="shrink-0 px-2 text-[9px] font-mono text-cyan-300/80">{visualClickMsg}</p>
          )}

          {/* Steps Execution Feed */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                Action Execution Feed ({steps.length} Steps)
              </span>
              {isRunning && (
                <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-emerald-400">
                  <RiLoader4Line className="animate-spin" /> Observing screen
                </span>
              )}
            </div>

            <div
              ref={stepsScrollRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-small"
            >
              {steps.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-600">
                  <RiComputerLine size={28} />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    No steps executed yet
                  </p>
                  <p className="max-w-xs text-[9px] text-zinc-600">
                    Define a goal above and click Launch Screen Agent. The vision agent will inspect your screen, determine coordinates, and execute mouse & keyboard actions.
                  </p>
                </div>
              ) : (
                steps.map((st, idx) => (
                  <div
                    key={`${st.timestamp}-${idx}`}
                    className={`rounded-lg border p-2.5 transition ${
                      st.action === 'COMPLETE'
                        ? 'border-green-400/30 bg-green-400/10'
                        : st.action === 'FAIL' || !st.success
                          ? 'border-red-400/30 bg-red-400/10'
                          : 'border-white/5 bg-white/[0.025] hover:border-emerald-400/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-400">
                          Step {st.stepIndex}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                            st.action === 'CLICK' || st.action === 'DOUBLE_CLICK'
                              ? 'bg-emerald-400/20 text-emerald-300'
                              : st.action === 'TYPE'
                                ? 'bg-cyan-400/20 text-cyan-300'
                                : st.action === 'PRESS'
                                  ? 'bg-amber-400/20 text-amber-300'
                                  : st.action === 'SCROLL'
                                    ? 'bg-purple-400/20 text-purple-300'
                                    : st.action === 'COMPLETE'
                                      ? 'bg-green-400/20 text-green-300'
                                      : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {st.action}
                        </span>
                        {st.coordinate && (
                          <span className="text-[8px] font-mono text-zinc-500">
                            ({st.coordinate.x}, {st.coordinate.y})
                          </span>
                        )}
                      </div>
                      <span className="text-[7px] font-mono text-zinc-600">
                        {new Date(st.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-zinc-300">
                      {st.thought}
                    </p>

                    {st.text && (
                      <p className="mt-1 rounded bg-black/40 px-2 py-0.5 text-[9px] font-mono text-cyan-300">
                        typed: "{st.text}"
                      </p>
                    )}

                    {st.error && (
                      <p className="mt-1 text-[8px] font-mono text-red-300">
                        Error: {st.error}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Task completion banner */}
            {taskState?.finalResult && (
              <div className="mt-2.5 shrink-0 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2 text-xs">
                <span className="font-bold text-emerald-300">Final Outcome: </span>
                <span className="text-zinc-200">{taskState.finalResult}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Screen Observer & Coordinate Reticle */}
        <div className="col-span-12 flex min-h-0 flex-col gap-3 lg:col-span-5">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                Visual Screen Observer
              </span>
              <button
                type="button"
                onClick={handleRefreshPreview}
                disabled={isCapturingPreview}
                className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
              >
                <RiRefreshLine className={isCapturingPreview ? 'animate-spin' : ''} /> Capture Now
              </button>
            </div>

            {/* Screen Image with Visual Reticle */}
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-white/5 bg-zinc-950/60">
              {screenPreview ? (
                <div className="relative h-full w-full">
                  <img
                    src={screenPreview}
                    alt="Screen Observation"
                    className="h-full w-full object-contain"
                  />
                  {/* Dynamic Targeting Crosshair / Reticle */}
                  {latestStep?.coordinate && (
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${(latestStep.coordinate.x / 1000) * 100}%`,
                        top: `${(latestStep.coordinate.y / 1000) * 100}%`
                      }}
                    >
                      <div className="relative flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full border-2 border-emerald-400 shadow-[0_0_15px_#34d399] animate-ping" />
                        <div className="absolute h-4 w-4 rounded-full border border-emerald-300 bg-emerald-400/40" />
                        <div className="absolute h-1.5 w-1.5 rounded-full bg-emerald-200" />
                        <span className="absolute top-4 left-4 whitespace-nowrap rounded bg-black/80 px-1 py-0.5 text-[7px] font-mono font-bold text-emerald-300 border border-emerald-400/40">
                          ({latestStep.coordinate.x}, {latestStep.coordinate.y})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-zinc-600">
                  <RiEyeLine size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    No Screen Capture Loaded
                  </p>
                  <p className="text-[9px] text-zinc-600">
                    Click "Capture Now" or launch a Skyvern task to view visual telemetry and target coordinates.
                  </p>
                </div>
              )}
            </div>

            {/* Telemetry info bar */}
            <div className="mt-2.5 shrink-0 grid grid-cols-2 gap-2 text-[9px] font-mono">
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <span className="text-zinc-500 block text-[7px] uppercase tracking-widest font-sans">
                  Active Model
                </span>
                <span className="text-emerald-400 font-bold">{config.geminiModel}</span>
              </div>
              <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                <span className="text-zinc-500 block text-[7px] uppercase tracking-widest font-sans">
                  Latest Action
                </span>
                <span className="text-cyan-400 font-bold">
                  {latestStep ? `${latestStep.action} (Step ${latestStep.stepIndex})` : 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
