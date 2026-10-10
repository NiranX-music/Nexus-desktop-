import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Terminal, 
  FileCode2, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  BrainCircuit, 
  ShieldAlert,
  Volume2,
  MousePointerClick
} from "lucide-react";

export interface AgentStep {
  id: string;
  type: "thought" | "tool_call" | "tool_result" | "approval_request" | "error";
  title: string;
  status: "running" | "success" | "failed" | "waiting_approval";
  duration?: string;
  thoughtContent?: string;
  toolName?: "terminal" | "filesystem" | "browser" | "desktop_ufo" | "voice";
  payload?: {
    cmd?: string;
    output?: string;
    path?: string;
    additions?: number;
    deletions?: number;
    screenshotUrl?: string;
    url?: string;
    text?: string;
  };
}

export const AgentTraceFeed: React.FC<{
  steps: AgentStep[];
  onApprove?: (stepId: string) => void;
  onReject?: (stepId: string) => void;
}> = ({ steps, onApprove, onReject }) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getToolIcon = (step: AgentStep) => {
    if (step.type === "thought") return <BrainCircuit className="w-4 h-4 text-purple-400" />;
    if (step.type === "approval_request") return <ShieldAlert className="w-4 h-4 text-amber-400" />;
    switch (step.toolName) {
      case "terminal": return <Terminal className="w-4 h-4 text-blue-400" />;
      case "filesystem": return <FileCode2 className="w-4 h-4 text-emerald-400" />;
      case "browser": return <Globe className="w-4 h-4 text-sky-400" />;
      case "desktop_ufo": return <MousePointerClick className="w-4 h-4 text-orange-400" />;
      case "voice": return <Volume2 className="w-4 h-4 text-teal-400" />;
      default: return <Terminal className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusIcon = (status: AgentStep["status"]) => {
    switch (status) {
      case "running": return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
      case "success": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "failed": return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      case "waiting_approval": return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 font-sans shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs font-semibold text-slate-400 tracking-wider uppercase">
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Nexus Agent Execution Trace
        </span>
        <span className="font-mono text-emerald-400">{steps.length} Actions Recorded</span>
      </div>

      {/* Timeline Stream */}
      <div className="space-y-3">
        {steps.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-xs font-mono">
            Autonomous Engine Idle. Ready to plan and execute operations.
          </div>
        ) : (
          steps.map((step) => {
            const isExpanded = !!expandedIds[step.id];

            return (
              <div 
                key={step.id} 
                className={`rounded-xl border transition-colors ${
                  step.status === "waiting_approval" 
                    ? "border-amber-500/40 bg-amber-950/20" 
                    : "border-slate-800/60 bg-slate-900/60 hover:border-slate-700/80"
                }`}
              >
                {/* Row Header */}
                <div 
                  onClick={() => toggleExpand(step.id)}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                      {getToolIcon(step)}
                    </div>
                    
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {step.title}
                    </span>

                    {step.payload?.additions !== undefined && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 font-mono">
                        +{step.payload.additions} -{step.payload.deletions}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {step.duration && (
                      <span className="text-xs text-slate-500 font-mono">{step.duration}</span>
                    )}
                    {getStatusIcon(step.status)}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Collapsible Inspection Drawer */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800/40 text-xs">
                    {/* Thought Display */}
                    {step.thoughtContent && (
                      <div className="p-3 rounded-lg bg-slate-950/70 border border-purple-900/30 text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                        <span className="text-purple-400 font-semibold block mb-1">Reasoning Chain:</span>
                        {step.thoughtContent}
                      </div>
                    )}

                    {/* Terminal Command & Logs */}
                    {step.payload?.cmd && (
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center gap-2 text-slate-400 font-mono">
                          <span className="text-emerald-400">$</span>
                          <code className="text-slate-200">{step.payload.cmd}</code>
                        </div>
                        {step.payload.output && (
                          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300 overflow-x-auto max-h-56 leading-tight">
                            {step.payload.output}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Browser Snapshot Preview */}
                    {step.payload?.screenshotUrl && (
                      <div className="mt-3 space-y-1">
                        <span className="text-slate-400 block font-mono">Browser Verification Proof:</span>
                        <img 
                          src={step.payload.screenshotUrl} 
                          alt="Browser State" 
                          className="rounded border border-slate-700 max-h-64 object-cover w-full"
                        />
                      </div>
                    )}

                    {/* Human-in-the-Loop Approval Confirmation */}
                    {step.status === "waiting_approval" && (
                      <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-amber-950/30 border border-amber-800/50">
                        <span className="text-amber-300 text-xs font-medium">Agent requested high-risk execution permission.</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => onReject?.(step.id)}
                            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            Deny
                          </button>
                          <button 
                            onClick={() => onApprove?.(step.id)}
                            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition"
                          >
                            Approve Action
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AgentTraceFeed;
