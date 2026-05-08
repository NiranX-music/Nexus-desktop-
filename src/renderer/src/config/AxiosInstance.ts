import { useAuthStore } from '@renderer/store/auth-store'
import { SECURITY_VERIFICATIONS_PAUSED } from '@renderer/config/security-flags'
import { nexusSupabase } from '@renderer/lib/supabase'
import axios, { AxiosError, AxiosRequestConfig } from 'axios'

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean
}
type QueueItem = {
  resolve: (token: string) => void
  reject: (err: any) => void
}

const AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_KEY
})

AxiosInstance.interceptors.request.use((config) => {
  if (SECURITY_VERIFICATIONS_PAUSED) return config

  const { accessToken, authMode } = useAuthStore.getState()

  if (accessToken && authMode === 'cloud') {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

let isRefreshing = false
let queue: QueueItem[] = []

const processQueue = (error: any, token: string | null = null) => {
  queue.forEach((prom) => {
    if (error || !token) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  queue = []
}

AxiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (SECURITY_VERIFICATIONS_PAUSED) return Promise.reject(error)

    const originalRequest = error.config as CustomAxiosRequestConfig

    if (
      error.response?.status === 401 &&
      useAuthStore.getState().authMode === 'cloud' &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes('/refresh-token') &&
      !originalRequest?.url?.includes('/users/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token: string) => {
              originalRequest.headers = originalRequest.headers || {}
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(AxiosInstance(originalRequest))
            },
            reject: (err: any) => reject(err)
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        if (!nexusSupabase) throw new Error('Supabase is not configured.')

        const { data, error: refreshError } = await nexusSupabase.auth.refreshSession()
        if (refreshError || !data.session) {
          throw new Error(refreshError?.message || 'Unable to refresh the cloud session.')
        }

        const newAccessToken = data.session.access_token

        useAuthStore.getState().setAccessToken(newAccessToken)

        processQueue(null, newAccessToken)

        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

        return AxiosInstance(originalRequest)
      } catch (err) {
        processQueue(err, null)

        useAuthStore.getState().logout()
        window.location.hash = '#/login'

        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default AxiosInstance
