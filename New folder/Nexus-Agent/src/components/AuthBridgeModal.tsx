import React, { useState, useEffect } from 'react'
import {
  X,
  Key,
  ShieldCheck,
  Smartphone,
  Laptop,
  Check,
  Copy,
  ExternalLink,
  Lock,
  Sparkles,
  RefreshCw,
  QrCode,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface AuthBridgeModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AuthBridgeModal: React.FC<AuthBridgeModalProps> = ({ isOpen, onClose }) => {
  const DEFAULT_KEY =
    ((import.meta as any).env?.VITE_NEXUS_API_KEY as string) ||
    (typeof window !== 'undefined' ? localStorage.getItem('nexus_agent_api_key') : '') ||
    ''

  const [apiKey, setApiKey] = useState(DEFAULT_KEY)
  const [operatorEmail, setOperatorEmail] = useState('operator@nexus-agent.local')
  const [sessionToken, setSessionToken] = useState('nx_live_' + Math.random().toString(36).substring(2, 12))
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [activeBridgeTab, setActiveBridgeTab] = useState<'deep_link' | 'code' | 'api_key' | 'ai_test'>('deep_link')
  const [desktopDetected, setDesktopDetected] = useState<boolean | null>(null)
  const [detectedPort, setDetectedPort] = useState<number | null>(null)
  const [httpSyncStatus, setHttpSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [httpSyncMsg, setHttpSyncMsg] = useState('')

  // AI Test state
  const [testPrompt, setTestPrompt] = useState('Analyze current system status and propose autonomous workflow plan.')
  const [testResponse, setTestResponse] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => {
    // Check if desktop agent is running locally on any known port: 17173 (standard), 9100, 5173
    const checkPorts = [17173, 9100, 5173]
    let found = false

    const checkLocalAgent = async () => {
      for (const port of checkPorts) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 1000)
          const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal })
          clearTimeout(timeoutId)
          if (res.ok) {
            setDesktopDetected(true)
            setDetectedPort(port)
            found = true
            break
          }
        } catch {
          // continue checking
        }
      }
      if (!found) {
        setDesktopDetected(false)
        setDetectedPort(null)
      }
    }

    if (isOpen) {
      checkLocalAgent()
    }
  }, [isOpen])

  if (!isOpen) return null

  const targetPort = detectedPort || 17173
  const deepLink = `nexus://auth?key=${encodeURIComponent(apiKey)}&token=${sessionToken}&user=${encodeURIComponent(operatorEmail)}`
  const pairingCode = `NX-${sessionToken.slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(deepLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDirectHttpSync = async () => {
    setHttpSyncStatus('syncing')
    setHttpSyncMsg(`Connecting to local desktop agent on port ${targetPort}...`)
    try {
      const res = await fetch(`http://127.0.0.1:${targetPort}/web-auth-bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          token: sessionToken,
          user: operatorEmail
        })
      })

      if (res.ok) {
        setHttpSyncStatus('success')
        setHttpSyncMsg(`Desktop agent on port ${targetPort} received API key and paired session!`)
      } else {
        const data = await res.json().catch(() => ({}))
        setHttpSyncStatus('error')
        setHttpSyncMsg(data.error || `Bridge returned status ${res.status}. Use OS Protocol link instead.`)
      }
    } catch (err: any) {
      setHttpSyncStatus('error')
      setHttpSyncMsg('Could not reach local agent over HTTP. Launch app with Deep Link below or start Nexus Desktop.')
    }
  }

  const handleTestKeySimulation = async () => {
    setTestLoading(true)
    setTestError(null)
    setTestResponse(null)

    try {
      // Direct call to Gemini 3.8 Flash API endpoint with the key
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are Nexus AI Agent core. User query: ${testPrompt}`
                  }
                ]
              }
            ],
            generationConfig: {
              maxOutputTokens: 250,
              temperature: 0.7
            }
          })
        }
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error?.message || `HTTP ${res.status}: Validation error`)
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Nexus Agent returned successful empty response.'
      setTestResponse(text)
    } catch (err: any) {
      setTestError(err.message || 'Verification request failed. Check API key permissions.')
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#090d16] border border-cyan-500/40 rounded-3xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0d1422] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Nexus Authentication & Web Bridge</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-semibold">
                  SECURE PROTOCOL
                </span>
              </div>
              <p className="text-xs text-slate-400">Bidirectional Sync b/w Web Portal & Desktop Client via Deep Link & API Key</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Localhost Detection Indicator */}
        <div className="px-6 py-2.5 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                desktopDetected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
              }`}
            ></span>
            <span className={desktopDetected ? 'text-emerald-300' : 'text-slate-400'}>
              {desktopDetected === null
                ? 'Scanning local bridge ports (17173, 9100, 5173)...'
                : desktopDetected
                ? `Desktop Agent Online on Port ${detectedPort}`
                : 'Desktop Agent Standby (Deep link or launch app to connect)'}
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">nexus://auth</span>
        </div>

        {/* Tab Switcher */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-2 p-1 rounded-2xl bg-slate-950 border border-white/5">
            <button
              onClick={() => setActiveBridgeTab('deep_link')}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeBridgeTab === 'deep_link'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Bridge Sync</span>
            </button>
            <button
              onClick={() => setActiveBridgeTab('code')}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeBridgeTab === 'code'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Pairing PIN</span>
            </button>
            <button
              onClick={() => setActiveBridgeTab('api_key')}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeBridgeTab === 'api_key'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>API Vault</span>
            </button>
            <button
              onClick={() => setActiveBridgeTab('ai_test')}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeBridgeTab === 'ai_test'
                  ? 'bg-sky-500 text-black shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test Key</span>
            </button>
          </div>

          {/* TAB 1: ONE-CLICK DEEP LINK & HTTP SYNC */}
          {activeBridgeTab === 'deep_link' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#091522] border border-cyan-500/30 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Direct Web-to-Desktop Pairing</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Transmit your active API key and session credentials securely into your local Nexus Desktop app via deep link or direct localhost HTTP socket.
                    </p>
                  </div>
                </div>

                {/* HTTP Sync Feedback */}
                {httpSyncStatus !== 'idle' && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      httpSyncStatus === 'success'
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                        : httpSyncStatus === 'error'
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                        : 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                    }`}
                  >
                    {httpSyncStatus === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {httpSyncStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {httpSyncStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{httpSyncMsg}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleDirectHttpSync}
                    disabled={httpSyncStatus === 'syncing'}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${httpSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>1-Click HTTP Sync to Running Desktop</span>
                  </button>

                  <a
                    href={deepLink}
                    className="py-3 px-4 rounded-xl bg-cyan-950 border border-cyan-500/50 hover:bg-cyan-900/60 text-cyan-300 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Launch OS App (Deep Link)</span>
                  </a>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={handleCopyLink}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'URI copied to clipboard' : 'Copy nexus://auth URL'}</span>
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">Target Port: {targetPort}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/50 border border-white/5 font-mono text-[11px] text-slate-400 break-all">
                <span className="text-cyan-400 block mb-1 font-semibold">DEEP LINK URI:</span>
                {deepLink}
              </div>
            </div>
          )}

          {/* TAB 2: PAIRING PIN */}
          {activeBridgeTab === 'code' && (
            <div className="space-y-4 text-center">
              <div className="p-6 rounded-2xl bg-black/60 border border-purple-500/30 flex flex-col items-center justify-center space-y-3">
                <span className="text-xs font-mono text-purple-400 uppercase tracking-widest font-semibold">
                  SINGLE-USE SESSION PAIRING PIN
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-widest bg-purple-950/40 px-6 py-2 rounded-2xl border border-purple-500/40">
                  {pairingCode}
                </div>
                <p className="text-xs text-slate-400 max-w-sm">
                  Enter this code into Nexus Desktop under <strong>Settings &gt; Web Bridge Sync</strong> or use the Mobile Command Bridge.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Code active for current session</span>
              </div>
            </div>
          )}

          {/* TAB 3: API KEY VAULT */}
          {activeBridgeTab === 'api_key' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                    AUTHENTICATED AGENT KEY
                  </span>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-xs text-slate-400 hover:text-white underline font-mono"
                  >
                    {showKey ? 'Mask' : 'Reveal'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    onClick={handleCopyKey}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 hover:border-emerald-400 flex items-center gap-1.5"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <p>
                  This key powers the real-time AI reasoning agent across both the Web Simulator and the Desktop Client. When synced, it is encrypted in the local desktop vault via OS keychain (<code>safeStorage</code>).
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: TEST KEY WITH AI */}
          {activeBridgeTab === 'ai_test' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/60 border border-sky-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider">
                    TEST AGENT REASONING IN WEB SIMULATOR
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Model: Gemini 3.8 Flash</span>
                </div>

                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-sky-400 resize-none"
                  placeholder="Enter a prompt to test your agent API key..."
                />

                <button
                  onClick={handleTestKeySimulation}
                  disabled={testLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{testLoading ? 'Querying Gemini API Core...' : 'Execute Live Reasoning Test'}</span>
                </button>
              </div>

              {testResponse && (
                <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/40 text-xs font-mono text-slate-200 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Key Verified & Active:</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/50 border border-white/5 text-slate-300 leading-relaxed max-h-40 overflow-y-auto">
                    {testResponse}
                  </div>
                </div>
              )}

              {testError && (
                <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/40 text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <span className="font-bold block">Verification Error:</span>
                    <span>{testError}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0d1422] border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>AES-256 + safeStorage Local Vault</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
