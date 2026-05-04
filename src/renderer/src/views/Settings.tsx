import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as faceapi from 'face-api.js'
import { GiArtificialIntelligence } from 'react-icons/gi'
import {
  RiKey2Line,
  RiSave3Line,
  RiUserVoiceLine,
  RiUserLine,
  RiLockPasswordLine,
  RiScan2Line,
  RiAddLine,
  RiRecordCircleLine,
  RiLock2Line,
  RiSettings4Line,
  RiShieldKeyholeLine,
  RiPlugLine,
  RiBrainLine,
  RiCloudLine,
  RiCpuLine,
  RiTerminalWindowLine,
  RiRefreshLine,
  RiDownloadCloud2Line,
  RiRocketLine,
  RiExternalLinkLine
} from 'react-icons/ri'
import {
  DEFAULT_NVIDIA_MODEL_DEFAULTS,
  getModelsForCategory,
  getNvidiaModelById,
  getStoredNvidiaModelDefaults,
  NEXUS_AI_PROVIDER_MODE_STORAGE_KEY,
  NVIDIA_API_KEY_STORAGE_KEY,
  NVIDIA_BUILD_MODELS,
  NVIDIA_DEFAULTS_STORAGE_KEY,
  NVIDIA_MODEL_CATEGORIES,
  NvidiaModelDefaults
} from '@renderer/config/nvidia-models'

interface SettingsProps {
  isSystemActive: boolean
}

type TabType = 'updates' | 'general' | 'keys' | 'models' | 'security' | 'about'

const ADMIN_PASS = '05122010'
const DEVELOPER_PROFILE_STORAGE_KEY = 'nexus_developer_profile'
const DEFAULT_DEVELOPER_PROFILE = {
  developer: 'NiranX',
  team: 'Resolute Team',
  company: 'Nexus tech',
  role: 'Lead Developer / AI Systems',
  website: 'https://nexus-desktop-app.vercel.app',
  note: 'Nexus AI is maintained by NiranX and Resolute Team.'
}
const sanitizeNvidiaKey = (value = '') =>
  value
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()

const getDeveloperProfile = () => {
  try {
    return {
      ...DEFAULT_DEVELOPER_PROFILE,
      ...JSON.parse(localStorage.getItem(DEVELOPER_PROFILE_STORAGE_KEY) || '{}')
    }
  } catch {
    return DEFAULT_DEVELOPER_PROFILE
  }
}

const SettingsView = ({ isSystemActive }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('updates')

  const [voice, setVoice] = useState<'MALE' | 'FEMALE'>(
    (localStorage.getItem('nexus_voice_profile') as 'MALE' | 'FEMALE') || 'MALE'
  )
  const [personality, setPersonality] = useState('')
  const [userName, setUserName] = useState(localStorage.getItem('nexus_user_name') || '')

  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('nexus_custom_api_key') || '')
  const [groqKey, setGroqKey] = useState(localStorage.getItem('nexus_groq_api_key') || '')
  const [hfKey, setHfKey] = useState(localStorage.getItem('nexus_hf_api_key') || '')
  const [tailvyKey, setTailvyKey] = useState(localStorage.getItem('nexus_tailvy_api_key') || '')
  const [nvidiaKey, setNvidiaKey] = useState(localStorage.getItem(NVIDIA_API_KEY_STORAGE_KEY) || '')
  const [aiProviderMode, setAiProviderMode] = useState(
    localStorage.getItem(NEXUS_AI_PROVIDER_MODE_STORAGE_KEY) || 'nexus'
  )
  const [nvidiaDefaults, setNvidiaDefaults] = useState<NvidiaModelDefaults>(
    DEFAULT_NVIDIA_MODEL_DEFAULTS
  )
  const [nvidiaSyncStatus, setNvidiaSyncStatus] = useState(
    `${NVIDIA_BUILD_MODELS.length} bundled Build models`
  )

  const [isSecurityUnlocked, setIsSecurityUnlocked] = useState(false)
  const [authPin, setAuthPin] = useState('')
  const [authError, setAuthError] = useState(false)

  const [newPin, setNewPin] = useState('')
  const [faceCount, setFaceCount] = useState(0)

  const [isScanningFace, setIsScanningFace] = useState(false)
  const [enrollStatus, setEnrollStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const [appVersion, setAppVersion] = useState('Loading')
  const [updateFeedUrl, setUpdateFeedUrl] = useState('https://nexus-desktop-app.vercel.app/updates/win')
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'
  >('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateNotes, setUpdateNotes] = useState('No new updates detected.')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isInstallPromptOpen, setIsInstallPromptOpen] = useState(false)
  const [developerProfile, setDeveloperProfile] = useState(getDeveloperProfile())
  const [aboutAdminPass, setAboutAdminPass] = useState('')
  const [isAboutAdminUnlocked, setIsAboutAdminUnlocked] = useState(false)
  const [aboutStatus, setAboutStatus] = useState('')

  useEffect(() => {
    setNvidiaDefaults(getStoredNvidiaModelDefaults())

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke('secure-get-keys').then((keys) => {
        if (keys?.nvidiaKey && !localStorage.getItem(NVIDIA_API_KEY_STORAGE_KEY)) {
          setNvidiaKey(keys.nvidiaKey)
          localStorage.setItem(NVIDIA_API_KEY_STORAGE_KEY, keys.nvidiaKey)
        }
      })

      window.electron.ipcRenderer.invoke('get-personality').then((res) => {
        if (res) setPersonality(res)
      })
      window.electron.ipcRenderer
        .invoke('check-vault-status')
        .then((res) => setFaceCount(res?.faceCount || 0))

      window.electron.ipcRenderer
        .invoke('get-app-version')
        .then((v) => setAppVersion(v || 'Unknown'))
        .catch(() => setAppVersion('Unknown'))

      window.electron.ipcRenderer
        .invoke('get-update-feed-url')
        .then((url) => {
          if (url) setUpdateFeedUrl(url)
        })
        .catch(() => {})

      window.electron.ipcRenderer.on('updater-event', (_e, event = {}) => {
        const { status, data = {}, error = '' } = event
        if (status === 'checking') setUpdateStatus('checking')
        if (status === 'available') {
          setUpdateStatus('available')
          setUpdateVersion(String(data.version || ''))
          setUpdateNotes(String(data.releaseNotes || 'Bug fixes and performance improvements.'))
        }
        if (status === 'not-available') {
          setUpdateStatus('idle')
          setUpdateNotes('System is up to date.')
        }
        if (status === 'downloading') {
          setUpdateStatus('downloading')
          setIsInstallPromptOpen(false)
          setDownloadProgress(Math.round(Number(data.percent || 0)))
        }
        if (status === 'downloaded') {
          setUpdateStatus('ready')
          setDownloadProgress(100)
          if (data.version) setUpdateVersion(String(data.version))
          setUpdateNotes(String(data.releaseNotes || 'Update downloaded and ready to install.'))
          setIsInstallPromptOpen(true)
        }
        if (status === 'error') {
          setUpdateStatus('error')
          setIsInstallPromptOpen(false)
          setUpdateNotes(`Error: ${error || 'Unable to reach the update server.'}`)
        }
      })
    }
    return () => {
      if (window.electron?.ipcRenderer)
        window.electron.ipcRenderer.removeAllListeners('updater-event')
    }
  }, [])

  const checkAndDownloadUpdate = async () => {
    if (!window.electron?.ipcRenderer) return
    setIsInstallPromptOpen(false)
    setUpdateStatus('checking')
    setUpdateNotes(`Checking firmware feed and preparing in-app download:\n${updateFeedUrl}`)

    try {
      const result = await window.electron.ipcRenderer.invoke('check-and-download-update')
      if (result?.success === false) {
        throw new Error(result.error || 'Unable to download the update.')
      }

      if (result?.updateAvailable === false) {
        setUpdateStatus('idle')
        setUpdateNotes('System is up to date.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download the update.'
      setUpdateStatus('error')
      setUpdateNotes(`Error: ${message}`)
    }
  }

  const downloadUpdate = async () => {
    if (!window.electron?.ipcRenderer) return
    setIsInstallPromptOpen(false)
    setUpdateStatus('downloading')
    setDownloadProgress(0)

    try {
      const result = await window.electron.ipcRenderer.invoke('download-update')
      if (result?.success === false) {
        throw new Error(result.error || 'Unable to download the update.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download the update.'
      setUpdateStatus('error')
      setUpdateNotes(`Error: ${message}`)
    }
  }

  const installUpdate = async () => {
    if (!window.electron?.ipcRenderer) return

    try {
      setIsInstallPromptOpen(false)
      setUpdateStatus('installing')
      const result = await window.electron.ipcRenderer.invoke('install-update')
      if (result?.success === false) {
        throw new Error(result.error || 'Unable to install the update.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to install the update.'
      setUpdateStatus('error')
      setUpdateNotes(`Error: ${message}`)
    }
  }

  const installLater = () => {
    setIsInstallPromptOpen(false)
    setUpdateStatus('ready')
    setUpdateNotes('Update downloaded. You can install it from this Settings screen when ready.')
  }

  const handleVoiceChange = (v: 'MALE' | 'FEMALE') => {
    if (isSystemActive) return
    setVoice(v)
    localStorage.setItem('nexus_voice_profile', v)
  }

  const handlePersonalityChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
    if (words.length <= 150) setPersonality(text)
  }

  const savePersonality = async () => {
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('set-personality', personality)
      alert('Personality Matrix Saved Securely to OS.')
    }
  }

  const saveUserName = () => {
    localStorage.setItem('nexus_user_name', userName)
    alert('User Designation Saved.')
  }

  const saveApiKeys = async () => {
    const cleanNvidiaKey = sanitizeNvidiaKey(nvidiaKey)
    setNvidiaKey(cleanNvidiaKey)

    localStorage.setItem('nexus_custom_api_key', geminiKey)
    localStorage.setItem('nexus_groq_api_key', groqKey)
    localStorage.setItem('nexus_hf_api_key', hfKey)
    localStorage.setItem('nexus_tailvy_api_key', tailvyKey)
    localStorage.setItem(NVIDIA_API_KEY_STORAGE_KEY, cleanNvidiaKey)
    localStorage.setItem(NEXUS_AI_PROVIDER_MODE_STORAGE_KEY, aiProviderMode)

    if (window.electron?.ipcRenderer) {
      try {
        await window.electron.ipcRenderer.invoke('secure-save-keys', {
          groqKey,
          geminiKey,
          nvidiaKey: cleanNvidiaKey
        })
      } catch (e) {}
    }
    alert(
      'Neural uplinks saved. AI Chat will use the selected Nexus Server / Own API routing mode.'
    )
  }

  const saveNvidiaDefaults = () => {
    localStorage.setItem(NVIDIA_DEFAULTS_STORAGE_KEY, JSON.stringify(nvidiaDefaults))
    alert('NVIDIA Build model defaults saved.')
  }

  const syncNvidiaModels = async () => {
    if (!window.electron?.ipcRenderer) return
    setNvidiaSyncStatus('Syncing live NVIDIA /v1/models...')
    const cleanNvidiaKey = sanitizeNvidiaKey(nvidiaKey)
    const result = await window.electron.ipcRenderer.invoke('nvidia:list-models', {
      apiKey: aiProviderMode === 'own-key' ? cleanNvidiaKey : '',
      useNexusServers: aiProviderMode !== 'own-key'
    })

    if (result?.success) {
      setNvidiaSyncStatus(
        `Live endpoint returned ${result.models.length} models. Bundled catalog remains categorized.`
      )
    } else {
      setNvidiaSyncStatus(result?.error || 'Unable to sync NVIDIA models.')
    }
  }

  const currentWordCount = personality
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length

  const unlockAboutAdmin = () => {
    if (aboutAdminPass === ADMIN_PASS) {
      setIsAboutAdminUnlocked(true)
      setAboutStatus('Developer panel unlocked.')
      setAboutAdminPass('')
      return
    }

    setAboutStatus('Invalid admin pass.')
  }

  const saveDeveloperProfile = () => {
    localStorage.setItem(DEVELOPER_PROFILE_STORAGE_KEY, JSON.stringify(developerProfile))
    setAboutStatus('Developer profile saved locally. Rebuild to ship as a new default.')
  }

  const unlockSecurityModule = async () => {
    if (!window.electron?.ipcRenderer) return
    const isValid = await window.electron.ipcRenderer.invoke('verify-vault-pin', authPin)
    if (isValid) {
      setIsSecurityUnlocked(true)
      setAuthPin('')
    } else {
      setAuthError(true)
      setTimeout(() => setAuthError(false), 1000)
    }
  }

  const updateMasterPin = async () => {
    if (newPin.length !== 4 || !window.electron?.ipcRenderer) return
    await window.electron.ipcRenderer.invoke('setup-vault-pin', newPin)
    setNewPin('')
    alert('Master PIN Updated Successfully.')
  }

  const startFaceEnrollment = async () => {
    setIsScanningFace(true)
    setEnrollStatus('INITIALIZING CAMERA...')
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models')
      ])

      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setEnrollStatus('POSITION FACE IN FRAME')

        const scanInterval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState !== 4) return
          const detection = await faceapi
            .detectSingleFace(videoRef.current)
            .withFaceLandmarks()
            .withFaceDescriptor()

          if (detection) {
            clearInterval(scanInterval)
            setEnrollStatus('FACE ACQUIRED. ENCRYPTING...')
            const descriptorArray = Array.from(detection.descriptor)

            if (window.electron?.ipcRenderer) {
              await window.electron.ipcRenderer.invoke('setup-vault-face', descriptorArray)
            }

            stream.getTracks().forEach((t) => t.stop())
            setIsScanningFace(false)
            setFaceCount((prev) => prev + 1)
            alert('New Biometric Identity Saved.')
          }
        }, 1000)
      }
    } catch (e) {
      setEnrollStatus('CAMERA ERROR')
      setTimeout(() => setIsScanningFace(false), 2000)
    }
  }

  const cardClass =
    'bg-[#0f0f13] border border-white/10 p-6 md:p-8 rounded-2xl flex flex-col gap-5 hover:border-white/20 transition-all shadow-lg'
  const inputContainerClass =
    'flex items-center bg-[#050505] border border-white/10 rounded-lg px-4 py-3 focus-within:border-white/30 focus-within:bg-black transition-all duration-300 w-full'
  const titleClass = 'text-sm font-semibold text-white flex items-center gap-2'

  return (
    <div className="min-h-full p-6 md:p-10 lg:p-16 flex flex-col items-center bg-black text-zinc-100">
      <motion.div
        className="w-full max-w-4xl flex flex-col gap-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-[#111] rounded-2xl border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.03)]">
              <GiArtificialIntelligence size={36} className="text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Command Center</h2>
              <p className="text-xs text-zinc-400 font-mono mt-1 tracking-widest flex items-center gap-2 uppercase">
                <RiRecordCircleLine
                  className={`${isSystemActive ? 'text-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'text-zinc-600'}`}
                  size={14}
                />
                {isSystemActive ? 'System Online' : 'System Offline'}
              </p>
            </div>
          </div>

          <div className="flex bg-[#0a0a0c] p-1 rounded-xl border border-white/10 w-full md:w-fit shadow-lg overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('updates')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold tracking-widest rounded-lg transition-all duration-300 ${activeTab === 'updates' ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <RiTerminalWindowLine size={16} /> SYSTEM
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold tracking-widest rounded-lg transition-all duration-300 ${activeTab === 'general' ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <RiSettings4Line size={16} /> GENERAL
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold tracking-widest rounded-lg transition-all duration-300 ${activeTab === 'keys' ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <RiPlugLine size={16} /> API KEYS
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold tracking-widest rounded-lg transition-all duration-300 ${activeTab === 'models' ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <RiBrainLine size={16} /> MODELS
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold tracking-widest rounded-lg transition-all duration-300 ${activeTab === 'security' ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <RiShieldKeyholeLine size={16} /> SECURITY
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold tracking-widest rounded-lg transition-all duration-300 ${activeTab === 'about' ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            >
              <RiUserLine size={16} /> ABOUT
            </button>
          </div>
        </div>

        <div className="relative pb-12 mt-2">
          <AnimatePresence mode="wait">
            {activeTab === 'updates' && (
              <motion.div
                key="updates"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full"
              >
                <div className={`${cardClass} md:col-span-1 border-emerald-500/20`}>
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <span className={titleClass}>
                      <RiRocketLine className="text-emerald-400" size={18} /> Update Firmware
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded font-mono font-bold tracking-widest">
                      v{appVersion}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 items-center justify-center flex-1 py-4 text-center">
                    {updateStatus === 'idle' || updateStatus === 'error' ? (
                      <>
                        <RiTerminalWindowLine
                          size={48}
                          className={updateStatus === 'error' ? 'text-red-400' : 'text-zinc-700'}
                        />
                        <p
                          className={`text-xs font-mono ${updateStatus === 'error' ? 'text-red-300' : 'text-zinc-400'}`}
                        >
                          {updateStatus === 'error'
                            ? 'Update check failed.'
                            : 'Current build is stable.'}
                        </p>
                        <p className="w-full break-all rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
                          Website feed: {updateFeedUrl}
                        </p>
                        <button
                          onClick={checkAndDownloadUpdate}
                          className="mt-2 w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <RiDownloadCloud2Line size={16} /> CHECK & DOWNLOAD FIRMWARE
                        </button>
                      </>
                    ) : updateStatus === 'checking' ? (
                      <>
                        <RiRefreshLine size={48} className="text-emerald-500 animate-spin" />
                        <p className="text-xs text-emerald-400 font-mono animate-pulse">
                          PINGING NEURAL NETWORK...
                        </p>
                      </>
                    ) : updateStatus === 'available' ? (
                      <>
                        <RiDownloadCloud2Line size={48} className="text-cyan-400" />
                        <p className="text-xs text-cyan-400 font-mono">
                          NEW BUILD FOUND: v{updateVersion}
                        </p>
                        <button
                          onClick={downloadUpdate}
                          className="mt-2 w-full py-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 text-cyan-400 hover:text-black font-bold tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all border border-cyan-500/50 cursor-pointer"
                        >
                          <RiDownloadCloud2Line size={16} /> DOWNLOAD FIRMWARE
                        </button>
                      </>
                    ) : updateStatus === 'downloading' ? (
                      <div className="w-full flex flex-col gap-3">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span>DOWNLOADING PATCH...</span>
                          <span>{downloadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-cyan-500 shadow-[0_0_10px_#06b6d4] transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : updateStatus === 'installing' ? (
                      <>
                        <RiRocketLine size={48} className="text-emerald-400 animate-pulse" />
                        <p className="text-xs text-emerald-400 font-mono">
                          RESTARTING TO INSTALL...
                        </p>
                      </>
                    ) : (
                      <>
                        <RiRecordCircleLine size={48} className="text-emerald-400 animate-pulse" />
                        <p className="text-xs text-emerald-400 font-mono">PATCH DOWNLOADED</p>
                        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            onClick={installUpdate}
                            className="mt-2 w-full py-3 rounded-lg bg-emerald-500 text-black font-bold tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
                          >
                            <RiRocketLine size={16} /> INSTALL NOW
                          </button>
                          <button
                            onClick={installLater}
                            className="mt-2 w-full py-3 rounded-lg bg-white/5 text-zinc-300 hover:text-white border border-white/10 font-bold tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            LATER
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className={`${cardClass} md:col-span-1`}>
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <span className={titleClass}>
                      <RiTerminalWindowLine className="text-zinc-400" size={18} /> Firmware Notes
                    </span>
                  </div>
                  <div className="flex-1 bg-[#050505] border border-white/5 rounded-xl p-4 overflow-y-auto max-h-60 scrollbar-small">
                    <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
                      {updateNotes}
                    </pre>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- TAB 2: GENERAL --- */}
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full"
              >
                <div className={`${cardClass} md:col-span-2`}>
                  <div className="flex justify-between items-center">
                    <span className={titleClass}>
                      <RiUserLine className="text-zinc-400" size={18} /> AI Personality Matrix
                    </span>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-[10px] font-mono tracking-widest ${currentWordCount >= 150 ? 'text-red-400' : 'text-zinc-400'}`}
                      >
                        {currentWordCount} / 150 WORDS
                      </span>
                      <button
                        onClick={savePersonality}
                        className="text-zinc-400 hover:text-white transition-colors bg-white/5 p-2 rounded-md hover:bg-white/10 border border-white/5"
                      >
                        <RiSave3Line size={18} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={personality}
                    onChange={handlePersonalityChange}
                    placeholder="Define who Nexus is. Example: 'You are a sassy, highly technical assistant...'"
                    className="bg-[#050505] border border-white/10 rounded-lg p-4 text-sm text-zinc-200 h-32 resize-none focus:border-white/30 outline-none transition-all scrollbar-small"
                  />
                </div>

                <div className={cardClass}>
                  <div className="flex justify-between items-end">
                    <span className={titleClass}>
                      <RiUserLine className="text-zinc-400" size={18} /> User Designation
                    </span>
                  </div>
                  <div className={inputContainerClass}>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter operator name..."
                      className="bg-transparent border-none outline-none text-sm text-zinc-100 w-full placeholder:text-zinc-600 font-medium"
                    />
                    <button
                      onClick={saveUserName}
                      className="text-zinc-500 hover:text-white transition-colors ml-2"
                    >
                      <RiSave3Line size={20} />
                    </button>
                  </div>
                </div>

                <div className={`${cardClass} relative`}>
                  <div className="flex justify-between items-center">
                    <span className={titleClass}>
                      <RiUserVoiceLine className="text-zinc-400" size={18} /> OS Voice Profile
                    </span>
                    {isSystemActive && (
                      <span className="text-[10px] text-red-400 font-mono tracking-widest flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                        <RiLock2Line /> LOCKED AS Nexus IS CONNECTED
                      </span>
                    )}
                  </div>
                  <div
                    className={`flex gap-3 h-12 mt-1 ${isSystemActive ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {(['FEMALE', 'MALE'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleVoiceChange(s)}
                        disabled={isSystemActive}
                        className={`cursor-pointer flex-1 flex items-center justify-center text-[12px] font-bold rounded-lg transition-all tracking-widest border ${
                          voice === s
                            ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                            : 'bg-[#050505] border-white/10 text-zinc-400 hover:text-white hover:border-white/30'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {isSystemActive && (
                    <div
                      className="absolute inset-0 z-10"
                      title="Disconnect AI to change voice"
                    ></div>
                  )}
                </div>
              </motion.div>
            )}

            {/* --- TAB 3: API KEYS --- */}
            {activeTab === 'keys' && (
              <motion.div
                key="keys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 gap-6 w-full"
              >
                <div className={`${cardClass} gap-6`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <span className={titleClass}>
                      <RiKey2Line className="text-zinc-400" size={18} /> External API Endpoints
                    </span>
                    <button
                      onClick={saveApiKeys}
                      className="bg-white text-black px-6 py-2.5 rounded-lg text-xs font-bold tracking-widest hover:bg-zinc-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RiSave3Line size={16} /> SAVE ALL KEYS
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                    {[
                      {
                        id: 'nexus',
                        title: 'Run models on Nexus Servers',
                        text: 'Default. Uses multi-site Vercel/Netlify failover and does not require a user API key.'
                      },
                      {
                        id: 'own-key',
                        title: 'Use my own NVIDIA API key',
                        text: 'Advanced mode. Requests go directly to NVIDIA using the encrypted local key below.'
                      }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setAiProviderMode(mode.id)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          aiProviderMode === mode.id
                            ? 'border-emerald-400/50 bg-emerald-500/15 text-white'
                            : 'border-white/10 bg-black/40 text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        <span className="text-xs font-black uppercase tracking-widest">
                          {mode.title}
                        </span>
                        <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{mode.text}</p>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-2">
                        <RiBrainLine size={14} /> Gemini Pro Core
                      </label>
                      <div className={inputContainerClass}>
                        <input
                          type="password"
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                          placeholder="AIzaSy_..."
                          className="bg-transparent border-none outline-none text-sm font-mono text-zinc-100 w-full placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-2">
                      <RiBrainLine size={14} /> NVIDIA Build NIM Override
                      </label>
                      <div className={inputContainerClass}>
                        <input
                          type="password"
                          value={nvidiaKey}
                          onChange={(e) => setNvidiaKey(e.target.value)}
                          placeholder="Optional: nvapi-... override"
                          className="bg-transparent border-none outline-none text-sm font-mono text-zinc-100 w-full placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-2">
                        <RiCpuLine size={14} /> Groq Fast Inferencing
                      </label>
                      <div className={inputContainerClass}>
                        <input
                          type="password"
                          value={groqKey}
                          onChange={(e) => setGroqKey(e.target.value)}
                          placeholder="gsk_..."
                          className="bg-transparent border-none outline-none text-sm font-mono text-zinc-100 w-full placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-2">
                        <RiCloudLine size={14} /> Hugging Face Vision
                      </label>
                      <div className={inputContainerClass}>
                        <input
                          type="password"
                          value={hfKey}
                          onChange={(e) => setHfKey(e.target.value)}
                          placeholder="hf_..."
                          className="bg-transparent border-none outline-none text-sm font-mono text-zinc-100 w-full placeholder:text-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase flex items-center gap-2">
                        <RiPlugLine size={14} /> Tailvy Builder Agent
                      </label>
                      <div className={inputContainerClass}>
                        <input
                          type="password"
                          value={tailvyKey}
                          onChange={(e) => setTailvyKey(e.target.value)}
                          placeholder="tlv_..."
                          className="bg-transparent border-none outline-none text-sm font-mono text-zinc-100 w-full placeholder:text-zinc-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#050505] border border-emerald-500/15 p-5 rounded-xl mt-2 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-4">
                      <div>
                        <span className={titleClass}>
                          <RiBrainLine className="text-emerald-400" size={18} /> NVIDIA API Key
                          Guide
                        </span>
                        <p className="text-[10px] text-zinc-500 font-mono mt-1 tracking-widest uppercase">
                          Optional override. Nexus API works without a user key.
                        </p>
                      </div>
                      <a
                        href="https://build.nvidia.com/settings/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-bold tracking-widest text-emerald-300 transition-all hover:bg-emerald-500/20"
                      >
                        OPEN NVIDIA KEYS <RiExternalLinkLine size={14} />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {[
                        {
                          step: '01',
                          title: 'Default Mode',
                          text: 'Leave this blank to use the hosted Nexus NVIDIA route.'
                        },
                        {
                          step: '02',
                          title: 'Optional Key',
                          text: 'Advanced users can generate a personal NVIDIA Build key.'
                        },
                        {
                          step: '03',
                          title: 'Paste Override',
                          text: 'Paste it above only if you want local billing/control.'
                        },
                        {
                          step: '04',
                          title: 'Save & Chat',
                          text: 'Click Save All Keys, then open the AI Chat tab.'
                        }
                      ].map((item) => (
                        <div
                          key={item.step}
                          className="rounded-xl border border-white/5 bg-black/40 p-4"
                        >
                          <span className="text-[10px] font-mono text-emerald-400">
                            {item.step}
                          </span>
                          <h4 className="mt-2 text-xs font-black tracking-widest text-white uppercase">
                            {item.title}
                          </h4>
                          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                            {item.text}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-white/5 bg-black/50 p-4 text-[10px] font-mono text-zinc-400">
                      Direct NVIDIA base URL used only when a local override key exists:{' '}
                      <span className="text-emerald-300">
                        https://integrate.api.nvidia.com/v1
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#050505] border border-white/5 p-4 rounded-xl mt-2 flex items-start gap-3">
                    <RiShieldKeyholeLine className="text-zinc-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">
                      [SECURITY NOTICE]: Optional local API keys are encrypted and stored strictly
                      in your local OS. If no NVIDIA key is saved, AI Chat uses the hosted Nexus
                      proxy, so prompts are sent to the hosted Nexus API route and billed through
                      the configured server-side NVIDIA key.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- TAB 4: NVIDIA MODELS --- */}
            {activeTab === 'models' && (
              <motion.div
                key="models"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 gap-6 w-full"
              >
                <div className={`${cardClass} gap-6`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <span className={titleClass}>
                        <RiBrainLine className="text-emerald-400" size={18} /> NVIDIA Build Model
                        Defaults
                      </span>
                      <p className="text-[10px] text-zinc-500 font-mono mt-2 tracking-widest uppercase">
                        Chat uses OpenAI-compatible NVIDIA NIM. Voice assistant reads these defaults
                        at startup.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={syncNvidiaModels}
                        className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-5 py-2.5 rounded-lg text-xs font-bold tracking-widest hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RiRefreshLine size={16} /> SYNC LIVE MODELS
                      </button>
                      <button
                        onClick={saveNvidiaDefaults}
                        className="bg-white text-black px-5 py-2.5 rounded-lg text-xs font-bold tracking-widest hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RiSave3Line size={16} /> SAVE DEFAULTS
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#050505] p-4 text-[10px] font-mono text-zinc-400 leading-relaxed">
                    {nvidiaSyncStatus}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {NVIDIA_MODEL_CATEGORIES.map((category) => {
                      const options = getModelsForCategory(category.id)
                      const selected = getNvidiaModelById(nvidiaDefaults[category.id])

                      return (
                        <div
                          key={category.id}
                          className="bg-[#050505] border border-white/10 rounded-2xl p-5 flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <label className="text-[10px] text-white font-bold font-mono tracking-widest uppercase">
                                {category.label}
                              </label>
                              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                                {category.hint}
                              </p>
                            </div>
                            <span className="text-[9px] text-emerald-400/70 border border-emerald-500/20 rounded-full px-2 py-1 font-mono">
                              {options.length}
                            </span>
                          </div>

                          <select
                            value={nvidiaDefaults[category.id]}
                            onChange={(event) =>
                              setNvidiaDefaults((current) => ({
                                ...current,
                                [category.id]: event.target.value
                              }))
                            }
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-3 text-xs font-mono text-zinc-100 outline-none focus:border-emerald-500/50"
                          >
                            {options.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.id}
                              </option>
                            ))}
                          </select>

                          <div className="min-h-20 rounded-xl border border-white/5 bg-black/40 p-3">
                            <p className="text-[11px] text-zinc-300 font-semibold">
                              {selected?.provider || 'NVIDIA'} / {selected?.name || 'model'}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                              {selected?.description || 'Model selected from live NVIDIA endpoint.'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="bg-[#050505] border border-white/5 p-4 rounded-xl flex items-start gap-3">
                    <RiShieldKeyholeLine className="text-zinc-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">
                      The bundled catalog includes current NVIDIA Build LLM, coding, reasoning,
                      multimodal, speech, translation, image, and retrieval models. The live sync
                      button queries the hosted Nexus models route when no local key is saved, or
                      NVIDIA's /v1/models endpoint directly when you provide an override key.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- TAB 5: SECURITY --- */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full rounded-3xl overflow-hidden shadow-2xl border border-white/5"
              >
                <AnimatePresence>
                  {!isSecurityUnlocked && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                      className="absolute inset-0 z-20 backdrop-blur-2xl bg-black/70 border border-white/10 rounded-3xl flex flex-col items-center justify-center"
                    >
                      <div className="bg-[#111] p-5 rounded-full mb-6 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                        <RiLockPasswordLine size={40} className="text-white" />
                      </div>
                      <p className="text-xs text-zinc-300 font-mono tracking-widest uppercase mb-6 font-semibold">
                        Authenticate to access Vault Settings
                      </p>
                      <div className="flex gap-3 items-center h-12">
                        <input
                          type="password"
                          maxLength={4}
                          pattern="\d*"
                          value={authPin}
                          onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="PIN"
                          className={`h-full bg-[#050505] border w-32 rounded-lg text-center text-xl tracking-[0.5em] text-white outline-none transition-colors ${authError ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-white/20 focus:border-white focus:bg-[#111]'}`}
                        />
                        <button
                          onClick={unlockSecurityModule}
                          className="h-full px-8 bg-white text-black text-xs font-bold tracking-widest rounded-lg hover:bg-zinc-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer"
                        >
                          UNLOCK
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0a0a0c] p-6 rounded-3xl border border-white/5">
                  <div className="bg-[#111113] border border-white/10 p-7 rounded-2xl flex flex-col gap-5">
                    <span className={titleClass}>
                      <RiLockPasswordLine className="text-zinc-400" size={18} /> Update Master PIN
                    </span>
                    <div className={inputContainerClass}>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="\d*"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter new 4-digit PIN..."
                        className="bg-transparent border-none outline-none text-sm font-mono text-zinc-100 w-full tracking-[0.3em]"
                      />
                      <button
                        onClick={updateMasterPin}
                        className="text-zinc-500 hover:text-white transition-colors ml-2 cursor-pointer"
                      >
                        <RiSave3Line size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#111113] border border-white/10 p-7 rounded-2xl flex flex-col gap-6">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                      <span className={titleClass}>
                        <RiScan2Line className="text-zinc-400" size={18} /> Biometric Registry
                      </span>
                      <span className="text-[10px] text-white font-mono tracking-widest bg-white/10 px-3 py-1.5 rounded-md font-semibold border border-white/5">
                        {faceCount} ENROLLED
                      </span>
                    </div>

                    {isScanningFace ? (
                      <div className="flex items-center gap-4 bg-[#050505] p-3 rounded-xl border border-white/20">
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-16 h-16 rounded-lg object-cover -scale-x-100 border border-white/10"
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-white font-mono tracking-widest animate-pulse font-bold">
                            {enrollStatus}
                          </span>
                          <span className="text-xs text-zinc-400">Keep head steady...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 h-full justify-between">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Enroll additional structural face descriptors. Data is mathematically
                          encrypted and stored locally.
                        </p>
                        <button
                          onClick={startFaceEnrollment}
                          className="w-full py-3 rounded-lg bg-white text-black font-bold tracking-widest text-[12px] flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] mt-auto cursor-pointer"
                        >
                          <RiAddLine size={18} /> ENROLL NEW IDENTITY
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- TAB 6: ABOUT --- */}
            {activeTab === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 gap-6 w-full"
              >
                <div className="rounded-3xl border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32rem),#070808] p-8 shadow-2xl">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-white/10 pb-6">
                    <div>
                      <p className="text-[10px] font-mono font-black uppercase tracking-[0.35em] text-emerald-400">
                        Developer Registry
                      </p>
                      <h3 className="mt-3 text-4xl font-black uppercase tracking-tight text-white">
                        {developerProfile.developer}
                      </h3>
                      <p className="mt-2 text-sm font-semibold text-zinc-400">
                        {developerProfile.role} / {developerProfile.team}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-right">
                      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
                        Company
                      </p>
                      <p className="mt-2 text-lg font-black text-emerald-200">
                        {developerProfile.company}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      ['Developer', developerProfile.developer],
                      ['Team', developerProfile.team],
                      ['Website', developerProfile.website]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-black/35 p-4">
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                          {label}
                        </p>
                        <p className="mt-2 break-words text-sm font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-5 text-sm leading-relaxed text-zinc-300">
                    {developerProfile.note}
                  </p>
                </div>

                <div className={`${cardClass} gap-5`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <span className={titleClass}>
                        <RiShieldKeyholeLine className="text-emerald-400" size={18} /> Admin Edit
                        Panel
                      </span>
                      <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                        Default universal admin pass: 05122010
                      </p>
                    </div>
                    {!isAboutAdminUnlocked && (
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={aboutAdminPass}
                          onChange={(event) => setAboutAdminPass(event.target.value)}
                          placeholder="Admin pass"
                          className="rounded-lg border border-white/10 bg-black px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/40"
                        />
                        <button
                          onClick={unlockAboutAdmin}
                          className="rounded-lg bg-emerald-400 px-5 py-2 text-xs font-black tracking-widest text-black"
                        >
                          UNLOCK
                        </button>
                      </div>
                    )}
                  </div>

                  {isAboutAdminUnlocked ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(
                          [
                            ['developer', 'Developer'],
                            ['team', 'Team'],
                            ['company', 'Company'],
                            ['role', 'Role'],
                            ['website', 'Website']
                          ] as Array<[keyof typeof DEFAULT_DEVELOPER_PROFILE, string]>
                        ).map(([key, label]) => (
                          <label key={key} className="flex flex-col gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                              {label}
                            </span>
                            <input
                              value={developerProfile[key]}
                              onChange={(event) =>
                                setDeveloperProfile((current) => ({
                                  ...current,
                                  [key]: event.target.value
                                }))
                              }
                              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                            />
                          </label>
                        ))}
                      </div>
                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                          About Note
                        </span>
                        <textarea
                          value={developerProfile.note}
                          onChange={(event) =>
                            setDeveloperProfile((current) => ({
                              ...current,
                              note: event.target.value
                            }))
                          }
                          className="min-h-28 resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
                        />
                      </label>
                      <button
                        onClick={saveDeveloperProfile}
                        className="w-full rounded-xl bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-black"
                      >
                        Save Developer Profile
                      </button>
                    </>
                  ) : (
                    <p className="rounded-xl border border-white/5 bg-black/40 p-4 text-xs leading-relaxed text-zinc-500">
                      Developer profile editing is locked. Enter the admin pass to edit this app's
                      local About section.
                    </p>
                  )}

                  {aboutStatus && (
                    <p className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-[11px] font-mono text-emerald-300">
                      {aboutStatus}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isInstallPromptOpen && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-[#0b0f0d] p-6 shadow-[0_0_40px_rgba(16,185,129,0.18)]"
                  initial={{ scale: 0.96, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.96, y: 12 }}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <RiDownloadCloud2Line className="text-emerald-400" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Update ready</h3>
                      <p className="text-xs font-mono uppercase tracking-widest text-emerald-300">
                        v{updateVersion || 'latest'} downloaded in app
                      </p>
                    </div>
                  </div>

                  <p className="mb-6 text-sm leading-relaxed text-zinc-300">
                    Nexus has downloaded the update. Install now to restart and apply it, or keep
                    working and install it later from this screen.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      onClick={installLater}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold tracking-widest text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      LATER
                    </button>
                    <button
                      onClick={installUpdate}
                      className="rounded-lg bg-emerald-500 px-4 py-3 text-xs font-bold tracking-widest text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
                    >
                      INSTALL NOW
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

export default SettingsView
