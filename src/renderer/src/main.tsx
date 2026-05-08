import './assets/main.css'

import React, { JSX, StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'

import LockScreen from './UI/LockScreen'
import { useAuthStore } from './store/auth-store'
import AuthInitializer from './auth/AuthToken'
import { LOCAL_DEVICE_LOCK_ENABLED, SECURITY_VERIFICATIONS_PAUSED } from './config/security-flags'
import { IS_TRIAL_BUILD } from './config/app-mode'
import { initializeIssueReporting, reportRendererIssue } from './services/issue-reporting'
import { clearDesktopAuthArtifacts, resolvePreferredDesktopAuthSession } from './services/auth-session'

import AppExperienceRoot from '@flavor-root'

const LoginPage = lazy(() => import('@flavor-login'))
const electronAPI = (window as any).electron?.ipcRenderer
const CLOUD_AUTH_FEEDBACK_STORAGE_KEY = 'nexus_cloud_auth_feedback'

const clearPausedSecuritySession = () => {
  clearDesktopAuthArtifacts()
  useAuthStore.getState().setAuthSession({ token: null, mode: null, user: null })
}

const writeCloudAuthFeedback = (message = '') => {
  if (message) {
    localStorage.setItem(CLOUD_AUTH_FEEDBACK_STORAGE_KEY, message)
  } else {
    localStorage.removeItem(CLOUD_AUTH_FEEDBACK_STORAGE_KEY)
  }

  window.dispatchEvent(new Event('nexus-cloud-auth-feedback'))
}

class SystemErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error.message }
  }
  componentDidCatch(error: any, info: React.ErrorInfo) {
    void reportRendererIssue({
      source: 'renderer-error-boundary',
      severity: 'fatal',
      title: error?.name || 'Renderer Boundary Error',
      message: error?.message || 'The renderer crashed inside the system shell.',
      errorName: error?.name || '',
      stack: error?.stack || '',
      context: {
        componentStack: info.componentStack || ''
      }
    })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center text-red-500 font-mono p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">CRITICAL SYSTEM FAILURE</h1>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 max-w-2xl wrap-break-word">
            {this.state.errorMsg}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

initializeIssueReporting()

let isSessionUnlocked = false

window.addEventListener('nexus-auth-logout', () => {
  isSessionUnlocked = false
})

const activateCloudSession = async (payload: any) => {
  const { activateCloudSessionPayload } = await import('./services/cloud-session')
  await activateCloudSessionPayload(payload)
  writeCloudAuthFeedback('')
}

const renderLoadingSurface = () => (
  <div className="h-screen w-screen bg-[#050505] flex items-center justify-center text-[#10b981] font-mono text-sm tracking-widest uppercase">
    Loading Nexus...
  </div>
)

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const [status, setStatus] = useState<'checking' | 'authorized'>('checking')
  const navigate = useNavigate()
  const location = useLocation()

  const accessToken = useAuthStore((state) => state.accessToken)
  const authMode = useAuthStore((state) => state.authMode)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    if (IS_TRIAL_BUILD) {
      setStatus('authorized')
      return
    }

    if (SECURITY_VERIFICATIONS_PAUSED) {
      clearPausedSecuritySession()
      isSessionUnlocked = true
      setStatus('authorized')
      return
    }

    const verifyAccess = async () => {
      try {
        const session = await resolvePreferredDesktopAuthSession()

        if (!session) {
          navigate('/login', { replace: true })
          return
        }

        if (accessToken !== session.accessToken || authMode !== session.mode) {
          useAuthStore.getState().setAuthSession({
            token: session.accessToken,
            mode: session.mode,
            user: session.user
          })
        }

        if (LOCAL_DEVICE_LOCK_ENABLED && !isSessionUnlocked && location.pathname !== '/lock') {
          navigate('/lock', { replace: true })
          return
        }

        setStatus('authorized')
      } catch (error) {
        logout()
        navigate('/login', { replace: true })
      }
    }

    verifyAccess()
  }, [navigate, location.pathname, accessToken, authMode, logout])

  if (status === 'checking') {
    return renderLoadingSurface()
  }

  return children
}

const PublicRoute = ({ children }: { children: JSX.Element }) => {
  if (IS_TRIAL_BUILD) return <Navigate to="/" replace />
  if (SECURITY_VERIFICATIONS_PAUSED) return <Navigate to="/" replace />

  const accessToken = useAuthStore((state) => state.accessToken)
  const isAuthInitialized = useAuthStore((state) => state.isAuthInitialized)

  if (!isAuthInitialized) {
    return renderLoadingSurface()
  }

  return accessToken ? <Navigate to="/" replace /> : children
}

const AppRouter = () => {
  const navigate = useNavigate()

  useEffect(() => {
    if (IS_TRIAL_BUILD) return

    let lastHandledCloudAuthSignature = ''

    const getCloudAuthSignature = (payload: any) =>
      JSON.stringify([
        payload?.ok ?? null,
        payload?.state || '',
        payload?.error || '',
        payload?.accessToken || payload?.access_token || '',
        payload?.refreshToken || payload?.refresh_token || ''
      ])

    const handleCloudAuthPayload = async (payload: any) => {
      if (!payload) return

      const signature = getCloudAuthSignature(payload)
      if (signature && signature === lastHandledCloudAuthSignature) return
      lastHandledCloudAuthSignature = signature

      try {
        if (!payload?.ok) throw new Error(payload?.error || 'Website authorization failed.')
        await activateCloudSession(payload)
        isSessionUnlocked = true
        navigate('/', { replace: true })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to activate the Nexus cloud session.'
        writeCloudAuthFeedback(message)
        useAuthStore.getState().logout()
        navigate('/login', { replace: true })
      }
    }

    if (electronAPI) {
      electronAPI.on('oauth-callback', async (_event: any, url: string) => {
        try {
          const urlObj = new URL(url.replace('nexus://', 'http://localhost/'))

          const refreshToken =
            urlObj.searchParams.get('refreshToken') || urlObj.searchParams.get('refresh_token')
          const accessToken =
            urlObj.searchParams.get('accessToken') || urlObj.searchParams.get('access_token')

          if (refreshToken && accessToken) {
            if (SECURITY_VERIFICATIONS_PAUSED) {
              clearPausedSecuritySession()
              navigate('/', { replace: true })
              return
            }

            await activateCloudSession({ refreshToken, accessToken })

            navigate('/')
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to activate the Nexus login callback.'
          writeCloudAuthFeedback(message)
          useAuthStore.getState().logout()
          navigate('/login', { replace: true })
        }
      })

      electronAPI.on('cloud-auth-callback', async (_event: any, payload: any) => {
        await handleCloudAuthPayload(payload)
      })

      void electronAPI
        .invoke('cloud-auth:consume-pending')
        .then(async (payload: any) => {
          await handleCloudAuthPayload(payload)
        })
        .catch(() => {})
    }
    return () => {
      electronAPI?.removeAllListeners('oauth-callback')
      electronAPI?.removeAllListeners('cloud-auth-callback')
    }
  }, [navigate])

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Suspense fallback={renderLoadingSurface()}>
              <LoginPage />
            </Suspense>
          </PublicRoute>
        }
      />

      <Route
        path="/lock"
        element={
          SECURITY_VERIFICATIONS_PAUSED || !LOCAL_DEVICE_LOCK_ENABLED ? (
            <Navigate to="/" replace />
          ) : (
            <ProtectedRoute>
              <LockScreen
                onUnlock={() => {
                  isSessionUnlocked = true
                  navigate('/')
                }}
              />
            </ProtectedRoute>
          )
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppExperienceRoot />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <HashRouter>
        <AuthInitializer />
        <AppRouter />
      </HashRouter>
    </SystemErrorBoundary>
  </StrictMode>
)
