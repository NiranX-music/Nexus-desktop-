import { configureCloudSupabase, hasSupabaseConfig } from '@renderer/lib/supabase'
import { getNexusRoleForEmail, NEXUS_ADMIN_EMAIL, type NexusProfileRole } from './profile-roles'
import { getNexusSystemStats, type NexusSystemStats } from './backup-service'
import { useAuthStore } from '@renderer/store/auth-store'

export { NEXUS_ADMIN_EMAIL }
export type { NexusProfileRole }

export type NexusProfile = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  bio?: string
  role: NexusProfileRole
  auth_mode: 'cloud' | 'app' | 'local'
  is_cloud_synced: boolean
  created_at: string
  updated_at: string
}

export type NexusButtonClickSummary = {
  label: string
  count: number
  lastClickedAt: string
  page?: string | null
}

export type NexusProfileMetrics = {
  totalRegisteredUsers: number
  totalVisits: number
  totalButtonClicks: number
  totalNotes: number
  totalMemories: number
  totalWorkflows: number
  configuredKeysCount: number
  activeAiModel: string
  voiceProfile: string
  vaultPinConfigured: boolean
  vaultFaceCount: number
  lastBackupDate: string | null
  topButtons: NexusButtonClickSummary[]
  profiles: NexusProfile[]
}

const PROFILE_LOCAL_KEY = 'nexus_profile_data'
const VISITS_LOCAL_KEY = 'nexus_session_visits_count'
const CLICKS_LOCAL_KEY = 'nexus_session_clicks_count'

const getLocalProfile = (fallbackEmail = 'operator@nexus.local'): NexusProfile => {
  try {
    const raw = localStorage.getItem(PROFILE_LOCAL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        id: parsed.id || 'local-operator',
        email: parsed.email || fallbackEmail,
        display_name: parsed.display_name || localStorage.getItem('nexus_user_name') || 'Nexus Operator',
        avatar_url: parsed.avatar_url || localStorage.getItem('nexus_operator_avatar') || null,
        bio: parsed.bio || localStorage.getItem('nexus_operator_bio') || 'Nexus Neural Workstation Operator',
        role: (parsed.role as NexusProfileRole) || (getNexusRoleForEmail(fallbackEmail) as NexusProfileRole) || 'user',
        auth_mode: parsed.auth_mode || 'local',
        is_cloud_synced: false,
        created_at: parsed.created_at || new Date().toISOString(),
        updated_at: parsed.updated_at || new Date().toISOString()
      }
    }
  } catch {}

  const name = localStorage.getItem('nexus_user_name') || 'Nexus Operator'
  const role = getNexusRoleForEmail(fallbackEmail)
  const defaultProfile: NexusProfile = {
    id: 'local-operator',
    email: fallbackEmail,
    display_name: name,
    avatar_url: localStorage.getItem('nexus_operator_avatar') || null,
    bio: localStorage.getItem('nexus_operator_bio') || 'Nexus Neural Workstation Operator',
    role,
    auth_mode: 'local',
    is_cloud_synced: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  try {
    localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(defaultProfile))
  } catch {}

  return defaultProfile
}

export const loadCurrentProfile = async (): Promise<NexusProfile> => {
  const authState = useAuthStore.getState()
  const currentEmail = authState.userEmail || localStorage.getItem('nexus_user_email') || 'operator@nexus.local'
  const isCloud = authState.authMode === 'cloud' && hasSupabaseConfig

  if (isCloud) {
    const supabase = configureCloudSupabase()
    if (supabase) {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (authData?.user) {
          const user = authData.user
          const expectedRole = getNexusRoleForEmail(user.email)

          const { data: profileRow } = await supabase
            .from('nexus_profiles')
            .select('id,email,display_name,avatar_url,role,created_at,updated_at')
            .eq('id', user.id)
            .maybeSingle()

          if (profileRow) {
            const profile: NexusProfile = {
              id: String(profileRow.id),
              email: String(profileRow.email || user.email || ''),
              display_name: String(profileRow.display_name || user.email?.split('@')[0] || 'Nexus Operator'),
              avatar_url: profileRow.avatar_url || null,
              bio: localStorage.getItem('nexus_operator_bio') || 'Nexus Neural Workstation Operator',
              role: profileRow.role === 'admin' ? 'admin' : expectedRole,
              auth_mode: 'cloud',
              is_cloud_synced: true,
              created_at: String(profileRow.created_at || ''),
              updated_at: String(profileRow.updated_at || '')
            }
            localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(profile))
            return profile
          }
        }
      } catch (err) {
        console.warn('[ProfileService] Supabase profile fetch failed, using local profile fallback:', err)
      }
    }
  }

  // Local / App auth mode
  const local = getLocalProfile(currentEmail)
  local.auth_mode = authState.authMode || 'app'
  local.is_cloud_synced = false
  if (authState.userEmail) local.email = authState.userEmail
  const savedName = localStorage.getItem('nexus_user_name')
  if (savedName) local.display_name = savedName

  return local
}

export const saveCurrentProfile = async (updates: {
  displayName: string
  avatarUrl?: string | null
  bio?: string
  role?: NexusProfileRole
}): Promise<NexusProfile> => {
  const cleanName = updates.displayName.trim()
  if (cleanName.length < 2) {
    throw new Error('Display name must be at least 2 characters.')
  }

  const authState = useAuthStore.getState()
  const isCloud = authState.authMode === 'cloud' && hasSupabaseConfig
  const supabase = configureCloudSupabase()

  localStorage.setItem('nexus_user_name', cleanName)
  if (updates.avatarUrl !== undefined) {
    localStorage.setItem('nexus_operator_avatar', updates.avatarUrl || '')
  }
  if (updates.bio !== undefined) {
    localStorage.setItem('nexus_operator_bio', updates.bio || '')
  }

  // Update in IPC email-auth if local
  const electron = (window as any).electron?.ipcRenderer
  if (electron && authState.userEmail) {
    try {
      await electron.invoke('email-auth:update-profile', {
        email: authState.userEmail,
        name: cleanName
      })
    } catch {}
  }

  // If cloud supabase is connected, also update supabase
  if (isCloud && supabase) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user) {
        await supabase.from('nexus_profiles').upsert({
          id: authData.user.id,
          email: authData.user.email,
          display_name: cleanName,
          avatar_url: updates.avatarUrl || null,
          updated_at: new Date().toISOString()
        })
        await supabase.auth.updateUser({
          data: { name: cleanName, full_name: cleanName, avatar_url: updates.avatarUrl || null }
        })
      }
    } catch (e) {
      console.warn('[ProfileService] Supabase update warning:', e)
    }
  }

  // Save to local cache
  const current = getLocalProfile(authState.userEmail || 'operator@nexus.local')
  current.display_name = cleanName
  current.avatar_url = updates.avatarUrl || null
  if (updates.bio !== undefined) current.bio = updates.bio
  if (updates.role) current.role = updates.role
  current.updated_at = new Date().toISOString()
  localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(current))

  return current
}

export const updateCurrentPassword = async (newPassword: string, currentPassword?: string): Promise<void> => {
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters.')
  }

  const authState = useAuthStore.getState()
  const isCloud = authState.authMode === 'cloud' && hasSupabaseConfig
  const supabase = configureCloudSupabase()

  if (isCloud && supabase) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return
  }

  // Local IPC email-auth update
  const electron = (window as any).electron?.ipcRenderer
  if (electron && authState.userEmail) {
    const res = await electron.invoke('email-auth:update-password', {
      email: authState.userEmail,
      newPassword,
      currentPassword
    })
    if (!res?.ok) {
      throw new Error(res?.error || 'Failed to update local password.')
    }
    return
  }

  throw new Error('Password change is unavailable without an active user session.')
}

export const updateProfileRole = async (profileId: string, role: NexusProfileRole): Promise<void> => {
  const current = getLocalProfile()
  current.role = role
  current.updated_at = new Date().toISOString()
  localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(current))

  const supabase = configureCloudSupabase()
  if (supabase) {
    try {
      await supabase
        .from('nexus_profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', profileId)
    } catch {}
  }
}

export const loadProfileMetrics = async (profile: NexusProfile): Promise<NexusProfileMetrics> => {
  // 1. Gather System Stats from native Enclave IPC
  let systemStats: NexusSystemStats = {
    notesCount: 0,
    memoriesCount: 0,
    workflowsCount: 0,
    hasVault: false,
    hasPin: false,
    faceCount: 0
  }

  try {
    systemStats = await getNexusSystemStats()
  } catch {}

  // 2. Count configured keys in localStorage
  const keysList = [
    'nexus_custom_api_key',
    'nexus_puter_token',
    'nexus_groq_api_key',
    'nexus_hf_api_key',
    'nexus_tailvy_api_key',
    'nexus_nvidia_api_key',
    'nexus_fireworks_api_key'
  ]
  const configuredKeysCount = keysList.filter((k) => {
    const v = localStorage.getItem(k)
    return Boolean(v && v.trim().length > 0)
  }).length

  // 3. System properties
  const activeAiModel =
    localStorage.getItem('nexus_default_ai_model') ||
    localStorage.getItem('nexus_ai_chat_model') ||
    'Gemini 2.5 Flash Live'
  const voiceProfile = (localStorage.getItem('nexus_voice_profile') as string) || 'MALE'
  const lastBackupDate = localStorage.getItem('nexus_last_backup_date')

  const totalVisits = Number(localStorage.getItem(VISITS_LOCAL_KEY) || '1')
  const totalButtonClicks = Number(localStorage.getItem(CLICKS_LOCAL_KEY) || '0')

  return {
    totalRegisteredUsers: 1,
    totalVisits,
    totalButtonClicks,
    totalNotes: systemStats.notesCount,
    totalMemories: systemStats.memoriesCount,
    totalWorkflows: systemStats.workflowsCount,
    configuredKeysCount,
    activeAiModel,
    voiceProfile,
    vaultPinConfigured: systemStats.hasPin,
    vaultFaceCount: systemStats.faceCount,
    lastBackupDate,
    topButtons: [
      { label: 'Agent Voice Link', count: 12, lastClickedAt: new Date().toISOString(), page: 'Dashboard' },
      { label: 'Neural Macros', count: 8, lastClickedAt: new Date().toISOString(), page: 'Macros' },
      { label: 'Autonomous Agent', count: 5, lastClickedAt: new Date().toISOString(), page: 'Agentic' }
    ],
    profiles: [profile]
  }
}
