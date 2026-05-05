import './assets/main.css'

import React, { JSX, StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'

import LockScreen from './UI/LockScreen'
import LoginPage from './auth/Login'
import { useAuthStore } from './store/auth-store'
import AuthInitializer from './auth/AuthToken'
import IndexRoot from './IndexRoot'
import { LOCAL_DEVICE_LOCK_ENABLED, SECURITY_VERIFICATIONS_PAUSED } from './config/security-flags'
import { bootstrapCloudAccount, syncLocalSettingsToCloud } from './services/cloud-data'
import { completeCloudSession, getCloudSession, getVerifiedCloudUser } from './lib/supabase'

const electronAPI = (window as any).electron?.ipcRenderer

const clearPausedSecuritySession = () => {
  localStorage.removeItem('nexus_cloud_token')
  localStorage.removeItem('nexus_email_session')
  localStorage.removeItem('nexus_user_name')
  useAuthStore.getState().setAccessToken(null)
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

let isSessionUnlocked = false

window.addEventListener('nexus-auth-logout', () => {
  isSessionUnlocked = false
})

const activateCloudSession = async (payload: any) => {
  const session = await completeCloudSession(payload)
  localStorage.removeItem('nexus_email_session')
  localStorage.setItem('nexus_cloud_token', session.refresh_token)
  useAuthStore.getState().setAccessToken(session.access_token)
  await bootstrapCloudAccount()
  await syncLocalSettingsToCloud()
}

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const [status, setStatus] = useState<'checking' | 'authorized'>('checking')
  const navigate = useNavigate()
  const location = useLocation()

  const accessToken = useAuthStore((state) => state.accessToken)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    if (SECURITY_VERIFICATIONS_PAUSED) {
      clearPausedSecuritySession()
      isSessionUnlocked = true
      setStatus('authorized')
      return
    }

    const verifyAccess = async () => {
      try {
        const session = await getCloudSession()
        const user = await getVerifiedCloudUser()

        if (!session || !user) {
          navigate('/login', { replace: true })
          return
        }

        if (accessToken !== session.access_token) {
          useAuthStore.getState().setAccessToken(session.access_token)
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
  }, [navigate, location.pathname, accessToken, logout])

  if (status === 'checking') {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center text-[#10b981] font-mono text-sm tracking-widest uppercase">
        Loading Nexus...
      </div>
    )
  }

  return children
}

const PublicRoute = ({ children }: { children: JSX.Element }) => {
  if (SECURITY_VERIFICATIONS_PAUSED) return <Navigate to="/" replace />

  const accessToken =
    useAuthStore((state) => state.accessToken) || localStorage.getItem('nexus_cloud_token')
  return accessToken ? <Navigate to="/" replace /> : children
}

const AppRouter = () => {
  const navigate = useNavigate()

  useEffect(() => {
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
        } catch (e) {}
      })

      electronAPI.on('cloud-auth-callback', async (_event: any, payload: any) => {
        try {
          if (!payload?.ok) throw new Error(payload?.error || 'Website authorization failed.')
          await activateCloudSession(payload)
          isSessionUnlocked = true
          navigate('/', { replace: true })
        } catch (error) {
          useAuthStore.getState().logout()
          navigate('/login', { replace: true })
        }
      })
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
            <LoginPage />
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
            <IndexRoot />
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
