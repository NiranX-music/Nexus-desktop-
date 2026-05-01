import { createModelsResult, handleOptionsResponse, jsonResponse } from '../../lib/nvidia-gateway.mjs'

export default async function handler(request) {
  if (request.method === 'OPTIONS') return handleOptionsResponse()

  if (request.method !== 'GET') {
    return jsonResponse(
      {
        success: false,
        error: 'Use GET for Nexus AI model requests.',
        models: []
      },
      405
    )
  }

  const result = await createModelsResult(request.headers)
  return jsonResponse(result.body, result.status)
}

