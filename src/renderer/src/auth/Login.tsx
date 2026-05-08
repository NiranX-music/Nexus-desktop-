import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Cloud,
  Cpu,
  Database,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MonitorSmartphone,
  Network,
  ShieldCheck,
  TerminalSquare,
  User,
  UserPlus
} from 'lucide-react'

import { activateCloudSessionPayload } from '@renderer/services/cloud-session'
import {
  normalizeAppAuthUser,
  persistPreferredDesktopAuthMode,
  persistStoredAppAuthToken
} from '@renderer/services/auth-session'
import { useAuthStore } from '@renderer/store/auth-store'

const CLOUD_AUTH_FEEDBACK_STORAGE_KEY = 'nexus_cloud_auth_feedback'
const LOGIN_UI_MODE_STORAGE_KEY = 'nexus_login_ui_mode'

type LoginSurfaceMode = 'cloud' | 'app'
type AppAuthStep = 'login' | 'register'

const readCloudAuthFeedback = () => localStorage.getItem(CLOUD_AUTH_FEEDBACK_STORAGE_KEY) || ''
const readPreferredUiMode = (): LoginSurfaceMode =>
  localStorage.getItem(LOGIN_UI_MODE_STORAGE_KEY) === 'app' ? 'app' : 'cloud'

const normalizeDesktopLoginCode = (value = '') => {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^NX/, '')
    .slice(0, 8)

  if (!raw) return ''

  const groups = ['NX', raw.slice(0, 4), raw.slice(4, 8)].filter(Boolean)
  return groups.join('-')
}

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export default function LoginPage() {
  const navigate = useNavigate()
  const [bootLogs, setBootLogs] = useState<string[]>([])
  const [isReady, setIsReady] = useState(false)
  const [authMode, setAuthMode] = useState<LoginSurfaceMode>(readPreferredUiMode())
  const [appAuthStep, setAppAuthStep] = useState<AppAuthStep>('login')
  const [authError, setAuthError] = useState(readCloudAuthFeedback())
  const [statusMessage, setStatusMessage] = useState('')
  const [desktopLoginCode, setDesktopLoginCode] = useState('')
  const [isOpeningWebsite, setIsOpeningWebsite] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [isAppAuthBusy, setIsAppAuthBusy] = useState(false)
  const [appName, setAppName] = useState('')
  const [appEmail, setAppEmail] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [appConfirmPassword, setAppConfirmPassword] = useState('')

  const electronAPI = (window as any).electron?.ipcRenderer

  const clearAuthMessages = () => {
    setAuthError('')
    setStatusMessage('')
    localStorage.removeItem(CLOUD_AUTH_FEEDBACK_STORAGE_KEY)
  }

  const activateAppAccountSession = (payload: any) => {
    if (!payload?.ok || !payload?.token || !payload?.user) {
      throw new Error(payload?.error || 'Unable to activate the Nexus app account session.')
    }

    const user = normalizeAppAuthUser(payload.user)
    persistStoredAppAuthToken(payload.token)
    persistPreferredDesktopAuthMode('app')
    localStorage.setItem('nexus_user_name', user.name)
    useAuthStore.getState().setAuthSession({
      token: payload.token,
      mode: 'app',
      user
    })

    return user
  }

  const handleWebsiteLogin = async () => {
    clearAuthMessages()

    if (!electronAPI) {
      window.open(
        `${import.meta.env.VITE_NEXUS_WEB_APP_URL || 'https://niranx-nexus-agent.vercel.app'}/auth=desktop?desktop=1`,
        '_blank'
      )
      setStatusMessage(
        'Website opened. Sign in there, copy the Nexus desktop code, then paste it below.'
      )
      return
    }

    setIsOpeningWebsite(true)
    try {
      const response = await electronAPI.invoke('cloud-auth:open-login')
      if (!response?.ok) {
        setAuthError(response?.error || 'Unable to open Nexus website login.')
        return
      }

      setStatusMessage(
        'Website opened. Sign in there, generate a Nexus desktop code, then paste it below.'
      )
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to open the Nexus website login flow.'
      )
    } finally {
      setIsOpeningWebsite(false)
    }
  }

  const verifyDesktopCode = async () => {
    const code = normalizeDesktopLoginCode(desktopLoginCode)

    setDesktopLoginCode(code)
    clearAuthMessages()

    if (code.length < 12) {
      setAuthError('Enter the full Nexus desktop code from the website.')
      return
    }

    if (!electronAPI) {
      setAuthError('Desktop code verification is only available inside the Nexus app.')
      return
    }

    setIsVerifyingCode(true)
    setStatusMessage('Verifying Nexus desktop code...')

    try {
      const response = await electronAPI.invoke('cloud-auth:redeem-code', { userCode: code })
      if (!response?.ok) {
        throw new Error(response?.error || 'Unable to verify the Nexus desktop code.')
      }

      await activateCloudSessionPayload(response)
      setStatusMessage('Cloud access granted. Entering Nexus...')
      navigate('/', { replace: true })
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Unable to verify the Nexus desktop code.'
      )
      setStatusMessage('')
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const submitAppAuth = async () => {
    clearAuthMessages()

    if (!electronAPI) {
      setAuthError('App account auth is only available inside the Nexus desktop app.')
      return
    }

    const email = appEmail.trim().toLowerCase()
    const password = appPassword
    const name = appName.trim()

    if (!isValidEmail(email)) {
      setAuthError('Enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setAuthError('Use at least 8 characters for the app account password.')
      return
    }

    if (appAuthStep === 'register') {
      if (name.length < 2) {
        setAuthError('Enter a display name for the app account.')
        return
      }

      if (appConfirmPassword !== password) {
        setAuthError('Passwords do not match yet.')
        return
      }
    }

    setIsAppAuthBusy(true)
    setStatusMessage(
      appAuthStep === 'register'
        ? 'Creating secure app account on this PC...'
        : 'Signing into the app account...'
    )

    try {
      const response =
        appAuthStep === 'register'
          ? await electronAPI.invoke('email-auth:register', { name, email, password })
          : await electronAPI.invoke('email-auth:login', { email, password })

      if (!response?.ok) {
        throw new Error(response?.error || 'Unable to complete app account sign-in.')
      }

      activateAppAccountSession(response)
      setStatusMessage(
        appAuthStep === 'register'
          ? 'App account created. Entering Nexus...'
          : 'App account unlocked. Entering Nexus...'
      )
      navigate('/', { replace: true })
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Unable to complete app account sign-in.'
      )
      setStatusMessage('')
    } finally {
      setIsAppAuthBusy(false)
    }
  }

  useEffect(() => {
    const sequence = [
      'SYS_BOOT: INITIATING KERNEL...',
      'SECURE_ENCLAVE: MOUNTED',
      'NEURAL_LINK: ESTABLISHING...',
      'IPC_BRIDGE: [OK]',
      'AUTH_FABRIC: CLOUD + APP MODES READY',
      'AGENTIC_ROUTER: ONLINE',
      'AWAITING OPERATOR HANDSHAKE...'
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < sequence.length) {
        setBootLogs((prev) => [...prev, sequence[currentStep]])
        currentStep += 1
      } else {
        setIsReady(true)
        clearInterval(interval)
      }
    }, 550)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const syncFeedback = () => {
      setAuthError(readCloudAuthFeedback())
    }

    window.addEventListener('nexus-cloud-auth-feedback', syncFeedback)
    return () => window.removeEventListener('nexus-cloud-auth-feedback', syncFeedback)
  }, [])

  useEffect(() => {
    localStorage.setItem(LOGIN_UI_MODE_STORAGE_KEY, authMode)
    clearAuthMessages()
  }, [authMode])

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  }

  const cardVariants: any = {
    hidden: { opacity: 0, scale: 0.95 },
    show: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 300, damping: 25 }
    }
  }

  const panelVariants: any = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
  }

  const rightPanelVariants: any = {
    hidden: { opacity: 0, x: 20 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] p-4 font-sans text-emerald-50 selection:bg-emerald-500/30 selection:text-emerald-100 lg:p-8">
      <div className="pointer-events-none absolute top-[-10%] left-[-5%] h-125 w-125 animate-pulse rounded-full bg-emerald-600/10 blur-[150px]" />
      <div className="pointer-events-none absolute right-[-5%] bottom-[-10%] h-125 w-125 rounded-full bg-cyan-900/10 blur-[150px]" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#10b98105_1px,transparent_1px),linear-gradient(to_bottom,#10b98105_1px,transparent_1px)] bg-[size:40px_40px] mix-blend-screen" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 grid w-full max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-12"
      >
        <motion.div
          variants={panelVariants}
          className="relative col-span-3 hidden h-125 flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40 p-5 shadow-2xl backdrop-blur-md lg:flex"
        >
          <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-4">
            <TerminalSquare className="h-5 w-5 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
              System Log
            </h3>
          </div>
          <div className="flex flex-1 flex-col justify-end overflow-hidden font-mono text-[10px] leading-relaxed tracking-wider">
            <AnimatePresence>
              {bootLogs.map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`mb-2 ${index === bootLogs.length - 1 ? 'font-bold text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-zinc-500'}`}
                >
                  <span className="mr-2 text-emerald-700 opacity-50">{'>'}</span> {log}
                </motion.div>
              ))}
            </AnimatePresence>
            {isReady && (
              <motion.div
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="mt-1 text-emerald-400"
              >
                _
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="col-span-1 flex flex-col items-center justify-center lg:col-span-6"
        >
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="relative mb-6 inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/30 bg-black shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <motion.div
                className="absolute left-0 h-0.5 w-full bg-emerald-400 shadow-[0_0_15px_#34d399]"
                animate={{ top: ['-10%', '110%', '-10%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />
              <Cpu className="relative z-10 h-10 w-10 text-emerald-400" />
            </div>

            <h1 className="mb-2 text-4xl font-black uppercase tracking-[0.2em] text-white drop-shadow-md">
              Nexus <span className="text-emerald-500">OS</span>
            </h1>
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">
              Dual Path Authentication Surface
            </p>
          </div>

          <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-black/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="absolute top-0 left-0 h-1 w-full bg-linear-to-r from-transparent via-emerald-500 to-transparent opacity-40" />

            <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/45 p-2">
              <button
                type="button"
                onClick={() => setAuthMode('cloud')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  authMode === 'cloud'
                    ? 'border border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    : 'border border-transparent bg-transparent text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <Cloud className="h-4 w-4" />
                Cloud Access
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('app')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  authMode === 'app'
                    ? 'border border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    : 'border border-transparent bg-transparent text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <MonitorSmartphone className="h-4 w-4" />
                App Account
              </button>
            </div>

            <AnimatePresence mode="wait">
              {authMode === 'cloud' ? (
                <motion.div
                  key="cloud-auth"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="mb-6 flex items-start gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
                    <div>
                      <p className="text-xs font-mono leading-relaxed text-zinc-300">
                        Cloud Access uses your Nexus website plus Supabase account. It is the sync
                        path for cloud data, paired devices, and the full online workspace.
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                        Browser handoff + one-time desktop code
                      </p>
                    </div>
                  </div>

                  <div className="group relative w-full">
                    <div className="absolute -inset-0.5 rounded-xl bg-linear-to-r from-emerald-500 to-cyan-600 opacity-0 blur transition duration-300 group-hover:opacity-100" />

                    <button
                      onClick={handleWebsiteLogin}
                      disabled={!isReady || isOpeningWebsite}
                      className={`relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/40 bg-black px-6 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all duration-200 ease-in-out ${
                        !isReady
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:border-emerald-500/90 hover:bg-white hover:text-black'
                      }`}
                    >
                      {isOpeningWebsite ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <LogIn className="h-5 w-5" />
                      )}
                      Open Website Login
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-4">
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                      Desktop Login Code
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        value={desktopLoginCode}
                        onChange={(event) =>
                          setDesktopLoginCode(normalizeDesktopLoginCode(event.target.value))
                        }
                        placeholder="NX-AB12-CD34"
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-center font-mono text-base font-black tracking-[0.26em] text-white outline-none transition focus:border-emerald-400/60"
                      />
                      <button
                        type="button"
                        onClick={verifyDesktopCode}
                        disabled={!isReady || isVerifyingCode}
                        className="rounded-xl border border-emerald-400/25 bg-emerald-400/15 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isVerifyingCode ? 'Verifying...' : 'Verify Code'}
                      </button>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                      After website sign-in, Nexus shows a short-lived desktop code. Enter it here
                      to finish login on this device.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="app-auth"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="mb-6 flex items-start gap-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-cyan-300" />
                    <div>
                      <p className="text-xs font-mono leading-relaxed text-zinc-300">
                        App Account lives inside Nexus itself. Users can create and use it fully
                        from the desktop app with no browser redirect.
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">
                        Local sign-in surface for this PC
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/35 p-2">
                    <button
                      type="button"
                      onClick={() => setAppAuthStep('login')}
                      className={`rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                        appAuthStep === 'login'
                          ? 'border border-emerald-400/35 bg-emerald-400/15 text-emerald-100'
                          : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppAuthStep('register')}
                      className={`rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                        appAuthStep === 'register'
                          ? 'border border-emerald-400/35 bg-emerald-400/15 text-emerald-100'
                          : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {appAuthStep === 'register' && (
                      <label className="block">
                        <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                          <User className="h-4 w-4" />
                          Display Name
                        </span>
                        <input
                          value={appName}
                          onChange={(event) => setAppName(event.target.value)}
                          placeholder="Nexus Operator"
                          className="w-full rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60"
                        />
                      </label>
                    )}

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                        <Mail className="h-4 w-4" />
                        Email Address
                      </span>
                      <input
                        value={appEmail}
                        onChange={(event) => setAppEmail(event.target.value)}
                        placeholder="operator@nexus.ai"
                        autoComplete="email"
                        className="w-full rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                        <Lock className="h-4 w-4" />
                        Password
                      </span>
                      <input
                        type="password"
                        value={appPassword}
                        onChange={(event) => setAppPassword(event.target.value)}
                        placeholder="Use at least 8 characters"
                        autoComplete={appAuthStep === 'register' ? 'new-password' : 'current-password'}
                        className="w-full rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60"
                      />
                    </label>

                    {appAuthStep === 'register' && (
                      <label className="block">
                        <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                          <Lock className="h-4 w-4" />
                          Confirm Password
                        </span>
                        <input
                          type="password"
                          value={appConfirmPassword}
                          onChange={(event) => setAppConfirmPassword(event.target.value)}
                          placeholder="Repeat the same password"
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/60"
                        />
                      </label>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={submitAppAuth}
                    disabled={!isReady || isAppAuthBusy}
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isAppAuthBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : appAuthStep === 'register' ? (
                      <UserPlus className="h-5 w-5" />
                    ) : (
                      <LogIn className="h-5 w-5" />
                    )}
                    {appAuthStep === 'register' ? 'Create App Account' : 'Sign In to App Account'}
                  </button>

                  <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                    This path keeps the whole account flow inside Nexus. Use Cloud Access when you
                    want Supabase-backed sync and paired desktop login from the website.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {statusMessage && (
              <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                <div>{statusMessage}</div>
              </div>
            )}

            {authError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {authError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-widest text-emerald-500/50">
              <Fingerprint size={14} />
              Dual Auth Handshake Ready
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={rightPanelVariants}
          className="col-span-3 hidden h-125 flex-col rounded-2xl border border-white/5 bg-black/40 p-5 shadow-2xl backdrop-blur-md lg:flex"
        >
          <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
            <Activity className="h-5 w-5 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
              Telemetry
            </h3>
          </div>

          <div className="flex flex-col gap-6 font-mono">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] tracking-widest text-zinc-500">
                <span className="flex items-center gap-2">
                  <Network size={12} /> NETWORK
                </span>
                <span className={isReady ? 'text-emerald-400' : 'text-yellow-500'}>
                  {isReady ? 'SECURE' : 'WAITING'}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full transition-all duration-1000 ${isReady ? 'w-full bg-emerald-500' : 'w-1/3 animate-pulse bg-yellow-500'}`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] tracking-widest text-zinc-500">
                <span className="flex items-center gap-2">
                  <Database size={12} /> CLOUD FABRIC
                </span>
                <span className="text-zinc-400">SYNC READY</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-full bg-emerald-500/50" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] tracking-widest text-zinc-500">
                <span className="flex items-center gap-2">
                  <Lock size={12} /> APP ACCOUNT
                </span>
                <span className="text-zinc-400">LOCAL MODE</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-[85%] bg-cyan-400/60" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-xl border border-white/10 bg-black/45 p-4">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
                <Cloud className="h-4 w-4" />
                Cloud Access
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Supabase-backed auth, web pairing, synced data, and cross-device continuity.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/45 p-4">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                <MonitorSmartphone className="h-4 w-4" />
                App Account
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Desktop-only sign-in that stays inside Nexus, with account creation handled in the
                app itself.
              </p>
            </div>
          </div>

          <div className="mt-auto rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-4">
            <p className="text-[9px] uppercase tracking-widest text-emerald-400/80">
              Choose cloud when you need sync. Choose app when you need fast local entry with no
              browser redirect.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
