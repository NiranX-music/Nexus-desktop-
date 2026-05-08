import { createClient, Session, SupabaseClient } from '@supabase/supabase-js'

const CLOUD_SUPABASE_CONFIG_STORAGE_KEY = 'nexus_cloud_supabase_config'

type CloudSupabaseConfig = {
  supabaseUrl: string
  supabasePublishableKey: string
}

const normalizeSupabaseValue = (value = '') => String(value || '').trim()

const readStoredSupabaseConfig = (): CloudSupabaseConfig | null => {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(CLOUD_SUPABASE_CONFIG_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CloudSupabaseConfig>
    const supabaseUrl = normalizeSupabaseValue(parsed.supabaseUrl)
    const supabasePublishableKey = normalizeSupabaseValue(parsed.supabasePublishableKey)

    if (!supabaseUrl || !supabasePublishableKey) return null
    return { supabaseUrl, supabasePublishableKey }
  } catch {
    return null
  }
}

const writeStoredSupabaseConfig = (config: CloudSupabaseConfig | null) => {
  if (typeof window === 'undefined') return

  if (!config) {
    localStorage.removeItem(CLOUD_SUPABASE_CONFIG_STORAGE_KEY)
    return
  }

  localStorage.setItem(CLOUD_SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(config))
}

const getEnvSupabaseConfig = (): CloudSupabaseConfig | null => {
  const supabaseUrl = normalizeSupabaseValue(import.meta.env.VITE_SUPABASE_URL || '')
  const supabasePublishableKey = normalizeSupabaseValue(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  )

  if (!supabaseUrl || !supabasePublishableKey) return null
  return { supabaseUrl, supabasePublishableKey }
}

const createSupabaseClient = (config: CloudSupabaseConfig): SupabaseClient =>
  createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'nexus-ai-2-auth'
    }
  })

const readPayloadSupabaseConfig = (
  payload?: DesktopAuthCallbackPayload | Partial<CloudSupabaseConfig> | null
): CloudSupabaseConfig | null => {
  if (!payload) return null

  const supabaseUrl = normalizeSupabaseValue(
    (payload as any).supabaseUrl || (payload as any).supabase_url || ''
  )
  const supabasePublishableKey = normalizeSupabaseValue(
    (payload as any).supabasePublishableKey ||
      (payload as any).supabase_publishable_key ||
      (payload as any).supabaseAnonKey ||
      (payload as any).supabase_anon_key ||
      ''
  )

  if (!supabaseUrl || !supabasePublishableKey) return null
  return { supabaseUrl, supabasePublishableKey }
}

const initialSupabaseConfig = getEnvSupabaseConfig() || readStoredSupabaseConfig()

let activeSupabaseConfig: CloudSupabaseConfig | null = initialSupabaseConfig

export const hasSupabaseConfig = Boolean(activeSupabaseConfig)

export let nexusSupabase: SupabaseClient | null = activeSupabaseConfig
  ? createSupabaseClient(activeSupabaseConfig)
  : null

export const configureCloudSupabase = (
  payload?: DesktopAuthCallbackPayload | Partial<CloudSupabaseConfig> | null
) => {
  const nextConfig =
    readPayloadSupabaseConfig(payload) || activeSupabaseConfig || getEnvSupabaseConfig() || readStoredSupabaseConfig()

  if (!nextConfig) {
    nexusSupabase = null
    activeSupabaseConfig = null
    writeStoredSupabaseConfig(null)
    return null
  }

  const hasConfigChanged =
    !activeSupabaseConfig ||
    activeSupabaseConfig.supabaseUrl !== nextConfig.supabaseUrl ||
    activeSupabaseConfig.supabasePublishableKey !== nextConfig.supabasePublishableKey

  if (!nexusSupabase || hasConfigChanged) {
    nexusSupabase = createSupabaseClient(nextConfig)
  }

  activeSupabaseConfig = nextConfig
  writeStoredSupabaseConfig(nextConfig)
  return nexusSupabase
}

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
  supabaseUrl?: string
  supabase_url?: string
  supabasePublishableKey?: string
  supabase_publishable_key?: string
  supabaseAnonKey?: string
  supabase_anon_key?: string
}

export const normalizeDesktopAuthPayload = (payload: DesktopAuthCallbackPayload) => ({
  accessToken: payload.accessToken || payload.access_token || '',
  refreshToken: payload.refreshToken || payload.refresh_token || '',
  expiresAt: payload.expiresAt || payload.expires_at || '',
  state: payload.state || '',
  email: payload.email || '',
  userId: payload.userId || payload.user_id || '',
  supabaseUrl: payload.supabaseUrl || payload.supabase_url || '',
  supabasePublishableKey:
    payload.supabasePublishableKey ||
    payload.supabase_publishable_key ||
    payload.supabaseAnonKey ||
    payload.supabase_anon_key ||
    ''
})

export const completeCloudSession = async (
  payload: DesktopAuthCallbackPayload
): Promise<Session> => {
  const client = configureCloudSupabase(payload)

  if (!client) {
    throw new Error('Supabase is not configured for this desktop build or auth callback.')
  }

  const { accessToken, refreshToken } = normalizeDesktopAuthPayload(payload)

  if (!accessToken || !refreshToken) {
    throw new Error('The website did not return a complete Nexus authorization.')
  }

  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  })

  if (error || !data.session) {
    throw new Error(error?.message || 'Unable to activate the Supabase session.')
  }

  return data.session
}

export const getCloudSession = async () => {
  const client = configureCloudSupabase()
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session
}

export const getVerifiedCloudUser = async () => {
  const client = configureCloudSupabase()
  if (!client) return null
  const { data, error } = await client.auth.getUser()
  if (error) return null
  return data.user
}

export const signOutCloudSession = async () => {
  const client = configureCloudSupabase()
  await client?.auth.signOut()
}
