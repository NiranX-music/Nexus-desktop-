import { useEffect } from 'react'
import { useAuthStore } from '../store/auth-store'
import { resolvePreferredDesktopAuthSession } from '../services/auth-session'
import { bootstrapCloudAccount, syncLocalSettingsToCloud } from '../services/cloud-data'

export default function AuthInitializer() {
  const setAuthSession = useAuthStore((s) => s.setAuthSession)
  const setIsAuthInitialized = useAuthStore((s: any) => s.setIsAuthInitialized)

  useEffect(() => {
    let isCancelled = false

    const init = async () => {
      try {
        const session = await resolvePreferredDesktopAuthSession()
        if (isCancelled) return

        if (!session) {
          setAuthSession({ token: null, mode: null, user: null })
          return
        }

        localStorage.setItem('nexus_user_name', session.user.name)
        setAuthSession({
          token: session.accessToken,
          mode: session.mode,
          user: session.user
        })

        if (session.mode === 'cloud') {
          void Promise.allSettled([bootstrapCloudAccount(), syncLocalSettingsToCloud()])
        }
      } catch (err) {
        if (!isCancelled) {
          setAuthSession({ token: null, mode: null, user: null })
        }
      } finally {
        if (!isCancelled && setIsAuthInitialized) setIsAuthInitialized(true)
      }
    }

    init()

    return () => {
      isCancelled = true
    }
  }, [setAuthSession, setIsAuthInitialized])

  return null
}
