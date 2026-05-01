import { getGatewayStatus, handleVercelOptions, sendVercelJson } from '../../lib/nvidia-gateway.mjs'

export default async function handler(req, res) {
  if (handleVercelOptions(req, res)) return

  const result = getGatewayStatus(req.headers)
  return sendVercelJson(res, result.status, result.body)
}

