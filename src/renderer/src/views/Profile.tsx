import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  CalendarClock,
  Crown,
  Globe2,
  Lock,
  Mail,
  MousePointerClick,
  Network,
  RefreshCw,
  Save,
  Shield,
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
import { useAuthStore } from '@renderer/store/auth-store'

const statCardClass =
  'rounded-xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)]'

const panelClass =
  'rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.34)]'

const inputClass =
  'h-11 w-full rounded-lg border border-white/10 bg-black/60 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/60 focus:bg-emerald-950/10'

const formatDate = (value?: string | null) => {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

const roleBadgeClass = (role: NexusProfileRole) =>
  role === 'admin'
    ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
    : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'

const ProfileView = () => {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const [profile, setProfile] = useState<NexusProfile | null>(null)
  const [metrics, setMetrics] = useState<NexusProfileMetrics | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [roleSavingId, setRoleSavingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isAdmin = profile?.role === 'admin'

  const metricCards = useMemo(
    () => [
      {
        label: isAdmin ? 'Registered Users' : 'Account Role',
        value: isAdmin ? String(metrics?.totalRegisteredUsers ?? 0) : profile?.role || 'user',
        icon: isAdmin ? <Users size={18} /> : <Shield size={18} />
      },
      {
        label: isAdmin ? 'Total Visits' : 'Your Visits',
        value: String(metrics?.totalVisits ?? 0),
        icon: <Globe2 size={18} />
      },
      {
        label: isAdmin ? 'Button Clicks' : 'Your Clicks',
        value: String(metrics?.totalButtonClicks ?? 0),
        icon: <MousePointerClick size={18} />
      }
    ],
    [
      isAdmin,
      metrics?.totalButtonClicks,
      metrics?.totalRegisteredUsers,
      metrics?.totalVisits,
      profile?.role
    ]
  )

  const refreshProfile = async () => {
    setError('')
    setNotice('')
    setIsLoading(true)
    try {
      const currentProfile = await loadCurrentProfile()
      setProfile(currentProfile)
      setDisplayName(currentProfile.display_name)
      setAvatarUrl(currentProfile.avatar_url || '')
      setMetrics(await loadProfileMetrics(currentProfile))
    } catch (err: any) {
      setError(err.message || 'Unable to load profile.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshProfile()
  }, [])

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingProfile(true)
    setError('')
    setNotice('')

    try {
      const nextProfile = await saveCurrentProfile({ displayName, avatarUrl })
      setProfile(nextProfile)
      setMetrics(await loadProfileMetrics(nextProfile))
      setNotice('Profile saved.')
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
      await updateCurrentPassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Password updated.')
    } catch (err: any) {
      setError(err.message || 'Unable to update password.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleRoleChange = async (profileId: string, role: NexusProfileRole) => {
    if (!profile) return
    setRoleSavingId(profileId)
    setError('')
    setNotice('')

    try {
      await updateProfileRole(profileId, role)
      const nextProfile = await loadCurrentProfile()
      setProfile(nextProfile)
      setMetrics(await loadProfileMetrics(nextProfile))
      setNotice('Role updated.')
    } catch (err: any) {
      setError(err.message || 'Unable to update role.')
    } finally {
      setRoleSavingId('')
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
      <div className="flex h-full items-center justify-center bg-black text-sm font-mono uppercase tracking-[0.2em] text-emerald-300">
        Loading Profile Matrix...
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-black p-5 text-zinc-100 scrollbar-small lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
              {isAdmin ? <Crown size={26} /> : <UserCog size={26} />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Profile Control</h2>
              <p className="mt-1 flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                <Mail size={13} /> {profile?.email || 'No email'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${roleBadgeClass(profile?.role || 'user')}`}
            >
              <Shield size={14} /> {profile?.role || 'user'}
            </span>
            <button
              onClick={refreshProfile}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-[11px] font-bold uppercase tracking-widest text-zinc-300 transition hover:border-emerald-300/30 hover:text-emerald-100"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-300/20 bg-red-500/10 px-4 text-[11px] font-bold uppercase tracking-widest text-red-100 transition hover:bg-red-500/20"
            >
              <Lock size={15} /> Sign Out
            </button>
          </div>
        </div>

        {(error || notice) && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs font-mono ${
              error
                ? 'border-red-500/30 bg-red-500/10 text-red-100'
                : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
            }`}
          >
            {error || notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {metricCards.map((card) => (
            <div key={card.label} className={statCardClass}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  {card.icon} {card.label}
                </span>
                <Activity size={14} className="text-emerald-300/70" />
              </div>
              <div className="mt-4 text-3xl font-black tracking-tight text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <form onSubmit={handleSaveProfile} className={`${panelClass} xl:col-span-1`}>
            <div className="mb-5 flex items-center gap-3">
              <UserRound size={19} className="text-emerald-300" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                Profile Details
              </h3>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Display Name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className={inputClass}
                  placeholder="Nexus Operator"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Avatar URL
                </span>
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  className={inputClass}
                  placeholder="https://..."
                />
              </label>

              <div className="rounded-xl border border-white/5 bg-black/40 p-4 text-[11px] leading-5 text-zinc-400">
                <div className="mb-2 flex items-center gap-2 font-mono uppercase tracking-widest text-zinc-500">
                  <CalendarClock size={13} /> Account Timeline
                </div>
                <div>Created: {formatDate(profile?.created_at)}</div>
                <div>Updated: {formatDate(profile?.updated_at)}</div>
              </div>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/10 text-xs font-bold uppercase tracking-widest text-emerald-100 transition hover:bg-emerald-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} /> {isSavingProfile ? 'Saving' : 'Save Profile'}
              </button>
            </div>
          </form>

          <form onSubmit={handlePasswordUpdate} className={`${panelClass} xl:col-span-1`}>
            <div className="mb-5 flex items-center gap-3">
              <Lock size={19} className="text-cyan-300" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">Password</h3>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  New Password
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Confirm Password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                />
              </label>
              <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-4 text-[11px] leading-5 text-cyan-100/70">
                Password changes are handled by Supabase Auth. Nexus never stores the password in
                profile or analytics rows.
              </div>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-xs font-bold uppercase tracking-widest text-cyan-100 transition hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} /> {isSavingPassword ? 'Updating' : 'Update Password'}
              </button>
            </div>
          </form>

          <div className={`${panelClass} xl:col-span-1`}>
            <div className="mb-5 flex items-center gap-3">
              <MousePointerClick size={19} className="text-emerald-300" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                Top Buttons
              </h3>
            </div>
            <div className="flex flex-col gap-3">
              {(metrics?.topButtons || []).length === 0 && (
                <div className="rounded-xl border border-white/5 bg-black/40 p-4 text-xs text-zinc-500">
                  No button clicks recorded yet.
                </div>
              )}
              {(metrics?.topButtons || []).map((button) => (
                <div
                  key={`${button.label}-${button.page}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {button.label}
                    </div>
                    <div className="mt-1 truncate text-[10px] font-mono text-zinc-500">
                      {button.page || 'Unknown page'}
                    </div>
                  </div>
                  <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-sm font-black text-emerald-100">
                    {button.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className={panelClass}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Users size={19} className="text-amber-200" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                    User Roles
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-100/70">
                  Admin: {NEXUS_ADMIN_EMAIL}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-zinc-500">
                    <tr className="border-b border-white/10">
                      <th className="pb-3">User</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(metrics?.profiles || []).map((row) => {
                      const isFixedAdmin = row.email.toLowerCase() === NEXUS_ADMIN_EMAIL
                      return (
                        <tr key={row.id} className="border-b border-white/5">
                          <td className="py-3">
                            <div className="font-semibold text-zinc-100">{row.display_name}</div>
                            <div className="mt-1 text-[11px] font-mono text-zinc-500">
                              {row.email}
                            </div>
                          </td>
                          <td className="py-3">
                            <select
                              value={row.role}
                              disabled={isFixedAdmin || roleSavingId === row.id}
                              onChange={(event) =>
                                void handleRoleChange(
                                  row.id,
                                  event.target.value as NexusProfileRole
                                )
                              }
                              className="h-9 rounded-lg border border-white/10 bg-black px-3 text-xs font-bold uppercase tracking-widest text-zinc-100 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 text-[11px] font-mono text-zinc-500">
                            {formatDate(row.updated_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={panelClass}>
              <div className="mb-5 flex items-center gap-3">
                <Network size={19} className="text-cyan-200" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                  Recent Visits and IPs
                </h3>
              </div>
              <div className="flex max-h-[27rem] flex-col gap-3 overflow-y-auto pr-1 scrollbar-small">
                {(metrics?.recentVisits || []).length === 0 && (
                  <div className="rounded-xl border border-white/5 bg-black/40 p-4 text-xs text-zinc-500">
                    No visits recorded yet.
                  </div>
                )}
                {(metrics?.recentVisits || []).map((visit) => (
                  <div key={visit.id} className="rounded-xl border border-white/5 bg-black/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-zinc-100">
                        {visit.visit_path}
                      </span>
                      <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-mono text-cyan-100">
                        {visit.ip_address || 'IP unavailable'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] font-mono text-zinc-500">
                      <span>{visit.profile_email || 'Anonymous visitor'}</span>
                      <span>{formatDate(visit.visited_at)}</span>
                      <span className="truncate">{visit.user_agent || 'No user agent'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileView
