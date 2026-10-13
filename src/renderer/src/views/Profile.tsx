import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  Archive,
  Brain,
  CalendarClock,
  CheckCircle2,
  Cpu,
  Crown,
  Download,
  FileText,
  HardDrive,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCog,
  UserRound,
  Users
} from 'lucide-react'

import { signOutCloudSession } from '@renderer/lib/supabase'
import { clearDesktopAuthArtifacts } from '@renderer/services/auth-session'
import {
  loadCurrentProfile,
  loadProfileMetrics,
  NEXUS_ADMIN_EMAIL,
  saveCurrentProfile,
  updateCurrentPassword,
  updateProfileRole,
  type NexusProfile,
  type NexusProfileMetrics,
  type NexusProfileRole
} from '@renderer/services/profile-service'
import { exportNexusBackup, importNexusBackup } from '@renderer/services/backup-service'
import { useAuthStore } from '@renderer/store/auth-store'

const statCardClass =
  'relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl transition hover:border-emerald-300/30'

const panelClass =
  'rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur-xl'

const inputClass =
  'h-11 w-full rounded-lg border border-white/10 bg-black/60 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/60 focus:bg-emerald-950/10 placeholder:text-zinc-600'

const formatDate = (value?: string | null) => {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80'
]

const ProfileView = () => {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [profile, setProfile] = useState<NexusProfile | null>(null)
  const [metrics, setMetrics] = useState<NexusProfileMetrics | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isExportingBackup, setIsExportingBackup] = useState(false)
  const [isImportingBackup, setIsImportingBackup] = useState(false)
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = profile?.role === 'admin'
  const isCloudSynced = Boolean(profile?.is_cloud_synced)

  const refreshProfile = async () => {
    setError('')
    setNotice('')
    setIsLoading(true)
    try {
      const currentProfile = await loadCurrentProfile()
      setProfile(currentProfile)
      setDisplayName(currentProfile.display_name)
      setAvatarUrl(currentProfile.avatar_url || '')
      setBio(currentProfile.bio || 'Nexus Neural Workstation Operator')
      setMetrics(await loadProfileMetrics(currentProfile))
    } catch (err: any) {
      console.warn('[ProfileView] Profile refresh warning:', err)
      setError(err.message || 'Unable to load profile data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshProfile()

    const handleBackupRestored = () => {
      void refreshProfile()
    }
    window.addEventListener('nexus-backup-restored', handleBackupRestored)
    return () => window.removeEventListener('nexus-backup-restored', handleBackupRestored)
  }, [])

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingProfile(true)
    setError('')
    setNotice('')

    try {
      const nextProfile = await saveCurrentProfile({
        displayName,
        avatarUrl,
        bio
      })
      setProfile(nextProfile)
      setMetrics(await loadProfileMetrics(nextProfile))
      setNotice('Operator dossier saved successfully.')
    } catch (err: any) {
      setError(err.message || 'Unable to save profile.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingPassword(true)
    setError('')
    setNotice('')

    try {
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match.')
      if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.')
      await updateCurrentPassword(newPassword, currentPassword || undefined)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Security password updated successfully.')
    } catch (err: any) {
      setError(err.message || 'Unable to update password.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleExportBackup = async () => {
    setIsExportingBackup(true)
    setBackupNotice(null)
    try {
      const res = await exportNexusBackup({ promptFileSave: true })
      if (res.canceled) return
      if (!res.success) {
        throw new Error(res.error || 'Backup export failed.')
      }
      setBackupNotice({
        type: 'success',
        message: `Nexus Backup exported successfully! (${res.filename || 'nexus-backup.zip'})`
      })
      void refreshProfile()
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: err.message || 'Failed to export backup archive.'
      })
    } finally {
      setIsExportingBackup(false)
    }
  }

  const handleImportFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setBackupNotice({
        type: 'error',
        message: 'Please provide a valid Nexus backup (.zip) archive.'
      })
      return
    }

    setIsImportingBackup(true)
    setBackupNotice(null)
    try {
      const res = await importNexusBackup(file)
      if (!res.success) {
        throw new Error(res.error || 'Failed to extract and restore backup.')
      }
      setBackupNotice({
        type: 'success',
        message: `Backup archive restored! Restored ${res.stats?.notesCount ?? 0} notes, ${res.stats?.memoriesCount ?? 0} memories, and settings.`
      })
      await refreshProfile()
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: err.message || 'Backup restoration failed.'
      })
    } finally {
      setIsImportingBackup(false)
    }
  }

  const handleNativeImportDialog = async () => {
    setIsImportingBackup(true)
    setBackupNotice(null)
    try {
      const res = await importNexusBackup(undefined, { useDialog: true })
      if (res.canceled) return
      if (!res.success) {
        throw new Error(res.error || 'Failed to import backup.')
      }
      setBackupNotice({
        type: 'success',
        message: `Nexus backup restored successfully! (${res.stats?.notesCount ?? 0} notes, ${res.stats?.memoriesCount ?? 0} memories restored)`
      })
      await refreshProfile()
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: err.message || 'Restoration failed.'
      })
    } finally {
      setIsImportingBackup(false)
    }
  }

  const handleLogout = async () => {
    setError('')
    try {
      await signOutCloudSession()
    } finally {
      clearDesktopAuthArtifacts()
      logout()
      navigate('/login', { replace: true })
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-black gap-3 text-xs font-mono uppercase tracking-[0.25em] text-emerald-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        <span>Synchronizing Neural Dossier...</span>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-black p-5 pb-36 text-zinc-100 scrollbar-small lg:p-8 lg:pb-36">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarUrl('')}
                />
              ) : isAdmin ? (
                <Crown size={30} className="text-amber-300" />
              ) : (
                <UserCog size={30} />
              )}
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-black bg-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white">{displayName || 'Nexus Operator'}</h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${
                    isAdmin
                      ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                      : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                  }`}
                >
                  <Shield size={11} /> {isAdmin ? 'ADMINISTRATOR' : 'OPERATOR'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-cyan-200">
                  {isCloudSynced ? '🟢 CLOUD SYNCED' : '🛡️ LOCAL ENCLAVE'}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-2 text-xs font-mono text-zinc-400">
                <Mail size={13} className="text-emerald-400" /> {profile?.email || 'operator@nexus.local'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportBackup}
              disabled={isExportingBackup}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-4 text-xs font-bold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:opacity-50"
              title="Export complete system state, notes, memories, and keys as .zip"
            >
              <Download size={15} /> {isExportingBackup ? 'Exporting...' : 'Export Backup (.zip)'}
            </button>
            <button
              onClick={refreshProfile}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-xs font-bold uppercase tracking-widest text-zinc-300 transition hover:border-emerald-300/30 hover:text-emerald-100"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-4 text-xs font-bold uppercase tracking-widest text-red-100 transition hover:bg-red-500/20"
            >
              <Lock size={15} /> Sign Out
            </button>
          </div>
        </div>

        {/* Status / Notices */}
        {(error || notice || backupNotice) && (
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-mono backdrop-blur-xl ${
              error || backupNotice?.type === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
            }`}
          >
            {error || backupNotice?.type === 'error' ? (
              <AlertCircle size={16} className="shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            )}
            <span className="flex-1">{error || notice || backupNotice?.message}</span>
            <button
              onClick={() => {
                setError('')
                setNotice('')
                setBackupNotice(null)
              }}
              className="text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={statCardClass}>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <ShieldCheck size={16} className="text-emerald-400" /> Security Enclave
              </span>
              <Activity size={14} className="text-emerald-400/70" />
            </div>
            <div className="mt-3 text-2xl font-black text-white">
              {profile?.role === 'admin' ? 'Administrator' : 'Operator'}
            </div>
            <div className="mt-1 text-[11px] font-mono text-emerald-400/80">
              {isCloudSynced ? 'Synchronized with Supabase' : 'Offline Hardware Vault'}
            </div>
          </div>

          <div className={statCardClass}>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <Brain size={16} className="text-cyan-400" /> Neural Memory Bank
              </span>
              <Activity size={14} className="text-cyan-400/70" />
            </div>
            <div className="mt-3 text-2xl font-black text-white">
              {metrics?.totalMemories ?? 0}{' '}
              <span className="text-xs font-normal text-zinc-400">Memories</span>
            </div>
            <div className="mt-1 text-[11px] font-mono text-zinc-400">
              {metrics?.totalNotes ?? 0} Markdown Notes Indexed
            </div>
          </div>

          <div className={statCardClass}>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <Cpu size={16} className="text-purple-400" /> Intelligence Engine
              </span>
              <Sparkles size={14} className="text-purple-400/70" />
            </div>
            <div className="mt-3 truncate text-xl font-black text-white">
              {metrics?.activeAiModel || 'Gemini 2.5 Flash'}
            </div>
            <div className="mt-1 text-[11px] font-mono text-zinc-400">
              {metrics?.configuredKeysCount ?? 0} Active API Provider Keys
            </div>
          </div>

          <div className={statCardClass}>
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <Archive size={16} className="text-amber-400" /> Backup Archive
              </span>
              <HardDrive size={14} className="text-amber-400/70" />
            </div>
            <div className="mt-3 text-2xl font-black text-white">
              {metrics?.lastBackupDate ? 'Secure' : 'Fresh'}
            </div>
            <div className="mt-1 truncate text-[11px] font-mono text-zinc-400">
              {metrics?.lastBackupDate ? formatDate(metrics.lastBackupDate) : 'No backup exported yet'}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Panel 1: Profile Details */}
          <form onSubmit={handleSaveProfile} className={`${panelClass} flex flex-col justify-between`}>
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserRound size={20} className="text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                    Operator Dossier
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  Editable
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Operator Codename / Name
                  </span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                    placeholder="Nexus Operator"
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Preset Holographic Avatars
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border transition ${
                          avatarUrl === preset
                            ? 'border-emerald-400 ring-2 ring-emerald-400/40'
                            : 'border-white/10 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={preset} alt="preset" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Custom Avatar URL
                  </span>
                  <input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Operational Directive / Bio
                  </span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-white/10 bg-black/60 p-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/60 focus:bg-emerald-950/10 placeholder:text-zinc-600"
                    placeholder="Primary objective or designation..."
                  />
                </label>

                <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 text-[11px] leading-5 text-zinc-400">
                  <div className="mb-1.5 flex items-center gap-2 font-mono uppercase tracking-widest text-zinc-500">
                    <CalendarClock size={13} /> Dossier History
                  </div>
                  <div className="flex justify-between">
                    <span>Enrolled:</span>
                    <span className="font-mono text-zinc-300">{formatDate(profile?.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Updated:</span>
                    <span className="font-mono text-zinc-300">{formatDate(profile?.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/15 text-xs font-bold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} /> {isSavingProfile ? 'Saving...' : 'Save Dossier'}
            </button>
          </form>

          {/* Panel 2: Password & Enclave Security */}
          <form onSubmit={handlePasswordUpdate} className={`${panelClass} flex flex-col justify-between`}>
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock size={20} className="text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                    Enclave Credentials
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">
                  {isCloudSynced ? 'Cloud Auth' : 'Local Vault'}
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {!isCloudSynced && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Current Password (Optional if admin)
                    </span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={inputClass}
                      placeholder="Current password"
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    New Security Password
                  </span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Confirm New Password
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                  />
                </label>

                <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3.5 text-[11px] leading-relaxed text-cyan-200/80">
                  <div className="flex items-center gap-2 font-bold mb-1 text-cyan-300">
                    <KeyRound size={13} /> {isCloudSynced ? 'Supabase Encryption' : 'Bcrypt Hardware Enclave'}
                  </div>
                  {isCloudSynced
                    ? 'Password updates are synced with your cloud Supabase user entity.'
                    : 'Nexus authenticates locally using hashed credentials stored in your native OS hardware enclave.'}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-zinc-400">
                  <span>Vault PIN Configured</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {metrics?.vaultPinConfigured ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingPassword || !newPassword}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/15 text-xs font-bold uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} /> {isSavingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          {/* Panel 3: Neural Backup & Migration (ZIP) */}
          <div className={`${panelClass} flex flex-col justify-between border-emerald-400/30 bg-emerald-950/10`}>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Archive size={20} className="text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                    Nexus System Backup (.zip)
                  </h3>
                </div>
                <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                  PORTABLE
                </span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Export or restore your complete Nexus workspace: notes, core memory, AI models, API keys, workflows, and operator dossier in a single compressed .zip archive.
              </p>

              {/* Drag & Drop / Upload area */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImportFile(file)
                  e.target.value = ''
                }}
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file) void handleImportFile(file)
                }}
                onClick={() => fileInputRef.current?.click()}
                className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-400/30 bg-black/40 p-6 text-center transition hover:border-emerald-400 hover:bg-emerald-950/20 cursor-pointer"
              >
                <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 group-hover:scale-110 transition-transform">
                  <Upload size={22} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Import Nexus Backup (.zip)
                </span>
                <span className="mt-1 text-[11px] text-zinc-500">
                  Click to browse or drag & drop .zip file here
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleNativeImportDialog}
                  disabled={isImportingBackup}
                  className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-200 transition"
                >
                  <FileText size={13} /> Browse Files
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-white/5 bg-black/40 p-3 text-[11px] text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>Last Export:</span>
                  <span className="font-mono text-zinc-300">
                    {metrics?.lastBackupDate ? formatDate(metrics.lastBackupDate) : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Archived Components:</span>
                  <span className="font-mono text-emerald-400">Notes • Memories • Keys • Dossier</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExportingBackup || isImportingBackup}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400 bg-emerald-400 text-xs font-bold uppercase tracking-widest text-black shadow-[0_0_20px_rgba(52,211,153,0.3)] transition hover:bg-emerald-300 disabled:opacity-50"
            >
              <Download size={16} /> {isExportingBackup ? 'Exporting Archive...' : 'Export Nexus Backup (.zip)'}
            </button>
          </div>
        </div>

        {/* Administration / Federation Panel (for Admin role) */}
        {isAdmin && (
          <div className={panelClass}>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-amber-300" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                  Administrator Privileges
                </h3>
              </div>
              <span className="text-[10px] font-mono text-amber-300/80">
                Primary Root: {NEXUS_ADMIN_EMAIL}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              You are authenticated as the Nexus Chief Administrator. Your session has unrestricted privileges across local hardware execution, memory databases, and cloud federation.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileView
