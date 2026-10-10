import React, { useState, useEffect } from "react";
import { 
  Key, 
  Server, 
  Cpu, 
  Cloud, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Eye, 
  EyeOff 
} from "lucide-react";

export interface NexusEngineConfig {
  developerMode: boolean;
  groqApiKey: string;
  geminiApiKey: string;
  geminiModel: string;
  ollamaEndpoint: string;
  cloudflareBridgeUrl: string;
  cloudflareAuthToken: string;
  deviceId: string;
}

export const Settings: React.FC<{
  initialConfig?: Partial<NexusEngineConfig>;
  onSave?: (config: NexusEngineConfig) => void;
}> = ({ initialConfig, onSave }) => {
  const [config, setConfig] = useState<NexusEngineConfig>({
    developerMode: true,
    groqApiKey: "",
    geminiApiKey: "",
    geminiModel: "gemini-3.8-flash",
    ollamaEndpoint: "http://localhost:11434",
    cloudflareBridgeUrl: "https://nexus-bridge-7l1.pages.dev/api",
    cloudflareAuthToken: "",
    deviceId: "nexus-desktop-primary",
    ...initialConfig
  });

  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [testStatus, setTestStatus] = useState<{ [key: string]: string }>({});
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    // Load from localStorage if present
    const stored = localStorage.getItem("nexus_engine_config");
    if (stored) {
      try {
        setConfig((prev) => ({ ...prev, ...JSON.parse(stored) }));
      } catch {}
    }
  }, []);

  const toggleVisibility = (field: string) => {
    setShowKeys((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = () => {
    localStorage.setItem("nexus_engine_config", JSON.stringify(config));
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
    onSave?.(config);
  };

  const testGroq = async () => {
    setTestStatus((prev) => ({ ...prev, groq: "testing" }));
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${config.groqApiKey}` }
      });
      if (res.ok) {
        setTestStatus((prev) => ({ ...prev, groq: "success" }));
      } else {
        setTestStatus((prev) => ({ ...prev, groq: "failed" }));
      }
    } catch {
      setTestStatus((prev) => ({ ...prev, groq: "failed" }));
    }
  };

  const testGemini = async () => {
    setTestStatus((prev) => ({ ...prev, gemini: "testing" }));
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiApiKey}`
      );
      if (res.ok) {
        setTestStatus((prev) => ({ ...prev, gemini: "success" }));
      } else {
        setTestStatus((prev) => ({ ...prev, gemini: "failed" }));
      }
    } catch {
      setTestStatus((prev) => ({ ...prev, gemini: "failed" }));
    }
  };

  const testBridge = async () => {
    setTestStatus((prev) => ({ ...prev, bridge: "testing" }));
    try {
      const res = await fetch(`${config.cloudflareBridgeUrl}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: config.deviceId, status: "PROBE" })
      });
      if (res.ok || res.status === 404) {
        setTestStatus((prev) => ({ ...prev, bridge: "success" }));
      } else {
        setTestStatus((prev) => ({ ...prev, bridge: "failed" }));
      }
    } catch {
      setTestStatus((prev) => ({ ...prev, bridge: "failed" }));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl bg-slate-950/90 border border-slate-800 p-6 shadow-2xl backdrop-blur-xl text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Developer Mode & AI Inference Settings</h2>
            <p className="text-xs text-slate-400">Configure free-tier LLM endpoints, local models, and Cloudflare Edge Bridge credentials.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition shadow-lg shadow-emerald-500/20"
        >
          {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {savedNotice ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Tier 1: Default Free Inference */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <Cloud className="w-4 h-4" />
              <span>Tier 1: Free Groq Cloud Inference (Default)</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
              Zero Card Required
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Powers ultra-fast sub-200ms reasoning via <code className="text-emerald-300">llama-3.3-70b-versatile</code> and <code className="text-emerald-300">whisper-large-v3-turbo</code> on Groq LPUs.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Groq Cloud API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeys.groq ? "text" : "password"}
                  value={config.groqApiKey}
                  onChange={(e) => setConfig({ ...config, groqApiKey: e.target.value })}
                  placeholder="gsk_..."
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility("groq")}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showKeys.groq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={testGroq}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition"
              >
                {testStatus.groq === "testing" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Verify"}
              </button>
            </div>
            {testStatus.groq === "success" && <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Groq API key is valid</span>}
            {testStatus.groq === "failed" && <span className="text-[11px] text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Invalid Groq key or network failure</span>}
          </div>
        </div>

        {/* Tier 2: Developer Mode - Google AI Studio / Gemini Pro */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-400">
              <Key className="w-4 h-4" />
              <span>Tier 2: Developer Mode (Google AI Studio / Gemini Pro)</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-slate-400">Enabled</span>
              <input
                type="checkbox"
                checked={config.developerMode}
                onChange={(e) => setConfig({ ...config, developerMode: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-purple-500 focus:ring-0"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Gemini API Key</label>
              <div className="relative">
                <input
                  type={showKeys.gemini ? "text" : "password"}
                  value={config.geminiApiKey}
                  onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility("gemini")}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showKeys.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Model Selector</label>
              <select
                value={config.geminiModel}
                onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              >
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (Default)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            {testStatus.gemini === "success" && <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Gemini API connection authenticated</span>}
            {testStatus.gemini === "failed" && <span className="text-[11px] text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Invalid Gemini Key</span>}
            <button
              type="button"
              onClick={testGemini}
              className="ml-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition"
            >
              Verify Gemini
            </button>
          </div>
        </div>

        {/* Tier 3: Local Offline Models & Cloudflare Edge Bridge */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
            <Server className="w-4 h-4" />
            <span>Local Offline Daemon & Cloudflare Edge Bridge</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Ollama Local Endpoint</label>
              <input
                type="text"
                value={config.ollamaEndpoint}
                onChange={(e) => setConfig({ ...config, ollamaEndpoint: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Cloudflare Pages Bridge URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.cloudflareBridgeUrl}
                  onChange={(e) => setConfig({ ...config, cloudflareBridgeUrl: e.target.value })}
                  placeholder="https://nexus-bridge-7l1.pages.dev/api"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={testBridge}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition"
                >
                  Ping
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
