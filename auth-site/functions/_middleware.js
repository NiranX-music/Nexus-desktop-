/**
 * Cloudflare Pages Middleware: Nexus Study AI
 * Handles:
 * 1. Global CORS headers for preflight and standard API calls
 * 2. Optional Auth Token verification (supports open zero-config mode or protected mode)
 * 3. Client Header Normalization (Custom Developer Mode keys: Groq, Gemini)
 * 4. Error boundaries and execution metrics
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Define CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Custom-Key, X-AI-Provider, X-Custom-Model, X-Study-Persona, X-Client-Platform",
    "Access-Control-Max-Age": "86400",
  };

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only apply API protections to /api/ routes
  if (url.pathname.startsWith("/api/")) {
    const authSecret = env.STUDY_AUTH_TOKEN || env.AUTH_TOKEN;
    
    // If an auth secret is configured on the edge, enforce Bearer validation
    if (authSecret) {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      
      // Allow if token matches or if a valid custom developer key is supplied by the user
      const customKey = request.headers.get("X-Custom-Key");
      if (token !== authSecret && !customKey) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Missing or invalid authorization token. Configure token or supply a custom developer key.",
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    // Attach parsed developer headers to context.data for downstream handlers
    context.data = context.data || {};
    context.data.customKey = request.headers.get("X-Custom-Key") || null;
    context.data.aiProvider = (request.headers.get("X-AI-Provider") || "").toLowerCase() || null;
    context.data.customModel = request.headers.get("X-Custom-Model") || null;
    context.data.studyPersona = request.headers.get("X-Study-Persona") || env.DEFAULT_PERSONA || "Socratic Tutor";
  }

  const startTime = Date.now();

  try {
    const response = await context.next();
    const duration = Date.now() - startTime;

    // Clone response to inject headers
    const newHeaders = new Headers(response.headers);
    for (const [key, val] of Object.entries(corsHeaders)) {
      newHeaders.set(key, val);
    }
    newHeaders.set("X-Response-Time-Ms", String(duration));
    newHeaders.set("X-Powered-By", "Nexus-Study-AI-Edge");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    console.error("[Middleware Error]", err);
    return new Response(
      JSON.stringify({
        error: "Internal Edge Error",
        message: err.message || "An unexpected error occurred during edge execution.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
}
