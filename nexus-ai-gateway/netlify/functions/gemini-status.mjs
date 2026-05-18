import { getGeminiStatus, handleOptionsResponse, jsonResponse } from '../../lib/gemini-gateway.mjs'

export default async function handler(request) {
  if (request.method === 'OPTIONS') return handleOptionsResponse()

  const result = getGeminiStatus(request.headers)
  return jsonResponse(result.body, result.status)
}
