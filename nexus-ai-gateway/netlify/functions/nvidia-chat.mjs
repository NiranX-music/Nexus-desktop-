import { createChatResult, handleOptionsResponse, jsonResponse, readNetlifyJson } from '../../lib/nvidia-gateway.mjs'

export default async function handler(request) {
  if (request.method === 'OPTIONS') return handleOptionsResponse()

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'Use POST for Nexus AI chat requests.'
      },
      405
    )
  }

  const result = await createChatResult(await readNetlifyJson(request), request.headers)
  return jsonResponse(result.body, result.status)
}

