import { useEffect, useState } from 'react'
import {
  RiBrainLine,
  RiDownloadCloud2Line,
  RiExternalLinkLine,
  RiKey2Line,
  RiLoader4Line,
  RiRefreshLine,
  RiRocketLine,
  RiSave3Line,
  RiSettings4Line,
  RiUserLine,
  RiUserVoiceLine
} from 'react-icons/ri'

interface TrialSettingsProps {
  isSystemActive: boolean
}

const sanitizeNvidiaKey = (value = '') =>
  value
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()

const cardClass =
  'rounded-3xl border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(8,14,14,0.96),rgba(4,7,8,0.92))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]'
const inputClass =
  'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/25'

export default function TrialSettings({ isSystemActive }: TrialSettingsProps) {
  const [voice, setVoice] = useState<'MALE' | 'FEMALE'>(
    (localStorage.getItem('nexus_voice_profile') as 'MALE' | 'FEMALE') || 'MALE'
  )
  const [userName, setUserName] = useState(localStorage.getItem('nexus_user_name') || '')
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('nexus_custom_api_key') || '')
  const [groqKey, setGroqKey] = useState(localStorage.getItem('nexus_groq_api_key') || '')
  const [hfKey, setHfKey] = useState(localStorage.getItem('nexus_hf_api_key') || '')
  const [tailvyKey, setTailvyKey] = useState(localStorage.getItem('nexus_tailvy_api_key') || '')
  const [nvidiaKey, setNvidiaKey] = useState(localStorage.getItem('nexus_nvidia_api_key') || '')
  const [aiProviderMode, setAiProviderMode] = useState(
    localStorage.getItem('nexus_ai_provider_mode') || 'nexus'
  )
  const [appVersion, setAppVersion] = useState('Loading')
  const [updateFeedUrl, setUpdateFeedUrl] = useState('https://niranx-nexus-agent.vercel.app/updates/win')
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'
  >('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateNotes, setUpdateNotes] = useState('Trial build is ready.')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [localStatus, setLocalStatus] = useState(
    'Trial build stores voice profile, operator name, and API routing locally on this PC.'
  )

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return

    window.electron.ipcRenderer
      .invoke('get-app-version')
      .then((version) => setAppVersion(version || 'Unknown'))
      .catch(() => setAppVersion('Unknown'))

    window.electron.ipcRenderer
      .invoke('get-update-feed-url')
      .then((url) => {
        if (url) setUpdateFeedUrl(url)
      })
      .catch(() => {})

    const unsubscribe = window.electron.ipcRenderer.on('updater-event', (_e, event = {}) => {
      const { status, data = {}, error = '' } = event as Record<string, any>

      if (status === 'checking') setUpdateStatus('checking')
      if (status === 'available') {
        setUpdateStatus('available')
        setUpdateVersion(String(data.version || ''))
        setUpdateNotes(String(data.releaseNotes || 'New trial patch ready.'))
      }
      if (status === 'not-available') {
        setUpdateStatus('idle')
        setUpdateNotes('Trial build is up to date.')
      }
      if (status === 'downloading') {
        setUpdateStatus('downloading')
        setDownloadProgress(Math.round(Number(data.percent || 0)))
      }
      if (status === 'downloaded') {
        setUpdateStatus('ready')
        setDownloadProgress(100)
        setUpdateVersion(String(data.version || updateVersion))
        setUpdateNotes(String(data.releaseNotes || 'Trial update downloaded and ready to install.'))
      }
      if (status === 'error') {
        setUpdateStatus('error')
        setUpdateNotes(`Error: ${error || 'Unable to reach the update server.'}`)
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [updateVersion])

  const saveLocalSettings = async () => {
    const cleanNvidiaKey = sanitizeNvidiaKey(nvidiaKey)

    localStorage.setItem('nexus_voice_profile', voice)
    localStorage.setItem('nexus_user_name', userName)
    localStorage.setItem('nexus_custom_api_key', geminiKey)
    localStorage.setItem('nexus_groq_api_key', groqKey)
    localStorage.setItem('nexus_hf_api_key', hfKey)
    localStorage.setItem('nexus_tailvy_api_key', tailvyKey)
    localStorage.setItem('nexus_nvidia_api_key', cleanNvidiaKey)
    localStorage.setItem('nexus_ai_provider_mode', aiProviderMode)

    if (window.electron?.ipcRenderer) {
      try {
        await window.electron.ipcRenderer.invoke('secure-save-keys', {
          groqKey,
          geminiKey,
          nvidiaKey: cleanNvidiaKey
        })
      } catch {}
    }

    setNvidiaKey(cleanNvidiaKey)
    setLocalStatus('Local settings saved. Trial mode keeps everything on this machine only.')
  }

  const checkAndDownloadUpdate = async () => {
    if (!window.electron?.ipcRenderer) return
    setUpdateStatus('checking')
    setUpdateNotes(`Checking the website feed for a new trial patch:\n${updateFeedUrl}`)

    try {
      const result = await window.electron.ipcRenderer.invoke('check-and-download-update')
      if (result?.success === false) {
        throw new Error(result.error || 'Unable to download the update.')
      }
      if (result?.updateAvailable === false) {
        setUpdateStatus('idle')
        setUpdateNotes('Trial build is up to date.')
      }
    } catch (error) {
      setUpdateStatus('error')
      setUpdateNotes(
        `Error: ${error instanceof Error ? error.message : 'Unable to download the update.'}`
      )
    }
  }

  const installUpdate = async () => {
    if (!window.electron?.ipcRenderer) return
    setUpdateStatus('installing')
    await window.electron.ipcRenderer.invoke('install-update')
  }

  return (
    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col gap-5">
        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                Trial Local Settings
              </p>
              <h2 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
                Operator profile and voice
              </h2>
            </div>
            <button
              type="button"
              onClick={saveLocalSettings}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-zinc-200"
            >
              <RiSave3Line /> Save local
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <RiUserLine /> Operator name
              </span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                placeholder="Enter operator name"
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <RiUserVoiceLine /> Voice profile
              </span>
              <div className={`grid grid-cols-2 gap-3 ${isSystemActive ? 'opacity-50' : ''}`}>
                {(['FEMALE', 'MALE'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={isSystemActive}
                    onClick={() => setVoice(option)}
                    className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                      voice === option
                        ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100'
                        : 'border-white/10 bg-black/30 text-zinc-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-300/12 bg-cyan-400/6 px-4 py-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
              <RiSettings4Line /> Local storage mode
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{localStatus}</p>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                API Routing
              </p>
              <h3 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
                Hosted or local overrides
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              {
                id: 'nexus',
                title: 'Use Nexus hosted routing',
                text: 'Best for a clean trial experience and faster setup.'
              },
              {
                id: 'own-key',
                title: 'Use my NVIDIA key',
                text: 'Advanced local override for trial testing.'
              }
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setAiProviderMode(mode.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  aiProviderMode === mode.id
                    ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100'
                    : 'border-white/10 bg-black/30 text-zinc-400'
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em]">{mode.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{mode.text}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <RiBrainLine /> Gemini
              </span>
              <input
                type="password"
                value={geminiKey}
                onChange={(event) => setGeminiKey(event.target.value)}
                placeholder="AIzaSy_..."
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <RiBrainLine /> NVIDIA Override
              </span>
              <input
                type="password"
                value={nvidiaKey}
                onChange={(event) => setNvidiaKey(event.target.value)}
                placeholder="nvapi-..."
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <RiBrainLine /> Groq
              </span>
              <input
                type="password"
                value={groqKey}
                onChange={(event) => setGroqKey(event.target.value)}
                placeholder="gsk_..."
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              <span className="inline-flex items-center gap-2">
                <RiBrainLine /> Hugging Face
              </span>
              <input
                type="password"
                value={hfKey}
                onChange={(event) => setHfKey(event.target.value)}
                placeholder="hf_..."
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 md:col-span-2">
              <span className="inline-flex items-center gap-2">
                <RiKey2Line /> Builder / Tavily
              </span>
              <input
                type="password"
                value={tailvyKey}
                onChange={(event) => setTailvyKey(event.target.value)}
                placeholder="tlv_..."
                className={inputClass}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                Trial Updates
              </p>
              <h2 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
                In-app patch flow
              </h2>
            </div>
            <span className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
              v{appVersion}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs leading-relaxed text-zinc-400">
              Website feed: {updateFeedUrl}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                <span>{updateStatus === 'idle' ? 'Ready' : updateStatus}</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={checkAndDownloadUpdate}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/12"
              >
                {updateStatus === 'checking' ? (
                  <RiLoader4Line className="animate-spin" />
                ) : (
                  <RiDownloadCloud2Line />
                )}
                Check & Download
              </button>
              <button
                type="button"
                onClick={installUpdate}
                disabled={updateStatus !== 'ready'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-emerald-300 disabled:opacity-45"
              >
                <RiRocketLine /> Install update
              </button>
            </div>

            <pre className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-[11px] leading-relaxed text-zinc-400 whitespace-pre-wrap">
              {updateNotes}
            </pre>

            {updateVersion ? (
              <div className="rounded-2xl border border-cyan-300/12 bg-cyan-400/6 px-4 py-4 text-sm text-zinc-300">
                Latest patch detected: <span className="font-semibold text-white">{updateVersion}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                Full Version
              </p>
              <h3 className="mt-1 text-lg font-black uppercase tracking-[0.08em] text-white">
                Ready when you are
              </h3>
            </div>
            <a
              href="https://niranx-nexus-agent.vercel.app/installer"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/18 bg-amber-300/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100 transition hover:bg-amber-300/16"
            >
              Full build <RiExternalLinkLine />
            </a>
          </div>

          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
            <li>Account-backed cloud sync and paired desktop auth.</li>
            <li>Macros, phone control, gallery, notes vault, and local tools.</li>
            <li>Always-on dock flows and the larger operator surface.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
