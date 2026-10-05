"""
Nexus AI client for the desktop daemon — Python mirror of frontend/ai/providers.js.

Interface (every adapter and the FallbackChain):
    transcribe_audio(audio_bytes, mime_type) -> {"text", "provider"}
    chat_completion(messages, **opts)       -> {"text", "provider"}
    plan_action(prompt, target_device, engines) -> {"target", "summary", "steps", "provider"}

Standard Mode   -> EdgeAdapter (the Nexus bridge /api/ai/*, built-in keys stay in Cloudflare)
Developer Mode  -> your provider first (Gemini / Groq / OpenAI / custom OpenAI-compatible such as
                   Ollama, LM Studio or a local Edge0 server), automatic fallback to the edge on
                   any failure (401, quota, network...).

Standard library only.
"""

import base64
import json
import re
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict, List, Optional

# Keep in sync with ENGINE_FOR_ACTION in frontend/ai/providers.js
ENGINE_FOR_ACTION = {
    "SHELL": "shell", "INTERPRETER": "shell",
    "UI_INSPECT": "ui", "UI_CLICK": "ui", "UI_TYPE": "ui", "UFO_TASK": "ui",
    "BROWSER_TASK": "browser",
    "ADB_TAP": "android", "ADB_TEXT": "android", "ADB_LAUNCH": "android", "ADB_KEY": "android", "ADB_SHELL": "android",
}

DEFAULT_MODELS = {
    "gemini": {"model": "gemini-3.8-flash", "stt_model": "gemini-3.5-transcribe"},
    "groq": {"model": "llama-3.3-70b-versatile", "stt_model": "whisper-large-v3-turbo", "base_url": "https://api.groq.com/openai/v1"},
    "openai": {"model": "gpt-4o-mini", "stt_model": "whisper-1", "base_url": "https://api.openai.com/v1"},
    "custom": {"model": "llama3.1", "stt_model": "whisper-1", "base_url": "http://localhost:11434/v1"},
}


class AIError(Exception):
    def __init__(self, message: str, status: Optional[int] = None, provider: str = ""):
        super().__init__(message)
        self.status = status
        self.provider = provider


def _http(url: str, provider: str, body: Optional[bytes] = None, headers: Optional[Dict[str, str]] = None,
          method: str = "POST", timeout: float = 60.0) -> Dict[str, Any]:
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8")
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            err = data.get("error")
            msg = (err.get("message") if isinstance(err, dict) else err) or data.get("detail") or raw[:300]
        except Exception:
            msg = raw[:300]
        raise AIError(f"{provider}: {msg}", e.code, provider)
    except urllib.error.URLError as e:
        raise AIError(f"{provider}: network error ({e.reason})", 0, provider)


def parse_json_loose(text: Any) -> Optional[Dict[str, Any]]:
    if isinstance(text, dict):
        return text
    s = re.sub(r"```(?:json)?", "", str(text or ""), flags=re.I).strip()
    try:
        return json.loads(s)
    except Exception:
        start, end = s.find("{"), s.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(s[start:end + 1])
            except Exception:
                return None
    return None


def filter_plan(plan: Dict[str, Any], engines: Optional[List[str]]) -> Dict[str, Any]:
    """Local enforcement: drop steps whose engine is disabled on THIS machine."""
    kept, dropped = [], list(plan.get("dropped_steps") or [])
    for step in plan.get("steps") or []:
        action = str(step.get("action") or step.get("tool") or "").upper()
        engine = ENGINE_FOR_ACTION.get(action)
        if engine and engines is not None and engine not in engines:
            dropped.append({"action": action, "reason": f"engine '{engine}' disabled on this PC"})
            continue
        kept.append({**step, "action": action})
    return {**plan, "steps": kept, "dropped_steps": dropped}


PLAN_SYSTEM_FALLBACK = (
    "You are the action planner for Nexus, an agent controlling a Windows PC and an Android phone. "
    "Return ONE JSON object {\"target\":\"DESKTOP\"|\"MOBILE\",\"summary\":str,\"steps\":[{\"action\":...}]}. "
    "Desktop actions: SHELL{cmd} (cmd.exe; open GUI apps with `start \"\" <app>`), INTERPRETER{task}, KEYPRESS{keys}, "
    "TYPE_TEXT{text}, MOUSE_CLICK{x,y}, SPEAK{text}, SCREENSHOT{}, UI_INSPECT{}, UI_CLICK{name,control_type?}, "
    "UI_TYPE{name,text}, UFO_TASK{task}, BROWSER_TASK{task}, ADB_TAP{x,y}, ADB_TEXT{text}, ADB_LAUNCH{package}, "
    "ADB_KEY{key}, ADB_SHELL{cmd}. Mobile actions: VIBRATE{duration_ms}, TOAST{text}, NOTIFICATION{title,content}, "
    "BATTERY_CHECK{}, CLIPBOARD_GET{}, TORCH{state}, SHELL{cmd}. Max 8 steps, no destructive operations unless "
    "explicitly requested, end with SPEAK. Only use actions whose engine is enabled: {engines}."
)


# ------------------------------------------------------------------------------
# Adapters
# ------------------------------------------------------------------------------
class BaseAdapter:
    name = "base"
    capabilities = ("transcribe_audio", "chat_completion", "plan_action")

    def supports(self, method: str) -> bool:
        return method in self.capabilities

    def plan_action(self, prompt: str, target_device: str = "DESKTOP", engines: Optional[List[str]] = None) -> Dict[str, Any]:
        system = PLAN_SYSTEM_FALLBACK.replace("{engines}", ", ".join(engines) if engines else "all")
        messages = [{"role": "system", "content": system},
                    {"role": "user", "content": f"Target: {target_device}\nRequest: {prompt}"}]
        res = self.chat_completion(messages, json_mode=True, temperature=0.2)
        plan = parse_json_loose(res["text"])
        if not plan:
            raise AIError(f"{self.name}: planner returned no JSON", 422, self.name)
        plan.setdefault("target", target_device)
        return {**filter_plan(plan, engines), "provider": self.name}


class GeminiAdapter(BaseAdapter):
    """Gemini Interactions REST API."""
    name = "gemini"

    def __init__(self, api_key: str, model: str = "", stt_model: str = "", base_url: str = "",
                 temperature: Optional[float] = None, max_tokens: Optional[int] = None):
        if not api_key:
            raise AIError("Gemini API key missing", 401, self.name)
        self.api_key = api_key
        self.model = model or DEFAULT_MODELS["gemini"]["model"]
        self.stt_model = stt_model or DEFAULT_MODELS["gemini"]["stt_model"]
        self.base_url = (base_url or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        self.temperature, self.max_tokens = temperature, max_tokens

    def _interact(self, body: Dict[str, Any]) -> str:
        data = _http(f"{self.base_url}/interactions", self.name, json.dumps({"store": False, **body}).encode(),
                     {"Content-Type": "application/json", "x-goog-api-key": self.api_key})
        outputs = [s for s in data.get("steps", []) if s.get("type") == "model_output"]
        if outputs:
            return "".join(c.get("text", "") for c in outputs[-1].get("content", []) if c.get("type") == "text")
        return data.get("output_text", "")

    def chat_completion(self, messages: List[Dict[str, str]], json_mode: bool = False,
                        temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        turns = [m for m in messages if m["role"] != "system"]
        text_in = turns[0]["content"] if len(turns) == 1 else "\n\n".join(f"{m['role'].upper()}: {m['content']}" for m in turns)
        gen = {k: v for k, v in {"temperature": temperature if temperature is not None else self.temperature,
                                 "max_output_tokens": max_tokens or self.max_tokens}.items() if v is not None}
        body: Dict[str, Any] = {"model": self.model, "input": text_in, "generation_config": gen}
        if system:
            body["system_instruction"] = system
        if json_mode:
            body["response_format"] = {"type": "text", "mime_type": "application/json"}
        return {"text": self._interact(body), "provider": self.name}

    def transcribe_audio(self, audio: bytes, mime_type: str = "audio/wav") -> Dict[str, Any]:
        text = self._interact({"model": self.stt_model, "input": [
            {"type": "audio", "data": base64.b64encode(audio).decode(), "mime_type": mime_type.split(";")[0]}]})
        return {"text": text.strip(), "provider": self.name}


class OpenAICompatibleAdapter(BaseAdapter):
    """OpenAI, Groq, Ollama, LM Studio, vLLM, llama.cpp server, local Edge0 — anything speaking /v1/chat/completions."""

    def __init__(self, base_url: str, api_key: str = "", model: str = "", stt_model: str = "", name: str = "openai-compatible",
                 temperature: Optional[float] = None, max_tokens: Optional[int] = None):
        if not base_url:
            raise AIError("Base URL missing", 400, name)
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model or "gpt-4o-mini"
        self.stt_model = stt_model or "whisper-1"
        self.temperature, self.max_tokens = temperature, max_tokens

    def _headers(self, content_type: Optional[str] = "application/json") -> Dict[str, str]:
        h = {"Content-Type": content_type} if content_type else {}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def chat_completion(self, messages: List[Dict[str, str]], json_mode: bool = False,
                        temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {"model": self.model, "messages": messages}
        t = temperature if temperature is not None else self.temperature
        if t is not None:
            body["temperature"] = t
        if max_tokens or self.max_tokens:
            body["max_tokens"] = max_tokens or self.max_tokens
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        data = _http(f"{self.base_url}/chat/completions", self.name, json.dumps(body).encode(), self._headers())
        return {"text": (data.get("choices") or [{}])[0].get("message", {}).get("content", ""), "provider": self.name}

    def transcribe_audio(self, audio: bytes, mime_type: str = "audio/wav") -> Dict[str, Any]:
        boundary = uuid.uuid4().hex
        ext = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a"}.get(mime_type.split(";")[0], "wav")
        parts = [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{self.stt_model}\r\n".encode(),
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.{ext}\"\r\n"
            f"Content-Type: {mime_type}\r\n\r\n".encode() + audio + b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
        data = _http(f"{self.base_url}/audio/transcriptions", self.name, b"".join(parts),
                     self._headers(f"multipart/form-data; boundary={boundary}"))
        return {"text": str(data.get("text", "")).strip(), "provider": self.name}


class EdgeAdapter(BaseAdapter):
    """Nexus bridge built-in AI (/api/ai/*): Gemini/Groq secrets or keyless Workers AI at the edge."""
    name = "nexus-edge"

    def __init__(self, api_url: str, auth_token: str = ""):
        self.api_url = api_url.rstrip("/")
        self.auth_token = auth_token

    def _post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        headers = {"Content-Type": "application/json", "User-Agent": "Nexus-Desktop-Daemon/2.1"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return _http(f"{self.api_url}{path}", self.name, json.dumps(body).encode(), headers)

    def transcribe_audio(self, audio: bytes, mime_type: str = "audio/wav") -> Dict[str, Any]:
        d = self._post("/ai/transcribe", {"audio_base64": base64.b64encode(audio).decode(), "mime_type": mime_type})
        return {"text": d.get("text", ""), "provider": d.get("provider", self.name)}

    def chat_completion(self, messages, json_mode=False, temperature=None, max_tokens=None) -> Dict[str, Any]:
        d = self._post("/ai/chat", {"messages": messages, "temperature": temperature, "max_tokens": max_tokens})
        return {"text": d.get("text", ""), "provider": d.get("provider", self.name)}

    def plan_action(self, prompt, target_device="DESKTOP", engines=None) -> Dict[str, Any]:
        d = self._post("/ai/plan", {"prompt": prompt, "target_device": target_device, "engines": engines})
        return {**filter_plan(d.get("plan") or {}, engines), "provider": d.get("provider", self.name)}


class FallbackChain:
    def __init__(self, adapters: List[BaseAdapter]):
        self.adapters = [a for a in adapters if a]
        self.name = " > ".join(a.name for a in self.adapters)

    def _run(self, method: str, *args, **kwargs) -> Dict[str, Any]:
        errors = []
        for a in self.adapters:
            if not a.supports(method):
                continue
            try:
                res = getattr(a, method)(*args, **kwargs)
                if errors:
                    res["fallback_errors"] = errors
                return res
            except Exception as e:  # noqa: BLE001 — any provider failure triggers fallback
                errors.append({"provider": a.name, "status": getattr(e, "status", None), "error": str(e)})
        raise AIError("All AI providers failed: " + " | ".join(f"{e['provider']}: {e['error']}" for e in errors), 502)

    def transcribe_audio(self, *a, **k): return self._run("transcribe_audio", *a, **k)
    def chat_completion(self, *a, **k): return self._run("chat_completion", *a, **k)
    def plan_action(self, *a, **k): return self._run("plan_action", *a, **k)


def build_user_adapter(ai_cfg: Dict[str, Any]) -> Optional[BaseAdapter]:
    """Developer Mode provider from config.user.json, or None if not configured."""
    provider = (ai_cfg.get("provider") or "gemini").lower()
    defaults = DEFAULT_MODELS.get(provider, DEFAULT_MODELS["custom"])
    common = dict(model=ai_cfg.get("model") or defaults["model"],
                  stt_model=ai_cfg.get("stt_model") or defaults["stt_model"],
                  temperature=ai_cfg.get("temperature"), max_tokens=ai_cfg.get("max_tokens"))
    key = ai_cfg.get("api_key") or ""
    if provider == "gemini":
        return GeminiAdapter(key, base_url=ai_cfg.get("base_url") or "", **common) if key else None
    if provider in ("groq", "openai") and not key:
        return None
    base_url = ai_cfg.get("base_url") or defaults.get("base_url", "")
    return OpenAICompatibleAdapter(base_url, key, name=provider, **common)


def build_client(user_cfg: Dict[str, Any], bridge_url: str, auth_token: str = "") -> FallbackChain:
    edge = EdgeAdapter(bridge_url, auth_token)
    if user_cfg.get("developer_mode"):
        try:
            mine = build_user_adapter(user_cfg.get("ai") or {})
        except AIError:
            mine = None
        return FallbackChain([mine, edge])
    return FallbackChain([edge])
