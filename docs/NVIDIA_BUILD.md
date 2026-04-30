# NVIDIA Build Integration

Nexus supports NVIDIA Build / NIM through the OpenAI-compatible API endpoint:

```ts
baseURL: 'https://integrate.api.nvidia.com/v1'
```

## API Key

Set the key in one of two places:

1. App UI: `Settings -> API Keys -> NVIDIA Build NIM`
2. Environment variable before launching the app:

```powershell
$env:NVIDIA_API_KEY = 'nvapi_your_key_here'
```

Do not ship a real API key in public source control. If a private distribution needs a bundled key,
set `NVIDIA_API_KEY` in the app launch environment or paste it into Settings before building your
installer.

## Default Model

The default chat model is:

```text
deepseek-ai/deepseek-v4-pro
```

Settings also lets you choose defaults for chat, coding, reasoning, vision, speech, translation,
and embedding categories.
