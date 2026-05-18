import {
  createGeminiEmbedResult,
  handleVercelOptions,
  readVercelJson,
  sendVercelJson
} from '../../lib/gemini-gateway.mjs'

export default async function handler(req, res) {
  if (handleVercelOptions(req, res)) return

  if (req.method !== 'POST') {
    return sendVercelJson(res, 405, {
      success: false,
      error: 'Use POST for Nexus Gemini embed requests.'
    })
  }

  const result = await createGeminiEmbedResult(readVercelJson(req), req.headers)
  return sendVercelJson(res, result.status, result.body)
}
