import {
  createGeminiGenerateResult,
  handleVercelOptions,
  readVercelJson,
  sendVercelJson
} from '../../lib/gemini-gateway.mjs'

export default async function handler(req, res) {
  if (handleVercelOptions(req, res)) return

  if (req.method !== 'POST') {
    return sendVercelJson(res, 405, {
      success: false,
      error: 'Use POST for Nexus Gemini generate requests.'
    })
  }

  const result = await createGeminiGenerateResult(readVercelJson(req), req.headers)
  return sendVercelJson(res, result.status, result.body)
}
