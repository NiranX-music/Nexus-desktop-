/**
 * Nexus AI Provider Layer (universal ES module)
 *
 * Runs unchanged in two places:
 *   1. The browser dashboard  -> Developer Mode / Bring-Your-Own-Key (keys stay on the device)
 *   2. Cloudflare Pages Functions -> Standard Mode built-in providers (keys live in CF secrets)
 *
 * Universal Document Studio, Music Audio Synthesizer, Video Generation & Media APIs.
 */

export const GLOBAL_GEMINI_API_KEY = "AQ.Ab8RN6JW5yXKyy1RDQlzMCS1TTn3ZMupKyzH7KTtXP7QA9Rqvw";

// -----------------------------------------------------------------------------
// 1. Action vocabulary shared by the planner, the edge API and the local daemons
// -----------------------------------------------------------------------------
export const ENGINES = ["shell", "ui", "browser", "android", "docs", "media"];

/** Which execution engine an action needs. Actions not listed are "core" (always allowed). */
export const ENGINE_FOR_ACTION = {
  SHELL: "shell",
  INTERPRETER: "shell",
  UI_INSPECT: "ui",
  UI_CLICK: "ui",
  UI_TYPE: "ui",
  UFO_TASK: "ui",
  VISUAL_CLICK: "ui",
  BROWSER_TASK: "browser",
  SCREEN_USE: "browser",
  SCREEN_TASK: "browser",
  ADB_TAP: "android",
  ADB_TEXT: "android",
  ADB_LAUNCH: "android",
  ADB_KEY: "android",
  ADB_SHELL: "android",
  DOC_GENERATE: "docs",
  DOC_EDIT: "docs",
  PDF_GENERATE: "docs",
  PDF_EDIT: "docs",
  SHEET_GENERATE: "docs",
  SLIDES_GENERATE: "docs",
  MUSIC_GENERATE: "media",
  AUDIO_GENERATE: "media",
  VIDEO_GENERATE: "media",
  AUDIO_COMMAND: "media",
};

export const DESKTOP_ACTIONS = [
  "SHELL", "INTERPRETER", "KEYPRESS", "TYPE_TEXT", "MOUSE_CLICK", "SPEAK", "SCREENSHOT",
  "UI_INSPECT", "UI_CLICK", "UI_TYPE", "UFO_TASK", "BROWSER_TASK",
  "SCREEN_USE", "SCREEN_TASK", "VISUAL_CLICK",
  "ADB_TAP", "ADB_TEXT", "ADB_LAUNCH", "ADB_KEY", "ADB_SHELL",
  "DOC_GENERATE", "DOC_EDIT", "PDF_GENERATE", "PDF_EDIT", "SHEET_GENERATE", "SLIDES_GENERATE",
  "MUSIC_GENERATE", "AUDIO_GENERATE", "VIDEO_GENERATE", "AUDIO_COMMAND"
];
export const MOBILE_ACTIONS = [
  "VIBRATE", "TOAST", "NOTIFICATION", "BATTERY_CHECK", "CLIPBOARD_GET", "TORCH", "SHELL", "SPEAK",
  "DOC_GENERATE", "MUSIC_GENERATE", "AUDIO_COMMAND"
];
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
          goal: { type: "string" },
          url: { type: "string" },
          target: { type: "string" },
          package: { type: "string" },
          key: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          duration_ms: { type: "integer" },
          title: { type: "string" },
          content: { type: "string" },
          state: { type: "string" },
          type: { type: "string" },
          prompt: { type: "string" },
          instructions: { type: "string" },
          template: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
          rows: { type: "array" },
          slides: { type: "array" },
          mood: { type: "string" },
          genre: { type: "string" },
          tempo: { type: "integer" },
          aspect_ratio: { type: "string" },
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
  MOUSE_CLICK: "MOUSE_CLICK {x,y}: click screen coordinates (last resort; prefer UI_CLICK or VISUAL_CLICK)",
  SPEAK: "SPEAK {text}: speak a short confirmation aloud",
  SCREENSHOT: "SCREENSHOT {}: capture the screen",
  UI_INSPECT: "UI_INSPECT {}: list named controls of the active window via the Windows accessibility tree",
  UI_CLICK: "UI_CLICK {name, control_type?}: click a control by its accessible name (e.g. name='Save', control_type='Button')",
  UI_TYPE: "UI_TYPE {name, text}: type into an edit control found by accessible name",
  UFO_TASK: "UFO_TASK {task}: delegate a complex multi-app Windows GUI task to Microsoft UFO",
  BROWSER_TASK: "BROWSER_TASK {task}: delegate a full web flow to Browser-Use (natural-language task, e.g. 'find the cheapest flight BOM->DEL on Friday')",
  SCREEN_USE: "SCREEN_USE {task, url?}: inspect the screen with multimodal AI vision, ground visual elements, and execute mouse/keyboard actions",
  SCREEN_TASK: "SCREEN_TASK {task, url?}: execute an autonomous multi-step visual screen workflow",
  VISUAL_CLICK: "VISUAL_CLICK {target}: visually ground and click a UI element by description using multimodal vision (e.g. target='blue submit button')",
  ADB_TAP: "ADB_TAP {x,y}: tap inside the connected Android device/emulator",
  ADB_TEXT: "ADB_TEXT {text}: type text on the Android device",
  ADB_LAUNCH: "ADB_LAUNCH {package}: launch an Android app by package name (e.g. com.whatsapp)",
  ADB_KEY: "ADB_KEY {key}: send an Android keyevent (HOME, BACK, ENTER, or a numeric code)",
  ADB_SHELL: "ADB_SHELL {cmd}: run `adb shell <cmd>`",
  DOC_GENERATE: "DOC_GENERATE {type, title, prompt}: generate any document (pdf, doc, sheet, presentation, markdown, html)",
  DOC_EDIT: "DOC_EDIT {type, instructions, content?}: edit or update an existing document, PDF, spreadsheet or presentation",
  PDF_GENERATE: "PDF_GENERATE {title, content, template?}: generate a formatted printable PDF invoice, report, or resume",
  PDF_EDIT: "PDF_EDIT {instructions, content?}: edit or revise a PDF document layout and content",
  SHEET_GENERATE: "SHEET_GENERATE {title, columns, rows, formulas?}: generate an Excel/CSV spreadsheet table with calculations",
  SLIDES_GENERATE: "SLIDES_GENERATE {title, topic, slides}: generate a presentation slide deck with slides and speaker notes",
  MUSIC_GENERATE: "MUSIC_GENERATE {prompt, mood?, genre?, tempo?}: generate an AI musical score, melody, and chords",
  AUDIO_GENERATE: "AUDIO_GENERATE {prompt, type?}: generate speech, audio sound effects or ambient audio",
  VIDEO_GENERATE: "VIDEO_GENERATE {prompt, aspect_ratio?, style?}: generate a complete video concept, storyboard and scene scripts",
  AUDIO_COMMAND: "AUDIO_COMMAND {text}: execute an audio AI command via voice synthesis",
  VIBRATE: "VIBRATE {duration_ms}: vibrate the phone",
  TOAST: "TOAST {text}: show a toast on the phone",
  NOTIFICATION: "NOTIFICATION {title, content}: post a phone notification",
  BATTERY_CHECK: "BATTERY_CHECK {}: read phone battery status",
  CLIPBOARD_GET: "CLIPBOARD_GET {}: read the phone clipboard",
  TORCH: "TORCH {state}: 'on' or 'off'",
};

/** Builds the planner prompt. `engines` = list of enabled engines, or null for 'unknown / all'. */
export function buildPlanMessages(prompt, ctx = {}) {
  const requested = String(ctx.target_device || "").toUpperCase();
  const engines = Array.isArray(ctx.engines) ? ctx.engines : null;
  const allowed = (list) => list.filter((a) => !ENGINE_FOR_ACTION[a] || !engines || engines.includes(ENGINE_FOR_ACTION[a]));

  const desktop = allowed(DESKTOP_ACTIONS).map((a) => `  - ${ACTION_DOCS[a]}`).join("
");
  const mobile = MOBILE_ACTIONS.map((a) => `  - ${ACTION_DOCS[a]}`).join("
");

  const system = [
    "You are the action planner for Nexus, an agent that controls the user's Windows PC, Android phone, and cloud ecosystem.",
    "Convert the user's request into a short, safe, executable JSON plan.",
    "",
    "DESKTOP & CLOUD actions:",
    desktop,
    "",
    "MOBILE actions (Android Termux companion):",
    mobile,
    "",
    "Rules:",
    '- Respond with ONE JSON object: {"target": "DESKTOP"|"MOBILE", "summary": string, "steps": [{"action": ..., ...fields}]}.',
    "- Use only the actions listed above for the chosen target. Use at most 8 steps.",
    "- For document creation requests (PDFs, docs, spreadsheets, presentations), use DOC_GENERATE, PDF_GENERATE, SHEET_GENERATE, or SLIDES_GENERATE.",
    "- For editing documents, use DOC_EDIT or PDF_EDIT.",
    "- For music composition or sound, use MUSIC_GENERATE or AUDIO_GENERATE.",
    "- For video requests or storyboards, use VIDEO_GENERATE.",
    "- Prefer delegating whole flows (BROWSER_TASK, UFO_TASK, INTERPRETER) over many low-level clicks.",
    "- Prefer UI_CLICK by accessible name over MOUSE_CLICK coordinates.",
    '- To open a Windows GUI app use SHELL with `start "" <app>` (e.g. `start "" notepad`, `start "" code .`) so the command returns immediately.',
    "- Never plan destructive operations (deleting files, formatting disks, killing system processes) unless the user explicitly asked for exactly that.",
    "- End with a SPEAK step that briefly confirms what was done.",
    requested && requested !== "ALL" ? `- The user selected target ${requested}; use it unless the request is clearly for the other device.` : "",
  ].filter(Boolean).join("
");

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
  async generateDocument(opts = {}) {
    throw new AIError(`${this.name} does not support document generation`, { status: 501, provider: this.name });
  }
  async editDocument(opts = {}) {
    throw new AIError(`${this.name} does not support document editing`, { status: 501, provider: this.name });
  }
  async generateMusic(opts = {}) {
    throw new AIError(`${this.name} does not support music generation`, { status: 501, provider: this.name });
  }
  async generateVideo(opts = {}) {
    throw new AIError(`${this.name} does not support video generation`, { status: 501, provider: this.name });
  }
}

/** Google Gemini via the Interactions REST API + generateContent multi-model resilience */
export class GeminiAdapter extends BaseAdapter {
  constructor({ apiKey, model, transcribeModel, fallbackModel, baseUrl, temperature, maxTokens } = {}) {
    super("gemini", [
      "transcribeAudio", "chatCompletion", "planAction",
      "generateDocument", "editDocument", "generateMusic", "generateVideo"
    ]);
    this.apiKey = apiKey || GLOBAL_GEMINI_API_KEY;
    if (!this.apiKey) throw new AIError("Gemini API key missing", { status: 401, provider: "gemini" });
    this.model = model || "gemini-3.8-flash";
    this.fallbackModel = fallbackModel || "gemini-3.5-flash";
    this.transcribeModel = transcribeModel || "gemini-3.5-flash";
    this.baseUrl = (baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async _generateContent(modelName, contents, systemInstruction = "", jsonMode = false) {
    const url = `${this.baseUrl}/models/${modelName}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: Array.isArray(contents) ? contents : [{ parts: [{ text: String(contents) }] }]
    };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const genConfig = {};
    if (this.temperature !== undefined) genConfig.temperature = this.temperature;
    if (this.maxTokens) genConfig.maxOutputTokens = this.maxTokens;
    if (jsonMode) genConfig.responseMimeType = "application/json";
    if (Object.keys(genConfig).length > 0) payload.generationConfig = genConfig;

    const data = await httpJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, "gemini");

    const candidate = data?.candidates?.[0];
    const textPart = candidate?.content?.parts?.map(p => p.text || "").join("") || "";
    return textPart;
  }

  async _interact(body, jsonMode = false) {
    // 1. Try Interactions API with primary model
    try {
      const data = await httpJson(`${this.baseUrl}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({ store: false, ...body }),
      }, "gemini");
      const outputs = (data.steps || []).filter((s) => s.type === "model_output");
      const last = outputs[outputs.length - 1];
      const text = (last?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("")
        || data.output_text || "";
      if (text) return text;
    } catch (err) {
      console.warn("[Gemini Interactions API Warn] Falling back to generateContent:", err.message);
    }

    // 2. Fallback to generateContent with primary model
    const inputStr = typeof body.input === "string" ? body.input : JSON.stringify(body.input);
    const system = body.system_instruction || "";
    try {
      return await this._generateContent(this.model, inputStr, system, jsonMode);
    } catch (err2) {
      console.warn("[Gemini Primary Model Warn] Falling back to", this.fallbackModel, ":", err2.message);
    }

    // 3. Fallback to generateContent with rock-solid fallback model
    return await this._generateContent(this.fallbackModel, inputStr, system, jsonMode);
  }

  async chatCompletion(messages, { temperature, maxTokens, responseSchema, json } = {}) {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("

");
    const turns = messages.filter((m) => m.role !== "system");
    const input = turns.length === 1
      ? turns[0].content
      : turns.map((m) => `${String(m.role).toUpperCase()}: ${m.content}`).join("

");

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
    return { text: await this._interact(body, !!(json || responseSchema)), provider: this.name };
  }

  async transcribeAudio(audio, { mimeType } = {}) {
    const clean = cleanMime(mimeType);
    const b64 = await toBase64(audio);
    try {
      const text = await this._interact({
        model: this.transcribeModel,
        input: [{ type: "audio", data: b64, mime_type: clean }],
      });
      if (text.trim()) return { text: text.trim(), provider: this.name };
    } catch (e) {
      console.warn("[Gemini Transcribe Audio Error] Fallback:", e.message);
    }

    // Direct multimodal audio fallback
    const contents = [{
      parts: [
        { inlineData: { mimeType: clean, data: b64 } },
        { text: "Transcribe this audio recording accurately. Return only the transcription text." }
      ]
    }];
    const text = await this._generateContent(this.fallbackModel, contents);
    return { text: text.trim(), provider: this.name };
  }

  /** Universal Document Creator & Generator */
  async generateDocument({ type = "pdf", title = "Document", prompt = "", template = "standard", options = {} } = {}) {
    const system = [
      "You are Nexus Document Architect, an expert designer of documents, spreadsheets, presentations, and PDFs.",
      "Generate a complete, professional, highly detailed, beautifully formatted document in valid JSON.",
      "Required JSON structure:",
      "{",
      '  "title": string,',
      '  "type": "pdf" | "doc" | "sheet" | "presentation" | "markdown" | "html",',
      '  "summary": string,',
      '  "html": string (clean, modern HTML with inline CSS styling, beautiful fonts, margins, printable A4 page layouts, professional typography, tables, badges),',
      '  "markdown": string (clean Markdown representation),',
      '  "data": object (structured data: if sheet -> { columns: string[], rows: any[][], formulas?: string[] }; if presentation -> { slides: [{ slide_num, title, subtitle, bullets: string[], notes: string }] }; if doc/pdf -> { sections: [{ heading, content }] })',
      "}",
      "Rules: Do not use placeholders like 'Lorem ipsum' or 'Insert text here'. Write real, comprehensive, professional content.",
    ].join("
");

    const userMsg = `Document Type: ${type.toUpperCase()}
Title: ${title}
Template/Style: ${template}
Prompt/Requirements: ${prompt}
Additional Options: ${JSON.stringify(options)}`;
    const { text } = await this.chatCompletion([
      { role: "system", content: system },
      { role: "user", content: userMsg }
    ], { json: true, temperature: 0.3 });

    const doc = parseJsonLoose(text);
    if (!doc) throw new AIError("Failed to generate structured document from Gemini", { status: 422, provider: this.name });
    return { ok: true, provider: this.name, ...doc };
  }

  /** Universal Document Editor */
  async editDocument({ type = "pdf", content = "", instructions = "", current_html = "", data = null } = {}) {
    const system = [
      "You are Nexus Document Architect. The user wants to edit/refine an existing document.",
      "Apply all requested changes, additions, styling refinements, and calculations accurately.",
      "Return the updated document in the exact same JSON format:",
      "{",
      '  "title": string,',
      '  "type": string,',
      '  "summary": string,',
      '  "html": string,',
      '  "markdown": string,',
      '  "data": object,',
      '  "changes_summary": string',
      "}",
    ].join("
");

    const userMsg = `Document Type: ${type}
Edit Instructions: ${instructions}
Current Markdown/Text:
${content}
Current HTML:
${current_html || ''}
Current Data:
${JSON.stringify(data || {})}`;
    const { text } = await this.chatCompletion([
      { role: "system", content: system },
      { role: "user", content: userMsg }
    ], { json: true, temperature: 0.2 });

    const updated = parseJsonLoose(text);
    if (!updated) throw new AIError("Failed to edit document with Gemini", { status: 422, provider: this.name });
    return { ok: true, provider: this.name, ...updated };
  }

  /** AI Music & Melody Generator */
  async generateMusic({ prompt = "Inspiring electronic synthwave melody", mood = "energetic", genre = "synthwave", tempo = 120 } = {}) {
    const system = [
      "You are Nexus AI Music Composer & Sound Architect.",
      "Generate a playable, beautiful musical composition structure for Web Audio API synthesis in valid JSON:",
      "{",
      '  "title": string,',
      '  "genre": string,',
      '  "mood": string,',
      '  "tempo": number (BPM, e.g. 110-140),',
      '  "key": string (e.g. "C Major", "A Minor", "F# Dorian"),',
      '  "sound_profile": { "synth_type": "sine"|"triangle"|"sawtooth"|"square", "reverb": number, "filter_freq": number },',
      '  "melody": [ { "note": string (e.g. "C4", "E4", "G4", "B4", "C5"), "freq": number (Hz, e.g. 261.63), "duration": number (seconds, e.g. 0.4), "time": number (offset in seconds) } ],',
      '  "bassline": [ { "note": string, "freq": number, "duration": number, "time": number } ],',
      '  "chords": [ { "name": string (e.g. "Am", "F", "C", "G"), "time": number, "duration": number, "notes": string[], "freqs": number[] } ],',
      '  "lyrics": string (optional lyrical verse)',
      "}",
      "Include at least 16 to 32 notes in the melody so it forms a full, catchy phrase/loop.",
    ].join("
");

    const { text } = await this.chatCompletion([
      { role: "system", content: system },
      { role: "user", content: `Compose a musical piece with prompt: ${prompt}
Mood: ${mood}
Genre: ${genre}
Target BPM: ${tempo}` }
    ], { json: true, temperature: 0.4 });

    const score = parseJsonLoose(text);
    if (!score) throw new AIError("Failed to generate music score from Gemini", { status: 422, provider: this.name });
    return { ok: true, provider: this.name, ...score };
  }

  /** AI Video & Storyboard Generator */
  async generateVideo({ prompt = "Futuristic AI autonomous agent overview", aspect_ratio = "16:9", style = "cinematic", scenes_count = 4 } = {}) {
    const system = [
      "You are Nexus Video Director & Motion Storyboard Architect.",
      "Generate a complete cinematic video script, storyboard, visual scenes, and canvas animation instructions in valid JSON:",
      "{",
      '  "title": string,',
      '  "synopsis": string,',
      '  "aspect_ratio": "16:9" | "9:16" | "1:1",',
      '  "style": string,',
      '  "total_duration_sec": number,',
      '  "audio_theme": { "mood": string, "music_prompt": string, "tempo": number },',
      '  "scenes": [',
      '    {',
      '      "scene_num": number,',
      '      "title": string,',
      '      "duration_sec": number,',
      '      "visual_prompt": string (rich cinematic description for video generation),',
      '      "camera": string (e.g. "Slow tracking push-in with shallow depth of field"),',
      '      "narration": string (voiceover text to speak aloud),',
      '      "on_screen_text": string,',
      '      "canvas_theme": { "bg_gradient": [string, string], "particle_color": string, "accent_color": string },',
      '      "animation_type": "particle_pulse" | "neon_grid" | "cyber_stream" | "cinematic_zoom"',
      '    }',
      '  ]',
      "}",
      "Ensure scenes tell a compelling story with punchy narration and vivid cinematic visuals.",
    ].join("
");

    const { text } = await this.chatCompletion([
      { role: "system", content: system },
      { role: "user", content: `Generate a video with prompt: ${prompt}
Aspect Ratio: ${aspect_ratio}
Style: ${style}
Number of Scenes: ${scenes_count}` }
    ], { json: true, temperature: 0.3 });

    const video = parseJsonLoose(text);
    if (!video) throw new AIError("Failed to generate video storyboard from Gemini", { status: 422, provider: this.name });
    return { ok: true, provider: this.name, ...video };
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

/** Client for the Nexus edge AI proxy (/api/ai/* and /api/docs/*) — the Standard Mode default from browser/daemon. */
export class EdgeAdapter extends BaseAdapter {
  constructor({ apiUrl = "/api", authToken = "" } = {}) {
    super("nexus-edge", [
      "transcribeAudio", "chatCompletion", "planAction",
      "generateDocument", "editDocument", "generateMusic", "generateVideo"
    ]);
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
  async generateDocument(opts = {}) {
    return this._post("/docs/generate", opts);
  }
  async editDocument(opts = {}) {
    return this._post("/docs/edit", opts);
  }
  async generateMusic(opts = {}) {
    return this._post("/audio/generate-music", opts);
  }
  async generateVideo(opts = {}) {
    return this._post("/video/generate", opts);
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
  generateDocument(...args) { return this._run("generateDocument", args); }
  editDocument(...args) { return this._run("editDocument", args); }
  generateMusic(...args) { return this._run("generateMusic", args); }
  generateVideo(...args) { return this._run("generateVideo", args); }
}
