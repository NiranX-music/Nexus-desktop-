import { getGeminiStatus, handleVercelOptions, sendVercelJson } from '../../lib/gemini-gateway.mjs'

export default async function handler(req, res) {
  if (handleVercelOptions(req, res)) return

  const result = getGeminiStatus(req.headers)
  return sendVercelJson(res, result.status, result.body)
}
