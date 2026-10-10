import React, { useState, useEffect } from "react";
import {
  Terminal,
  Cpu,
  Settings as SettingsIcon,
  Shield,
  Activity,
  Play,
  RotateCcw,
  Sparkles,
  Wifi,
  Download,
  AlertTriangle,
  Clock
} from "lucide-react";
import AgentTraceFeed, { AgentStep } from "./components/AgentTraceFeed";
import SettingsModal from "./components/SettingsModal";
import QuotaModal from "./components/QuotaModal";

export const App: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuotaOpen, setIsQuotaOpen] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [etaRemaining, setEtaRemaining] = useState<string>("0s");
  const [quotaPct, setQuotaPct] = useState<number>(88.5);
  const [remainingTokens, setRemainingTokens] = useState<number>(88500);
  const [deviceStatus, setDeviceStatus] = useState<string>("ONLINE");

  // Load initial demo trace or listen to SSE
  useEffect(() => {
    // Check initial bridge quota
    fetch("/api/quota")
      .then((res) => res.json())
      .catch(() => {});
  }, []);

  const handleRunTask = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    const taskId = `task_${Date.now()}`;

    // Add initial planning thought step
    const initialThought: AgentStep = {
      id: `thought_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: "thought",
      title: "Analyzing request constraints & formulating execution plan",
      status: "running",
      thoughtContent: `Task prompt: "${prompt}". Validating isolated git worktree requirements, checking free-tier Groq quota, and decomposing into milestone phases...`,
    };
    setSteps([initialThought]);
    setEtaRemaining("14.5s");

    // Simulate/dispatch task execution lifecycle
    setTimeout(() => {
      initialThought.status = "success";
      const toolStep: AgentStep = {
        id: `tool_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: "tool_call",
        title: "Worktree Isolation & Code Patch Application",
        status: "running",
        toolName: "filesystem",
        payload: {
          path: "src/components/Feature.tsx",
          action: "apply_unified_diff",
        },
      };
      setSteps([initialThought, toolStep]);
      setEtaRemaining("8.2s");

      setTimeout(() => {
        toolStep.status = "success";
        const verifyStep: AgentStep = {
          id: `verify_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          type: "tool_call",
          title: "Headless Chromium DOM & Console Inspection",
          status: "running",
          toolName: "browser",
          payload: {
            url: "http://localhost:3000",
            wait_selector: "#root",
          },
        };
        setSteps([initialThought, toolStep, verifyStep]);
        setEtaRemaining("2.8s");

        setTimeout(() => {
          verifyStep.status = "success";
          const completeStep: AgentStep = {
            id: `done_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            type: "tool_result",
            title: "Task Verified & Review Artifact Generated",
            status: "success",
            duration: "12.4s",
            payload: {
              diff_summary: { additions: 18, deletions: 2 },
              artifact: "REVIEW_ARTIFACT.md",
            },
          };
          setSteps([initialThought, toolStep, verifyStep, completeStep]);
          setIsRunning(false);
          setEtaRemaining("0s");

          // Simulate token consumption and quota update
          setRemainingTokens((prev) => {
            const next = Math.max(0, prev - 1850);
            const pct = (next / 100000) * 100;
            setQuotaPct(pct);
            if (pct <= 20) setIsQuotaOpen(true);
            return next;
          });
        }, 1500);
      }, 1800);
    }, 1200);
  };

  const handleExportData = () => {
    window.open("/api/export", "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-cyan-500/20">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">Nexus AI Agent</h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                v2.2.0 Autonomous
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3 h-3" /> {deviceStatus}
              </span>
              <span>&bull;</span>
              <span>100% Free-Tier Architecture</span>
            </div>
          </div>
        </div>

        {/* Telemetry Stats & Controls */}
        <div className="flex items-center gap-3">
          {/* Dynamic ETA Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">ETA:</span>
            <span className="font-mono font-semibold text-white">{etaRemaining}</span>
          </div>

          {/* Quota Indicator */}
          <button
            onClick={() => setIsQuotaOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              quotaPct <= 20
                ? "bg-amber-950/50 border-amber-500/40 text-amber-300 hover:bg-amber-900/50 animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {quotaPct <= 20 && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
            <span>Quota:</span>
            <span className="font-mono font-bold text-white">{quotaPct.toFixed(1)}%</span>
          </button>

          {/* Export Sovereignty Archive */}
          <button
            onClick={handleExportData}
            title="Export 100% Local Sovereignty Archive (ZIP + Offline HTML)"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Command Bar */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-4 backdrop-blur-md shadow-xl flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Autonomous Command Dispatcher
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRunTask()}
              placeholder="e.g., Run test suite in isolated git worktree, fix syntax regressions, and verify in headless browser..."
              className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner"
            />
            <button
              onClick={handleRunTask}
              disabled={isRunning || !prompt.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-cyan-500/25"
            >
              {isRunning ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? "Executing..." : "Dispatch"}</span>
            </button>
          </div>
        </div>

        {/* Live Trace & Verification Feed */}
        <div className="flex-1 rounded-2xl border border-slate-800/90 bg-slate-900/30 p-4 sm:p-6 backdrop-blur-md shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Live Agent Execution Feed &amp; Thought Traces
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Local Data Sovereignty</span>
            </div>
          </div>

          <AgentTraceFeed steps={steps} onApproveStep={() => {}} onRejectStep={() => {}} />
        </div>
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <QuotaModal
        isOpen={isQuotaOpen}
        remainingPct={quotaPct}
        remainingTokens={remainingTokens}
        totalQuota={100000}
        onClose={() => setIsQuotaOpen(false)}
        onInjectKey={(prov, key) => {
          localStorage.setItem(`nexus_api_key_${prov}`, key);
        }}
        onSwitchToLocal={() => {
          localStorage.setItem("nexus_active_provider", "ollama");
        }}
      />
    </div>
  );
};

export default App;
