import { FormEvent, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Cpu,
  Database,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Network,
  ShieldCheck,
  TerminalSquare,
  User,
  UserPlus
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth-store'
import { configureCloudSupabase } from '../lib/supabase'
import { normalizeCloudAuthUser, persistPreferredDesktopAuthMode } from '../services/auth-session'
import {
  bootstrapCloudAccount,
  saveCloudData,
  syncLocalSettingsToCloud
} from '../services/cloud-data'

type Mode = 'signin' | 'create'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuthSession = useAuthStore((state) => state.setAuthSession)
  const [bootLogs, setBootLogs] = useState<string[]>([])
  const [isReady, setIsReady] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCloudConfigured] = useState(() => Boolean(configureCloudSupabase()))

  const authStateLabel = useMemo(() => (isCloudConfigured ? 'CLOUD' : 'SETUP'), [isCloudConfigured])

  useEffect(() => {
    const sequence = [
      'SYS_BOOT: INITIATING KERNEL...',
      'SECURE_ENCLAVE: MOUNTED',
      'SUPABASE_AUTH: EMAIL + PASSWORD',
      'IPC_BRIDGE: [OK]',
      'REMOTE_MEMORY: READY',
      'AGENTIC_ROUTER: ONLINE',
      'AWAITING OPERATOR CREDENTIALS...'
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < sequence.length) {
        setBootLogs((prev) => [...prev, sequence[currentStep]])
        currentStep++
      } else {
        setIsReady(true)
        clearInterval(interval)
      }
    }, 420)

    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      const supabase = configureCloudSupabase()
      if (!supabase) {
        throw new Error(
          'Supabase is not configured for this build. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
        )
      }

      const normalizedEmail = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error('Enter a valid email address.')
      }
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters.')
      }

      const name = displayName.trim() || normalizedEmail.split('@')[0] || 'Nexus Operator'

      if (mode === 'create') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.')
        if (name.length < 2) throw new Error('Enter a display name.')

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name,
              full_name: name
            }
          }
        })

        if (signUpError) throw signUpError
        if (!data.session || !data.user) {
          setNotice('Account created. Check your email to confirm it, then sign in here.')
          setMode('signin')
          return
        }

        const user = normalizeCloudAuthUser(data.user)
        persistPreferredDesktopAuthMode('cloud')
        localStorage.setItem('nexus_user_name', user.name)
        localStorage.removeItem('nexus_local_account')
        localStorage.removeItem('nexus_local_session')
        setAuthSession({ token: data.session.access_token, mode: 'cloud', user })
        await Promise.allSettled([
          bootstrapCloudAccount(),
          syncLocalSettingsToCloud(),
          saveCloudData('account', 'details', {
            email: user.email,
            display_name: user.name,
            provider: 'email',
            created_at: data.user.created_at,
            last_sign_in_at: data.user.last_sign_in_at || null,
            updated_at: new Date().toISOString()
          })
        ])
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        })

        if (signInError || !data.session || !data.user) {
          throw signInError || new Error('Email or password is incorrect.')
        }

        const user = normalizeCloudAuthUser(data.user)
        persistPreferredDesktopAuthMode('cloud')
        localStorage.setItem('nexus_user_name', user.name)
        localStorage.removeItem('nexus_local_account')
        localStorage.removeItem('nexus_local_session')
        setAuthSession({ token: data.session.access_token, mode: 'cloud', user })
        await Promise.allSettled([
          bootstrapCloudAccount(),
          syncLocalSettingsToCloud(),
          saveCloudData('account', 'details', {
            email: user.email,
            display_name: user.name,
            provider: 'email',
            created_at: data.user.created_at,
            last_sign_in_at: data.user.last_sign_in_at || null,
            updated_at: new Date().toISOString()
          })
        ])
      }

      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Authentication failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
    <div className="min-h-screen bg-[#050505] text-emerald-50 font-sans flex items-center justify-center p-3 lg:p-5 relative overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-100">
      <div className="absolute top-[-10%] left-[-5%] w-125 h-125 bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-125 h-125 bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-linear(to_right,#10b98105_1px,transparent_1px),linear-linear(to_bottom,#10b98105_1px,transparent_1px)] bg-size-[40px_40px] pointer-events-none mix-blend-screen" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-7xl relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
      >
        <motion.div
          variants={panelVariants}
          className="hidden lg:flex col-span-3 flex-col h-[min(31rem,calc(100vh-7rem))] bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
            <TerminalSquare className="w-5 h-5 text-emerald-500" />
            <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">
              System Log
            </h3>
          </div>
          <div className="flex-1 flex flex-col justify-end font-mono text-[10px] leading-relaxed tracking-wider overflow-hidden">
            <AnimatePresence>
              {bootLogs.map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`mb-2 ${index === bootLogs.length - 1 ? 'text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-zinc-500'}`}
                >
                  <span className="opacity-50 mr-2 text-emerald-700">{`>`}</span> {log}
                </motion.div>
              ))}
            </AnimatePresence>
            {isReady && (
              <motion.div
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-emerald-400 mt-1"
              >
                _
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="col-span-1 lg:col-span-6 flex flex-col items-center justify-center"
        >
          <div className="text-center mb-4 flex flex-col items-center">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)] mb-4 overflow-hidden">
              <motion.div
                className="absolute left-0 w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_#34d399]"
                animate={{ top: ['-10%', '110%', '-10%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />
              <Cpu className="w-8 h-8 text-emerald-400 relative z-10" />
            </div>

            <h1 className="text-3xl font-black tracking-[0.2em] uppercase text-white mb-1 drop-shadow-md">
              NEXUS <span className="text-emerald-500">OS</span>
            </h1>
            <p className="text-zinc-500 text-xs font-mono tracking-widest uppercase">
              Supabase Email Access
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl relative"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-emerald-500 to-transparent opacity-40" />

            <div className="mb-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                Supabase Auth protects sign-in while Nexus stores profile, settings, and memory rows
                under your account.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 rounded-xl bg-white/5 border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`h-10 rounded-lg text-[10px] font-black tracking-[0.18em] uppercase transition ${mode === 'signin' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30' : 'text-zinc-500 hover:text-zinc-200'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`h-10 rounded-lg text-[10px] font-black tracking-[0.18em] uppercase transition ${mode === 'create' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30' : 'text-zinc-500 hover:text-zinc-200'}`}
              >
                Create
              </button>
            </div>

            <div className="space-y-3">
              {mode === 'create' && (
                <label className="block">
                  <span className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400 mb-2">
                    <User size={14} /> Name
                  </span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    className="w-full h-11 bg-black/70 border border-white/15 rounded-xl px-4 text-sm text-white outline-none focus:border-emerald-400/70 focus:bg-emerald-950/10"
                    placeholder="Operator name"
                  />
                </label>
              )}

              <label className="block">
                <span className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400 mb-2">
                  <Mail size={14} /> Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="w-full h-11 bg-black/70 border border-white/15 rounded-xl px-4 text-sm text-white outline-none focus:border-emerald-400/70 focus:bg-emerald-950/10"
                  placeholder="operator@nexus.local"
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400 mb-2">
                  <KeyRound size={14} /> Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full h-11 bg-black/70 border border-white/15 rounded-xl px-4 text-sm text-white outline-none focus:border-emerald-400/70 focus:bg-emerald-950/10"
                  placeholder="Minimum 8 characters"
                />
              </label>

              {mode === 'create' && (
                <label className="block">
                  <span className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400 mb-2">
                    <Lock size={14} /> Confirm
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full h-11 bg-black/70 border border-white/15 rounded-xl px-4 text-sm text-white outline-none focus:border-emerald-400/70 focus:bg-emerald-950/10"
                    placeholder="Repeat password"
                  />
                </label>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-mono text-red-200">
                {error}
              </div>
            )}
            {notice && (
              <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-xs font-mono text-cyan-100">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={!isReady || isSubmitting}
              className={`mt-4 relative flex w-full items-center justify-center gap-3 h-12 px-6 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-50 transition-all duration-200 ease-in-out font-bold text-xs tracking-widest uppercase shadow-lg ${!isReady || isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-400 hover:text-black hover:border-emerald-300 cursor-pointer'}`}
            >
              {mode === 'signin' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {isSubmitting ? 'Checking' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="mt-3 flex items-center justify-center gap-2 text-emerald-500/50 text-[10px] font-mono tracking-widest uppercase">
              <Lock size={14} />
              {isCloudConfigured ? 'Supabase Ready' : 'Supabase Config Missing'}
            </div>
          </form>
        </motion.div>

        <motion.div
          variants={rightPanelVariants}
          className="hidden lg:flex col-span-3 flex-col h-[min(31rem,calc(100vh-7rem))] bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">
              Telemetry
            </h3>
          </div>

          <div className="flex flex-col gap-6 font-mono">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] tracking-widest text-zinc-500">
                <span className="flex items-center gap-2">
                  <Network size={12} /> NETWORK
                </span>
                <span className="text-emerald-400">CLOUD</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="w-full h-full bg-emerald-500" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] tracking-widest text-zinc-500">
                <span className="flex items-center gap-2">
                  <Database size={12} /> ACCOUNT
                </span>
                <span className={isCloudConfigured ? 'text-emerald-400' : 'text-yellow-500'}>
                  {authStateLabel}
                </span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="w-full h-full bg-emerald-500/50" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] tracking-widest text-zinc-500">
                <span className="flex items-center gap-2">
                  <Lock size={12} /> SESSION
                </span>
                <span className={isReady ? 'text-emerald-400' : 'text-zinc-400'}>
                  {isReady ? 'OPEN' : 'BOOTING'}
                </span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${isReady ? 'w-full bg-emerald-500/70' : 'w-1/3 bg-yellow-500 animate-pulse'}`}
                />
              </div>
            </div>
          </div>

          <div className="mt-auto p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-xl">
            <p className="text-[9px] text-emerald-400/80 tracking-widest uppercase leading-relaxed">
              Nexus AI stores operator state in private Supabase rows guarded by account identity.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
