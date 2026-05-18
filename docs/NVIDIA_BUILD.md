# Upstream AI API Integration

Nexus routes desktop chat through the Nexus AI API gateway first. The gateway can use NVIDIA Build / NIM or any OpenAI-compatible upstream API.

```ts
baseURL: 'https://integrate.api.nvidia.com/v1'
```

## API Key

Set the key on the gateway host, not inside the desktop app:

```powershell
$env:NEXUS_AI_UPSTREAM_API_KEY = 'your-key-here'
```

`NVIDIA_API_KEY`, `NVIDIA_BUILD_API_KEY`, and `NVIDIA_NIM_API_KEY` are still accepted as aliases for older NVIDIA deployments. Do not ship a real API key in public source control or inside the desktop bundle.

## Default Model

The default chat model is:

```text
deepseek-ai/deepseek-v4-pro
```

Settings also lets you choose defaults for chat, coding, reasoning, vision, speech, translation,
and embedding categories.
