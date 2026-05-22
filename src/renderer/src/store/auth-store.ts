import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface AuthState {
  accessToken: string | null
  userEmail: string | null
  authMode: 'cloud' | 'app' | null
  isAuthInitialized: boolean

  setAccessToken: (token: string | null) => void
  setUserEmail: (email: string | null) => void
  setAuthSession: (session: {
    token: string | null
    mode?: 'cloud' | 'app' | null
    user?: { email?: string; name?: string } | null
  }) => void
  setIsAuthInitialized: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    accessToken: null,
    userEmail: null,
    authMode: null,
    isAuthInitialized: false,

    setAccessToken: (token) =>
      set((state) => {
        state.accessToken = token
      }),

    setUserEmail: (email) =>
      set((state) => {
        state.userEmail = email
      }),

    setAuthSession: (session) =>
      set((state) => {
        state.accessToken = session.token
        state.authMode = session.mode || null
        state.userEmail = session.user?.email || null
        state.isAuthInitialized = true
      }),

    setIsAuthInitialized: (value) =>
      set((state) => {
        state.isAuthInitialized = value
      }),

    logout: () =>
      set((state) => {
        state.accessToken = null
        state.userEmail = null
        state.authMode = null
        state.isAuthInitialized = true
        localStorage.removeItem('nexus_local_session')
        localStorage.removeItem('nexus_cloud_token')
      })
  }))
)
