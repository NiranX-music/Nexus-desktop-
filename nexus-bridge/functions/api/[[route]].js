/**
 * Cloudflare Pages Function: Multi-Device Edge API Router
 * Path: functions/api/[[route]].js
 * 
 * Supports Desktop Daemon, Mobile (Termux/PWA), and Cloudflare D1/R2.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function errorResponse(message, status = 400, details = null) {
  return jsonResponse(
    {
      ok: false,
      error: message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
    },
    status
  );
}

function getDatabase(env) {
  return env.DB || env.nexus_db || env.NEXUS_DB || null;
}

function getStorage(env) {
  return env.BUCKET || env.R2_BUCKET || env.nexus_media || null;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const route = Array.isArray(params.route)
    ? params.route
    : url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);

  const segment0 = (route[0] || "").toLowerCase();
  const segment1 = (route[1] || "").toLowerCase();

  const db = getDatabase(env);
  const r2 = getStorage(env);

  try {
    // --------------------------------------------------------------------------
    // 1. Health & Edge Diagnostics
    // --------------------------------------------------------------------------
    if (route.length === 0 || segment0 === "health") {
      return jsonResponse({
        ok: true,
        service: "Nexus Multi-Device Bridge API",
        version: "2.0.0",
        edge_runtime: "Cloudflare Pages Functions / Workers",
        database_bound: !!db,
        r2_storage_bound: !!r2,
        modal_configured: !!env.MODAL_API_URL,
        timestamp: new Date().toISOString(),
      });
    }

    if (!db && segment0 !== "files" && segment0 !== "upload") {
      return errorResponse("Cloudflare D1 Database binding 'DB' is not configured.", 500);
    }

    // --------------------------------------------------------------------------
    // 2. Multi-Device Registry & Heartbeat Monitoring
    // POST /api/heartbeat -> Update device status, battery level, timestamp
    // GET  /api/devices   -> List all registered devices with online flags
    // GET  /api/heartbeat -> Quick telemetry summary
    // --------------------------------------------------------------------------
    if (segment0 === "heartbeat" || segment0 === "devices") {
      if (request.method === "POST" && segment0 === "heartbeat") {
        let body = {};
        try {
          body = await request.json();
        } catch {}

        const deviceId = String(body.device_id || "nexus-primary").trim();
        const rawType = String(body.device_type || "DESKTOP").toUpperCase().trim();
        const deviceType = ["DESKTOP", "MOBILE", "WEB"].includes(rawType) ? rawType : "DESKTOP";
        const deviceName = String(body.device_name || `${deviceType} Agent`).trim();
        const rawStatus = String(body.status || "ONLINE").toUpperCase().trim();
        const status = ["ONLINE", "BUSY", "OFFLINE"].includes(rawStatus) ? rawStatus : "ONLINE";
        const batteryLevel = Number.isInteger(body.battery_level) ? Math.min(Math.max(body.battery_level, 0), 100) : 100;

        await db
          .prepare(
            `INSERT INTO devices (device_id, device_type, device_name, status, battery_level, last_heartbeat)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(device_id) DO UPDATE SET
               device_type = excluded.device_type,
               device_name = excluded.device_name,
               status = excluded.status,
               battery_level = excluded.battery_level,
               last_heartbeat = CURRENT_TIMESTAMP`
          )
          .bind(deviceId, deviceType, deviceName, status, batteryLevel)
          .run();

        return jsonResponse({
          ok: true,
          device: {
            device_id: deviceId,
            device_type: deviceType,
            device_name: deviceName,
            status,
            battery_level: batteryLevel,
            last_heartbeat: new Date().toISOString(),
          },
        });
      }

      if (request.method === "GET") {
        const query = await db
          .prepare(
            `SELECT device_id, device_type, device_name, status, battery_level, last_heartbeat,
             CAST((strftime('%s', 'now') - strftime('%s', last_heartbeat)) AS INTEGER) as seconds_ago
             FROM devices
             ORDER BY last_heartbeat DESC LIMIT 20`
          )
          .all();

        const devices = (query.results || []).map((d) => {
          const isOnline = d.status !== "OFFLINE" && (d.seconds_ago === null || d.seconds_ago <= 60);
          return {
            ...d,
            effective_status: isOnline ? d.status : "OFFLINE",
            is_online: isOnline,
            seconds_ago: d.seconds_ago ?? 9999,
          };
        });

        const desktopOnline = devices.some((d) => d.device_type === "DESKTOP" && d.is_online);
        const mobileOnline = devices.some((d) => d.device_type === "MOBILE" && d.is_online);

        return jsonResponse({
          ok: true,
          devices,
          summary: {
            total: devices.length,
            desktop_online: desktopOnline,
            mobile_online: mobileOnline,
          },
        });
      }

      return errorResponse(`Method ${request.method} not allowed`, 405);
    }

    // --------------------------------------------------------------------------
    // 3. Multi-Device Tasks Management
    // POST  /api/tasks          -> Create new task with target assignment
    // GET   /api/tasks/pending  -> Polled by Desktop or Mobile daemon (?device_type=DESKTOP|MOBILE)
    // GET   /api/tasks          -> List recent tasks
    // GET   /api/tasks/:id      -> Fetch specific task
    // PATCH /api/tasks/:id      -> Update execution status, logs & R2 screenshot URL
    // --------------------------------------------------------------------------
    if (segment0 === "tasks") {
      // 3A. GET /api/tasks/pending?device_type=DESKTOP
      if (request.method === "GET" && segment1 === "pending") {
        const targetType = (url.searchParams.get("device_type") || "DESKTOP").toUpperCase().trim();
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 50);

        const result = await db
          .prepare(
            `SELECT * FROM tasks
             WHERE status = 'QUEUED'
               AND (target_device = ? OR target_device = 'ALL')
             ORDER BY created_at ASC
             LIMIT ?`
          )
          .bind(targetType, limit)
          .all();

        return jsonResponse({
          ok: true,
          count: (result.results || []).length,
          device_type: targetType,
          tasks: result.results || [],
        });
      }

      // 3B. GET /api/tasks (list recent tasks)
      if (request.method === "GET" && (!segment1 || segment1 === "")) {
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 100);
        const targetFilter = url.searchParams.get("target_device");
        const statusFilter = url.searchParams.get("status");

        let sql = `SELECT * FROM tasks WHERE 1=1`;
        const paramsList = [];

        if (targetFilter) {
          sql += ` AND (target_device = ? OR target_device = 'ALL')`;
          paramsList.push(targetFilter.toUpperCase());
        }
        if (statusFilter) {
          sql += ` AND status = ?`;
          paramsList.push(statusFilter.toUpperCase());
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        paramsList.push(limit);

        const stmt = db.prepare(sql);
        const query = await stmt.bind(...paramsList).all();

        return jsonResponse({
          ok: true,
          count: (query.results || []).length,
          tasks: query.results || [],
        });
      }

      // 3C. POST /api/tasks (Create new task)
      if (request.method === "POST" && (!segment1 || segment1 === "")) {
        let body;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Invalid JSON payload", 400);
        }

        const sourceDevice = String(body.source_device || "WEB").toUpperCase().trim();
        let targetDevice = String(body.target_device || "DESKTOP").toUpperCase().trim();
        if (!["DESKTOP", "MOBILE", "ALL"].includes(targetDevice)) targetDevice = "DESKTOP";

        let commandType = String(body.command_type || "VOICE_PROMPT").toUpperCase().trim();
        if (!["VOICE_PROMPT", "TERMINAL_EXEC", "DESKTOP_GUI", "MOBILE_ACTION"].includes(commandType)) {
          commandType = "VOICE_PROMPT";
        }

        const promptRaw = String(body.prompt_raw || body.payload || "").trim();
        const mediaR2Url = body.media_r2_url ? String(body.media_r2_url).trim() : null;
        const dispatchModal = Boolean(body.dispatch_modal);

        if (!promptRaw && !mediaR2Url) {
          return errorResponse("Either 'prompt_raw' or 'media_r2_url' is required", 400);
        }

        const taskId = crypto.randomUUID();
        let actionPlanStr = null;
        let initialStatus = "QUEUED";

        // Check if Modal decompose action is requested
        const modalBaseUrl = env.MODAL_API_URL || "https://barhateniranjan725--nexus-ai-core-nexusaicore-fastapi-app.modal.run";
        if ((dispatchModal || commandType === "VOICE_PROMPT") && modalBaseUrl) {
          try {
            const modalEndpoint = `${modalBaseUrl.replace(/\/+$/, "")}/decompose_action`;
            const modalResp = await fetch(modalEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: promptRaw,
                context: { source_device: sourceDevice, target_device: targetDevice, task_id: taskId },
              }),
            });

            if (modalResp.ok) {
              const plan = await modalResp.json();
              actionPlanStr = JSON.stringify(plan);
              if (plan.target && ["DESKTOP", "MOBILE", "ALL"].includes(plan.target)) {
                targetDevice = plan.target;
              }
            }
          } catch (modalErr) {
            console.warn("Modal decompose_action failed, falling back to direct QUEUED task:", modalErr.message);
          }
        }

        await db
          .prepare(
            `INSERT INTO tasks (
               id, source_device, target_device, command_type, prompt_raw, action_plan, media_r2_url, status, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          )
          .bind(taskId, sourceDevice, targetDevice, commandType, promptRaw, actionPlanStr, mediaR2Url, initialStatus)
          .run();

        return jsonResponse(
          {
            ok: true,
            task: {
              id: taskId,
              source_device: sourceDevice,
              target_device: targetDevice,
              command_type: commandType,
              prompt_raw: promptRaw,
              action_plan: actionPlanStr ? JSON.parse(actionPlanStr) : null,
              media_r2_url: mediaR2Url,
              status: initialStatus,
              created_at: new Date().toISOString(),
            },
          },
          201
        );
      }

      // 3D. GET /api/tasks/:id (Single task)
      if (request.method === "GET" && segment1 && segment1 !== "pending") {
        const taskId = segment1;
        const result = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).all();
        const task = (result.results || [])[0];
        if (!task) return errorResponse(`Task '${taskId}' not found`, 404);
        return jsonResponse({ ok: true, task });
      }

      // 3E. PATCH /api/tasks/:id (Daemon reporting progress, output log, or screenshot)
      if (request.method === "PATCH" && segment1 && segment1 !== "pending") {
        const taskId = segment1;
        let body;
        try {
          body = await request.json();
        } catch {
          return errorResponse("Invalid JSON payload", 400);
        }

        const rawStatus = body.status ? String(body.status).toUpperCase().trim() : null;
        const validStatuses = new Set(["QUEUED", "PLANNING_AI", "DISPATCHED", "COMPLETED", "FAILED"]);
        if (rawStatus && !validStatuses.has(rawStatus)) {
          return errorResponse(`Invalid status '${rawStatus}'. Allowed: QUEUED, PLANNING_AI, DISPATCHED, COMPLETED, FAILED`, 400);
        }

        const executionLog = body.execution_log !== undefined ?
          (typeof body.execution_log === "object" ? JSON.stringify(body.execution_log) : String(body.execution_log))
          : null;

        const mediaR2Url = body.media_r2_url !== undefined ? String(body.media_r2_url) : null;

        const isFinished = rawStatus === "COMPLETED" || rawStatus === "FAILED";

        const updateResult = await db
          .prepare(
            `UPDATE tasks
             SET status = COALESCE(?, status),
                 execution_log = COALESCE(?, execution_log),
                 media_r2_url = COALESCE(?, media_r2_url),
                 completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END
             WHERE id = ?`
          )
          .bind(rawStatus, executionLog, mediaR2Url, isFinished ? 1 : 0, taskId)
          .run();

        if (updateResult.meta && updateResult.meta.changes === 0) {
          return errorResponse(`Task '${taskId}' not found`, 404);
        }

        return jsonResponse({
          ok: true,
          id: taskId,
          status: rawStatus,
          updated_at: new Date().toISOString(),
        });
      }

      // 3F. DELETE /api/tasks/:id
      if (request.method === "DELETE" && segment1) {
        await db.prepare(`DELETE FROM tasks WHERE id = ?`).bind(segment1).run();
        return jsonResponse({ ok: true, deleted: segment1 });
      }
    }

    // --------------------------------------------------------------------------
    // 4. Object Retrieval from R2: GET /api/files/:key
    // --------------------------------------------------------------------------
    if (segment0 === "files" && request.method === "GET") {
      if (!r2) return errorResponse("Cloudflare R2 Bucket binding 'BUCKET' is not configured.", 501);

      const objectKey = route.slice(1).join("/");
      if (!objectKey) return errorResponse("Missing object key in /api/files/:key", 400);

      const object = await r2.get(objectKey);
      if (!object) return errorResponse(`Object '${objectKey}' not found`, 404);

      const headers = new Headers(CORS_HEADERS);
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      return new Response(object.body, { headers });
    }

    return errorResponse(`Endpoint /api/${route.join("/")} not found`, 404);
  } catch (err) {
    console.error("[Nexus Edge Router Error]", err);
    return errorResponse(err.message || "Internal server error", 500, { stack: err.stack });
  }
}
