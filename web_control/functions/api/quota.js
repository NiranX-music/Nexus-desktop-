/**
 * Cloudflare Pages Function - Usage Quota & 20% Warning Broadcast
 * File: web_control/functions/api/quota.js
 * 
 * Free-tier usage monitoring endpoint:
 * Evaluates token pool thresholds and broadcasts low-quota events (<20%)
 * to connected devices so users can inject secondary API keys.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Nexus-Auth-Token",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // GET /api/quota: Check general quota status
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "OK",
        tier: "FREE_TIER",
        allocated_tokens: 100000,
        warning_threshold_pct: 20.0,
        features: ["groq_llama_3_3", "whisper_turbo", "gemini_pro_fallback", "local_ollama"]
      }),
      { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  // POST /api/quota: Report local usage or trigger low quota broadcast
  if (request.method === "POST") {
    try {
      const data = await request.json();
      const remainingPct = data.remaining_pct ?? 100.0;
      const isLow = remainingPct <= 20.0;

      return new Response(
        JSON.stringify({
          received: true,
          is_low_quota: isLow,
          action_recommended: isLow ? "INJECT_FALLBACK_API_KEY" : "CONTINUE_FREE_TIER",
          timestamp: new Date().toISOString()
        }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
}
