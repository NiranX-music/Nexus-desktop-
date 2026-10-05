/**
 * Nexus AI Provider Layer (universal ES module)
 *
 * Runs unchanged in two places:
 *   1. The browser dashboard  -> Developer Mode / Bring-Your-Own-Key (keys stay on the device)
 *   2. Cloudflare Pages Functions -> Standard Mode built-in providers (keys live in CF secrets)
 *
 * Only depends on fetch / FormData / Blob / atob / btoa, which exist in both runtimes.
 *
 * Every adapter implements the same AIClient interface:
 *   transcribeAudio(audio, { mimeType })        -> { text }
 *   chatCompletion(messages, options)           -> { text }
 *   planAction(prompt, { target_device, engines }) -> { target, summary, steps[] }
 */

// -----------------------------------------------------------------------------
// 1. Action vocabulary shared by the planner, the edge API and the local daemons
// -----------------------------------------------------------------------------
export const ENGINES = ["shell", "ui", "browser", "android"];

/** Which execution engine an action needs. Actions not listed are "core" (always allowed). */
export const ENGINE_FOR_ACTION = {
  SHELL: "shell",
  INTERPRETER: "shell",
  UI_INSPECT: "ui",
  UI_CLICK: "ui",
  UI_TYPE: "ui",
  UFO_TASK: "ui",
  BROWSER_TASK: "browser",
  ADB_TAP: "android",
  ADB_TEXT: "android",
  ADB_LAUNCH: "android",
  ADB_KEY: "android",
  ADB_SHELL: "android",
};

export const DESKTOP_ACTIONS = [
  "SHELL", "INTERPRETER", "KEYPRESS", "TYPE_TEXT", "MOUSE_CLICK", "SPEAK", "SCREENSHOT",
  "UI_INSPECT", "UI_CLICK", "UI_TYPE", "UFO_TASK", "BROWSER_TASK",
  "ADB_TAP", "ADB_TEXT", "ADB_LAUNCH", "ADB_KEY", "ADB_SHELL",
];
export const MOBILE_ACTIONS = ["VIBRATE", "TOAST", "NOTIFICATION", "BATTERY_CHECK", "CLIPBOARD_GET", "TORCH", "SHELL", "SPEAK"];
const ALL_ACTIONS = [...new Set([...DESKTOP_ACTIONS, ...MOBILE_ACTIONS])];
const MAX_STEPS = 20;

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    target: { type: "string", enum: ["DESKTOP", "MOBILE"] },
    summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ALL_ACTIONS },
          cmd: { type: "string" },
          keys: { type: "array", items: { type: "string" } },
          text: { type: "string" },
          name: { type: "string" },
          control_type: { type: "string" },
          task: { type: "string" },
          package: { type: "string" },
          key: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          duration_ms: { type: "integer" },
          title: { type: "string" },
          content: { type: "string" },
          state: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  required: ["target", "summary", "steps"],
};

const ACTION_DOCS = {
  SHELL: 'SHELL {cmd}: run a command (Windows cmd.exe on desktop; use `powershell -NoProfile -Command "..."` for PowerShell; bash on Android Termux)',
  INTERPRETER: "INTERPRETER {task}: hand a multi-step coding/file/system task to Open Interpreter (natural language)",
  KEYPRESS: 'KEYPRESS {keys}: press a hotkey, e.g. ["ctrl","shift","p"]',
  TYPE_TEXT: "TYPE_TEXT {text}: type text into the focused window",
  MOUSE_CLICK: "MOUSE_CLICK {x,y}: click screen coordinates (last resort; prefer UI_CLICK)",
  SPEAK: "SPEAK {text}: speak a short confirmation aloud",
  SCREENSHOT: "SCREENSHOT {}: capture the screen",
  UI_INSPECT: "UI_INSPECT {}: list named controls of the active window via the Windows accessibility tree",
  UI_CLICK: "UI_CLICK {name, control_type?}: click a control by its accessible name (e.g. name='Save', control_type='Button')",
  UI_TYPE: "UI_TYPE {name, text}: type into an edit control found by accessible name",
  UFO_TASK: "UFO_TASK {task}: delegate a complex multi-app Windows GUI task to Microsoft UFO",
  BROWSER_TASK: "BROWSER_TASK {task}: delegate a full web flow to Browser-Use (natural-language task, e.g. 'find the cheapest flight BOM->DEL on Friday')",
  ADB_TAP: "ADB_TAP {x,y}: tap inside the connected Android device/emulator",
  ADB_TEXT: "ADB_TEXT {text}: type text on the Android device",
  ADB_LAUNCH: "ADB_LAUNCH {package}: launch an Android app by package name (e.g. com.whatsapp)",
  ADB_KEY: "ADB_KEY {key}: send an Android keyevent (HOME, BACK, ENTER, or a numeric code)",
  ADB_SHELL: "ADB_SHELL {cmd}: run `adb shell <cmd>`",
  VIBRATE: "VIBRATE {duration_ms}: vibrate the phone",
  TOAST: "TOAST {text}: show a toast on the phone",
  NOTIFICATION: "NOTIFICATION {title, content}: post a phone notification",
  BATTERY_CHECK: "BATTERY_CHECK {}: read phone battery status",
  CLIPBOARD_GET: "CLIPBOARD_GET {}: read the phone clipboard",
  TORCH: "TORCH {state}: 'on' or 'off'",
};

/** Builds the planner prompt. `engines` = list of enabled engines, or null for "unknown / all". */
export function buildPlanMessages(prompt, ctx = {}) {
  const requested = String(ctx.target_device || "").toUpperCase();
  const engines = Array.isArray(ctx.engines) ? ctx.engines : null;
  const allowed = (list) => list.filter((a) => !ENGINE_FOR_ACTION[a] || !engines || engines.includes(ENGINE_FOR_ACTION[a]));

  const desktop = allowed(DESKTOP_ACTIONS).map((a) => `  - ${ACTION_DOCS[a]}`).join("\n");
  const mobile = MOBILE_ACTIONS.map((a) => `  - ${ACTION_DOCS[a]}`).join("\n");

  const system = [
    "You are the action planner for Nexus, an agent that controls the user's Windows PC and Android phone.",
    "Convert the user's request into a short, safe, executable JSON plan.",
    "",
    "DESKTOP actions:",
    desktop,
    "",
    "MOBILE actions (Android Termux companion):",
    mobile,
    "",
    "Rules:",
    "- Respond with ONE JSON object: {\"target\": \"DESKTOP\"|\"MOBILE\", \"summary\": string, \"steps\": [{\"action\": ..., ...fields}]}.",
    "- Use only the actions listed above for the chosen target. Use at most 8 steps.",
    "- Prefer delegating whole flows (BROWSER_TASK, UFO_TASK, INTERPRETER) over many low-level clicks.",
    "- Prefer UI_CLICK by accessible name over MOUSE_CLICK coordinates.",
    "- To open a Windows GUI app use SHELL with `start \"\" <app>` (e.g. `start \"\" notepad`, `start \"\" code .`) so the command returns immediately.",
    "- Never plan destructive operations (deleting files, formatting disks, killing system processes) unless the user explicitly asked for exactly that.",
    "- End with a SPEAK step that briefly confirms what was done.",
    requested && requested !== "ALL" ? `- The user selected target ${requested}; use it unless the request is clearly for the other device.` : "",
  ].filter(Boolean).join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: String(prompt || "").trim() },
  ];
}

/** Validates a raw plan: drops unknown actions and actions whose engine is disabled. */
export function normalizePlan(raw, ctx = {}) {
  let plan = raw;
  if (typeof plan === "string") plan = parseJsonLoose(plan);
  if (!plan || typeof plan !== "object") throw new AIError("Planner returned no JSON plan", { status: 422 });

  const requested = String(ctx.target_device || "").toUpperCase();
  let target = String(plan.target || requested || "DESKTOP").toUpperCase();
  if (!["DESKTOP", "MOBILE", "ALL"].includes(target)) target = "DESKTOP";

  const engines = Array.isArray(ctx.engines) ? ctx.engines : null;
  const vocabulary = target === "MOBILE" ? MOBILE_ACTIONS : ALL_ACTIONS;
  const steps = [];
  const dropped = [];

  for (const s of Array.isArray(plan.steps) ? plan.steps : []) {
    if (!s || typeof s !== "object") continue;
    const action = String(s.action || s.tool || "").toUpperCase();
    const engine = ENGINE_FOR_ACTION[action];
    if (!vocabulary.includes(action)) {
      dropped.push({ action, reason: "unknown action" });
    } else if (engine && engines && !engines.includes(engine)) {
      dropped.push({ action, reason: `engine '${engine}' disabled` });
    } else {
      steps.push({ ...s, action });
    }
    if (steps.length >= MAX_STEPS) break;
  }

  return {
    target,
    summary: String(plan.summary || plan.prompt || "").slice(0, 500),
    prompt: ctx.prompt || plan.prompt || undefined,
    steps,
    ...(dropped.length ? { dropped_steps: dropped } : {}),
    metadata: { ...(plan.metadata || {}), steps_count: steps.length },
  };
}

// -----------------------------------------------------------------------------
// 2. Helpers
// -----------------------------------------------------------------------------
export class AIError extends Error {
  constructor(message, { status, provider } = {}) {
    super(message);
    this.name = "AIError";
    this.status = status;
    this.provider = provider;
  }
}

export function parseJsonLoose(text) {
  if (text && typeof text === "object") return text;
  const s = String(text || "").replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(s.slice(start, end + 1)); } catch { /* fall through */ }
    }
  }
  return null;
}

async function httpJson(url, init, provider) {
  let resp;
  try {
    resp = await fetch(url, init);
  } catch (e) {
    throw new AIError(`${provider}: network error (${e.message})`, { status: 0, provider });
  }
  const text = await resp.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!resp.ok) {
    let msg = data?.error?.message || data?.error || data?.detail || data?.message || text.slice(0, 300) || `HTTP ${resp.status}`;
    if (typeof msg !== "string") msg = JSON.stringify(msg);
    throw new AIError(`${provider}: ${msg}`, { status: resp.status, provider });
  }
  return data;
}

export async function toBase64(audio) {
  if (typeof audio === "string") return audio.includes(",") ? audio.split(",", 2)[1] : audio;
  const bytes = audio instanceof Uint8Array
    ? audio
    : new Uint8Array(typeof audio.arrayBuffer === "function" ? await audio.arrayBuffer() : audio);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cleanMime(mime) {
  return String(mime || "audio/webm").split(";")[0].trim().toLowerCase();
}

function extForMime(mime) {
  const m = cleanMime(mime);
  return ({ "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/flac": "flac" })[m] || "webm";
}

// -----------------------------------------------------------------------------
// 3. Adapters
// -----------------------------------------------------------------------------
class BaseAdapter {
  constructor(name, capabilities) {
    this.name = name;
    this.capabilities = new Set(capabilities);
  }
  supports(method) {
    return this.capabilities.has(method);
  }
  async planAction(prompt, ctx = {}) {
    const { text } = await this.chatCompletion(buildPlanMessages(prompt, ctx), {
      json: true,
      responseSchema: PLAN_SCHEMA,
      temperature: 0.2,
    });
    return { ...normalizePlan(parseJsonLoose(text), { ...ctx, prompt }), provider: this.name };
  }
}

/** Google Gemini via the Interactions REST API (current models, no SDK required). */
export class GeminiAdapter extends BaseAdapter {
  constructor({ apiKey, model, transcribeModel, baseUrl, temperature, maxTokens } = {}) {
    super("gemini", ["transcribeAudio", "chatCompletion", "planAction"]);
    if (!apiKey) throw new AIError("Gemini API key missing", { status: 401, provider: "gemini" });
    this.apiKey = apiKey;
    this.model = model || "gemini-3.8-flash";
    this.transcribeModel = transcribeModel || "gemini-3.5-transcribe";
    this.baseUrl = (baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async _interact(body) {
    const data = await httpJson(`${this.baseUrl}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({ store: false, ...body }),
    }, "gemini");
    const outputs = (data.steps || []).filter((s) => s.type === "model_output");
    const last = outputs[outputs.length - 1];
    const text = (last?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("")
      || data.output_text || "";
    return text;
  }

  async chatCompletion(messages, { temperature, maxTokens, responseSchema } = {}) {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const turns = messages.filter((m) => m.role !== "system");
    const input = turns.length === 1
      ? turns[0].content
      : turns.map((m) => `${String(m.role).toUpperCase()}: ${m.content}`).join("\n\n");

    const body = {
      model: this.model,
      input,
      generation_config: {
        temperature: temperature ?? this.temperature,
        max_output_tokens: maxTokens ?? this.maxTokens,
      },
    };
    if (system) body.system_instruction = system;
    if (responseSchema) body.response_format = { type: "text", mime_type: "application/json", schema: responseSchema };
    return { text: await this._interact(body), provider: this.name };
  }

  async transcribeAudio(audio, { mimeType } = {}) {
    const text = await this._interact({
      model: this.transcribeModel,
      input: [{ type: "audio", data: await toBase64(audio), mime_type: cleanMime(mimeType) }],
    });
    return { text: text.trim(), provider: this.name };
  }
}

/** Any OpenAI-compatible server: OpenAI, Groq, Ollama, LM Studio, vLLM, llama.cpp, a local Edge0 server... */
export class OpenAICompatibleAdapter extends BaseAdapter {
  constructor({ name, apiKey, baseUrl, model, sttModel, temperature, maxTokens, jsonMode = true } = {}) {
    super(name || "openai-compatible", ["transcribeAudio", "chatCompletion", "planAction"]);
    if (!baseUrl) throw new AIError("Base URL missing", { status: 400, provider: this.name });
    this.apiKey = apiKey || "";
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model || "gpt-4o-mini";
    this.sttModel = sttModel || "whisper-1";
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.jsonMode = jsonMode;
  }

  _headers(json = true) {
    const h = json ? { "Content-Type": "application/json" } : {};
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  async chatCompletion(messages, { temperature, maxTokens, json } = {}) {
    const body = {
      model: this.model,
      messages,
      temperature: temperature ?? this.temperature,
      max_tokens: maxTokens ?? this.maxTokens,
    };
    if (json && this.jsonMode) body.response_format = { type: "json_object" };
    const data = await httpJson(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
    }, this.name);
    return { text: data?.choices?.[0]?.message?.content || "", provider: this.name };
  }

  async transcribeAudio(audio, { mimeType } = {}) {
    const mime = cleanMime(mimeType || audio?.type);
    const blob = typeof audio === "string" ? new Blob([base64ToBytes(toBase64Sync(audio))], { type: mime }) : audio;
    const form = new FormData();
    form.append("file", blob, `audio.${extForMime(mime)}`);
    form.append("model", this.sttModel);
    const data = await httpJson(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: this._headers(false),
      body: form,
    }, this.name);
    return { text: String(data.text || "").trim(), provider: this.name };
  }
}

function toBase64Sync(s) {
  return s.includes(",") ? s.split(",", 2)[1] : s;
}

export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor({ apiKey, model, sttModel, temperature, maxTokens } = {}) {
    if (!apiKey) throw new AIError("Groq API key missing", { status: 401, provider: "groq" });
    super({
      name: "groq",
      apiKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: model || "llama-3.3-70b-versatile",
      sttModel: sttModel || "whisper-large-v3-turbo",
      temperature,
      maxTokens,
    });
  }
}

/** Cloudflare Workers AI through the `AI` binding (edge only, free daily allowance, no API key). */
export class WorkersAIAdapter extends BaseAdapter {
  constructor(aiBinding, { model, sttModel, maxTokens } = {}) {
    super("workers-ai", ["transcribeAudio", "chatCompletion", "planAction"]);
    if (!aiBinding) throw new AIError("Workers AI binding missing", { status: 500, provider: "workers-ai" });
    this.ai = aiBinding;
    this.model = model || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    this.sttModel = sttModel || "@cf/openai/whisper-large-v3-turbo";
    this.maxTokens = maxTokens || 1024;
  }

  async chatCompletion(messages, { temperature, maxTokens } = {}) {
    try {
      const r = await this.ai.run(this.model, {
        messages,
        temperature: temperature ?? 0.3,
        max_tokens: maxTokens ?? this.maxTokens,
      });
      const out = r?.response;
      return { text: typeof out === "string" ? out : JSON.stringify(out ?? ""), provider: this.name };
    } catch (e) {
      throw new AIError(`workers-ai: ${e.message}`, { status: 502, provider: this.name });
    }
  }

  async transcribeAudio(audio) {
    try {
      const r = await this.ai.run(this.sttModel, { audio: await toBase64(audio) });
      return { text: String(r?.text || "").trim(), provider: this.name };
    } catch (e) {
      throw new AIError(`workers-ai: ${e.message}`, { status: 502, provider: this.name });
    }
  }
}

/** Legacy Modal service (CPU faster-whisper + rule-based planner). Used only as a last-resort fallback. */
export class ModalAdapter extends BaseAdapter {
  constructor({ baseUrl } = {}) {
    super("modal", ["transcribeAudio", "planAction"]);
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
  }
  async planAction(prompt, ctx = {}) {
    const raw = await httpJson(`${this.baseUrl}/decompose_action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, context: { target_device: ctx.target_device } }),
    }, this.name);
    return { ...normalizePlan(raw, { ...ctx, prompt }), provider: this.name };
  }
  async transcribeAudio(audio, { mimeType } = {}) {
    const data = await httpJson(`${this.baseUrl}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_base64: await toBase64(audio), format: extForMime(mimeType) }),
    }, this.name);
    return { text: String(data.text || "").trim(), provider: this.name };
  }
}

/** Client for the Nexus edge AI proxy (/api/ai/*) — the Standard Mode default from the browser/daemon. */
export class EdgeAdapter extends BaseAdapter {
  constructor({ apiUrl = "/api", authToken = "" } = {}) {
    super("nexus-edge", ["transcribeAudio", "chatCompletion", "planAction"]);
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.authToken = authToken;
  }
  _post(path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;
    return httpJson(`${this.apiUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) }, this.name);
  }
  async transcribeAudio(audio, { mimeType } = {}) {
    const d = await this._post("/ai/transcribe", { audio_base64: await toBase64(audio), mime_type: cleanMime(mimeType || audio?.type) });
    return { text: d.text || "", provider: d.provider || this.name };
  }
  async chatCompletion(messages, options = {}) {
    const d = await this._post("/ai/chat", { messages, temperature: options.temperature, max_tokens: options.maxTokens });
    return { text: d.text || "", provider: d.provider || this.name };
  }
  async planAction(prompt, ctx = {}) {
    const d = await this._post("/ai/plan", { prompt, target_device: ctx.target_device, engines: ctx.engines });
    return { ...d.plan, provider: d.provider || this.name };
  }
}

// -----------------------------------------------------------------------------
// 4. Fallback chain: same interface, tries adapters in order
// -----------------------------------------------------------------------------
export class FallbackChain {
  constructor(adapters, { onFallback } = {}) {
    this.adapters = adapters.filter(Boolean);
    this.onFallback = onFallback;
    this.name = this.adapters.map((a) => a.name).join(" > ");
  }

  async _run(method, args) {
    const errors = [];
    for (const adapter of this.adapters) {
      if (!adapter.supports(method)) continue;
      try {
        const result = await adapter[method](...args);
        return { ...result, provider: result.provider || adapter.name, ...(errors.length ? { fallback_errors: errors } : {}) };
      } catch (e) {
        errors.push({ provider: adapter.name, status: e.status ?? null, error: e.message });
        if (this.onFallback) this.onFallback(adapter, e);
      }
    }
    const detail = errors.map((e) => `${e.provider}${e.status ? ` (${e.status})` : ""}: ${e.error}`).join(" | ");
    throw new AIError(errors.length ? `All AI providers failed — ${detail}` : `No provider supports ${method}`, { status: 502 });
  }

  supports(method) {
    return this.adapters.some((a) => a.supports(method));
  }
  transcribeAudio(...args) { return this._run("transcribeAudio", args); }
  chatCompletion(...args) { return this._run("chatCompletion", args); }
  planAction(...args) { return this._run("planAction", args); }
}
