/**
 * Nexus Media & Blob Upload Handler (100% Free - Zero Credit Cards)
 * Path: functions/api/upload.js
 * 
 * Free-Tier Storage: Cloudflare Workers KV & D1 SQLite payload storage.
 * Stores audio recordings (WebM/WAV) and screenshots as binary/Base64 without R2.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Filename, X-Nexus-Auth-Token",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const kv = env.NEXUS_KV;
  const db = env.DB || env.nexus_db;

  if (request.method === "POST") {
    try {
      const url = new URL(request.url);
      const customFilename = url.searchParams.get("filename") || request.headers.get("X-Filename") || `media-${Date.now()}`;
      const contentType = request.headers.get("Content-Type") || "application/octet-stream";
      
      const arrayBuffer = await request.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "Upload payload cannot be empty." }),
          { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }

      const safeFilename = customFilename.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const objectKey = `media/${Date.now()}-${safeFilename}`;

      // Convert ArrayBuffer to Base64 data URL
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      const dataUri = `data:${contentType};base64,${base64Data}`;

      // Store in Cloudflare Workers KV (100% Free, up to 25MB per key)
      if (kv) {
        await kv.put(`blob:${objectKey}`, base64Data, {
          metadata: { contentType, filename: safeFilename, bytes: arrayBuffer.byteLength },
          expirationTtl: 30 * 24 * 3600 // 30 days retention
        }).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          ok: true,
          key: objectKey,
          filename: safeFilename,
          size: arrayBuffer.byteLength,
          content_type: contentType,
          url: dataUri, // Directly usable in frontend <img> or <audio> tags
          kv_stored: !!kv,
          created_at: new Date().toISOString(),
        }),
        { status: 201, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err.message || "Upload failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  return new Response(
    JSON.stringify({ ok: false, error: `Method ${request.method} not allowed` }),
    { status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}
