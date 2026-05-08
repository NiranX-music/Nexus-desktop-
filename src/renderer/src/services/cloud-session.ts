import { useAuthStore } from '@renderer/store/auth-store'
import { bootstrapCloudAccount, syncLocalSettingsToCloud } from '@renderer/services/cloud-data'
import type { DesktopAuthCallbackPayload } from '@renderer/lib/supabase'
import { completeCloudSession } from '@renderer/lib/supabase'
import { normalizeCloudAuthUser, persistPreferredDesktopAuthMode } from './auth-session'

export const activateCloudSessionPayload = async (payload: DesktopAuthCallbackPayload) => {
  const session = await completeCloudSession(payload)
  const user = session.user ? normalizeCloudAuthUser(session.user) : null

  persistPreferredDesktopAuthMode('cloud')
  localStorage.setItem('nexus_user_name', user?.name || '')
  useAuthStore.getState().setAuthSession({
    token: session.access_token,
    mode: 'cloud',
    user
  })

  const [bootstrapResult, syncResult] = await Promise.allSettled([
    bootstrapCloudAccount(),
    syncLocalSettingsToCloud()
  ])

  if (bootstrapResult.status === 'fulfilled' && bootstrapResult.value?.ok === false) {
    console.warn(
      'Nexus cloud bootstrap completed with a non-blocking warning:',
      bootstrapResult.value.error
    )
  } else if (bootstrapResult.status === 'rejected') {
    console.warn('Nexus cloud bootstrap failed after session activation:', bootstrapResult.reason)
  }

  if (syncResult.status === 'rejected') {
    console.warn('Nexus local settings sync failed after session activation:', syncResult.reason)
  }

  return session
}
