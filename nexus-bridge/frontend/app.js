/**
 * Nexus Remote Agent — Client PWA Application
 * Cross-device control dashboard connecting Cloudflare D1/R2 and Modal Labs GPU Core.
 */

// -----------------------------------------------------------------------------
// 1. Configuration & App State
// -----------------------------------------------------------------------------
const CONFIG = {
  apiUrl: localStorage.getItem("nexus_api_url") || "/api",
  modalUrl: localStorage.getItem("nexus_modal_url") || "https://barhateniranjan725--nexus-ai-core-nexusaicore-fastapi-app.modal.run",
  authToken: localStorage.getItem("nexus_auth_token") || "",
  pollInterval: parseInt(localStorage.getItem("nexus_poll_interval") || "2500", 10),
};

const state = {
  activeTarget: "DESKTOP",          // 'DESKTOP' | 'MOBILE' | 'ALL'
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
async function submitTask(targetDevice, commandType, promptRaw, dispatchModal = false, mediaUrl = null) {
  return fetchEdgeApi("/tasks", {
    method: "POST",
    body: JSON.stringify({
      source_device: "WEB",
      target_device: targetDevice,
      command_type: commandType,
      prompt_raw: promptRaw,
      media_r2_url: mediaUrl,
      dispatch_modal: dispatchModal,
    }),
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
      state.tasks = tasksData.tasks;
      renderTasksList();
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
                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy Output
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
    micLabel.textContent = "Record Voice";
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

async function handleAudioTranscription(audioBlob) {
  showToast("Transcribing on Modal GPU (Whisper)...", "info");

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
          showToast(`Transcribed: "${data.text}"`, "success");
          return;
        }
      }
    } catch (e) {
      console.warn("Modal transcription failed:", e);
    }
  }

  // Fallback: Upload to R2 and populate
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
function setupEventListeners() {
  // Target Device Chips
  document.querySelectorAll(".target-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".target-chip").forEach((b) => b.classList.remove("active", "text-emerald-400"));
      btn.classList.add("active");
      state.activeTarget = btn.dataset.target;
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

  // Microphone
  document.getElementById("micBtn").addEventListener("click", () => {
    if (state.isRecording) stopAudioRecording();
    else startAudioRecording();
  });

  document.getElementById("cancelRecordBtn").addEventListener("click", () => {
    state.audioChunks = [];
    stopAudioRecording();
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
    const shouldModal = modalToggle.checked;
    const res = await submitTask(state.activeTarget, state.activeCommandType, promptText, shouldModal);
    if (res.ok) {
      showToast(`Task assigned to ${res.task.target_device}`, "success");
      input.value = "";
      pollFleetAndTasks();
    } else {
      showToast(res.error || "Failed to dispatch task", "error");
    }
  } catch (err) {
    showToast(err.message || "Network error", "error");
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Dispatch Task</span>`;
    refreshIcons();
  }
}

// -----------------------------------------------------------------------------
// 9. Settings Storage
// -----------------------------------------------------------------------------
function loadConfigToModal() {
  document.getElementById("cfgApiUrl").value = CONFIG.apiUrl;
  document.getElementById("cfgModalUrl").value = CONFIG.modalUrl;
  document.getElementById("cfgAuthSecret").value = CONFIG.authToken;
  document.getElementById("cfgPollInterval").value = CONFIG.pollInterval;
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

  document.getElementById("settingsModal").classList.add("hidden");
  document.getElementById("settingsModal").classList.remove("flex");

  showToast("Settings saved", "success");
  startLivePolling();
}

function resetSettings() {
  localStorage.removeItem("nexus_api_url");
  localStorage.removeItem("nexus_modal_url");
  localStorage.removeItem("nexus_auth_token");
  localStorage.removeItem("nexus_poll_interval");

  CONFIG.apiUrl = "/api";
  CONFIG.modalUrl = "https://barhateniranjan725--nexus-ai-core-nexusaicore-fastapi-app.modal.run";
  CONFIG.authToken = "";
  CONFIG.pollInterval = 2500;

  loadConfigToModal();
  showToast("Settings reset", "info");
}
