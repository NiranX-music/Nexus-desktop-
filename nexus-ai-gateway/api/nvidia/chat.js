import { createChatResult, handleVercelOptions, readVercelJson, sendVercelJson } from '../../lib/nvidia-gateway.mjs'

export default async function handler(req, res) {
  if (handleVercelOptions(req, res)) return

  if (req.method !== 'POST') {
    return sendVercelJson(res, 405, {
      success: false,
      error: 'Use POST for Nexus AI chat requests.'
    })
  }

  const result = await createChatResult(readVercelJson(req), req.headers)
  return sendVercelJson(res, result.status, result.body)
}

