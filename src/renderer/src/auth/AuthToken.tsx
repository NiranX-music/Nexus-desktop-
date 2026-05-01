import { useEffect } from 'react'
import { useAuthStore } from '../store/auth-store'
import AxiosInstance from '../config/AxiosInstance'

const electronAPI = (window as any).electron?.ipcRenderer

export default function AuthInitializer() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setIsAuthInitialized = useAuthStore((s: any) => s.setIsAuthInitialized)

  useEffect(() => {
    const init = async () => {
      try {
        const storedEmailSession = localStorage.getItem('nexus_email_session')
        if (storedEmailSession && electronAPI) {
          const session = await electronAPI.invoke('email-auth:verify-session', storedEmailSession)
          if (session?.ok) {
            setAccessToken(storedEmailSession)
            return
          }
          localStorage.removeItem('nexus_email_session')
        }

        const storedRefreshToken = localStorage.getItem('nexus_cloud_token')

        if (!storedRefreshToken) {
          setAccessToken(null)
          return
        }

        const res = await AxiosInstance.post('/users/refresh-token', {
          refreshToken: storedRefreshToken
        })

        const accessToken = res.data.accessToken
        setAccessToken(accessToken)

        if (res.data.refreshToken) {
          localStorage.setItem('nexus_cloud_token', res.data.refreshToken)
        }
      } catch (err) {
        setAccessToken(null)
        localStorage.removeItem('nexus_cloud_token')
      } finally {
        if (setIsAuthInitialized) setIsAuthInitialized(true)
      }
    }

    init()
  }, [setAccessToken, setIsAuthInitialized])

  return null
}
