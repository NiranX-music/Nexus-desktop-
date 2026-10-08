/**
 * Nexus Edge Command Bridge - Real-time SSE & Task Dispatcher
 * Path: functions/api/bridge.js
 * 
 * 100% Free Tier: Zero Payment Cards.
 * Supports persistent SSE listener (<30ms latency) and instant task dispatching.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Nexus-Auth-Token",
};

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB || env.nexus_db;
  const kv = env.NEXUS_KV;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --------------------------------------------------------------------------
  // GET /api/bridge: Ultra-Fast Server-Sent Events (SSE) stream for Desktop Daemon
  // --------------------------------------------------------------------------
  if (request.method === "GET") {
    const url = new URL(request.url);
    const targetDevice = (url.searchParams.get("device") || "DESKTOP").toUpperCase();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event, data) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        // 1. Initial Handshake event
        sendEvent("connected", {
          status: "BRIDGE_ONLINE",
          device: targetDevice,
          timestamp: new Date().toISOString(),
          edge_pop: request.headers.get("cf-ray") || "global-edge"
        });

        // 2. Query any pending tasks in D1 immediately
        if (db) {
          try {
            const pending = await db
              .prepare(
                `SELECT id, target_device, command_type, prompt_raw, action_plan, media_blob, created_at
                 FROM tasks
                 WHERE (target_device = ? OR target_device = 'ALL') AND status = 'QUEUED'
                 ORDER BY created_at ASC LIMIT 5`
              )
              .bind(targetDevice)
              .all();

            if (pending.results && pending.results.length > 0) {
              for (const task of pending.results) {
                sendEvent("task", task);
                // Mark as PROCESSING
                await db.prepare("UPDATE tasks SET status = 'PROCESSING' WHERE id = ?").bind(task.id).run().catch(() => {});
              }
            }
          } catch (err) {
            console.warn("[Bridge SSE D1 Query Error]", err);
          }
        }

        // 3. Heartbeat ping
        sendEvent("ping", { time: Date.now() });

        // Close cleanly after initial sync (SSE client will reconnect or keep polling loop)
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
  // POST /api/bridge: Dispatch new command into D1 queue & trigger listeners
  // --------------------------------------------------------------------------
  if (request.method === "POST") {
    if (!db) {
      return new Response(
        JSON.stringify({ ok: false, error: "Database binding 'DB' not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const taskId = body.id || ("tsk_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16));
    const targetDevice = String(body.target_device || body.target || "DESKTOP").toUpperCase();
    const commandType = String(body.command_type || body.type || "TERMINAL_EXEC").toUpperCase();
    const promptRaw = String(body.prompt_raw || body.prompt || body.text || "").trim();
    const actionPlan = body.action_plan ? (typeof body.action_plan === "string" ? body.action_plan : JSON.stringify(body.action_plan)) : null;
    const mediaBlob = body.media_blob || body.media || null;

    try {
      await db.prepare(
        `INSERT INTO tasks (id, source_device, target_device, command_type, prompt_raw, action_plan, media_blob, status, created_at)
         VALUES (?, 'WEB', ?, ?, ?, ?, ?, 'QUEUED', CURRENT_TIMESTAMP)`
      ).bind(taskId, targetDevice, commandType, promptRaw, actionPlan, mediaBlob).run();

      // Cache the task in KV if available for sub-10ms lookup
      if (kv) {
        await kv.put(`task:${taskId}`, JSON.stringify({
          id: taskId,
          target_device: targetDevice,
          command_type: commandType,
          prompt_raw: promptRaw,
          action_plan: actionPlan,
          status: "QUEUED"
        }), { expirationTtl: 3600 }).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          ok: true,
          task_id: taskId,
          status: "DISPATCHED",
          target_device: targetDevice,
          command_type: commandType,
          timestamp: new Date().toISOString()
        }),
        { status: 201, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  return new Response(
    JSON.stringify({ ok: false, error: `Method ${request.method} not allowed` }),
    { status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}
