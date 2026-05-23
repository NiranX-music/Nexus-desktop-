import type { SupabaseClient } from '@supabase/supabase-js'

import { configureCloudSupabase } from '@renderer/lib/supabase'

const VISITOR_ID_STORAGE_KEY = 'nexus_analytics_visitor_id'
const IP_LOOKUP_URL = 'https://api.ipify.org?format=json'

let publicIpPromise: Promise<string | null> | null = null

type AnalyticsUserContext = {
  userId: string | null
  email: string | null
}

export type ButtonClickPayload = {
  buttonLabel: string
  page?: string
  elementTag?: string
  metadata?: Record<string, unknown>
}

const truncate = (value: string, maxLength = 240) => {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}...` : clean
}

export const getAnalyticsVisitorId = () => {
  if (typeof window === 'undefined') return null

  let visitorId = localStorage.getItem(VISITOR_ID_STORAGE_KEY)
  if (!visitorId) {
    visitorId =
      crypto.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId)
  }
  return visitorId
}

const getPublicIpAddress = async () => {
  if (!publicIpPromise) {
    publicIpPromise = fetch(IP_LOOKUP_URL, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = (await response.json()) as { ip?: string }
        return payload.ip || null
      })
      .catch(() => null)
  }

  return publicIpPromise
}

const getAnalyticsUserContext = async (supabase: SupabaseClient): Promise<AnalyticsUserContext> => {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return { userId: null, email: null }
    return { userId: data.user.id, email: data.user.email || null }
  } catch {
    return { userId: null, email: null }
  }
}

export const trackSiteVisit = async (visitPath: string, metadata: Record<string, unknown> = {}) => {
  const supabase = configureCloudSupabase()
  if (!supabase || typeof window === 'undefined') return

  const [ipAddress, userContext] = await Promise.all([
    getPublicIpAddress(),
    getAnalyticsUserContext(supabase)
  ])

  await supabase.from('nexus_site_visits').insert({
    user_id: userContext.userId,
    profile_email: userContext.email,
    visitor_id: getAnalyticsVisitorId(),
    visit_path: truncate(visitPath, 300),
    ip_address: ipAddress,
    user_agent: truncate(navigator.userAgent || '', 500),
    referrer: truncate(document.referrer || '', 500) || null,
    metadata
  })
}

export const trackButtonClick = async ({
  buttonLabel,
  page,
  elementTag,
  metadata = {}
}: ButtonClickPayload) => {
  const supabase = configureCloudSupabase()
  if (!supabase || typeof window === 'undefined') return

  const userContext = await getAnalyticsUserContext(supabase)

  await supabase.from('nexus_button_clicks').insert({
    user_id: userContext.userId,
    profile_email: userContext.email,
    visitor_id: getAnalyticsVisitorId(),
    button_label: truncate(buttonLabel || 'Unnamed control', 180),
    page: truncate(page || window.location.hash || window.location.pathname || '/', 300),
    element_tag: truncate(elementTag || 'button', 80),
    metadata
  })
}
