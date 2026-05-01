import { createModelsResult, handleVercelOptions, sendVercelJson } from '../../lib/nvidia-gateway.mjs'

export default async function handler(req, res) {
  if (handleVercelOptions(req, res)) return

  if (req.method !== 'GET') {
    return sendVercelJson(res, 405, {
      success: false,
      error: 'Use GET for Nexus AI model requests.',
      models: []
    })
  }

  const result = await createModelsResult(req.headers)
  return sendVercelJson(res, result.status, result.body)
}

