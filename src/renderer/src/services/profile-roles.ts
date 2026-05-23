export type NexusProfileRole = 'user' | 'admin'

export const NEXUS_ADMIN_EMAIL = 'niranjanbarhate64@gmail.com'

export const normalizeProfileEmail = (email?: string | null) =>
  String(email || '')
    .trim()
    .toLowerCase()

export const getNexusRoleForEmail = (email?: string | null): NexusProfileRole =>
  normalizeProfileEmail(email) === NEXUS_ADMIN_EMAIL ? 'admin' : 'user'
