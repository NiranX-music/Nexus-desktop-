import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface AuthState {
  accessToken: string | null
  isAuthInitialized: boolean

  setAccessToken: (token: string | null) => void
  setIsAuthInitialized: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    accessToken: null,
    isAuthInitialized: false,

    setAccessToken: (token) =>
      set((state) => {
        state.accessToken = token
      }),

    setIsAuthInitialized: (value) =>
      set((state) => {
        state.isAuthInitialized = value
      }),

    logout: () =>
      set((state) => {
        const emailSession = localStorage.getItem('nexus_email_session')

        if (emailSession) {
          window.electron?.ipcRenderer?.invoke?.('email-auth:logout', emailSession).catch(() => {})
        }

        localStorage.removeItem('nexus_cloud_token')
        localStorage.removeItem('nexus_email_session')
        window.dispatchEvent(new Event('nexus-auth-logout'))
        state.accessToken = null
        state.isAuthInitialized = true
      })
  }))
)
