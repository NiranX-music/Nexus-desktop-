import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { trackButtonClick, trackSiteVisit } from '@renderer/services/analytics'

const getControlLabel = (element: HTMLElement) => {
  const explicitLabel =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('name') ||
    ''

  if (explicitLabel.trim()) return explicitLabel.trim()

  const text = element.innerText || element.textContent || ''
  return text.replace(/\s+/g, ' ').trim() || element.tagName.toLowerCase()
}

const AnalyticsTracker = () => {
  const location = useLocation()
  const lastClickRef = useRef<Record<string, number>>({})

  const pageKey = useMemo(() => {
    const routePath = `${location.pathname}${location.search}` || '/'
    return window.location.hash || routePath
  }, [location.pathname, location.search])

  useEffect(() => {
    void trackSiteVisit(pageKey, { surface: 'route' }).catch(() => {})
  }, [pageKey])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const control = target?.closest(
        'button,a,[role="button"],input[type="button"],input[type="submit"]'
      ) as HTMLElement | null

      if (!control || control.dataset.analyticsSkip === 'true') return

      const label = getControlLabel(control)
      const signature = `${pageKey}:${control.tagName}:${label}`
      const now = Date.now()
      if (now - (lastClickRef.current[signature] || 0) < 250) return
      lastClickRef.current[signature] = now

      void trackButtonClick({
        buttonLabel: label,
        page: pageKey,
        elementTag: control.tagName.toLowerCase(),
        metadata: {
          className: control.className || '',
          surface: 'global-click-capture'
        }
      }).catch(() => {})
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pageKey])

  return null
}

export default AnalyticsTracker
