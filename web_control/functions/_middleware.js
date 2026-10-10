/**
 * Cloudflare Pages Functions - Edge Authentication & CORS Middleware
 * File: web_control/functions/_middleware.js
 * 
 * Enforces shared secret Bearer token authentication and uniform CORS headers
 * across all edge bridge endpoints.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Nexus-Auth-Token",
  "Access-Control-Max-Age": "86400",
};

export async function onRequest(context) {
  const { request, env, next } = context;

  // 1. Handle CORS Preflight immediately
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  // 2. Validate Bearer Token / Shared Secret if configured in env
  const expectedToken = env.NEXUS_AUTH_SECRET || env.BRIDGE_SECRET;
  if (expectedToken) {
    const authHeader = request.headers.get("Authorization") || "";
    const customHeader = request.headers.get("X-Nexus-Auth-Token") || request.headers.get("X-Nexus-Key") || "";
    
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const token = bearer || customHeader;

    // Allow public health checks and auth routes, authenticate others
    const url = new URL(request.url);
    const isPublic = url.pathname.endsWith("/health") || url.pathname.endsWith("/login");

    if (!isPublic && token !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing Nexus bridge token" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS
          }
        }
      );
    }
  }

  // 3. Proceed to endpoint and attach CORS headers to response
  const response = await next();
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
