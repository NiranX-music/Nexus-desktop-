import { nexusSupabase } from '@renderer/lib/supabase'

export type NexusCloudValue = Record<string, unknown> | string | number | boolean | null

export type NexusCloudDataRow<T = NexusCloudValue> = {
  id?: string
  user_id?: string
  device_id?: string | null
  collection: string
  item_key: string
  value: T
  updated_at?: string
}

const DEVICE_ID_STORAGE_KEY = 'nexus_desktop_device_id'

const createDeviceId = () =>
  crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`

const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (!deviceId) {
    deviceId = createDeviceId()
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId)
  }
  return deviceId
}

export const isCloudDataReady = () => Boolean(nexusSupabase)

export const getCloudAccount = async () => {
  if (!nexusSupabase) return null
  const { data, error } = await nexusSupabase.auth.getUser()
  if (error) return null
  return data.user
}

export const bootstrapCloudAccount = async () => {
  if (!nexusSupabase) return { ok: false, error: 'Supabase is not configured.' }

  const user = await getCloudAccount()
  if (!user) return { ok: false, error: 'No authenticated cloud user.' }

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
    updated_at: new Date().toISOString()
  }

  await nexusSupabase.from('nexus_profiles').upsert(profile, { onConflict: 'id' })

  await nexusSupabase.from('nexus_desktop_devices').upsert(
    {
      user_id: user.id,
      device_id: getDeviceId(),
      device_name: navigator.userAgent,
      app_version: import.meta.env.VITE_NEXUS_APP_VERSION || '',
      last_seen_at: new Date().toISOString()
    },
    { onConflict: 'user_id,device_id' }
  )

  return { ok: true, user }
}

export const saveCloudData = async (
  collection: string,
  itemKey: string,
  value: NexusCloudValue
) => {
  if (!nexusSupabase) return { ok: false, error: 'Supabase is not configured.' }

  const user = await getCloudAccount()
  if (!user) return { ok: false, error: 'No authenticated cloud user.' }

  const { error } = await nexusSupabase.from('nexus_user_data').upsert(
    {
      user_id: user.id,
      device_id: getDeviceId(),
      collection,
      item_key: itemKey,
      value,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,collection,item_key' }
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export const loadCloudData = async <T = NexusCloudValue>(
  collection: string,
  itemKey: string
): Promise<T | null> => {
  if (!nexusSupabase) return null

  const { data, error } = await nexusSupabase
    .from('nexus_user_data')
    .select('value')
    .eq('collection', collection)
    .eq('item_key', itemKey)
    .maybeSingle()

  if (error) return null
  return (data?.value as T) ?? null
}

export const listCloudData = async <T = NexusCloudValue>(
  collection: string
): Promise<Array<NexusCloudDataRow<T>>> => {
  if (!nexusSupabase) return []

  const { data, error } = await nexusSupabase
    .from('nexus_user_data')
    .select('id,user_id,device_id,collection,item_key,value,updated_at')
    .eq('collection', collection)
    .order('updated_at', { ascending: false })

  if (error) return []
  return (data || []) as Array<NexusCloudDataRow<T>>
}

export const deleteCloudData = async (collection: string, itemKey: string) => {
  if (!nexusSupabase) return { ok: false, error: 'Supabase is not configured.' }

  const { error } = await nexusSupabase
    .from('nexus_user_data')
    .delete()
    .eq('collection', collection)
    .eq('item_key', itemKey)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export const saveCloudSetting = (itemKey: string, value: NexusCloudValue) =>
  saveCloudData('settings', itemKey, value)

export const loadCloudSettings = async () => {
  const rows = await listCloudData('settings')
  return rows.reduce<Record<string, NexusCloudValue>>((settings, row) => {
    settings[row.item_key] = row.value
    return settings
  }, {})
}

export const syncLocalSettingsToCloud = async () => {
  const sensitiveKeys = new Set([
    'nexus_cloud_token',
    'nexus_email_session',
    'nexus_desktop_device_id',
    'nexus_supabase_session',
    'nexus_secure_vault'
  ])

  const knownKeys = [
    'nexus_user_name',
    'nexus_voice_profile',
    'nexus_nvidia_default_models',
    'nexus_ai_provider_mode',
    'nexus_nvidia_voice_replies',
    'nexus_voice_lang',
    'nexus_adb_ip',
    'nexus_adb_port'
  ]
  const discoveredKeys = Array.from({ length: localStorage.length }, (_, index) =>
    localStorage.key(index)
  ).filter((key): key is string => Boolean(key?.startsWith('nexus_')))
  const keys = Array.from(new Set([...knownKeys, ...discoveredKeys])).filter(
    (key) => !sensitiveKeys.has(key)
  )

  await Promise.all(
    keys.map(async (key) => {
      const rawValue = localStorage.getItem(key)
      if (rawValue !== null) {
        await saveCloudSetting(key, { value: rawValue })
      }
    })
  )
}
