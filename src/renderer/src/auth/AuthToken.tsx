import { useEffect } from 'react'
import { useAuthStore } from '../store/auth-store'
import { SECURITY_VERIFICATIONS_PAUSED } from '../config/security-flags'
import { bootstrapCloudAccount, syncLocalSettingsToCloud } from '@renderer/services/cloud-data'
import { getCloudSession, getVerifiedCloudUser } from '@renderer/lib/supabase'

export default function AuthInitializer() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setIsAuthInitialized = useAuthStore((s: any) => s.setIsAuthInitialized)

  useEffect(() => {
    const init = async () => {
      if (SECURITY_VERIFICATIONS_PAUSED) {
        localStorage.removeItem('nexus_cloud_token')
        localStorage.removeItem('nexus_email_session')
        localStorage.removeItem('nexus_user_name')
        setAccessToken(null)
        if (setIsAuthInitialized) setIsAuthInitialized(true)
        return
      }

      try {
        const session = await getCloudSession()
        const user = await getVerifiedCloudUser()

        if (!session || !user) {
          setAccessToken(null)
          return
        }

        setAccessToken(session.access_token)
        await bootstrapCloudAccount()
        await syncLocalSettingsToCloud()
      } catch (err) {
        setAccessToken(null)
        localStorage.removeItem('nexus_cloud_token')
        localStorage.removeItem('nexus_email_session')
      } finally {
        if (setIsAuthInitialized) setIsAuthInitialized(true)
      }
    }

    init()
  }, [setAccessToken, setIsAuthInitialized])

  return null
}
