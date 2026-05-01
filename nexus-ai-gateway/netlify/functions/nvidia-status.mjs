import { getGatewayStatus, handleOptionsResponse, jsonResponse } from '../../lib/nvidia-gateway.mjs'

export default async function handler(request) {
  if (request.method === 'OPTIONS') return handleOptionsResponse()

  const result = getGatewayStatus(request.headers)
  return jsonResponse(result.body, result.status)
}

