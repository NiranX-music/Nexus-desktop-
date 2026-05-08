import type { User } from '@supabase/supabase-js'

import { getCloudSession, getVerifiedCloudUser } from '@renderer/lib/supabase'

export type DesktopAuthMode = 'cloud' | 'app'

export type DesktopAuthUser = {
  id: string
  email: string
  name: string
  createdAt?: string
  lastLoginAt?: string
}

export type ResolvedDesktopAuthSession = {
  mode: DesktopAuthMode
  accessToken: string
  user: DesktopAuthUser
}

const APP_AUTH_SESSION_STORAGE_KEY = 'nexus_app_auth_session'
const DESKTOP_AUTH_MODE_STORAGE_KEY = 'nexus_desktop_auth_mode'
const LEGACY_AUTH_STORAGE_KEYS = [
  'nexus_cloud_token',
  'nexus_email_session',
  'nexus_cloud_auth_feedback'
] as const

const electronAPI = (window as any).electron?.ipcRenderer

const normalizeAuthMode = (value: unknown): DesktopAuthMode | null => {
  if (value === 'cloud' || value === 'app') return value
  return null
}

const normalizeName = (value = '', fallbackEmail = '') => {
  const trimmed = String(value || '').trim()
  if (trimmed) return trimmed
  return fallbackEmail.split('@')[0] || 'Nexus Operator'
}

export const normalizeCloudAuthUser = (user: User): DesktopAuthUser => ({
  id: user.id,
  email: user.email || '',
  name: normalizeName(
    String(user.user_metadata?.full_name || user.user_metadata?.name || ''),
    user.email || ''
  )
})

export const normalizeAppAuthUser = (user: any): DesktopAuthUser => ({
  id: String(user?.id || ''),
  email: String(user?.email || '').trim().toLowerCase(),
  name: normalizeName(String(user?.name || ''), String(user?.email || '')),
  createdAt: user?.createdAt ? String(user.createdAt) : undefined,
  lastLoginAt: user?.lastLoginAt ? String(user.lastLoginAt) : undefined
})

export const readPreferredDesktopAuthMode = (): DesktopAuthMode | null => {
  if (typeof window === 'undefined') return null
  return normalizeAuthMode(localStorage.getItem(DESKTOP_AUTH_MODE_STORAGE_KEY))
}

export const persistPreferredDesktopAuthMode = (mode: DesktopAuthMode | null) => {
  if (typeof window === 'undefined') return

  if (!mode) {
    localStorage.removeItem(DESKTOP_AUTH_MODE_STORAGE_KEY)
    return
  }

  localStorage.setItem(DESKTOP_AUTH_MODE_STORAGE_KEY, mode)
}

export const readStoredAppAuthToken = () => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(APP_AUTH_SESSION_STORAGE_KEY) || ''
}

export const persistStoredAppAuthToken = (token: string) => {
  if (typeof window === 'undefined') return

  if (!token) {
    localStorage.removeItem(APP_AUTH_SESSION_STORAGE_KEY)
    return
  }

  localStorage.setItem(APP_AUTH_SESSION_STORAGE_KEY, token)
}

export const clearDesktopAuthArtifacts = () => {
  if (typeof window === 'undefined') return

  localStorage.removeItem(APP_AUTH_SESSION_STORAGE_KEY)
  localStorage.removeItem('nexus_user_name')

  for (const key of LEGACY_AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }

  persistPreferredDesktopAuthMode(null)
}

const resolveAppAuthSession = async (): Promise<ResolvedDesktopAuthSession | null> => {
  const token = readStoredAppAuthToken()
  if (!token || !electronAPI) return null

  try {
    const response = await electronAPI.invoke('email-auth:verify-session', token)
    if (!response?.ok || !response.user) {
      persistStoredAppAuthToken('')
      return null
    }

    return {
      mode: 'app',
      accessToken: token,
      user: normalizeAppAuthUser(response.user)
    }
  } catch {
    persistStoredAppAuthToken('')
    return null
  }
}

const resolveCloudAuthSession = async (): Promise<ResolvedDesktopAuthSession | null> => {
  try {
    const session = await getCloudSession()
    const user = await getVerifiedCloudUser()

    if (!session || !user) return null

    return {
      mode: 'cloud',
      accessToken: session.access_token,
      user: normalizeCloudAuthUser(user)
    }
  } catch {
    return null
  }
}

export const resolvePreferredDesktopAuthSession =
  async (): Promise<ResolvedDesktopAuthSession | null> => {
    const preferredMode = readPreferredDesktopAuthMode()
    const resolvers =
      preferredMode === 'app'
        ? [resolveAppAuthSession, resolveCloudAuthSession]
        : preferredMode === 'cloud'
          ? [resolveCloudAuthSession, resolveAppAuthSession]
          : [resolveCloudAuthSession, resolveAppAuthSession]

    for (const resolver of resolvers) {
      const session = await resolver()
      if (session) return session
    }

    return null
  }
