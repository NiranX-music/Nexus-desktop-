import React, { useState } from "react";
import { AlertTriangle, Key, ArrowRight, X, Check, ShieldAlert } from "lucide-react";

export interface QuotaModalProps {
  isOpen: boolean;
  remainingPct: number;
  remainingTokens: number;
  totalQuota: number;
  onClose: () => void;
  onInjectKey: (provider: string, apiKey: string) => void;
  onSwitchToLocal: () => void;
}

export const QuotaModal: React.FC<QuotaModalProps> = ({
  isOpen,
  remainingPct,
  remainingTokens,
  totalQuota,
  onClose,
  onInjectKey,
  onSwitchToLocal,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [saved, setSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    onInjectKey(selectedProvider, apiKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-950 p-6 shadow-2xl text-slate-100 space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Low API Quota Intercept
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-500/30">
                {remainingPct.toFixed(1)}% Left
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Free-tier pool remaining: {remainingTokens.toLocaleString()} / {totalQuota.toLocaleString()} tokens
            </p>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                remainingPct <= 10 ? "bg-rose-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.max(2, remainingPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Critical threshold: &lt;20%</span>
            <span>Zero cards charged</span>
          </div>
        </div>

        {/* Fallback Options */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                Inject Secondary API Key (Free Google AI Studio / Gemini)
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-white rounded px-2 py-1 font-mono focus:outline-none"
              >
                <option value="gemini">Google Gemini (Free AI Studio)</option>
                <option value="groq">Groq (Alternative Key)</option>
                <option value="openai">OpenAI Compatible</option>
              </select>
            </div>

            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter fallback API key..."
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-600 font-mono focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onSwitchToLocal();
                onClose();
              }}
              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium transition"
            >
              <ShieldAlert className="w-4 h-4" />
              Switch to Offline Ollama (Local)
            </button>

            <button
              type="submit"
              disabled={!apiKey.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
            >
              {saved ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              {saved ? "Key Saved!" : "Inject & Resume"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuotaModal;
