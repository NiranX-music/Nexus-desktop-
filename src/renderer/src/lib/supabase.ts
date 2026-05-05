import { createClient, Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export const nexusSupabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'nexus-ai-2-auth'
      }
    })
  : null

export type DesktopAuthCallbackPayload = {
  accessToken?: string
  refreshToken?: string
  access_token?: string
  refresh_token?: string
  expiresAt?: string
  expires_at?: string
  state?: string
  email?: string
  userId?: string
  user_id?: string
}

export const normalizeDesktopAuthPayload = (payload: DesktopAuthCallbackPayload) => ({
  accessToken: payload.accessToken || payload.access_token || '',
  refreshToken: payload.refreshToken || payload.refresh_token || '',
  expiresAt: payload.expiresAt || payload.expires_at || '',
  state: payload.state || '',
  email: payload.email || '',
  userId: payload.userId || payload.user_id || ''
})

export const completeCloudSession = async (
  payload: DesktopAuthCallbackPayload
): Promise<Session> => {
  if (!nexusSupabase) {
    throw new Error('Supabase is not configured for this desktop build.')
  }

  const { accessToken, refreshToken } = normalizeDesktopAuthPayload(payload)

  if (!accessToken || !refreshToken) {
    throw new Error('The website did not return a complete Nexus authorization.')
  }

  const { data, error } = await nexusSupabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  })

  if (error || !data.session) {
    throw new Error(error?.message || 'Unable to activate the Supabase session.')
  }

  return data.session
}

export const getCloudSession = async () => {
  if (!nexusSupabase) return null
  const { data } = await nexusSupabase.auth.getSession()
  return data.session
}

export const getVerifiedCloudUser = async () => {
  if (!nexusSupabase) return null
  const { data, error } = await nexusSupabase.auth.getUser()
  if (error) return null
  return data.user
}

export const signOutCloudSession = async () => {
  await nexusSupabase?.auth.signOut()
}
