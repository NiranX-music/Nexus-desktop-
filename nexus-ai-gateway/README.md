# Nexus AI Gateway

Private Nexus AI API gateway for Nexus desktop app failover.

## What It Does

- Serves `/api/ai/chat`, `/api/ai/models`, `/api/ai/status`, and the legacy NVIDIA-named routes on Vercel.
- Serves `/.netlify/functions/ai-chat`, `/.netlify/functions/ai-models`, `/.netlify/functions/ai-status`, and the legacy NVIDIA-named functions on Netlify.
- Serves `/api/gemini/generate`, `/api/gemini/embed`, `/api/gemini/status`, `/.netlify/functions/gemini-generate`, `/.netlify/functions/gemini-embed`, and `/.netlify/functions/gemini-status` for server-side Gemini.
- Keeps AI endpoints private by requiring the Nexus desktop client header or the admin pass.
- Lets the desktop app fail over across three Vercel mirrors and three Netlify mirrors.
- Sends all model traffic to the configured OpenAI-compatible upstream API.

## Required Environment Variables

Set these on every Vercel and Netlify site:

```env
NEXUS_AI_UPSTREAM_BASE_URL=https://integrate.api.nvidia.com/v1
NEXUS_AI_UPSTREAM_API_KEY=your-real-api-key
NEXUS_AI_UPSTREAM_AUTH_HEADER=authorization
NEXUS_AI_UPSTREAM_AUTH_SCHEME=Bearer
NEXUS_AI_UPSTREAM_NAME=nvidia
NEXUS_AI_UPSTREAM_ALLOW_NO_KEY=false
NEXUS_GEMINI_API_KEY=your-gemini-key
NEXUS_GEMINI_MODEL=gemini-2.5-flash
NEXUS_GEMINI_EMBEDDING_MODEL=gemini-embedding-001
NEXUS_ADMIN_PASS=05122010
NEXUS_ALLOW_PUBLIC_AI=false
```

`NVIDIA_API_KEY`, `NVIDIA_BUILD_API_KEY`, and `NVIDIA_NIM_API_KEY` are accepted as fallback aliases for older deployments, but use `NEXUS_AI_UPSTREAM_API_KEY` for the primary deployment setting.

Do not commit the real upstream API key.

## Recommended Mirror Names

Vercel:

- `nexus-ai-gateway`
- `nexus-ai-gateway-2`
- `nexus-ai-gateway-3`

Netlify:

- `nexus-ai-gateway`
- `nexus-ai-gateway-2`
- `nexus-ai-gateway-3`

The desktop app already knows these default URLs and will try the next mirror if one fails.

Live mirrors deployed for Nexus:

- `https://nexus-ai-gateway.vercel.app`
- `https://nexus-ai-gateway-2.vercel.app`
- `https://nexus-ai-gateway-3.vercel.app`
- `https://nexus-ai-gateway.netlify.app`
- `https://nexus-ai-gateway-2.netlify.app`
- `https://nexus-ai-gateway-3.netlify.app`

## Admin Page

Open `/api-edit.html` and unlock it with:

```text
05122010
```

This page checks whether the current mirror has an upstream API key configured. Secrets still live in Vercel/Netlify environment variables, not in the browser.
