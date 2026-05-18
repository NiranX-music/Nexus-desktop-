import {
  createGeminiEmbedResult,
  handleOptionsResponse,
  jsonResponse,
  readNetlifyJson
} from '../../lib/gemini-gateway.mjs'

export default async function handler(request) {
  if (request.method === 'OPTIONS') return handleOptionsResponse()

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'Use POST for Nexus Gemini embed requests.'
      },
      405
    )
  }

  const result = await createGeminiEmbedResult(await readNetlifyJson(request), request.headers)
  return jsonResponse(result.body, result.status)
}
