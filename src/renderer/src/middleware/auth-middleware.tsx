import { SECURITY_VERIFICATIONS_PAUSED } from '@renderer/config/security-flags'
import { getVerifiedCloudUser } from '@renderer/lib/supabase'
import React from 'react'

const authMiddleware = async ({ children }: { children: React.ReactNode }): Promise<any> => {
  if (SECURITY_VERIFICATIONS_PAUSED) return { children }

  const getUser = async () => {
    try {
      return await getVerifiedCloudUser()
    } catch (error) {
      return null
    }
  }

  const user = await getUser()

  if (user) {
    return { children }
  }

}

export default authMiddleware
