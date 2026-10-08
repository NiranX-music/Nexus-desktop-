/**
 * Nexus Edge Tasks API - Query, Submit & Report Execution
 * Path: functions/api/tasks.js
 * 
 * 100% Free Tier Cloudflare D1 Backend.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Nexus-Auth-Token",
};

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB || env.nexus_db;
  const kv = env.NEXUS_KV;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!db) {
    return new Response(
      JSON.stringify({ ok: false, error: "Database binding 'DB' not configured" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  const url = new URL(request.url);

  // --------------------------------------------------------------------------
  // GET /api/tasks: Query pending tasks or list execution history
  // --------------------------------------------------------------------------
  if (request.method === "GET") {
    const target = url.searchParams.get("target") || url.searchParams.get("target_device");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    let query = "SELECT * FROM tasks";
    const conditions = [];
    const bindings = [];

    if (target) {
      conditions.push("(target_device = ? OR target_device = 'ALL')");
      bindings.push(target.toUpperCase());
    }
    if (status) {
      conditions.push("status = ?");
      bindings.push(status.toUpperCase());
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC LIMIT ?";
    bindings.push(limit);

    try {
      const stmt = db.prepare(query);
      const res = await (bindings.length > 0 ? stmt.bind(...bindings).all() : stmt.all());
      return new Response(
        JSON.stringify({ ok: true, count: (res.results || []).length, tasks: res.results || [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/tasks: Submit new task
  // --------------------------------------------------------------------------
  if (request.method === "POST") {
    let body = {};
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const taskId = body.id || ("tsk_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16));
    const targetDevice = String(body.target_device || body.target || "DESKTOP").toUpperCase();
    const commandType = String(body.command_type || body.type || "TERMINAL_EXEC").toUpperCase();
    const promptRaw = String(body.prompt_raw || body.prompt || body.text || "").trim();
    const actionPlan = body.action_plan ? (typeof body.action_plan === "string" ? body.action_plan : JSON.stringify(body.action_plan)) : null;
    const mediaBlob = body.media_blob || null;

    try {
      await db.prepare(
        `INSERT INTO tasks (id, source_device, target_device, command_type, prompt_raw, action_plan, media_blob, status, created_at)
         VALUES (?, 'WEB', ?, ?, ?, ?, ?, 'QUEUED', CURRENT_TIMESTAMP)`
      ).bind(taskId, targetDevice, commandType, promptRaw, actionPlan, mediaBlob).run();

      return new Response(
        JSON.stringify({ ok: true, task_id: taskId, status: "QUEUED" }),
        { status: 201, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }
  }

  // --------------------------------------------------------------------------
  // PATCH /api/tasks: Update execution status & result logs
  // --------------------------------------------------------------------------
  if (request.method === "PATCH") {
    let body = {};
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const taskId = body.id || body.task_id;
    if (!taskId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing task id" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    const status = String(body.status || "COMPLETED").toUpperCase();
    const resultOutput = body.result_output || body.result || body.output || null;
    const executionLog = body.execution_log ? (typeof body.execution_log === "string" ? body.execution_log : JSON.stringify(body.execution_log)) : null;

    try {
      await db.prepare(
        `UPDATE tasks 
         SET status = ?, result_output = COALESCE(?, result_output), execution_log = COALESCE(?, execution_log), completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(status, typeof resultOutput === "string" ? resultOutput : JSON.stringify(resultOutput), executionLog, taskId).run();

      return new Response(
        JSON.stringify({ ok: true, task_id: taskId, status }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }
  }

  return new Response(JSON.stringify({ ok: false, error: `Method ${request.method} not allowed` }), { status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
