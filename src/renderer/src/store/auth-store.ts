import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  clearDesktopAuthArtifacts,
  readStoredAppAuthToken,
  type DesktopAuthMode,
  type DesktopAuthUser
} from '@renderer/services/auth-session'

interface AuthState {
  accessToken: string | null
  authMode: DesktopAuthMode | null
  user: DesktopAuthUser | null
  isAuthInitialized: boolean

  setAccessToken: (token: string | null) => void
  setAuthSession: (session: {
    token: string | null
    mode: DesktopAuthMode | null
    user?: DesktopAuthUser | null
  }) => void
  setIsAuthInitialized: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    accessToken: null,
    authMode: null,
    user: null,
    isAuthInitialized: false,

    setAccessToken: (token) =>
      set((state) => {
        state.accessToken = token
      }),

    setAuthSession: ({ token, mode, user = null }) =>
      set((state) => {
        state.accessToken = token
        state.authMode = mode
        state.user = user
      }),

    setIsAuthInitialized: (value) =>
      set((state) => {
        state.isAuthInitialized = value
      }),

    logout: () =>
      set((state) => {
        const appSessionToken = readStoredAppAuthToken()

        import('@renderer/lib/supabase')
          .then(({ signOutCloudSession }) => signOutCloudSession())
          .catch(() => {})

        if (appSessionToken) {
          window.electron?.ipcRenderer?.invoke('email-auth:logout', appSessionToken).catch(() => {})
        }

        clearDesktopAuthArtifacts()
        window.dispatchEvent(new Event('nexus-auth-logout'))
        state.accessToken = null
        state.authMode = null
        state.user = null
        state.isAuthInitialized = true
      })
  }))
)
