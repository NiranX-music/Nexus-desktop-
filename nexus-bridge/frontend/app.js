/**
 * Nexus Remote Agent — Client PWA Application
 * Cross-device control dashboard connecting Cloudflare D1/R2 and Modal Labs GPU Core.
 */

import {
  GeminiAdapter,
  GroqAdapter,
  OpenAICompatibleAdapter,
  EdgeAdapter,
  ModalAdapter,
  FallbackChain,
  normalizePlan,
  ENGINE_FOR_ACTION,
  GLOBAL_GEMINI_API_KEY
} from "./ai/providers.js";

// -----------------------------------------------------------------------------
// 1. Configuration & App State
// -----------------------------------------------------------------------------
const CONFIG = {
  apiUrl: localStorage.getItem("nexus_api_url") || "/api",
  modalUrl: localStorage.getItem("nexus_modal_url") || "https://barhateniranjan725--nexus-ai-core-nexusaicore-fastapi-app.modal.run",
  authToken: localStorage.getItem("nexus_auth_token") || "",
  pollInterval: parseInt(localStorage.getItem("nexus_poll_interval") || "2500", 10),
};

const DEFAULT_MODELS = {
  gemini: { model: "gemini-3.8-flash", sttModel: "gemini-3.5-transcribe" },
  groq: { model: "llama-3.3-70b-versatile", sttModel: "whisper-large-v3-turbo", baseUrl: "https://api.groq.com/openai/v1" },
  openai: { model: "gpt-4o-mini", sttModel: "whisper-1", baseUrl: "https://api.openai.com/v1" },
  custom: { model: "llama3.1", sttModel: "whisper-1", baseUrl: "http://localhost:11434/v1" },
  edge: { model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", sttModel: "@cf/openai/whisper-large-v3-turbo" },
};

let DEV_CONFIG = {
  enabled: false,
  provider: "edge",
  apiKey: "",
  baseUrl: "",
  model: "",
  sttModel: "",
  engines: {
    shell: true,
    ui: false,
    browser: false,
    android: false,
  },
};

try {
  const savedDev = localStorage.getItem("nexus_dev_settings");
  if (savedDev) {
    DEV_CONFIG = { ...DEV_CONFIG, ...JSON.parse(savedDev) };
  }
} catch {}

const state = {
  activeTarget: "CLOUD",            // 'CLOUD' | 'DESKTOP' | 'MOBILE' | 'ALL'
  activeCommandType: "VOICE_PROMPT", // 'VOICE_PROMPT' | 'TERMINAL_EXEC' | 'DESKTOP_GUI' | 'MOBILE_ACTION'
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  audioContext: null,
  analyser: null,
  animFrameId: null,
  recordStartTime: 0,
  recordTimerInterval: null,
  pollingTimer: null,
  tasks: [],
  devices: [],
  expandedTaskId: null,
};

// -----------------------------------------------------------------------------
// 2. Initialization & Service Worker
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();

  registerServiceWorker();
  setupEventListeners();
  loadConfigToModal();
  startLivePolling();
});

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[PWA] Service Worker registered:", reg.scope))
      .catch((err) => console.warn("[PWA] SW registration failed:", err));
  }
}

// -----------------------------------------------------------------------------
// 3. UI Toast Notifications
// -----------------------------------------------------------------------------
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast-msg flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium shadow-xl pointer-events-auto backdrop-blur-md ${
    type === "success"
      ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
      : type === "error"
      ? "bg-red-950/90 border-red-500/50 text-red-200"
      : "bg-slate-900/90 border-slate-700 text-slate-200"
  }`;

  const iconName = type === "success" ? "check-circle-2" : type === "error" ? "alert-circle" : "info";
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i><span>${message}</span>`;
  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(30px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// -----------------------------------------------------------------------------
// 3b. Live Execution Terminal Window Logger
// -----------------------------------------------------------------------------
function logToTerminal(text, type = "info") {
  const terminal = document.getElementById("liveTerminalOutput");
  if (!terminal) return;
  const time = new Date().toLocaleTimeString();
  const line = document.createElement("div");
  const color = type === "error" ? "text-rose-400" : type === "success" ? "text-emerald-400" : type === "cmd" ? "text-cyan-400" : "text-slate-300";
  line.className = `${color} leading-relaxed`;
  line.innerHTML = `<span class="text-slate-600 font-mono">[${time}]</span> ${escapeHtml(text)}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// -----------------------------------------------------------------------------
// 4. Edge API Client (with Bearer Token Auth)
// -----------------------------------------------------------------------------
async function fetchEdgeApi(endpoint, options = {}) {
  const base = CONFIG.apiUrl.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (CONFIG.authToken) {
    headers["Authorization"] = `Bearer ${CONFIG.authToken}`;
    headers["X-Nexus-Key"] = CONFIG.authToken;
  }

  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const errorText = await resp.text();
    let msg = `HTTP ${resp.status}`;
    try {
      const parsed = JSON.parse(errorText);
      msg = parsed.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return resp.json();
}

/**
 * Submits a new multi-device task to Cloudflare D1
 */
async function submitTask(targetDevice, commandType, promptRaw, dispatchModal = false, mediaUrl = null, actionPlan = null) {
  const body = {
    source_device: "WEB",
    target_device: targetDevice,
    command_type: commandType,
    prompt_raw: promptRaw,
    media_r2_url: mediaUrl,
    dispatch_modal: dispatchModal,
  };
  if (actionPlan) {
    body.action_plan = actionPlan;
  }
  return fetchEdgeApi("/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// -----------------------------------------------------------------------------
// 5. Polling & Device Fleet Status
// -----------------------------------------------------------------------------
async function pollFleetAndTasks() {
  try {
    // 1. Fetch Registered Devices
    const devData = await fetchEdgeApi("/devices").catch(() => null);
    if (devData && devData.devices) {
      state.devices = devData.devices;
      updateDevicesUI(devData.devices);
    }

    // 2. Fetch Tasks Stream
    const tasksData = await fetchEdgeApi("/tasks?limit=40").catch(() => null);
    if (tasksData && tasksData.tasks) {
      const prevMap = new Map((state.tasks || []).map(t => [t.id, t.status]));
      state.tasks = tasksData.tasks;
      renderTasksList();

      // Stream new completions/failures into live execution terminal
      for (const t of state.tasks) {
        const prevStatus = prevMap.get(t.id);
        if (prevStatus && prevStatus !== t.status) {
          const summary = t.result_output || t.execution_log || `Task status updated to ${t.status}`;
          logToTerminal(`[${t.target_device}] Task ${t.id.slice(0, 8)}: ${t.status} - ${typeof summary === "object" ? JSON.stringify(summary) : summary}`, t.status === "COMPLETED" ? "success" : t.status === "FAILED" ? "error" : "info");
        }
      }
    }
  } catch (err) {
    console.debug("Sync poll error:", err.message);
  }
}

function startLivePolling() {
  if (state.pollingTimer) clearInterval(state.pollingTimer);
  pollFleetAndTasks();
  state.pollingTimer = setInterval(pollFleetAndTasks, CONFIG.pollInterval);
}

function updateDevicesUI(devices) {
  const desktop = devices.find((d) => d.device_type === "DESKTOP");
  const mobile = devices.find((d) => d.device_type === "MOBILE");

  // Desktop indicator
  const dDot = document.getElementById("desktopDot");
  const dText = document.getElementById("desktopText");
  const dBadge = document.getElementById("desktopDeviceBadge");
  if (desktop && desktop.is_online) {
    dDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
    dText.textContent = "PC: Online";
    dText.className = "text-emerald-400 font-medium hidden md:inline";
    dBadge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[11px]";
  } else {
    dDot.className = "w-2 h-2 rounded-full bg-slate-600";
    dText.textContent = "PC: Offline";
    dText.className = "text-slate-400 font-medium hidden md:inline";
    dBadge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px]";
  }

  // Mobile indicator
  const mDot = document.getElementById("mobileDot");
  const mText = document.getElementById("mobileBatteryText");
  const mBadge = document.getElementById("mobileDeviceBadge");
  if (mobile && mobile.is_online) {
    mDot.className = "w-2 h-2 rounded-full bg-cyan-400 animate-pulse";
    mText.textContent = `Phone: ${mobile.battery_level}%`;
    mText.className = "text-cyan-400 font-medium hidden md:inline";
    mBadge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-[11px]";
  } else {
    mDot.className = "w-2 h-2 rounded-full bg-slate-600";
    mText.textContent = "Phone: Offline";
    mText.className = "text-slate-400 font-medium hidden md:inline";
    mBadge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px]";
  }
}

// -----------------------------------------------------------------------------
// 6. Task Stream Rendering
// -----------------------------------------------------------------------------
function renderTasksList() {
  const container = document.getElementById("tasksListContainer");
  const counter = document.getElementById("tasksCounter");
  counter.textContent = state.tasks.length;

  if (state.tasks.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500 rounded-xl bg-slate-900/40 border border-slate-800">
        <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        <p class="text-xs sm:text-sm">No tasks in D1 queue. Select target and dispatch above.</p>
      </div>`;
    refreshIcons();
    return;
  }

  const badges = {
    QUEUED: { bg: "bg-amber-500/10 border-amber-500/30 text-amber-400", pulse: "bg-amber-400", label: "QUEUED" },
    PLANNING_AI: { bg: "bg-purple-500/10 border-purple-500/30 text-purple-400", pulse: "bg-purple-400 animate-pulse", label: "MODAL GPU" },
    DISPATCHED: { bg: "bg-blue-500/10 border-blue-500/30 text-blue-400", pulse: "bg-blue-400 animate-pulse", label: "DISPATCHED" },
    COMPLETED: { bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", pulse: "bg-emerald-400", label: "COMPLETED" },
    FAILED: { bg: "bg-red-500/10 border-red-500/30 text-red-400", pulse: "bg-red-400", label: "FAILED" },
  };

  const html = state.tasks.map((task) => {
    const isExpanded = state.expandedTaskId === task.id;
    const badge = badges[task.status] || badges.QUEUED;
    const timeFormatted = new Date(task.created_at || Date.now()).toLocaleTimeString();

    const targetIcon = task.target_device === "MOBILE" ? "smartphone" : task.target_device === "ALL" ? "network" : "monitor";
    const targetColor = task.target_device === "MOBILE" ? "text-cyan-400 border-cyan-500/30 bg-cyan-950/30" : "text-emerald-400 border-emerald-500/30 bg-emerald-950/30";

    // Format logs
    let outputPretty = "Awaiting execution...";
    if (task.execution_log) {
      try {
        outputPretty = JSON.stringify(JSON.parse(task.execution_log), null, 2);
      } catch {
        outputPretty = task.execution_log;
      }
    }

    return `
      <div class="rounded-xl bg-nexus-surface/70 border border-nexus-border hover:border-slate-700 transition-all p-3.5 space-y-2.5">
        <!-- Card Header -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}">
              <span class="w-1.5 h-1.5 rounded-full ${badge.pulse}"></span>
              ${badge.label}
            </span>

            <span class="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${targetColor}">
              <i data-lucide="${targetIcon}" class="w-3 h-3"></i>
              ${task.target_device}
            </span>

            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
              ${task.command_type}
            </span>

            <span class="text-[11px] text-slate-500 font-mono">${timeFormatted}</span>
          </div>

          <button class="accordion-toggle text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors ${isExpanded ? 'expanded' : ''}" onclick="toggleTaskExpand('${task.id}')">
            <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200"></i>
          </button>
        </div>

        <!-- Prompt Text -->
        <div class="font-mono text-xs text-slate-200 bg-slate-950/60 p-2 rounded border border-slate-900 truncate">
          ${escapeHtml(task.prompt_raw || "[Voice payload]")}
        </div>

        <!-- Optional Attached Screenshot or Media from R2 -->
        ${task.media_r2_url ? `
          <div class="flex items-center gap-2 text-xs pt-1">
            <i data-lucide="image" class="w-3.5 h-3.5 text-cyan-400"></i>
            <a href="${task.media_r2_url}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline text-[11px] truncate">
              View Attached R2 Media (${task.media_r2_url.split('/').pop()})
            </a>
          </div>
        ` : ''}

        <!-- Expandable Execution Details -->
        ${isExpanded ? `
          <div class="pt-2 border-t border-slate-800/80 space-y-2">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-400 font-medium">Task ID: <code class="text-slate-300">${task.id}</code></span>
              <button class="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1" onclick="copyToClipboard('${task.id}')">
                <i data-lucide="copy" class="w-3 h-3"></i> Copy Output
              </button>
            </div>
            ${task.action_plan ? `
              <div class="text-[10px] font-mono text-purple-300 bg-purple-950/30 p-2 rounded border border-purple-800/40">
                <strong>Modal AI Plan:</strong> ${escapeHtml(task.action_plan)}
              </div>
            ` : ''}
            <pre id="output-${task.id}" class="text-[11px] font-mono bg-slate-950 border border-slate-800 p-2.5 rounded text-emerald-400 max-h-52 overflow-x-auto whitespace-pre-wrap">${escapeHtml(outputPretty)}</pre>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");

  container.innerHTML = html;
  refreshIcons();
}

window.toggleTaskExpand = function (id) {
  state.expandedTaskId = state.expandedTaskId === id ? null : id;
  renderTasksList();
};

window.copyToClipboard = function (id) {
  const el = document.getElementById(`output-${id}`);
  if (el) {
    navigator.clipboard.writeText(el.innerText);
    showToast("Output copied to clipboard", "success");
  }
};

function escapeHtml(str) {
  if (typeof str !== "string") str = JSON.stringify(str);
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// -----------------------------------------------------------------------------
// 7. Web Audio Recording & Modal GPU Whisper Transcription
// -----------------------------------------------------------------------------
async function startAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    state.isRecording = true;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
    const source = state.audioContext.createMediaStreamSource(stream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 64;
    source.connect(state.analyser);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    state.mediaRecorder = new MediaRecorder(stream, { mimeType });
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };

    state.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (state.audioContext) state.audioContext.close();
      cancelAnimationFrame(state.animFrameId);
      clearInterval(state.recordTimerInterval);

      if (state.audioChunks.length > 0) {
        const audioBlob = new Blob(state.audioChunks, { type: "audio/webm" });
        await handleAudioTranscription(audioBlob);
      }
    };

    state.mediaRecorder.start(250);
    updateRecordingUI(true);
    startVisualizer();
  } catch (err) {
    console.error("Mic error:", err);
    showToast(`Microphone error: ${err.message}`, "error");
    updateRecordingUI(false);
  }
}

function stopAudioRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.isRecording = false;
    state.mediaRecorder.stop();
    updateRecordingUI(false);
  }
}

function updateRecordingUI(isRecording) {
  const wave = document.getElementById("recordingWaveContainer");
  const micBtn = document.getElementById("micBtn");
  const micLabel = document.getElementById("micBtnLabel");
  const timer = document.getElementById("recordingTimer");

  if (isRecording) {
    wave.classList.remove("hidden");
    wave.classList.add("flex");
    micBtn.classList.add("border-red-500", "bg-red-950/40", "text-red-400");
    micLabel.textContent = "Stop Recording";

    state.recordStartTime = Date.now();
    state.recordTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.recordStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      timer.textContent = `${m}:${s}`;
    }, 500);
  } else {
    wave.classList.add("hidden");
    wave.classList.remove("flex");
    micBtn.classList.remove("border-red-500", "bg-red-950/40", "text-red-400");
    micLabel.textContent = "Hold to Talk";
    clearInterval(state.recordTimerInterval);
  }
}

function startVisualizer() {
  const canvas = document.getElementById("audioVisualizer");
  const ctx = canvas.getContext("2d");
  const count = state.analyser.frequencyBinCount;
  const data = new Uint8Array(count);

  function draw() {
    state.animFrameId = requestAnimationFrame(draw);
    state.analyser.getByteFrequencyData(data);
    ctx.fillStyle = "rgba(15, 23, 42, 0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / count) * 2;
    let x = 0;
    for (let i = 0; i < count; i++) {
      const h = (data[i] / 255) * canvas.height;
      ctx.fillStyle = "#34d399";
      ctx.fillRect(x, canvas.height - h, barWidth - 1, h);
      x += barWidth;
    }
  }
  draw();
}

function buildClientAI() {
  const edge = new EdgeAdapter({ apiUrl: CONFIG.apiUrl, authToken: CONFIG.authToken });
  if (!DEV_CONFIG.enabled || DEV_CONFIG.provider === "edge") {
    return edge;
  }

  const p = (DEV_CONFIG.provider || "edge").toLowerCase();
  const def = DEFAULT_MODELS[p] || DEFAULT_MODELS.custom;
  let customAdapter = null;

  try {
    if (p === "gemini") {
      customAdapter = new GeminiAdapter({
        apiKey: DEV_CONFIG.apiKey || GLOBAL_GEMINI_API_KEY,
        model: DEV_CONFIG.model || def.model,
        fallbackModel: "gemini-3.5-flash",
        transcribeModel: DEV_CONFIG.sttModel || def.sttModel,
      });
    } else if (p === "groq") {
      if (DEV_CONFIG.apiKey) {
        customAdapter = new GroqAdapter({
          apiKey: DEV_CONFIG.apiKey,
          model: DEV_CONFIG.model || def.model,
          sttModel: DEV_CONFIG.sttModel || def.sttModel,
        });
      }
    } else if (p === "openai") {
      if (DEV_CONFIG.apiKey) {
        customAdapter = new OpenAICompatibleAdapter({
          name: "openai",
          apiKey: DEV_CONFIG.apiKey,
          baseUrl: DEV_CONFIG.baseUrl || def.baseUrl,
          model: DEV_CONFIG.model || def.model,
          sttModel: DEV_CONFIG.sttModel || def.sttModel,
        });
      }
    } else if (p === "custom") {
      const base = DEV_CONFIG.baseUrl || def.baseUrl;
      customAdapter = new OpenAICompatibleAdapter({
        name: "custom",
        apiKey: DEV_CONFIG.apiKey || "",
        baseUrl: base,
        model: DEV_CONFIG.model || def.model,
        sttModel: DEV_CONFIG.sttModel || def.sttModel,
      });
    }
  } catch (err) {
    console.warn("Failed to initialize user provider adapter:", err);
  }

  if (customAdapter) {
    return new FallbackChain([customAdapter, edge]);
  }
  return edge;
}

function getEnabledEngines() {
  const eng = [];
  if (DEV_CONFIG.engines?.shell) eng.push("shell");
  if (DEV_CONFIG.engines?.ui) eng.push("ui");
  if (DEV_CONFIG.engines?.browser) eng.push("browser");
  if (DEV_CONFIG.engines?.android) eng.push("android");
  return eng;
}

async function handleAudioTranscription(audioBlob) {
  showToast("Transcribing audio...", "info");

  // 1. Try Client / Developer Mode AI if configured
  if (DEV_CONFIG.enabled && DEV_CONFIG.provider !== "edge") {
    try {
      const client = buildClientAI();
      const res = await client.transcribeAudio(audioBlob, { mimeType: audioBlob.type || "audio/webm" });
      if (res && res.text) {
        document.getElementById("commandInput").value = res.text;
        showToast(`Transcribed via ${res.provider || client.name}: "${res.text}"`, "success");
        return;
      }
    } catch (e) {
      console.warn("Client transcription failed, falling back to edge:", e);
    }
  }

  // 2. Try Edge API (Workers AI Whisper Large v3 Turbo, free tier)
  try {
    const edge = new EdgeAdapter({ apiUrl: CONFIG.apiUrl, authToken: CONFIG.authToken });
    const res = await edge.transcribeAudio(audioBlob, { mimeType: audioBlob.type || "audio/webm" });
    if (res && res.text) {
      document.getElementById("commandInput").value = res.text;
      showToast(`Transcribed via Workers AI: "${res.text}"`, "success");
      return;
    }
  } catch (e) {
    console.warn("Workers AI transcription failed, trying Modal fallback:", e);
  }

  // 3. Fallback: Modal GPU (Whisper)
  const modalEndpoint = CONFIG.modalUrl.replace(/\/+$/, "");
  if (modalEndpoint) {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "command.webm");
      const resp = await fetch(`${modalEndpoint}/transcribe`, { method: "POST", body: formData });
      if (resp.ok) {
        const data = await resp.json();
        if (data.text) {
          document.getElementById("commandInput").value = data.text;
          showToast(`Transcribed on Modal: "${data.text}"`, "success");
          return;
        }
      }
    } catch (e) {
      console.warn("Modal transcription failed:", e);
    }
  }

  // 4. Fallback: Upload to R2 and populate
  try {
    const uploadRes = await fetch(`${CONFIG.apiUrl}/upload?filename=voice-${Date.now()}.webm`, {
      method: "POST",
      headers: {
        "Content-Type": "audio/webm",
        ...(CONFIG.authToken ? { "Authorization": `Bearer ${CONFIG.authToken}` } : {}),
      },
      body: audioBlob,
    });
    if (uploadRes.ok) {
      const r2Data = await uploadRes.json();
      document.getElementById("commandInput").value = `[Voice recorded: ${r2Data.url}]`;
      showToast("Voice clip uploaded to Cloudflare R2", "success");
      return;
    }
  } catch {}

  document.getElementById("commandInput").value = `[Voice recording: ${Math.round(audioBlob.size / 1024)} KB]`;
  showToast("Voice audio ready to dispatch", "success");
}

// -----------------------------------------------------------------------------
// 8. Event Listeners & UI Controls
// -----------------------------------------------------------------------------
function updateTargetModeBanner() {
  const banner = document.getElementById("targetModeBanner");
  if (!banner) return;
  if (state.activeTarget === "CLOUD") {
    banner.className = "text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-2 rounded-xl flex items-center justify-between";
    banner.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span><strong>Cloud Autonomous Mode:</strong> Commands run 100% on Cloudflare Edge via NiranX master account. Zero local terminal scripts required.</span>
      </div>
      <span class="text-[10px] text-slate-400 font-sans hidden sm:inline">User: barhateniranjan725@gmail.com</span>
    `;
  } else if (state.activeTarget === "DESKTOP") {
    banner.className = "text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-3 py-2 rounded-xl flex items-center justify-between";
    banner.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
        <span><strong>Desktop Companion Mode:</strong> Dispatches to local PC daemon if active (optional companion).</span>
      </div>
      <span class="text-[10px] text-slate-400 font-sans hidden sm:inline">Target: DESKTOP</span>
    `;
  } else if (state.activeTarget === "MOBILE") {
    banner.className = "text-[11px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-500/30 px-3 py-2 rounded-xl flex items-center justify-between";
    banner.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
        <span><strong>Mobile Companion Mode:</strong> Dispatches to Termux / Android device bridge.</span>
      </div>
      <span class="text-[10px] text-slate-400 font-sans hidden sm:inline">Target: MOBILE</span>
    `;
  } else {
    banner.className = "text-[11px] font-mono text-purple-400 bg-purple-950/40 border border-purple-500/30 px-3 py-2 rounded-xl flex items-center justify-between";
    banner.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-purple-400"></span>
        <span><strong>Broadcast Mode:</strong> Dispatches across Cloud backend and all connected devices.</span>
      </div>
      <span class="text-[10px] text-slate-400 font-sans hidden sm:inline">Target: ALL</span>
    `;
  }
}

function setupEventListeners() {
  initStudio();
  // Target Device Chips
  document.querySelectorAll(".target-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".target-chip").forEach((b) => b.classList.remove("active", "text-emerald-400"));
      btn.classList.add("active");
      state.activeTarget = btn.dataset.target;
      updateTargetModeBanner();
    });
  });

  // Command Mode Tabs
  document.querySelectorAll(".cmd-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cmd-tab-btn").forEach((b) => b.classList.remove("active", "text-emerald-400"));
      btn.classList.add("active");
      state.activeCommandType = btn.dataset.type;
    });
  });

  // Preset Chips
  document.querySelectorAll(".quick-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.getElementById("commandInput").value = chip.dataset.cmd;
      if (chip.dataset.target) {
        state.activeTarget = chip.dataset.target;
        document.querySelectorAll(".target-chip").forEach((b) => {
          b.classList.toggle("active", b.dataset.target === chip.dataset.target);
        });
        updateTargetModeBanner();
      }
      if (chip.dataset.type) {
        state.activeCommandType = chip.dataset.type;
        document.querySelectorAll(".cmd-tab-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.type === chip.dataset.type);
        });
      }
      document.getElementById("commandInput").focus();
    });
  });

  // Microphone: Click or Hold-to-Talk
  const micBtn = document.getElementById("micBtn");
  let holdTimeout = null;
  let isHoldActive = false;

  if (micBtn) {
    micBtn.addEventListener("pointerdown", () => {
      isHoldActive = false;
      holdTimeout = setTimeout(() => {
        isHoldActive = true;
        if (!state.isRecording) {
          startAudioRecording();
          logToTerminal("Hold-to-Talk active: recording voice...", "cmd");
        }
      }, 250);
    });

    const stopHold = () => {
      if (holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }
      if (isHoldActive) {
        isHoldActive = false;
        if (state.isRecording) {
          stopAudioRecording();
          logToTerminal("Hold-to-Talk released: transcribing audio...", "cmd");
        }
      }
    };

    micBtn.addEventListener("pointerup", stopHold);
    micBtn.addEventListener("pointerleave", stopHold);
    micBtn.addEventListener("pointercancel", stopHold);

    micBtn.addEventListener("click", () => {
      if (!isHoldActive) {
        if (state.isRecording) {
          stopAudioRecording();
          logToTerminal("Voice recording stopped.", "cmd");
        } else {
          startAudioRecording();
          logToTerminal("Voice recording started (Click mode).", "cmd");
        }
      }
    });
  }

  document.getElementById("cancelRecordBtn")?.addEventListener("click", () => {
    state.audioChunks = [];
    stopAudioRecording();
    logToTerminal("Voice recording cancelled.", "info");
  });

  // Clear Terminal Button
  document.getElementById("clearTerminalBtn")?.addEventListener("click", () => {
    const term = document.getElementById("liveTerminalOutput");
    if (term) term.innerHTML = `<div class="text-slate-500">[System] Terminal output cleared.</div>`;
  });

  // Dispatch Button
  document.getElementById("sendTaskBtn").addEventListener("click", handleDispatchTask);

  // Ctrl + Enter shortcut
  document.getElementById("commandInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleDispatchTask();
    }
  });

  // Refresh
  document.getElementById("manualRefreshBtn").addEventListener("click", () => {
    pollFleetAndTasks();
    showToast("Refreshed from D1", "info");
  });

  // Settings Modal
  const modal = document.getElementById("settingsModal");
  document.getElementById("openSettingsBtn").addEventListener("click", () => {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  });
  document.getElementById("closeSettingsBtn").addEventListener("click", () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  });
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  document.getElementById("resetSettingsBtn").addEventListener("click", resetSettings);

  // Master Account Profile Modal
  const accountModal = document.getElementById("accountModal");
  const openAccountBtn = document.getElementById("userAccountPill");
  const closeAccountBtn = document.getElementById("closeAccountBtn");
  const dismissAccountBtn = document.getElementById("dismissAccountBtn");

  if (openAccountBtn && accountModal) {
    openAccountBtn.addEventListener("click", () => {
      accountModal.classList.remove("hidden");
      accountModal.classList.add("flex");
    });
  }
  if (closeAccountBtn && accountModal) {
    closeAccountBtn.addEventListener("click", () => {
      accountModal.classList.add("hidden");
      accountModal.classList.remove("flex");
    });
  }
  if (dismissAccountBtn && accountModal) {
    dismissAccountBtn.addEventListener("click", () => {
      accountModal.classList.add("hidden");
      accountModal.classList.remove("flex");
    });
  }

  // Developer Mode Event Listeners
  const devToggle = document.getElementById("devModeToggle");
  if (devToggle) devToggle.addEventListener("change", updateDevModeUI);

  const devProvider = document.getElementById("devProviderSelect");
  if (devProvider) devProvider.addEventListener("change", updateDevModeUI);

  const toggleKeyBtn = document.getElementById("toggleApiKeyVisibility");
  if (toggleKeyBtn) {
    toggleKeyBtn.addEventListener("click", () => {
      const input = document.getElementById("devApiKey");
      const icon = document.getElementById("toggleApiKeyIcon");
      if (input.type === "password") {
        input.type = "text";
        if (icon) icon.setAttribute("data-lucide", "eye-off");
      } else {
        input.type = "password";
        if (icon) icon.setAttribute("data-lucide", "eye");
      }
      refreshIcons();
    });
  }
}

async function handleDispatchTask() {
  const input = document.getElementById("commandInput");
  const sendBtn = document.getElementById("sendTaskBtn");
  const modalToggle = document.getElementById("dispatchModalToggle");
  const promptText = input.value.trim();

  if (!promptText) {
    showToast("Please enter a command or record audio", "error");
    return;
  }

  sendBtn.disabled = true;
  sendBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Dispatching...</span>`;
  refreshIcons();

  try {
    let clientPlan = null;
    const shouldModal = modalToggle ? modalToggle.checked : false;

    // In Developer Mode or for voice prompt, generate client plan if user configured custom provider
    if (DEV_CONFIG.enabled && DEV_CONFIG.provider !== "edge") {
      try {
        const client = buildClientAI();
        showToast(`Planning action with ${client.name}...`, "info");
        const planned = await client.planAction(promptText, {
          target_device: state.activeTarget,
          engines: getEnabledEngines(),
        });
        if (planned && Array.isArray(planned.steps) && planned.steps.length > 0) {
          clientPlan = planned;
          showToast(`Plan ready: ${planned.summary || planned.steps.length + ' steps'} (${planned.provider || client.name})`, "success");
        }
      } catch (err) {
        console.warn("Client plan failed, falling back to edge/server:", err);
        showToast(`Planner fallback: ${err.message}`, "info");
      }
    }

    const res = await submitTask(
      state.activeTarget,
      state.activeCommandType,
      promptText,
      clientPlan ? false : shouldModal,
      null,
      clientPlan
    );

    if (res.ok) {
      const tgt = res.task?.target_device || state.activeTarget;
      const tId = res.task?.id || res.task_id || "new";
      const isCloudEdge = res.execution === "CLOUD_EDGE" || res.status === "COMPLETED" || tgt === "CLOUD";

      if (isCloudEdge) {
        const out = res.result || res.task?.result_output || "Task completed on Cloudflare edge.";
        showToast("Cloud Task Completed (Account: NiranX)", "success");
        logToTerminal(`[Cloud Edge] COMPLETED (ID: ${tId})`, "success");
        logToTerminal(`Output: ${typeof out === "object" ? JSON.stringify(out, null, 2) : out}`, "info");
      } else {
        showToast(`Task assigned to ${tgt}`, "success");
        logToTerminal(`[Dispatch] Task queued for ${tgt} (ID: ${tId}): "${promptText}"`, "cmd");
      }

      if (clientPlan) {
        logToTerminal(`[Plan: ${clientPlan.provider || 'AI'}] ${clientPlan.summary || clientPlan.steps.length + ' steps'}`, "info");
      }
      input.value = "";
      pollFleetAndTasks();
    } else {
      showToast(res.error || "Failed to dispatch task", "error");
      logToTerminal(`[Dispatch Error] ${res.error || "Failed to dispatch task"}`, "error");
    }
  } catch (err) {
    showToast(err.message || "Network error", "error");
    logToTerminal(`[Network Error] ${err.message}`, "error");
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Dispatch Task</span>`;
    refreshIcons();
  }
}

// -----------------------------------------------------------------------------
// 9. Settings Storage
// -----------------------------------------------------------------------------
function updateDevModeUI() {
  const isDev = document.getElementById("devModeToggle") ? document.getElementById("devModeToggle").checked : false;
  const content = document.getElementById("devModeContent");
  const badge = document.getElementById("devModeStatusBadge");
  const provider = document.getElementById("devProviderSelect") ? document.getElementById("devProviderSelect").value : "edge";
  const apiKeyRow = document.getElementById("devApiKeyRow");
  const baseUrlRow = document.getElementById("devBaseUrlRow");

  if (badge) {
    if (isDev) {
      badge.textContent = "DEV ACTIVE";
      badge.className = "text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
    } else {
      badge.textContent = "STANDARD";
      badge.className = "text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-slate-800 text-slate-400 border border-slate-700";
    }
  }

  if (content) {
    if (isDev) content.classList.remove("hidden");
    else content.classList.add("hidden");
  }

  if (baseUrlRow) {
    if (provider === "custom" || provider === "openai") baseUrlRow.classList.remove("hidden");
    else baseUrlRow.classList.add("hidden");
  }

  if (apiKeyRow) {
    if (provider === "edge") {
      apiKeyRow.classList.add("opacity-40", "pointer-events-none");
      const keyInput = document.getElementById("devApiKey");
      if (keyInput) keyInput.placeholder = "(Built-in Cloudflare Zero-Card Free Tier)";
    } else {
      apiKeyRow.classList.remove("opacity-40", "pointer-events-none");
      const keyInput = document.getElementById("devApiKey");
      if (keyInput) keyInput.placeholder = provider === "gemini" ? "AIzaSy..." : "sk-...";
    }
  }
}

function loadConfigToModal() {
  document.getElementById("cfgApiUrl").value = CONFIG.apiUrl;
  document.getElementById("cfgModalUrl").value = CONFIG.modalUrl;
  document.getElementById("cfgAuthSecret").value = CONFIG.authToken;
  document.getElementById("cfgPollInterval").value = CONFIG.pollInterval;

  // Dev settings
  if (document.getElementById("devModeToggle")) {
    document.getElementById("devModeToggle").checked = Boolean(DEV_CONFIG.enabled);
  }
  if (document.getElementById("devProviderSelect")) {
    document.getElementById("devProviderSelect").value = DEV_CONFIG.provider || "edge";
  }
  if (document.getElementById("devApiKey")) {
    document.getElementById("devApiKey").value = DEV_CONFIG.apiKey || "";
  }
  if (document.getElementById("devBaseUrl")) {
    document.getElementById("devBaseUrl").value = DEV_CONFIG.baseUrl || "";
  }
  if (document.getElementById("devModelName")) {
    document.getElementById("devModelName").value = DEV_CONFIG.model || "";
  }
  if (document.getElementById("devSttModelName")) {
    document.getElementById("devSttModelName").value = DEV_CONFIG.sttModel || "";
  }
  if (document.getElementById("devEngineShell")) {
    document.getElementById("devEngineShell").checked = DEV_CONFIG.engines?.shell !== false;
  }
  if (document.getElementById("devEngineUI")) {
    document.getElementById("devEngineUI").checked = Boolean(DEV_CONFIG.engines?.ui);
  }
  if (document.getElementById("devEngineBrowser")) {
    document.getElementById("devEngineBrowser").checked = Boolean(DEV_CONFIG.engines?.browser);
  }
  if (document.getElementById("devEngineAndroid")) {
    document.getElementById("devEngineAndroid").checked = Boolean(DEV_CONFIG.engines?.android);
  }

  updateDevModeUI();
}

function saveSettings() {
  CONFIG.apiUrl = document.getElementById("cfgApiUrl").value.trim() || "/api";
  CONFIG.modalUrl = document.getElementById("cfgModalUrl").value.trim();
  CONFIG.authToken = document.getElementById("cfgAuthSecret").value.trim();
  CONFIG.pollInterval = parseInt(document.getElementById("cfgPollInterval").value, 10) || 2500;

  localStorage.setItem("nexus_api_url", CONFIG.apiUrl);
  localStorage.setItem("nexus_modal_url", CONFIG.modalUrl);
  localStorage.setItem("nexus_auth_token", CONFIG.authToken);
  localStorage.setItem("nexus_poll_interval", CONFIG.pollInterval.toString());

  // Save Developer Mode settings
  DEV_CONFIG.enabled = document.getElementById("devModeToggle")?.checked || false;
  DEV_CONFIG.provider = document.getElementById("devProviderSelect")?.value || "edge";
  DEV_CONFIG.apiKey = document.getElementById("devApiKey")?.value.trim() || "";
  DEV_CONFIG.baseUrl = document.getElementById("devBaseUrl")?.value.trim() || "";
  DEV_CONFIG.model = document.getElementById("devModelName")?.value.trim() || "";
  DEV_CONFIG.sttModel = document.getElementById("devSttModelName")?.value.trim() || "";
  DEV_CONFIG.engines = {
    shell: document.getElementById("devEngineShell")?.checked ?? true,
    ui: document.getElementById("devEngineUI")?.checked ?? false,
    browser: document.getElementById("devEngineBrowser")?.checked ?? false,
    android: document.getElementById("devEngineAndroid")?.checked ?? false,
  };

  localStorage.setItem("nexus_dev_settings", JSON.stringify(DEV_CONFIG));

  document.getElementById("settingsModal").classList.add("hidden");
  document.getElementById("settingsModal").classList.remove("flex");

  showToast("Settings & Developer Mode saved", "success");
  startLivePolling();
}

function resetSettings() {
  localStorage.removeItem("nexus_api_url");
  localStorage.removeItem("nexus_modal_url");
  localStorage.removeItem("nexus_auth_token");
  localStorage.removeItem("nexus_poll_interval");
  localStorage.removeItem("nexus_dev_settings");

  CONFIG.apiUrl = "/api";
  CONFIG.modalUrl = "https://barhateniranjan725--nexus-ai-core-nexusaicore-fastapi-app.modal.run";
  CONFIG.authToken = "";
  CONFIG.pollInterval = 2500;

  DEV_CONFIG = {
    enabled: false,
    provider: "edge",
    apiKey: "",
    baseUrl: "",
    model: "",
    sttModel: "",
    engines: { shell: true, ui: false, browser: false, android: false },
  };

  loadConfigToModal();
  showToast("Settings reset", "info");
}


// =============================================================================
// 12. NEXUS CREATOR STUDIO: DOCUMENTS, SPREADSHEETS, PRESENTATIONS, AUDIO & VIDEO
// =============================================================================

function buildStudioClient() {
  const customKey = DEV_CONFIG.apiKey || GLOBAL_GEMINI_API_KEY;
  try {
    return new GeminiAdapter({
      apiKey: customKey,
      model: DEV_CONFIG.model || "gemini-3.8-flash",
      fallbackModel: "gemini-3.5-flash",
    });
  } catch {
    return new EdgeAdapter({ apiUrl: CONFIG.apiUrl, authToken: CONFIG.authToken });
  }
}

let activeAudioSynthNodes = [];
let audioSynthContext = null;
let visualizerAnimFrame = null;
let isVideoPlaying = false;

function initStudio() {
  const studioModal = document.getElementById("studioModal");
  const openStudioBtn = document.getElementById("openStudioBtn");
  const closeStudioBtn = document.getElementById("closeStudioBtn");

  if (openStudioBtn && studioModal) {
    openStudioBtn.addEventListener("click", () => {
      studioModal.classList.remove("hidden");
      studioModal.classList.add("flex");
      refreshIcons();
    });
  }

  if (closeStudioBtn && studioModal) {
    closeStudioBtn.addEventListener("click", () => {
      studioModal.classList.add("hidden");
      studioModal.classList.remove("flex");
      stopMusicSynthesis();
      isVideoPlaying = false;
    });
  }

  // Studio Mode Tabs
  document.querySelectorAll(".studio-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".studio-tab-btn").forEach((b) => {
        b.classList.remove("active", "bg-slate-800", "text-white");
        b.classList.add("text-slate-400");
      });
      btn.classList.add("active", "bg-slate-800", "text-white");
      btn.classList.remove("text-slate-400");

      const tab = btn.dataset.tab;
      document.querySelectorAll(".studio-tab-pane").forEach((pane) => pane.classList.add("hidden"));
      if (tab === "docs") document.getElementById("studioTabDocs")?.classList.remove("hidden");
      if (tab === "sheets") document.getElementById("studioTabSheets")?.classList.remove("hidden");
      if (tab === "slides") document.getElementById("studioTabSlides")?.classList.remove("hidden");
      if (tab === "music") document.getElementById("studioTabMusic")?.classList.remove("hidden");
      if (tab === "video") document.getElementById("studioTabVideo")?.classList.remove("hidden");
      refreshIcons();
    });
  });

  initStudioDocs();
  initStudioSheets();
  initStudioSlides();
  initStudioMusic();
  initStudioVideo();
}

// -----------------------------------------------------------------------------
// Studio: Documents & PDFs
// -----------------------------------------------------------------------------
function initStudioDocs() {
  const genBtn = document.getElementById("generateDocBtn");
  const editBtn = document.getElementById("applyDocEditBtn");
  const dlPdfBtn = document.getElementById("downloadPdfBtn");
  const dlHtmlBtn = document.getElementById("downloadHtmlBtn");
  const copyMdBtn = document.getElementById("copyMdBtn");

  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const type = document.getElementById("docTypeSelect")?.value || "pdf";
      const title = document.getElementById("docTitleInput")?.value.trim() || `${type.toUpperCase()} Document`;
      const prompt = document.getElementById("docPromptInput")?.value.trim();

      if (!prompt) {
        showToast("Please provide document instructions or outline", "error");
        return;
      }

      genBtn.disabled = true;
      genBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Architecting with Gemini...</span>`;
      refreshIcons();

      try {
        const client = buildStudioClient();
        logToTerminal(`Generating ${type.toUpperCase()}: "${title}" with Gemini...`, "cmd");
        const doc = await client.generateDocument({ type, title, prompt });
        state.currentDoc = doc;

        document.getElementById("docPreviewTitle").textContent = doc.title || title;
        document.getElementById("docPaperView").innerHTML = doc.html || marked.parse(doc.markdown || "");
        document.getElementById("docPreviewContainer").classList.remove("hidden");

        showToast(`Document "${title}" generated!`, "success");
        logToTerminal(`Document generated successfully (${doc.type || type})`, "success");
      } catch (err) {
        showToast(`Generation failed: ${err.message}`, "error");
        logToTerminal(`Document error: ${err.message}`, "error");
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = `<i data-lucide="wand-2" class="w-3.5 h-3.5"></i><span>Generate Document</span>`;
        refreshIcons();
      }
    });
  }

  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      if (!state.currentDoc) return;
      const editInput = document.getElementById("docEditInput");
      const instructions = editInput?.value.trim();
      if (!instructions) return;

      editBtn.disabled = true;
      editBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i>`;

      try {
        const client = buildStudioClient();
        logToTerminal(`Refining document with Gemini: "${instructions}"...`, "cmd");
        const doc = await client.editDocument({
          type: state.currentDoc.type || "pdf",
          content: state.currentDoc.markdown || "",
          instructions,
          current_html: state.currentDoc.html || "",
          data: state.currentDoc.data || null,
        });

        state.currentDoc = { ...state.currentDoc, ...doc };
        document.getElementById("docPaperView").innerHTML = doc.html || marked.parse(doc.markdown || "");
        editInput.value = "";
        showToast("Document updated by Gemini!", "success");
      } catch (err) {
        showToast(`Edit failed: ${err.message}`, "error");
      } finally {
        editBtn.disabled = false;
        editBtn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Refine</span>`;
        refreshIcons();
      }
    });
  }

  if (dlPdfBtn) {
    dlPdfBtn.addEventListener("click", () => {
      if (!state.currentDoc) return;
      const docTitle = (state.currentDoc.title || "document").replace(/[^a-zA-Z0-9_-]/g, "_");
      
      const { jsPDF } = window.jspdf || {};
      const paper = document.getElementById("docPaperView");
      if (jsPDF && paper) {
        showToast("Compiling PDF vector document...", "info");
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        pdf.html(paper, {
          callback: (doc) => {
            doc.save(`${docTitle}.pdf`);
            showToast("PDF downloaded!", "success");
          },
          margin: [30, 30, 30, 30],
          autoPaging: "text",
          width: 535,
          windowWidth: 780,
        });
      } else {
        const w = window.open("", "_blank");
        w.document.write(`<!DOCTYPE html><html><head><title>${state.currentDoc.title}</title><style>body{font-family:sans-serif;padding:30px;}</style></head><body>${state.currentDoc.html || ""}</body></html>`);
        w.document.close();
        w.print();
      }
    });
  }

  if (dlHtmlBtn) {
    dlHtmlBtn.addEventListener("click", () => {
      if (!state.currentDoc) return;
      const blob = new Blob([state.currentDoc.html || ""], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(state.currentDoc.title || "document").replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
      a.click();
    });
  }

  if (copyMdBtn) {
    copyMdBtn.addEventListener("click", () => {
      if (!state.currentDoc?.markdown) return;
      navigator.clipboard.writeText(state.currentDoc.markdown);
      showToast("Markdown copied to clipboard!", "success");
    });
  }
}

// -----------------------------------------------------------------------------
// Studio: Spreadsheets
// -----------------------------------------------------------------------------
function initStudioSheets() {
  const genBtn = document.getElementById("generateSheetBtn");
  const editBtn = document.getElementById("applySheetEditBtn");
  const dlXlsxBtn = document.getElementById("downloadXlsxBtn");
  const dlCsvBtn = document.getElementById("downloadCsvBtn");

  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const template = document.getElementById("sheetTemplateSelect")?.value || "financial";
      const title = document.getElementById("sheetTitleInput")?.value.trim() || "Financial Spreadsheet";
      const prompt = document.getElementById("sheetPromptInput")?.value.trim();

      if (!prompt) {
        showToast("Please provide spreadsheet requirements or columns", "error");
        return;
      }

      genBtn.disabled = true;
      genBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Generating Sheet...</span>`;
      refreshIcons();

      try {
        const client = buildStudioClient();
        logToTerminal(`Generating Spreadsheet: "${title}" with Gemini...`, "cmd");
        const doc = await client.generateDocument({ type: "sheet", title, prompt, template });
        state.currentSheet = doc;

        renderSheetTable(doc.data?.columns || [], doc.data?.rows || []);
        document.getElementById("sheetPreviewTitle").textContent = doc.title || title;
        document.getElementById("sheetPreviewContainer").classList.remove("hidden");

        showToast(`Spreadsheet "${title}" generated!`, "success");
      } catch (err) {
        showToast(`Sheet generation failed: ${err.message}`, "error");
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = `<i data-lucide="table" class="w-3.5 h-3.5"></i><span>Generate Spreadsheet</span>`;
        refreshIcons();
      }
    });
  }

  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      if (!state.currentSheet) return;
      const editInput = document.getElementById("sheetEditInput");
      const instructions = editInput?.value.trim();
      if (!instructions) return;

      editBtn.disabled = true;
      try {
        const client = buildStudioClient();
        const doc = await client.editDocument({
          type: "sheet",
          content: JSON.stringify(state.currentSheet.data || {}),
          instructions,
          data: state.currentSheet.data || null,
        });
        state.currentSheet = { ...state.currentSheet, ...doc };
        renderSheetTable(doc.data?.columns || [], doc.data?.rows || []);
        editInput.value = "";
        showToast("Spreadsheet updated by Gemini!", "success");
      } catch (err) {
        showToast(`Edit failed: ${err.message}`, "error");
      } finally {
        editBtn.disabled = false;
      }
    });
  }

  if (dlXlsxBtn) {
    dlXlsxBtn.addEventListener("click", () => {
      if (!state.currentSheet?.data) return;
      const { XLSX } = window;
      const cols = state.currentSheet.data.columns || [];
      const rows = state.currentSheet.data.rows || [];
      if (XLSX) {
        const aoa = [cols, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, `${(state.currentSheet.title || "spreadsheet").replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`);
        showToast("Excel workbook downloaded!", "success");
      } else {
        // Fallback to CSV
        dlCsvBtn?.click();
      }
    });
  }

  if (dlCsvBtn) {
    dlCsvBtn.addEventListener("click", () => {
      if (!state.currentSheet?.data) return;
      const cols = state.currentSheet.data.columns || [];
      const rows = state.currentSheet.data.rows || [];
      const lines = [cols.map((c) => `"${c}"`).join(",")];
      for (const r of rows) lines.push((Array.isArray(r) ? r : []).map((c) => `"${c}"`).join(","));
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(state.currentSheet.title || "spreadsheet").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
      a.click();
      showToast("CSV file downloaded!", "success");
    });
  }
}

function renderSheetTable(columns, rows) {
  const table = document.getElementById("sheetDataTable");
  if (!table) return;
  table.innerHTML = "";

  const thead = document.createElement("thead");
  thead.className = "bg-slate-900 text-slate-300 font-semibold";
  const trHead = document.createElement("tr");
  for (const col of columns) {
    const th = document.createElement("th");
    th.className = "px-3 py-2 text-left border-r border-slate-800 last:border-0";
    th.textContent = col;
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tbody.className = "divide-y divide-slate-800/80";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tr = document.createElement("tr");
    tr.className = i % 2 === 0 ? "bg-slate-950 hover:bg-slate-900/60" : "bg-slate-900/30 hover:bg-slate-900/60";
    for (const cell of (Array.isArray(row) ? row : [])) {
      const td = document.createElement("td");
      td.className = "px-3 py-1.5 border-r border-slate-800/50 last:border-0 select-all";
      td.textContent = cell !== undefined && cell !== null ? cell : "";
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
}

// -----------------------------------------------------------------------------
// Studio: Presentations
// -----------------------------------------------------------------------------
function initStudioSlides() {
  const genBtn = document.getElementById("generateSlidesBtn");
  const prevBtn = document.getElementById("prevSlideBtn");
  const nextBtn = document.getElementById("nextSlideBtn");
  const dlBtn = document.getElementById("downloadSlidesHtmlBtn");

  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const theme = document.getElementById("slidesThemeSelect")?.value || "pitch";
      const title = document.getElementById("slidesTitleInput")?.value.trim() || "Slide Deck";
      const prompt = document.getElementById("slidesPromptInput")?.value.trim();

      if (!prompt) {
        showToast("Please provide presentation outline or topic", "error");
        return;
      }

      genBtn.disabled = true;
      genBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Designing Deck...</span>`;
      refreshIcons();

      try {
        const client = buildStudioClient();
        logToTerminal(`Designing presentation: "${title}" with Gemini...`, "cmd");
        const doc = await client.generateDocument({ type: "presentation", title, prompt, template: theme });
        state.currentDeck = doc.data?.slides || [];
        state.currentDeckTitle = doc.title || title;
        state.currentSlideIndex = 0;

        renderSlideCard(0);
        document.getElementById("slidesDeckTitle").textContent = state.currentDeckTitle;
        document.getElementById("slidesPreviewContainer").classList.remove("hidden");

        showToast(`Presentation (${state.currentDeck.length} slides) ready!`, "success");
      } catch (err) {
        showToast(`Presentation generation failed: ${err.message}`, "error");
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = `<i data-lucide="presentation" class="w-3.5 h-3.5"></i><span>Generate Presentation</span>`;
        refreshIcons();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (!state.currentDeck || state.currentDeck.length === 0) return;
      state.currentSlideIndex = (state.currentSlideIndex - 1 + state.currentDeck.length) % state.currentDeck.length;
      renderSlideCard(state.currentSlideIndex);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (!state.currentDeck || state.currentDeck.length === 0) return;
      state.currentSlideIndex = (state.currentSlideIndex + 1) % state.currentDeck.length;
      renderSlideCard(state.currentSlideIndex);
    });
  }

  if (dlBtn) {
    dlBtn.addEventListener("click", () => {
      if (!state.currentDeck) return;
      const slidesHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${state.currentDeckTitle}</title>
<style>
body{margin:0;background:#020617;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.slide{background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:36px;max-width:800px;width:90%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);}
h2{color:#38bdf8;font-size:26px;margin-top:0;}
ul{font-size:18px;line-height:1.7;color:#cbd5e1;}
.notes{margin-top:24px;padding-top:16px;border-top:1px solid #334155;color:#94a3b8;font-style:italic;}
</style></head><body>
<div class="slide">
  <h2>${state.currentDeck[state.currentSlideIndex]?.title || state.currentDeckTitle}</h2>
  <ul>${(state.currentDeck[state.currentSlideIndex]?.bullets || []).map(b => `<li>${b}</li>`).join("")}</ul>
  <div class="notes">Speaker Notes: ${state.currentDeck[state.currentSlideIndex]?.notes || ""}</div>
</div>
</body></html>`;
      const blob = new Blob([slidesHtml], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(state.currentDeckTitle || "presentation").replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
      a.click();
      showToast("Presentation HTML downloaded!", "success");
    });
  }
}

function renderSlideCard(idx) {
  const slides = state.currentDeck || [];
  if (!slides[idx]) return;
  const s = slides[idx];

  document.getElementById("slideNumberBadge").textContent = `Slide ${idx + 1} of ${slides.length}`;
  document.getElementById("slideCounterText").textContent = `Slide ${idx + 1} / ${slides.length}`;
  document.getElementById("slideTitleHeading").textContent = s.title || `Slide ${idx + 1}`;

  const list = document.getElementById("slideBulletsList");
  list.innerHTML = "";
  for (const b of (s.bullets || [])) {
    const li = document.createElement("li");
    li.textContent = b;
    list.appendChild(li);
  }

  document.getElementById("slideSpeakerNotes").textContent = s.notes || "No notes.";
}

// -----------------------------------------------------------------------------
// Studio: Music & Audio Synthesizer
// -----------------------------------------------------------------------------
function initStudioMusic() {
  const genBtn = document.getElementById("generateMusicBtn");
  const playBtn = document.getElementById("playMusicBtn");
  const stopBtn = document.getElementById("stopMusicBtn");
  const slider = document.getElementById("bpmSlider");
  const bpmText = document.getElementById("bpmDisplay");

  if (slider && bpmText) {
    slider.addEventListener("input", () => {
      bpmText.textContent = slider.value;
    });
  }

  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const genre = document.getElementById("musicGenreSelect")?.value || "synthwave";
      const tempo = parseInt(document.getElementById("bpmSlider")?.value || "120", 10);
      const prompt = document.getElementById("musicPromptInput")?.value.trim() || `${genre} composition`;

      genBtn.disabled = true;
      genBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Composing with Gemini...</span>`;
      refreshIcons();

      try {
        const client = buildStudioClient();
        logToTerminal(`Composing ${genre} music (${tempo} BPM) with Gemini...`, "cmd");
        const music = await client.generateMusic({ prompt, genre, tempo });
        state.currentScore = music;

        document.getElementById("musicTrackTitle").textContent = music.title || "Synthesized Track";
        document.getElementById("musicTrackMeta").textContent = `${music.tempo || tempo} BPM • ${music.key || "C Major"} • ${(music.melody || []).length} Notes`;

        const notesContainer = document.getElementById("notesContainer");
        notesContainer.innerHTML = "";
        for (const n of (music.melody || [])) {
          const chip = document.createElement("span");
          chip.className = "px-2 py-0.5 rounded bg-pink-950/60 border border-pink-500/40 text-pink-300 font-mono text-[10px]";
          chip.textContent = `${n.note} (${n.freq}Hz)`;
          notesContainer.appendChild(chip);
        }

        document.getElementById("musicPlayerContainer").classList.remove("hidden");
        showToast(`Music composed: "${music.title}"! Click Play Audio to hear.`, "success");
      } catch (err) {
        showToast(`Music composition failed: ${err.message}`, "error");
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = `<i data-lucide="music-2" class="w-3.5 h-3.5"></i><span>Compose &amp; Synthesize Music</span>`;
        refreshIcons();
      }
    });
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (!state.currentScore) return;
      playSynthesizedMusic(state.currentScore);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      stopMusicSynthesis();
    });
  }
}

function playSynthesizedMusic(score) {
  stopMusicSynthesis();
  const synthType = document.getElementById("synthWaveTypeSelect")?.value || score.sound_profile?.synth_type || "sawtooth";
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    showToast("Web Audio API not supported", "error");
    return;
  }

  audioSynthContext = new AudioCtx();
  const ctx = audioSynthContext;
  const melody = score.melody || [];
  const tempo = score.tempo || 120;
  const beatSec = 60 / tempo;

  // Analyser node for frequency bars
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.connect(ctx.destination);

  let currentTime = ctx.currentTime + 0.1;

  for (const n of melody) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = synthType;
    osc.frequency.setValueAtTime(n.freq || 440, currentTime);

    const dur = n.duration || beatSec * 0.8;
    gain.gain.setValueAtTime(0.001, currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, currentTime + dur);

    osc.connect(gain);
    gain.connect(analyser);

    osc.start(currentTime);
    osc.stop(currentTime + dur);
    activeAudioSynthNodes.push(osc);

    currentTime += dur * 0.95;
  }

  document.getElementById("playMusicText").textContent = "Playing...";
  animateMusicVisualizer(analyser);
  showToast("Playing synthesized audio track!", "info");
}

function stopMusicSynthesis() {
  for (const osc of activeAudioSynthNodes) {
    try { osc.stop(); } catch {}
  }
  activeAudioSynthNodes = [];
  if (audioSynthContext) {
    try { audioSynthContext.close(); } catch {}
    audioSynthContext = null;
  }
  if (visualizerAnimFrame) {
    cancelAnimationFrame(visualizerAnimFrame);
    visualizerAnimFrame = null;
  }
  const btnText = document.getElementById("playMusicText");
  if (btnText) btnText.textContent = "Play Audio";
}

function animateMusicVisualizer(analyser) {
  const canvas = document.getElementById("musicVisualizerCanvas");
  if (!canvas || !analyser) return;
  const ctx = canvas.getContext("2d");
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    visualizerAnimFrame = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, "#ec4899");
      gradient.addColorStop(1, "#38bdf8");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  }
  draw();
}

// -----------------------------------------------------------------------------
// Studio: Video & Motion Storyboard
// -----------------------------------------------------------------------------
function initStudioVideo() {
  const genBtn = document.getElementById("generateVideoBtn");
  const playBtn = document.getElementById("playVideoBtn");
  const dlBtn = document.getElementById("downloadStoryboardBtn");

  if (genBtn) {
    genBtn.addEventListener("click", async () => {
      const aspect = document.getElementById("videoAspectSelect")?.value || "16:9";
      const style = document.getElementById("videoStyleSelect")?.value || "cinematic";
      const scenesCount = parseInt(document.getElementById("videoScenesCountSelect")?.value || "4", 10);
      const prompt = document.getElementById("videoPromptInput")?.value.trim();

      if (!prompt) {
        showToast("Please provide video prompt or concept", "error");
        return;
      }

      genBtn.disabled = true;
      genBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Directing Video with Gemini...</span>`;
      refreshIcons();

      try {
        const client = buildStudioClient();
        logToTerminal(`Directing ${style} video concept with Gemini...`, "cmd");
        const video = await client.generateVideo({ prompt, aspect_ratio: aspect, style, scenes_count: scenesCount });
        state.currentVideo = video;

        document.getElementById("videoTitleDisplay").textContent = video.title || "Video Storyboard";
        renderVideoScenesList(video.scenes || []);
        document.getElementById("videoPlayerContainer").classList.remove("hidden");

        showToast(`Video Storyboard (${(video.scenes || []).length} scenes) generated!`, "success");
      } catch (err) {
        showToast(`Video generation failed: ${err.message}`, "error");
      } finally {
        genBtn.disabled = false;
        genBtn.innerHTML = `<i data-lucide="clapperboard" class="w-3.5 h-3.5"></i><span>Generate Video Storyboard</span>`;
        refreshIcons();
      }
    });
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (!state.currentVideo) return;
      playVideoSequence(state.currentVideo);
    });
  }

  if (dlBtn) {
    dlBtn.addEventListener("click", () => {
      if (!state.currentVideo) return;
      const v = state.currentVideo;
      const md = `# 🎬 ${v.title}\n\n**Style:** ${v.style} | **Aspect Ratio:** ${v.aspect_ratio}\n\n### Synopsis\n${v.synopsis || ""}\n\n## Storyboard Scenes\n` +
        (v.scenes || []).map((s) => `### Scene ${s.scene_num}: ${s.title} (${s.duration_sec || 4}s)\n- **Visual:** ${s.visual_prompt}\n- **Camera:** ${s.camera}\n- **Narration:** "${s.narration}"\n`).join("\n");

      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(v.title || "video").replace(/[^a-zA-Z0-9_-]/g, "_")}_storyboard.md`;
      a.click();
      showToast("Storyboard downloaded!", "success");
    });
  }
}

function renderVideoScenesList(scenes) {
  const container = document.getElementById("videoScenesList");
  if (!container) return;
  container.innerHTML = "";

  for (const s of scenes) {
    const card = document.createElement("div");
    card.className = "p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1 border-l-4 border-l-amber-500";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-200">Scene ${s.scene_num}: ${escapeHtml(s.title)}</span>
        <span class="font-mono text-[10px] text-amber-400">${s.duration_sec || 4}s &bull; ${escapeHtml(s.camera || "Pan")}</span>
      </div>
      <p class="text-slate-400 text-[11px] leading-relaxed">${escapeHtml(s.visual_prompt || "")}</p>
      <div class="text-[11px] text-emerald-300 italic pt-1">🗣️ Voiceover: "${escapeHtml(s.narration || "")}"</div>
    `;
    container.appendChild(card);
  }
}

async function playVideoSequence(video) {
  if (isVideoPlaying) return;
  isVideoPlaying = true;
  const canvas = document.getElementById("videoCanvas");
  const subBar = document.getElementById("videoSubtitleBar");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  subBar?.classList.remove("hidden");

  const scenes = video.scenes || [];
  for (let i = 0; i < scenes.length && isVideoPlaying; i++) {
    const s = scenes[i];
    if (subBar) subBar.textContent = `Scene ${s.scene_num}: ${s.narration || s.title}`;

    // Speak narration if synthesis supported
    if ("speechSynthesis" in window && s.narration) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(s.narration);
      utt.rate = 1.05;
      window.speechSynthesis.speak(utt);
    }

    const durationMs = (s.duration_sec || 4) * 1000;
    const start = Date.now();

    while (Date.now() - start < durationMs && isVideoPlaying) {
      const progress = (Date.now() - start) / durationMs;
      renderMotionScene(ctx, canvas, s, progress);
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  isVideoPlaying = false;
  if (subBar) subBar.classList.add("hidden");
  showToast("Video sequence playback completed!", "info");
}

function renderMotionScene(ctx, canvas, scene, progress) {
  const w = canvas.width;
  const h = canvas.height;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#020617");
  grad.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Animated Cyberpunk grid lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
  ctx.lineWidth = 1;
  const offset = (progress * 40) % 40;
  for (let x = offset; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = offset; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Radial pulsing neon core
  const radius = 60 + Math.sin(progress * Math.PI * 4) * 20;
  const radGrad = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, radius);
  radGrad.addColorStop(0, "rgba(245, 158, 11, 0.8)");
  radGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.4)");
  radGrad.addColorStop(1, "transparent");
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  // Floating particles
  for (let p = 0; p < 20; p++) {
    const px = (w * ((p * 0.13 + progress * 0.3) % 1));
    const py = (h * ((p * 0.17 + progress * 0.2) % 1));
    ctx.fillStyle = "rgba(52, 211, 153, 0.7)";
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scene Title Typography
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 12;
  ctx.fillText(scene.title || "", w / 2, h / 2 - 20);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "12px JetBrains Mono, monospace";
  ctx.shadowBlur = 4;
  ctx.fillText(`SCENE ${scene.scene_num} • ${scene.camera || "CAMERA PUSH"}`, w / 2, h / 2 + 15);
  ctx.shadowBlur = 0;
}
