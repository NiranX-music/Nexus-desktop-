/**
 * Cloudflare Pages Function: Cloudflare R2 Media & Blob Upload Handler
 * Path: functions/api/upload.js
 * 
 * Free-Tier Object Storage: Cloudflare R2 (10 GB storage, zero egress bandwidth fees)
 * Stores audio recordings (WebM/WAV) and execution screenshots (PNG).
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Filename",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const r2 = env.BUCKET || env.R2_BUCKET || env.nexus_media;
  if (!r2) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Cloudflare R2 Bucket binding 'BUCKET' is not configured in wrangler.toml or Pages dashboard.",
        hint: "Add [[r2_buckets]] binding = 'BUCKET' bucket_name = 'nexus-media' to your configuration.",
      }),
      { status: 501, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

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

      // Generate clean unique key in R2
      const safeFilename = customFilename.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const objectKey = `media/${Date.now()}-${safeFilename}`;

      await r2.put(objectKey, arrayBuffer, {
        httpMetadata: { contentType },
        customMetadata: {
          uploadedAt: new Date().toISOString(),
          bytes: arrayBuffer.byteLength.toString(),
        },
      });

      const publicOrApiUrl = `/api/files/${objectKey}`;

      return new Response(
        JSON.stringify({
          ok: true,
          key: objectKey,
          filename: safeFilename,
          size: arrayBuffer.byteLength,
          content_type: contentType,
          url: publicOrApiUrl,
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
