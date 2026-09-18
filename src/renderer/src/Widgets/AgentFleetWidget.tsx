import { useState, useEffect } from 'react'
import {
  RiRobot2Line,
  RiRadarLine,
  RiCodeSSlashLine,
  RiShieldCheckLine,
  RiPlayCircleLine,
  RiCloseLine,
  RiTerminalBoxLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiDeleteBinLine
} from 'react-icons/ri'
import {
  FleetAgentState,
  AgentRole,
  getFleetStatus,
  dispatchFleetTask,
  onFleetStatusUpdate,
  onFleetTaskComplete
} from '../services/agent-fleet-api'

const AGENT_ICONS: Record<AgentRole, any> = {
  recon_scout: RiRadarLine,
  code_architect: RiCodeSSlashLine,
  system_janitor: RiDeleteBinLine,
  sentry_watcher: RiShieldCheckLine
}

export default function AgentFleetWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [agents, setAgents] = useState<FleetAgentState[]>([])
  const [expandedAgent, setExpandedAgent] = useState<AgentRole | null>(null)
  const [manualPrompt, setManualPrompt] = useState('')
  const [selectedRole, setSelectedRole] = useState<AgentRole>('recon_scout')
  const [isDispatching, setIsDispatching] = useState(false)

  useEffect(() => {
    getFleetStatus().then(setAgents).catch(() => {})

    const unsubUpdate = onFleetStatusUpdate((updated) => setAgents(updated))
    const unsubComplete = onFleetTaskComplete((_res) => {
      getFleetStatus().then(setAgents).catch(() => {})
    })

    const handleToggle = (e: any) => {
      if (e.detail?.open !== undefined) setIsOpen(e.detail.open)
      else setIsOpen((prev) => !prev)
    }
    window.addEventListener('nexus-toggle-fleet-widget', handleToggle)

    return () => {
      unsubUpdate()
      unsubComplete()
      window.removeEventListener('nexus-toggle-fleet-widget', handleToggle)
    }
  }, [])

  const runningCount = agents.filter((a) => a.status === 'running').length

  const handleDispatch = async () => {
    if (!manualPrompt.trim()) return
    setIsDispatching(true)
    try {
      await dispatchFleetTask(selectedRole, manualPrompt.trim())
      setManualPrompt('')
    } finally {
      setIsDispatching(false)
    }
  }

  return (
    <>
      {/* Floating Minimized Pill Trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/80 border border-emerald-500/30 text-emerald-400 font-mono text-xs shadow-[0_0_20px_rgba(52,211,153,0.15)] hover:border-emerald-400 hover:scale-105 transition-all backdrop-blur-xl cursor-pointer"
        >
          <RiRobot2Line className={runningCount > 0 ? 'animate-bounce text-emerald-300' : ''} />
          <span className="tracking-widest uppercase font-bold text-[11px]">Fleet</span>
          {runningCount > 0 && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>
      )}

      {/* Expanded Fleet Command Center */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-black/90 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <RiRobot2Line size={16} />
              </div>
              <div>
                <h4 className="text-xs font-mono font-bold tracking-widest uppercase text-white">
                  Nexus Agent Fleet
                </h4>
                <p className="text-[10px] font-mono text-zinc-400">
                  {runningCount} Active Unit{runningCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white transition-colors p-1"
            >
              <RiCloseLine size={18} />
            </button>
          </div>

          {/* Agent Cards List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-small">
            {agents.map((agent) => {
              const Icon = AGENT_ICONS[agent.role] || RiRobot2Line
              const isExpanded = expandedAgent === agent.role
              const isRunning = agent.status === 'running'

              return (
                <div
                  key={agent.role}
                  className="rounded-xl border border-white/5 bg-zinc-950/70 p-3 space-y-2 transition-all hover:border-white/15"
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.role)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-1.5 rounded-lg border text-sm ${
                          isRunning
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 animate-pulse'
                            : agent.status === 'completed'
                              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                              : 'bg-zinc-900 border-white/5 text-zinc-400'
                        }`}
                      >
                        <Icon />
                      </div>
                      <div>
                        <span className="text-xs font-mono font-semibold text-zinc-100 block">
                          {agent.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono block">
                          {agent.title}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${
                          isRunning
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : agent.status === 'completed'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : 'bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        {agent.status}
                      </span>
                      <button className="text-zinc-500 hover:text-white text-xs">
                        {isExpanded ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {isRunning && (
                    <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${agent.progress}%` }}
                      />
                    </div>
                  )}

                  {agent.currentTask && (
                    <p className="text-[11px] font-mono text-zinc-400 truncate">
                      &gt; {agent.currentTask}
                    </p>
                  )}

                  {/* Logs Drawer */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
                        Telemetry Stream
                      </span>
                      <div className="bg-black/60 rounded p-2 max-h-28 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-0.5">
                        {agent.logs.map((log, idx) => (
                          <div key={idx} className="leading-tight">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Manual Mission Dispatcher Drawer */}
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AgentRole)}
                className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-emerald-500/50"
              >
                <option value="recon_scout">Recon Scout (Intel/Search)</option>
                <option value="code_architect">Code Architect (Code/Build)</option>
                <option value="system_janitor">System Janitor (Cleanup)</option>
                <option value="sentry_watcher">Sentry Watcher (Hardware)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualPrompt}
                onChange={(e) => setManualPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDispatch()}
                placeholder="Directive prompt..."
                className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-[11px] font-mono text-zinc-100 outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
              />
              <button
                onClick={handleDispatch}
                disabled={isDispatching}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-mono font-bold text-xs flex items-center gap-1 hover:bg-emerald-400 transition-all disabled:opacity-50 cursor-pointer"
              >
                <RiPlayCircleLine />
                RUN
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
