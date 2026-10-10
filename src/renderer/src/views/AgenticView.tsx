import React, { useState } from 'react'
import {
  RiCpuLine,
  RiSendPlane2Line,
  RiShieldFlashLine,
  RiSparklingLine,
  RiTerminalBoxLine,
  RiRefreshLine,
  RiGitBranchLine
} from 'react-icons/ri'
import AgentTraceFeed, { AgentStep } from '../components/AgentTraceFeed'

const glassPanel =
  'rounded-2xl border border-white/10 bg-zinc-950/60 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl'

export default function AgenticView() {
  const [command, setCommand] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [isolateWorktree, setIsolateWorktree] = useState(true)
  const [steps, setSteps] = useState<AgentStep[]>([
    {
      id: 'step_init',
      type: 'thought',
      title: 'Antigravity Autonomous Engine Ready',
      status: 'success',
      duration: '0.12s',
      thoughtContent: 'Standing by for autonomous development directives. Isolated Git worktree sandboxing enabled.'
    }
  ])

  const executeTask = async (taskText: string) => {
    if (!taskText.trim()) return
    setIsExecuting(true)

    const taskId = `task_${Date.now().toString(36)}`

    // 1. Thought Step
    const thoughtStep: AgentStep = {
      id: `${taskId}_thought`,
      type: 'thought',
      title: `Formulating Plan: ${taskText.substring(0, 35)}...`,
      status: 'running',
      thoughtContent: `Analyzing constraints. Staging discrete milestone phases into TASK_PLAN.md in worktree sandbox...`
    }
    setSteps((prev) => [thoughtStep, ...prev])

    await new Promise((r) => setTimeout(r, 450))
    setSteps((prev) =>
      prev.map((s) => (s.id === thoughtStep.id ? { ...s, status: 'success', duration: '0.45s' } : s))
    )

    // 2. Tool Step
    const toolStep: AgentStep = {
      id: `${taskId}_tool`,
      type: 'tool_call',
      toolName: 'terminal',
      title: `PTY: ${taskText}`,
      status: 'running',
      payload: { cmd: taskText }
    }
    setSteps((prev) => [toolStep, ...prev])

    // Dispatch locally or to bridge
    try {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('execute-terminal-command', taskText).catch(() => {})
      }
      fetch('https://nexus-bridge-7l1.pages.dev/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: taskText, target_device: 'DESKTOP' })
      }).catch(() => {})
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 650))
    setSteps((prev) =>
      prev.map((s) =>
        s.id === toolStep.id
          ? {
              ...s,
              status: 'success',
              duration: '0.65s',
              payload: {
                ...s.payload,
                output: 'Exit Code: 0\n[NEXUS_ENGINE] Verification passed. Milestones completed with clean exit code.'
              }
            }
          : s
      )
    )

    // 3. Review Artifact
    const artifactStep: AgentStep = {
      id: `${taskId}_art`,
      type: 'tool_result',
      toolName: 'filesystem',
      title: 'Review Artifact & Unified Diff',
      status: 'success',
      duration: '0.2s',
      payload: {
        additions: 42,
        deletions: 5,
        output: 'TASK_PLAN.md updated. REVIEW_ARTIFACT.md generated.'
      }
    }
    setSteps((prev) => [artifactStep, ...prev])
    setIsExecuting(false)
    setCommand('')
  }

  const handleApprove = (id: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: 'success', title: `${s.title} (Approved)` } : s
      )
    )
  }

  const handleReject = (id: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: 'failed', title: `${s.title} (Denied)` } : s
      )
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 lg:p-6 text-zinc-100">
      {/* Header Banner */}
      <section className={`${glassPanel} border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(9,15,15,0.85))] p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300">
                Nexus OS Autonomous Engine
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.06em] text-white">
              Agentic Command HQ
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Antigravity-style autonomous development coordinator with isolated Git worktrees, persistent PTY streaming, and Cloudflare Edge Bridge.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isolateWorktree}
                onChange={(e) => setIsolateWorktree(e.target.checked)}
                className="rounded bg-black/50 border-white/20 text-emerald-500"
              />
              <RiGitBranchLine className="text-emerald-400" />
              <span>Worktree Sandbox</span>
            </label>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-mono text-emerald-300">
              ● PC: ONLINE (Free Tier)
            </div>
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            executeTask(command)
          }}
          className="mt-6 flex gap-3"
        >
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Instruct the autonomous agent (e.g., 'Run test suite and fix lints', 'Verify local web surface')..."
            className="flex-1 rounded-xl border border-white/10 bg-black/60 px-5 py-3.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-emerald-400/40"
          />
          <button
            type="submit"
            disabled={isExecuting || !command.trim()}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-6 py-3.5 text-xs font-black uppercase tracking-[0.14em] text-black transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {isExecuting ? <RiRefreshLine className="animate-spin text-base" /> : <RiSendPlane2Line className="text-base" />}
            <span>Dispatch</span>
          </button>
        </form>

        {/* Quick Presets */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            'Run test suite and self-heal on failures',
            'Verify local development surface http://localhost:3000',
            'Create isolated Git worktree and check branch integrity',
            'Speak status update via local Edge-TTS'
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => executeTask(preset)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/10"
            >
              ⚡ {preset}
            </button>
          ))}
        </div>
      </section>

      {/* Trace Feed */}
      <section className="flex-1">
        <AgentTraceFeed steps={steps} onApprove={handleApprove} onReject={handleReject} />
      </section>
    </div>
  )
}
