import { useEffect } from 'react'
import { useAuthStore } from '../store/auth-store'
import { SECURITY_VERIFICATIONS_PAUSED } from '../config/security-flags'
import { IS_TRIAL_BUILD } from '../config/app-mode'
import { clearDesktopAuthArtifacts, resolvePreferredDesktopAuthSession } from '../services/auth-session'

export default function AuthInitializer() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setAuthSession = useAuthStore((s) => s.setAuthSession)
  const setIsAuthInitialized = useAuthStore((s: any) => s.setIsAuthInitialized)

  useEffect(() => {
    const init = async () => {
      if (SECURITY_VERIFICATIONS_PAUSED || IS_TRIAL_BUILD) {
        clearDesktopAuthArtifacts()
        setAccessToken(null)
        if (setIsAuthInitialized) setIsAuthInitialized(true)
        return
      }

      try {
        const session = await resolvePreferredDesktopAuthSession()

        if (!session) {
          clearDesktopAuthArtifacts()
          setAccessToken(null)
          return
        }

        setAuthSession({
          token: session.accessToken,
          mode: session.mode,
          user: session.user
        })
        localStorage.setItem('nexus_user_name', session.user.name)

        if (session.mode === 'cloud') {
          const { bootstrapCloudAccount, syncLocalSettingsToCloud } = await import(
            '@renderer/services/cloud-data'
          )
          await bootstrapCloudAccount()
          await syncLocalSettingsToCloud()
        }
      } catch (err) {
        clearDesktopAuthArtifacts()
        setAccessToken(null)
      } finally {
        if (setIsAuthInitialized) setIsAuthInitialized(true)
      }
    }

    init()
  }, [setAccessToken, setAuthSession, setIsAuthInitialized])

  return null
}
