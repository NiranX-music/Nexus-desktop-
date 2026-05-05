import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { signOutCloudSession } from '@renderer/lib/supabase'

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
        signOutCloudSession().catch(() => {})
        localStorage.removeItem('nexus_cloud_token')
        localStorage.removeItem('nexus_email_session')
        window.dispatchEvent(new Event('nexus-auth-logout'))
        state.accessToken = null
        state.isAuthInitialized = true
      })
  }))
)
