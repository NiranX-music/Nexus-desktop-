/**
 * Cloudflare Pages Function - Device Presence & Heartbeat Registry
 * File: web_control/functions/api/devices.js
 * 
 * Tracks active Desktop, Mobile, and Edge agent nodes.
 * Stores strictly device telemetry (presence, battery, agent version) in D1.
 * ZERO user chats or code files are touched by this endpoint.
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

  // GET /api/devices: List active devices
  if (request.method === "GET") {
    if (!db) {
      return new Response(
        JSON.stringify({
          devices: [
            { id: "local-desktop", name: "Nexus Desktop Host", type: "DESKTOP", status: "ONLINE", battery_level: 100 }
          ]
        }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    try {
      const rows = await db
        .prepare("SELECT id, name, type, status, battery_level, agent_version, last_seen FROM devices ORDER BY last_seen DESC LIMIT 20")
        .all();
      return new Response(
        JSON.stringify({ devices: rows.results || [] }),
        { headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  // POST /api/devices: Heartbeat ping
  if (request.method === "POST") {
    try {
      const data = await request.json();
      const deviceId = data.id || "desktop-primary";
      const name = data.name || "Desktop Node";
      const type = (data.type || "DESKTOP").toUpperCase();
      const status = data.status || "ONLINE";
      const battery = data.battery_level ?? 100;
      const version = data.agent_version || "2.2.0";

      if (db) {
        await db
          .prepare(`
            INSERT INTO devices (id, name, type, status, battery_level, agent_version, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              status = excluded.status,
              battery_level = excluded.battery_level,
              agent_version = excluded.agent_version,
              last_seen = CURRENT_TIMESTAMP
          `)
          .bind(deviceId, name, type, status, battery, version)
          .run();
      }

      return new Response(
        JSON.stringify({ success: true, deviceId, status: "ONLINE" }),
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
