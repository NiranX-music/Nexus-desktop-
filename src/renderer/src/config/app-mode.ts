export type NexusAppFlavor = 'full' | 'trial'

const resolveAppFlavor = (): NexusAppFlavor => {
  const rawFlavor = String(import.meta.env.VITE_NEXUS_APP_FLAVOR || 'full')
    .trim()
    .toLowerCase()

  return rawFlavor === 'trial' ? 'trial' : 'full'
}

export const APP_FLAVOR = resolveAppFlavor()
export const IS_TRIAL_BUILD = APP_FLAVOR === 'trial'
export const IS_INTERNAL_BUILD = false
export const IS_LOCAL_ONLY_BUILD = IS_TRIAL_BUILD
export const APP_RUNTIME_LABEL = IS_TRIAL_BUILD ? 'Nexus AI Trial' : 'Nexus AI'

export const TRIAL_ALLOWED_TABS = [
  'DASHBOARD',
  'AI CHAT',
  'BROWSER CONTROL',
  'WHITEBOARD',
  'SETTINGS'
] as const

export const TRIAL_LIMITATION_COPY = [
  'No account sign-in required',
  'Local device settings only',
  'Core voice, chat, browser, whiteboard, and updates',
  'Advanced automation and connected modules are disabled'
]
