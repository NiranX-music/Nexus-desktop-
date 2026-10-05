/**
 * Cloudflare Pages Functions Authentication & CORS Middleware
 * Path: functions/_middleware.js
 * 
 * Enforces optional Bearer token security on mutating API calls (POST, PATCH, DELETE, PUT)
 * and guarantees strict cross-origin resource sharing (CORS) across all responses.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nexus-Key, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 0. Clean URL Redirects for Micro-Frontends
  if (["/landing", "/auth", "/status", "/admin"].includes(url.pathname)) {
    return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
  }

  // 1. Handle CORS Preflight immediately
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // 2. Secret Token Authentication for mutating operations
  const secretKey = env.NEXUS_SECRET_KEY || env.AUTH_SECRET;
  const isMutatingMethod = ["POST", "PATCH", "PUT", "DELETE"].includes(request.method);

  // If a secret is configured in the environment, enforce it on mutating requests
  if (secretKey && isMutatingMethod) {
    const authHeader = request.headers.get("Authorization") || "";
    const customHeader = request.headers.get("X-Nexus-Key") || "";
    
    let providedToken = "";
    if (authHeader.startsWith("Bearer ")) {
      providedToken = authHeader.slice(7).trim();
    } else if (customHeader) {
      providedToken = customHeader.trim();
    }

    if (!providedToken || providedToken !== secretKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Unauthorized: Invalid or missing Bearer auth token",
          hint: "Provide 'Authorization: Bearer <token>' or 'X-Nexus-Key: <token>'",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }
  }

  // 3. Proceed to downstream route handlers
  let response;
  try {
    response = await context.next();
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || "Internal Worker Error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  }

  // 4. Attach CORS headers to outgoing response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
