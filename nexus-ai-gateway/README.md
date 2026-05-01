# Nexus AI Gateway

Private NVIDIA-compatible gateway for Nexus desktop app failover.

## What It Does

- Serves `/api/nvidia/chat`, `/api/nvidia/models`, and `/api/nvidia/status` on Vercel.
- Serves `/.netlify/functions/nvidia-chat`, `/.netlify/functions/nvidia-models`, and `/.netlify/functions/nvidia-status` on Netlify.
- Keeps AI endpoints private by requiring the Nexus desktop client header or the admin pass.
- Lets the desktop app fail over across three Vercel mirrors and three Netlify mirrors.

## Required Environment Variables

Set these on every Vercel and Netlify site:

```env
NVIDIA_API_KEY=nvapi-your-key
NEXUS_ADMIN_PASS=05122010
NEXUS_ALLOW_PUBLIC_AI=false
```

Do not commit the real NVIDIA key.

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

This page checks whether the current mirror has `NVIDIA_API_KEY` configured. Secrets still live in Vercel/Netlify environment variables, not in the browser.
