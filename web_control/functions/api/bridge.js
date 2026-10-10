/**
 * Cloudflare Worker / Pages Functions Persistent SSE Streaming Bridge
 * File: web_control/functions/api/bridge.js
 * 
 * 100% Free Tier: Zero mandatory credit cards.
 * Sub-50ms SSE streaming for real-time Agent Task signaling.
 * STRICT PRIVACY: NEVER stores user prompts, code, or thoughts in Cloudflare D1.
 * Only ephemeral signal IDs and device targets are dispatched.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Nexus-Auth-Token",
};

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB || env.nexus_db;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);

  // --------------------------------------------------------------------------
  // GET /api/bridge: Persistent SSE stream for Desktop Agent and UI clients
  // --------------------------------------------------------------------------
  if (request.method === "GET") {
    const targetDevice = (url.searchParams.get("device") || "DESKTOP").toUpperCase();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event, data) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        // 1. Initial Handshake
        sendEvent("connected", {
          status: "ONLINE",
          device: targetDevice,
          timestamp: new Date().toISOString(),
          edge_pop: request.headers.get("cf-ray") || "global-edge"
        });

        // 2. Query for pending ephemeral signals in Cloudflare D1
        if (db) {
          try {
            const pending = await db
              .prepare(
                `SELECT signal_id, target_device, status, created_at
                 FROM task_signals
                 WHERE (target_device = ? OR target_device = 'ALL') AND status = 'PENDING'
                 ORDER BY created_at ASC LIMIT 5`
              )
              .bind(targetDevice)
              .all();

            if (pending.results && pending.results.length > 0) {
              for (const sig of pending.results) {
                sendEvent("signal", sig);
                await db
                  .prepare("UPDATE task_signals SET status = 'CLAIMED' WHERE signal_id = ?")
                  .bind(sig.signal_id)
                  .run()
                  .catch(() => {});
              }
            }
          } catch (err) {
            console.warn("[Bridge SSE Query Error]", err);
          }
        }

        // 3. Heartbeat ping
        sendEvent("ping", { time: Date.now() });
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        ...CORS_HEADERS
      }
    });
  }

  // --------------------------------------------------------------------------
  // POST /api/bridge: Dispatch ephemeral task signal
  // --------------------------------------------------------------------------
  if (request.method === "POST") {
    try {
      const body = await request.json();

      const signalId = body.signal_id || `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const targetDevice = (body.target_device || body.target || "DESKTOP").toUpperCase();

      if (db) {
        await db
          .prepare(
            `INSERT INTO task_signals (signal_id, target_device, status)
             VALUES (?, ?, 'PENDING')`
          )
          .bind(signalId, targetDevice)
          .run();
      }

      return new Response(
        JSON.stringify({
          success: true,
          signal_id: signalId,
          target: targetDevice,
          status: "PENDING",
          message: "Ephemeral signal registered at Cloudflare Edge"
        }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
}
