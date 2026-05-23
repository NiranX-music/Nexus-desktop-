import { configureCloudSupabase } from '@renderer/lib/supabase'

import { bootstrapCloudAccount } from './cloud-data'
import { getNexusRoleForEmail, NEXUS_ADMIN_EMAIL, type NexusProfileRole } from './profile-roles'

export { NEXUS_ADMIN_EMAIL }
export type { NexusProfileRole }

export type NexusProfile = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: NexusProfileRole
  created_at: string
  updated_at: string
}

export type NexusVisitRow = {
  id: string
  user_id: string | null
  profile_email: string | null
  visitor_id: string | null
  visit_path: string
  ip_address: string | null
  user_agent: string | null
  visited_at: string
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
  recentVisits: NexusVisitRow[]
  topButtons: NexusButtonClickSummary[]
  profiles: NexusProfile[]
}

const PROFILE_COLUMNS = 'id,email,display_name,avatar_url,role,created_at,updated_at'

const getSupabaseOrThrow = () => {
  const supabase = configureCloudSupabase()
  if (!supabase) throw new Error('Supabase is not configured for profile management.')
  return supabase
}

const normalizeProfile = (row: any): NexusProfile => ({
  id: String(row.id || ''),
  email: String(row.email || ''),
  display_name: String(row.display_name || row.email?.split('@')[0] || 'Nexus Operator'),
  avatar_url: row.avatar_url || null,
  role: row.role === 'admin' ? 'admin' : 'user',
  created_at: String(row.created_at || ''),
  updated_at: String(row.updated_at || '')
})

const getCurrentUser = async () => {
  const supabase = getSupabaseOrThrow()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error(error?.message || 'No authenticated profile session.')
  return { supabase, user: data.user }
}

const fetchCount = async (tableName: string) => {
  const supabase = getSupabaseOrThrow()
  const { count, error } = await supabase.from(tableName).select('id', {
    count: 'exact',
    head: true
  })
  if (error) throw error
  return count || 0
}

export const loadCurrentProfile = async () => {
  const { supabase, user } = await getCurrentUser()
  await bootstrapCloudAccount()

  const expectedRole = getNexusRoleForEmail(user.email)
  if (expectedRole === 'admin') {
    await supabase
      .from('nexus_profiles')
      .update({
        email: user.email,
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
  }

  const { data, error } = await supabase
    .from('nexus_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error
  if (data) return normalizeProfile(data)

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Nexus Operator'

  const profile = {
    id: user.id,
    email: user.email,
    display_name: displayName,
    avatar_url: user.user_metadata?.avatar_url || null,
    role: expectedRole,
    updated_at: new Date().toISOString()
  }

  const { data: insertedProfile, error: insertError } = await supabase
    .from('nexus_profiles')
    .insert(profile)
    .select(PROFILE_COLUMNS)
    .single()

  if (insertError) throw insertError
  return normalizeProfile(insertedProfile)
}

export const saveCurrentProfile = async (updates: {
  displayName: string
  avatarUrl?: string | null
}) => {
  const cleanName = updates.displayName.trim()
  if (cleanName.length < 2) throw new Error('Display name must be at least 2 characters.')

  const { supabase, user } = await getCurrentUser()
  const expectedRole = getNexusRoleForEmail(user.email)
  const profileUpdate: Record<string, unknown> = {
    email: user.email,
    display_name: cleanName,
    avatar_url: updates.avatarUrl?.trim() || null,
    updated_at: new Date().toISOString()
  }

  if (expectedRole === 'admin') profileUpdate.role = 'admin'

  const { error } = await supabase.from('nexus_profiles').update(profileUpdate).eq('id', user.id)
  if (error) throw error

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      name: cleanName,
      full_name: cleanName,
      avatar_url: profileUpdate.avatar_url
    }
  })

  if (authError) throw authError
  localStorage.setItem('nexus_user_name', cleanName)
  return loadCurrentProfile()
}

export const updateCurrentPassword = async (password: string) => {
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')

  const { supabase } = await getCurrentUser()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export const updateProfileRole = async (profileId: string, role: NexusProfileRole) => {
  const supabase = getSupabaseOrThrow()
  const { error } = await supabase
    .from('nexus_profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', profileId)

  if (error) throw error
}

export const loadProfileMetrics = async (profile: NexusProfile): Promise<NexusProfileMetrics> => {
  const supabase = getSupabaseOrThrow()
  const isAdmin = profile.role === 'admin'

  const [totalRegisteredUsers, totalVisits, totalButtonClicks] = await Promise.all([
    isAdmin ? fetchCount('nexus_profiles') : Promise.resolve(1),
    fetchCount('nexus_site_visits'),
    fetchCount('nexus_button_clicks')
  ])

  const [{ data: visits, error: visitsError }, { data: clicks, error: clicksError }] =
    await Promise.all([
      supabase
        .from('nexus_site_visits')
        .select('id,user_id,profile_email,visitor_id,visit_path,ip_address,user_agent,visited_at')
        .order('visited_at', { ascending: false })
        .limit(isAdmin ? 24 : 8),
      supabase
        .from('nexus_button_clicks')
        .select('button_label,page,clicked_at,profile_email')
        .order('clicked_at', { ascending: false })
        .limit(isAdmin ? 300 : 120)
    ])

  if (visitsError) throw visitsError
  if (clicksError) throw clicksError

  const topButtonsByLabel = new Map<string, NexusButtonClickSummary>()
  for (const click of clicks || []) {
    const label = String(click.button_label || 'Unnamed control')
    const existing = topButtonsByLabel.get(label)
    if (existing) {
      existing.count += 1
      continue
    }

    topButtonsByLabel.set(label, {
      label,
      count: 1,
      lastClickedAt: String(click.clicked_at || ''),
      page: click.page || null
    })
  }

  let profiles: NexusProfile[] = []
  if (isAdmin) {
    const { data, error } = await supabase
      .from('nexus_profiles')
      .select(PROFILE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    profiles = (data || []).map(normalizeProfile)
  }

  return {
    totalRegisteredUsers,
    totalVisits,
    totalButtonClicks,
    recentVisits: ((visits || []) as any[]).map((visit) => ({
      id: String(visit.id || ''),
      user_id: visit.user_id || null,
      profile_email: visit.profile_email || null,
      visitor_id: visit.visitor_id || null,
      visit_path: String(visit.visit_path || '/'),
      ip_address: visit.ip_address || null,
      user_agent: visit.user_agent || null,
      visited_at: String(visit.visited_at || '')
    })),
    topButtons: Array.from(topButtonsByLabel.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    profiles
  }
}
