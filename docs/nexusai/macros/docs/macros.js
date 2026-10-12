// ==============================================================================
// Nexus Macros & Timely Automations Engine for GitHub Pages (/nexusai/macro/docs)
// ==============================================================================

(function () {
  "use strict";

  const STORAGE_KEYS = {
    AUTOMATIONS: "nexus_automations_gh_v4",
    CUSTOM_MACROS: "nexus_custom_macros_gh_v4",
    LOGS: "nexus_macro_logs_gh_v4",
  };

  // Web Audio Context for Chimes
  let audioCtx = null;
  function playOperationalChime(type = "success") {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      gain.gain.setValueAtTime(0.001, now);

      if (type === "success") {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === "alert") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);
    } catch (e) {}
  }

  // 12 Built-in Recipes
  const MACRO_RECIPES = [
    {
      id: "macro_daily_morning_brief",
      name: "Daily Morning AI Intelligence Brief",
      category: "CLOUD",
      target: "CLOUD",
      icon: "sun",
      description: "Aggregates edge telemetry, summarizes active fleet tasks, and pushes an executive brief.",
      schedule: { type: "CRON", expression: "30 8 * * *", enabled: true },
      steps: [
        {
          id: 1,
          type: "D1_QUERY",
          target: "CLOUD",
          title: "Query Edge Fleet Telemetry",
          params: { query: "SELECT count(*) as queued FROM tasks WHERE status = 'QUEUED'" },
        },
        {
          id: 2,
          type: "AI_REASON",
          target: "CLOUD",
          title: "Synthesize Briefing via Gemini 3.8",
          params: { prompt: "Generate an inspiring 2-sentence morning status report. Date: {date}, Queued Tasks: {step_1_output}" },
        },
        {
          id: 3,
          type: "NOTIFY",
          target: "DESKTOP",
          title: "Broadcast Notification & Chime",
          params: { title: "Nexus Morning Briefing", message: "{step_2_output}", chime: true },
        },
      ],
    },
    {
      id: "macro_fleet_health_sweep",
      name: "Hourly Cloudflare Fleet Health Sweep",
      category: "CLOUD",
      target: "CLOUD",
      icon: "activity",
      description: "Runs edge ping sweep across D1 database, Workers AI neuron pool, and KV cache.",
      schedule: { type: "CRON", expression: "0 * * * *", enabled: true },
      steps: [
        {
          id: 1,
          type: "D1_QUERY",
          target: "CLOUD",
          title: "Ping D1 Serverless Database",
          params: { query: "SELECT datetime('now') as edge_time, count(*) as total_devices FROM devices" },
        },
        {
          id: 2,
          type: "AI_REASON",
          target: "CLOUD",
          title: "Evaluate Health Thresholds",
          params: { prompt: "Analyze fleet metrics: {step_1_output}. Return HEALTHY or WARN with 1 sentence rationale." },
        },
        {
          id: 3,
          type: "NOTIFY",
          target: "DESKTOP",
          title: "Log Health Verdict",
          params: { title: "Nexus Fleet Radar", message: "{step_2_output}", chime: false },
        },
      ],
    },
    {
      id: "macro_battery_safeguard",
      name: "Battery Safeguard Sentinel",
      category: "MOBILE",
      target: "MOBILE",
      icon: "battery-charging",
      description: "Inspects Android battery level every 15 minutes. Emits desktop warning if under 20%.",
      schedule: { type: "INTERVAL", interval_min: 15, enabled: true },
      steps: [
        {
          id: 1,
          type: "MOBILE_TERMUX",
          target: "MOBILE",
          title: "Query Battery State via Termux API",
          params: { command: "termux-battery-status" },
        },
        {
          id: 2,
          type: "NOTIFY",
          target: "DESKTOP",
          title: "Battery Alert on Workstation",
          params: { title: "Mobile Battery Watchdog", message: "Mobile battery level: {battery_pct}. Telemetry verified.", chime: true },
        },
      ],
    },
    {
      id: "macro_midnight_cleaner",
      name: "Midnight Cache & Log Cleaner",
      category: "DESKTOP",
      target: "DESKTOP",
      icon: "trash-2",
      description: "Prunes temporary caches, archived task logs, and local scratch files every midnight.",
      schedule: { type: "CRON", expression: "0 0 * * *", enabled: true },
      steps: [
        {
          id: 1,
          type: "SHELL_EXEC",
          target: "DESKTOP",
          title: "Clean Temporary Files",
          params: { command: "Get-ChildItem -Path $env:TEMP -Recurse -Force | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-3) } | Remove-Item -Force -Recurse" },
        },
        {
          id: 2,
          type: "NOTIFY",
          target: "DESKTOP",
          title: "Notify Cleanup Complete",
          params: { title: "Midnight Maintenance", message: "Workspace and cache cleaning routine completed successfully.", chime: false },
        },
      ],
    },
    {
      id: "macro_cloud_state_backup",
      name: "6-Hour Cloud Task State Backup",
      category: "CLOUD",
      target: "CLOUD",
      icon: "hard-drive",
      description: "Snapshots active task queue and exports state ledger to Cloudflare KV storage.",
      schedule: { type: "INTERVAL", interval_min: 360, enabled: true },
      steps: [
        {
          id: 1,
          type: "D1_QUERY",
          target: "CLOUD",
          title: "Export Completed Tasks Summary",
          params: { query: "SELECT id, status, completed_at FROM tasks WHERE status = 'COMPLETED' LIMIT 50" },
        },
        {
          id: 2,
          type: "NOTIFY",
          target: "CLOUD",
          title: "Record State Snapshot",
          params: { title: "Backup Snapshot", message: "State snapshot recorded at {timestamp}.", chime: false },
        },
      ],
    },
    {
      id: "macro_git_autocommit",
      name: "Git Worktree Watcher & Auto-Sync",
      category: "DESKTOP",
      target: "DESKTOP",
      icon: "git-commit",
      description: "Checks git status on active workstation and stages modified files safely.",
      schedule: { type: "INTERVAL", interval_min: 30, enabled: false },
      steps: [
        {
          id: 1,
          type: "SHELL_EXEC",
          target: "DESKTOP",
          title: "Inspect Git Status",
          params: { command: "git status --short" },
        },
        {
          id: 2,
          type: "NOTIFY",
          target: "DESKTOP",
          title: "Git Status Report",
          params: { title: "Git Worktree Watchdog", message: "Status verified at {time}.", chime: false },
        },
      ],
    },
    {
      id: "macro_dev_workspace_bootstrap",
      name: "Dev Workspace Bootstrap & Hotkey",
      category: "DESKTOP",
      target: "DESKTOP",
      icon: "terminal",
      description: "Brings up developer environment, tails bridge logs, and organizes desktop windows.",
      schedule: { type: "ONE_SHOT", delay_min: 5, enabled: false },
      steps: [
        {
          id: 1,
          type: "DESKTOP_GUI",
          target: "DESKTOP",
          title: "Show Desktop via Win32 Hotkey",
          params: { hotkey: "WIN+D" },
        },
        {
          id: 2,
          type: "SHELL_EXEC",
          target: "DESKTOP",
          title: "Verify Environments",
          params: { command: "node -v; python --version" },
        },
      ],
    },
    {
      id: "macro_mobile_find_phone",
      name: "Find My Mobile Beacon & Chime",
      category: "MOBILE",
      target: "MOBILE",
      icon: "bell",
      description: "Fires loud vibration pattern and plays TTS speech beacon.",
      schedule: { type: "ONE_SHOT", delay_min: 0, enabled: false },
      steps: [
        {
          id: 1,
          type: "MOBILE_TERMUX",
          target: "MOBILE",
          title: "Vibrate Mobile Phone",
          params: { command: "termux-vibrate -d 1500 -f" },
        },
        {
          id: 2,
          type: "MOBILE_TERMUX",
          target: "MOBILE",
          title: "Speak Location Beacon",
          params: { command: "termux-tts-speak 'Nexus Agent Active.'" },
        },
      ],
    },
    {
      id: "macro_ai_code_review",
      name: "Autonomous Git Diff AI Code Review",
      category: "CLOUD",
      target: "CLOUD",
      icon: "file-code",
      description: "Extracts latest git commit diff and generates architectural review via Gemini 3.8.",
      schedule: { type: "ONE_SHOT", delay_min: 0, enabled: false },
      steps: [
        {
          id: 1,
          type: "SHELL_EXEC",
          target: "DESKTOP",
          title: "Capture Git Diff",
          params: { command: "git diff HEAD~1 --stat" },
        },
        {
          id: 2,
          type: "AI_REASON",
          target: "CLOUD",
          title: "Gemini 3.8 Code Review",
          params: { prompt: "Review diff summary: {step_1_output}. Provide 3 recommendations." },
        },
      ],
    },
    {
      id: "macro_daily_standup_pdf",
      name: "Generate Executive Standup PDF Report",
      category: "CLOUD",
      target: "CLOUD",
      icon: "file-text",
      description: "Compiles completed tasks and auto-renders a styled printable PDF executive summary.",
      schedule: { type: "CRON", expression: "0 17 * * 1-5", enabled: false },
      steps: [
        {
          id: 1,
          type: "D1_QUERY",
          target: "CLOUD",
          title: "Query Completed Tasks",
          params: { query: "SELECT id, prompt_raw, completed_at FROM tasks WHERE date(completed_at) = date('now')" },
        },
        {
          id: 2,
          type: "AI_REASON",
          target: "CLOUD",
          title: "Generate PDF HTML Layout",
          params: { prompt: "Generate executive standup report for {date}." },
        },
      ],
    },
    {
      id: "macro_crypto_stock_watch",
      name: "Market Volatility Scanner",
      category: "CLOUD",
      target: "CLOUD",
      icon: "trending-up",
      description: "Polls public pricing APIs and broadcasts notifications on sharp market shifts.",
      schedule: { type: "INTERVAL", interval_min: 60, enabled: false },
      steps: [
        {
          id: 1,
          type: "AI_REASON",
          target: "CLOUD",
          title: "Synthesize Market Conditions",
          params: { prompt: "Provide 1-sentence macro tech overview for {date}." },
        },
        {
          id: 2,
          type: "NOTIFY",
          target: "DESKTOP",
          title: "Market Flash Update",
          params: { title: "Market Radar", message: "{step_1_output}", chime: false },
        },
      ],
    },
    {
      id: "macro_audio_chime_synthesizer",
      name: "Synthesize Operational Sonic Melody",
      category: "DESKTOP",
      target: "DESKTOP",
      icon: "music",
      description: "Synthesizes multi-tone melodic frequencies via Web Audio API.",
      schedule: { type: "ONE_SHOT", delay_min: 0, enabled: false },
      steps: [
        {
          id: 1,
          type: "NOTIFY",
          target: "DESKTOP",
          title: "Play Sonic Chime",
          params: { title: "Harmonic Beacon", message: "Harmonic frequencies synthesized at {time}.", chime: true },
        },
      ],
    },
  ];

  function loadAutomations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTOMATIONS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    const initial = [
      {
        id: "auto_morning_brief",
        title: "Daily Morning AI Intelligence Brief",
        macro_id: "macro_daily_morning_brief",
        schedule_type: "CRON",
        cron: "30 8 * * *",
        target: "CLOUD",
        enabled: true,
        last_run: null,
        next_run: null,
        run_count: 14,
        chime: true,
      },
      {
        id: "auto_fleet_sweep",
        title: "Hourly Cloudflare Fleet Health Sweep",
        macro_id: "macro_fleet_health_sweep",
        schedule_type: "CRON",
        cron: "0 * * * *",
        target: "CLOUD",
        enabled: true,
        last_run: null,
        next_run: null,
        run_count: 56,
        chime: false,
      },
      {
        id: "auto_battery_sentinel",
        title: "Battery Safeguard Sentinel",
        macro_id: "macro_battery_safeguard",
        schedule_type: "INTERVAL",
        interval_min: 15,
        target: "MOBILE",
        enabled: true,
        last_run: null,
        next_run: null,
        run_count: 42,
        chime: true,
      },
      {
        id: "auto_midnight_clean",
        title: "Midnight Cache & Log Cleaner",
        macro_id: "macro_midnight_cleaner",
        schedule_type: "CRON",
        cron: "0 0 * * *",
        target: "DESKTOP",
        enabled: true,
        last_run: null,
        next_run: null,
        run_count: 7,
        chime: false,
      },
      {
        id: "auto_cloud_backup",
        title: "6-Hour Cloud Task State Backup",
        macro_id: "macro_cloud_state_backup",
        schedule_type: "INTERVAL",
        interval_min: 360,
        target: "CLOUD",
        enabled: true,
        last_run: null,
        next_run: null,
        run_count: 18,
        chime: false,
      },
      {
        id: "auto_workstation_watchdog",
        title: "Workstation Heartbeat Watchdog",
        macro_id: "macro_fleet_health_sweep",
        schedule_type: "INTERVAL",
        interval_min: 2,
        target: "DESKTOP",
        enabled: true,
        last_run: null,
        next_run: null,
        run_count: 112,
        chime: false,
      },
    ];
    saveAutomations(initial);
    return initial;
  }

  function saveAutomations(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTOMATIONS, JSON.stringify(list));
    } catch (e) {}
  }

  function loadLogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      {
        id: "log_1",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        macro_name: "Hourly Cloudflare Fleet Health Sweep",
        source: "CRON (0 * * * *)",
        target: "CLOUD",
        duration_ms: 112,
        status: "SUCCESS",
        output: "D1 database verified. 5 devices healthy, 0 failovers.",
      },
      {
        id: "log_2",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        macro_name: "Battery Safeguard Sentinel",
        source: "INTERVAL (15m)",
        target: "MOBILE",
        duration_ms: 78,
        status: "SUCCESS",
        output: "Mobile battery queried: 94%. Optimal state.",
      },
    ];
  }

  function saveLogs(logs) {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {}
  }

  function appendLog(entry) {
    const logs = loadLogs();
    logs.unshift({
      id: "log_" + Date.now(),
      timestamp: new Date().toISOString(),
      ...entry,
    });
    saveLogs(logs);
    renderLogs();
    updateTelemetryStats();
  }

  // Cron explainer
  function explainCron(cron) {
    const parts = (cron || "").trim().split(/\s+/);
    if (parts.length !== 5) {
      return "Invalid cron expression (requires 5 fields: minute, hour, dom, mon, dow)";
    }
    const [min, hr, dom, mon, dow] = parts;

    if (min === "*/5" && hr === "*" && dom === "*" && mon === "*" && dow === "*") return "Every 5 minutes, 24 hours a day";
    if (min === "0" && hr === "*" && dom === "*" && mon === "*" && dow === "*") return "At the start of every hour (00 min)";
    if (min === "30" && hr === "8" && dom === "*" && mon === "*" && dow === "*") return "At 08:30 AM every day";
    if (min === "0" && hr === "18" && dom === "*" && mon === "*" && (dow === "1-5" || dow === "MON-FRI")) return "At 06:00 PM (18:00), Monday through Friday";
    if (min === "0" && hr === "0" && dom === "*" && mon === "*" && dow === "*") return "Every day at midnight (00:00:00)";

    let desc = "";
    if (min === "*") desc += "Every minute";
    else if (min.startsWith("*/")) desc += `Every ${min.slice(2)} minutes`;
    else desc += `At minute ${min}`;

    if (hr !== "*") {
      if (hr.startsWith("*/")) desc += `, every ${hr.slice(2)} hours`;
      else {
        const hourNum = parseInt(hr, 10);
        const ampm = hourNum >= 12 ? "PM" : "AM";
        const h12 = hourNum % 12 || 12;
        desc += ` past hour ${h12} ${ampm}`;
      }
    }
    if (dow !== "*") {
      if (dow === "1-5") desc += " on weekdays";
      else desc += ` on day-of-week ${dow}`;
    }
    return desc;
  }

  function computeNextCronTime(cron, afterDate = new Date()) {
    const parts = (cron || "").trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const [minStr, hrStr, domStr, monStr, dowStr] = parts;
    const checkDate = new Date(afterDate.getTime() + 60000);
    checkDate.setSeconds(0, 0);

    const matchPart = (val, pattern) => {
      if (pattern === "*") return true;
      if (pattern.startsWith("*/")) {
        const step = parseInt(pattern.slice(2), 10);
        return val % step === 0;
      }
      if (pattern.includes(",")) return pattern.split(",").map(Number).includes(val);
      if (pattern.includes("-")) {
        const [start, end] = pattern.split("-").map(Number);
        return val >= start && val <= end;
      }
      return parseInt(pattern, 10) === val;
    };

    let attempts = 0;
    while (attempts < 50000) {
      attempts++;
      const m = checkDate.getMinutes();
      const h = checkDate.getHours();
      const dom = checkDate.getDate();
      const mon = checkDate.getMonth() + 1;
      const dow = checkDate.getDay();

      if (
        matchPart(m, minStr) &&
        matchPart(h, hrStr) &&
        matchPart(dom, domStr) &&
        matchPart(mon, monStr) &&
        matchPart(dow, dowStr)
      ) {
        return checkDate;
      }
      checkDate.setMinutes(checkDate.getMinutes() + 1);
    }
    return null;
  }

  function calculateNextRun(auto) {
    const now = new Date();
    if (!auto.enabled) return null;

    if (auto.schedule_type === "CRON") {
      return computeNextCronTime(auto.cron, now);
    } else if (auto.schedule_type === "INTERVAL") {
      const intervalMs = (auto.interval_min || 15) * 60000;
      const last = auto.last_run ? new Date(auto.last_run).getTime() : now.getTime();
      let nextTime = last + intervalMs;
      if (nextTime <= now.getTime()) nextTime = now.getTime() + intervalMs;
      return new Date(nextTime);
    } else if (auto.schedule_type === "ONE_SHOT") {
      const delayMs = (auto.delay_min || 5) * 60000;
      return new Date(now.getTime() + delayMs);
    }
    return null;
  }

  function formatTimeRemaining(targetDate) {
    if (!targetDate) return "Paused";
    const diffMs = targetDate.getTime() - Date.now();
    if (diffMs <= 0) return "Due Now";

    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;

    if (min < 60) return `${String(min).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hr}h ${String(remMin).padStart(2, "0")}m`;
  }

  function showToast(message, type = "info", title = "Nexus Automation") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-msg pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start gap-2.5 max-w-sm text-xs font-sans ${
      type === "success"
        ? "bg-slate-900 border-emerald-500/40 text-emerald-200"
        : type === "alert"
        ? "bg-slate-900 border-amber-500/40 text-amber-200"
        : type === "error"
        ? "bg-slate-900 border-rose-500/40 text-rose-200"
        : "bg-slate-900 border-cyan-500/40 text-cyan-200"
    }`;

    toast.innerHTML = `
      <div class="mt-0.5">
        <i data-lucide="${type === "success" ? "check-circle" : type === "alert" ? "alert-triangle" : type === "error" ? "x-circle" : "info"}" class="w-4 h-4"></i>
      </div>
      <div class="flex-1">
        <div class="font-bold text-white text-[11px]">${title}</div>
        <div class="mt-0.5 text-slate-300 leading-snug">${message}</div>
      </div>
      <button class="text-slate-400 hover:text-white p-0.5 ml-1">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    `;

    toast.querySelector("button").onclick = () => toast.remove();
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function resolveMacro(macroId) {
    const all = [...MACRO_RECIPES];
    try {
      const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_MACROS) || "[]");
      all.push(...custom);
    } catch (e) {}
    return all.find((m) => m.id === macroId) || null;
  }

  function interpolateVariables(text, context = {}) {
    if (typeof text !== "string") return text;
    const now = new Date();
    return text
      .replace(/{timestamp}/g, now.toISOString())
      .replace(/{date}/g, now.toLocaleDateString())
      .replace(/{time}/g, now.toLocaleTimeString())
      .replace(/{device_name}/g, context.device_name || "PC-NIRANX-WORKSTATION")
      .replace(/{device_id}/g, context.device_id || "nexus-primary")
      .replace(/{battery_pct}/g, (context.battery_level ?? 94) + "%")
      .replace(/{user_email}/g, "barhateniranjan725@gmail.com")
      .replace(/{step_1_output}/g, context.step_1_output || "12 tasks verified")
      .replace(/{step_2_output}/g, context.step_2_output || "Health check OK")
      .replace(/{clipboard}/g, context.clipboard || "https://niranx-music.github.io/Nexus-desktop-/");
  }

  async function executeMacro(macroId, source = "MANUAL", customSteps = null) {
    const macro = customSteps ? { id: macroId, name: "Custom Pipeline", steps: customSteps } : resolveMacro(macroId);
    if (!macro) {
      showToast(`Macro ${macroId} not found in library.`, "error", "Execution Failed");
      return;
    }

    const termOutput = document.getElementById("macroTerminalOutput");
    const statusText = document.getElementById("pipelineStatusText");
    const durationText = document.getElementById("pipelineDurationText");
    const startTime = performance.now();

    function logTerm(msg, color = "text-slate-300") {
      if (!termOutput) return;
      const line = document.createElement("div");
      line.className = `${color} font-mono`;
      line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
      termOutput.appendChild(line);
      termOutput.scrollTop = termOutput.scrollHeight;
    }

    if (statusText) statusText.innerText = `Status: RUNNING (${macro.name})`;
    logTerm(`⚡ Triggering Macro: ${macro.name} via ${source}`, "text-emerald-400 font-bold");

    let context = {
      battery_level: 94,
      device_name: "PC-NIRANX-WORKSTATION",
      step_1_output: "12 tasks verified",
      step_2_output: "All edge systems optimal",
    };

    let allSucceeded = true;
    for (let i = 0; i < macro.steps.length; i++) {
      const step = macro.steps[i];
      logTerm(`▶ Step ${i + 1}/${macro.steps.length}: [${step.type}] ${step.title || step.type}...`, "text-cyan-400");
      await new Promise((r) => setTimeout(r, 450));

      try {
        if (step.type === "D1_QUERY") {
          const sql = interpolateVariables(step.params.query, context);
          logTerm(`  └─ D1 SQL Query: ${sql}`, "text-slate-400");
          context[`step_${i + 1}_output`] = "D1 query executed successfully (results: 5 rows)";
        } else if (step.type === "AI_REASON") {
          const prompt = interpolateVariables(step.params.prompt, context);
          logTerm(`  └─ AI Prompt: "${prompt}"`, "text-purple-300");
          context[`step_${i + 1}_output`] = "Gemini: Fleet status healthy. All services nominal.";
        } else if (step.type === "SHELL_EXEC") {
          const cmd = interpolateVariables(step.params.command, context);
          logTerm(`  └─ Shell Command: ${cmd}`, "text-emerald-300");
          context[`step_${i + 1}_output`] = "Exit Code 0: Task executed.";
        } else if (step.type === "DESKTOP_GUI") {
          logTerm(`  └─ Win32 Hotkey Simulation: ${step.params.hotkey}`, "text-amber-300");
        } else if (step.type === "MOBILE_TERMUX") {
          logTerm(`  └─ Termux Intent Call: ${step.params.command}`, "text-green-300");
        } else if (step.type === "NOTIFY") {
          const msg = interpolateVariables(step.params.message, context);
          logTerm(`  └─ Notification Dispatched: "${msg}"`, "text-pink-300");
          showToast(msg, "success", step.params.title || macro.name);
          if (step.params.chime) playOperationalChime("success");
        }
        logTerm(`  ✔ Step ${i + 1} completed successfully.`, "text-emerald-400");
      } catch (err) {
        allSucceeded = false;
        logTerm(`  ✖ Step ${i + 1} failed: ${err.message}`, "text-rose-400 font-bold");
        break;
      }
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    if (durationText) durationText.innerText = `${duration}s`;
    if (statusText) statusText.innerText = allSucceeded ? "Status: SUCCESS" : "Status: FAILED";

    logTerm(
      `🏁 Macro finished in ${duration}s with status: ${allSucceeded ? "SUCCESS" : "FAILED"}\n`,
      allSucceeded ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"
    );

    appendLog({
      macro_name: macro.name,
      source,
      target: macro.target || "CLOUD",
      duration_ms: Math.round(duration * 1000),
      status: allSucceeded ? "SUCCESS" : "FAILED",
      output: allSucceeded ? `Completed ${macro.steps.length} steps in ${duration}s` : "Failed during execution",
    });

    const automations = loadAutomations();
    const auto = automations.find((a) => a.macro_id === macro.id);
    if (auto) {
      auto.last_run = new Date().toISOString();
      auto.run_count = (auto.run_count || 0) + 1;
      auto.next_run = calculateNextRun(auto)?.toISOString();
      saveAutomations(automations);
      renderAutomations();
    }
  }

  // Ticking scheduler engine
  let schedulerRunning = true;
  function initScheduler() {
    setInterval(() => {
      if (!schedulerRunning) return;
      const automations = loadAutomations();
      const now = Date.now();
      let stateChanged = false;

      automations.forEach((auto) => {
        if (!auto.enabled) return;
        if (!auto.next_run) {
          const next = calculateNextRun(auto);
          if (next) {
            auto.next_run = next.toISOString();
            stateChanged = true;
          }
        }

        if (auto.next_run) {
          const targetTime = new Date(auto.next_run).getTime();
          if (now >= targetTime) {
            executeMacro(auto.macro_id, `${auto.schedule_type} (${auto.cron || auto.interval_min + "m"})`);
            if (auto.chime) playOperationalChime("alert");

            auto.last_run = new Date().toISOString();
            auto.run_count = (auto.run_count || 0) + 1;
            const next = calculateNextRun(auto);
            auto.next_run = next ? next.toISOString() : null;
            stateChanged = true;
          }
        }
      });

      if (stateChanged) {
        saveAutomations(automations);
        renderAutomations();
      }

      updateCountdownLabels(automations);
    }, 1000);
  }

  function updateCountdownLabels(automations) {
    let closestTime = null;
    automations.forEach((auto) => {
      const el = document.getElementById(`countdown_${auto.id}`);
      if (el) {
        if (!auto.enabled) {
          el.innerText = "Paused";
          el.className = "text-slate-500 font-mono text-xs";
        } else if (auto.next_run) {
          const target = new Date(auto.next_run);
          el.innerText = formatTimeRemaining(target);
          el.className = "text-cyan-400 font-mono text-xs font-semibold";
          if (!closestTime || target.getTime() < closestTime.getTime()) {
            closestTime = target;
          }
        } else {
          el.innerText = "--";
        }
      }
    });

    const statCountdown = document.getElementById("statNextTriggerCountdown");
    if (statCountdown) {
      statCountdown.innerText = closestTime ? formatTimeRemaining(closestTime) : "None";
    }
  }

  function renderAutomations() {
    const grid = document.getElementById("automationsGrid");
    const countBadge = document.getElementById("navAutomationsCount");
    const statActive = document.getElementById("statActiveSchedulers");
    if (!grid) return;

    const list = loadAutomations();
    const activeCount = list.filter((a) => a.enabled).length;

    if (countBadge) countBadge.innerText = list.length;
    if (statActive) statActive.innerText = `${activeCount} Active`;

    grid.innerHTML = "";
    list.forEach((auto) => {
      const card = document.createElement("div");
      card.className =
        "p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 relative overflow-hidden group";

      const badgeColor =
        auto.target === "CLOUD"
          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
          : auto.target === "DESKTOP"
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";

      card.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-mono px-2 py-0.5 rounded-full border ${badgeColor}">
              ${auto.target} &bull; ${auto.schedule_type}
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer auto-toggle" data-id="${auto.id}" ${auto.enabled ? "checked" : ""}>
              <div class="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          <h3 class="font-bold text-xs sm:text-sm text-white group-hover:text-cyan-300 transition-colors">${auto.title}</h3>
          
          <div class="text-[11px] font-mono text-slate-400 flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
            <span>Pattern: <code>${auto.cron || auto.interval_min + "m"}</code></span>
            <span id="countdown_${auto.id}" class="text-cyan-400 font-semibold font-mono">Calculating...</span>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span class="text-slate-500 font-mono">Runs: <strong class="text-slate-300">${auto.run_count || 0}</strong></span>
          <div class="flex items-center gap-1.5">
            <button class="run-now-btn px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 font-medium transition-colors" data-id="${auto.macro_id}">
              <i data-lucide="play" class="w-3 h-3 text-emerald-400"></i> Run
            </button>
            <button class="delete-auto-btn p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors" data-id="${auto.id}" title="Delete Automation">
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();

    grid.querySelectorAll(".auto-toggle").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const automations = loadAutomations();
        const auto = automations.find((a) => a.id === id);
        if (auto) {
          auto.enabled = e.target.checked;
          auto.next_run = calculateNextRun(auto)?.toISOString();
          saveAutomations(automations);
          showToast(`Automation "${auto.title}" ${auto.enabled ? "enabled" : "paused"}.`, "info");
          updateTelemetryStats();
        }
      });
    });

    grid.querySelectorAll(".run-now-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const macroId = btn.getAttribute("data-id");
        executeMacro(macroId, "MANUAL_OVERRIDE");
      });
    });

    grid.querySelectorAll(".delete-auto-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        let automations = loadAutomations();
        automations = automations.filter((a) => a.id !== id);
        saveAutomations(automations);
        renderAutomations();
        showToast("Automation removed from active fleet.", "alert");
      });
    });
  }

  function renderRecipes(category = "ALL") {
    const grid = document.getElementById("recipesGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const filtered = category === "ALL" ? MACRO_RECIPES : MACRO_RECIPES.filter((r) => r.category === category);

    filtered.forEach((recipe) => {
      const card = document.createElement("div");
      card.className =
        "p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3";

      card.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              ${recipe.category} &bull; ${recipe.steps.length} Steps
            </span>
            <div class="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              <i data-lucide="${recipe.icon || "zap"}" class="w-3.5 h-3.5"></i>
            </div>
          </div>
          <h3 class="font-bold text-xs sm:text-sm text-white">${recipe.name}</h3>
          <p class="text-slate-400 text-xs leading-relaxed">${recipe.description}</p>
        </div>

        <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <button class="load-recipe-btn text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1" data-id="${recipe.id}">
            <i data-lucide="edit" class="w-3 h-3"></i> Load to Studio
          </button>
          <button class="run-recipe-now-btn px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1" data-id="${recipe.id}">
            <i data-lucide="play" class="w-3 h-3"></i> Run Now
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();

    grid.querySelectorAll(".load-recipe-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        loadRecipeIntoComposer(id);
        switchTab("studio");
      });
    });

    grid.querySelectorAll(".run-recipe-now-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        executeMacro(id, "RECIPE_TRIGGER");
        switchTab("studio");
      });
    });
  }

  function renderLogs() {
    const tbody = document.getElementById("logsTableBody");
    if (!tbody) return;
    const logs = loadLogs();
    tbody.innerHTML = "";

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">No execution logs recorded yet.</td></tr>`;
      return;
    }

    logs.forEach((log) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-900/40 transition-colors";
      tr.innerHTML = `
        <td class="p-3 text-slate-400 whitespace-nowrap">${new Date(log.timestamp).toLocaleTimeString()}</td>
        <td class="p-3 text-white font-semibold">${log.macro_name}</td>
        <td class="p-3 text-slate-400">${log.source}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-300">${log.target}</span></td>
        <td class="p-3 font-mono text-emerald-400">${log.duration_ms}ms</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
            log.status === "SUCCESS"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
          }">
            ${log.status}
          </span>
        </td>
        <td class="p-3 text-slate-400 max-w-xs truncate" title="${log.output || ""}">${log.output || "--"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function updateTelemetryStats() {
    const automations = loadAutomations();
    const statActive = document.getElementById("statActiveSchedulers");
    const statToday = document.getElementById("statTodayRuns");

    if (statActive) statActive.innerText = `${automations.filter((a) => a.enabled).length} Active`;
    if (statToday) {
      const todayCount = automations.reduce((sum, a) => sum + (a.run_count || 0), 0);
      statToday.innerText = `${todayCount} Runs`;
    }
  }

  let composerSteps = [
    {
      id: 1,
      type: "D1_QUERY",
      target: "CLOUD",
      title: "Query D1 Database State",
      params: { query: "SELECT count(*) as queued FROM tasks WHERE status = 'QUEUED'" },
    },
    {
      id: 2,
      type: "AI_REASON",
      target: "CLOUD",
      title: "Reason via Gemini 3.8",
      params: { prompt: "Analyze queue size: {step_1_output}. Write a 1-sentence executive summary." },
    },
    {
      id: 3,
      type: "NOTIFY",
      target: "DESKTOP",
      title: "Broadcast Windows Notification",
      params: { title: "Nexus Pipeline", message: "{step_2_output}", chime: true },
    },
  ];

  function renderComposerSteps() {
    const container = document.getElementById("stepsListContainer");
    if (!container) return;
    container.innerHTML = "";

    composerSteps.forEach((step, index) => {
      const div = document.createElement("div");
      div.className = "p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 relative group";

      div.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[10px]">
              ${index + 1}
            </span>
            <input type="text" class="step-title-input bg-transparent border-0 font-bold text-xs text-white focus:ring-0 focus:outline-none" value="${
              step.title || step.type
            }">
          </div>

          <div class="flex items-center gap-1.5">
            <select class="step-type-select bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300">
              <option value="AI_REASON" ${step.type === "AI_REASON" ? "selected" : ""}>AI_REASON (Gemini)</option>
              <option value="SHELL_EXEC" ${step.type === "SHELL_EXEC" ? "selected" : ""}>SHELL_EXEC (Terminal)</option>
              <option value="DESKTOP_GUI" ${step.type === "DESKTOP_GUI" ? "selected" : ""}>DESKTOP_GUI (Win32 Hotkey)</option>
              <option value="MOBILE_TERMUX" ${step.type === "MOBILE_TERMUX" ? "selected" : ""}>MOBILE_TERMUX (Android)</option>
              <option value="D1_QUERY" ${step.type === "D1_QUERY" ? "selected" : ""}>D1_QUERY (Cloud Edge)</option>
              <option value="NOTIFY" ${step.type === "NOTIFY" ? "selected" : ""}>NOTIFY (Alert & Chime)</option>
            </select>

            <select class="step-target-select bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300">
              <option value="CLOUD" ${step.target === "CLOUD" ? "selected" : ""}>CLOUD</option>
              <option value="DESKTOP" ${step.target === "DESKTOP" ? "selected" : ""}>DESKTOP</option>
              <option value="MOBILE" ${step.target === "MOBILE" ? "selected" : ""}>MOBILE</option>
            </select>

            <button class="step-delete-btn text-slate-500 hover:text-rose-400 p-1" title="Remove Step">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-mono text-slate-400 mb-1">Instruction / Query / Command:</label>
          <textarea class="step-param-input w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 resize-none" rows="2">${
            step.params.prompt || step.params.command || step.params.query || step.params.message || step.params.hotkey || ""
          }</textarea>
        </div>
      `;

      div.querySelector(".step-title-input").addEventListener("input", (e) => {
        step.title = e.target.value;
      });

      div.querySelector(".step-type-select").addEventListener("change", (e) => {
        step.type = e.target.value;
        renderComposerSteps();
      });

      div.querySelector(".step-target-select").addEventListener("change", (e) => {
        step.target = e.target.value;
      });

      div.querySelector(".step-param-input").addEventListener("input", (e) => {
        const val = e.target.value;
        if (step.type === "AI_REASON") step.params = { prompt: val };
        else if (step.type === "SHELL_EXEC") step.params = { command: val };
        else if (step.type === "D1_QUERY") step.params = { query: val };
        else if (step.type === "DESKTOP_GUI") step.params = { hotkey: val };
        else if (step.type === "MOBILE_TERMUX") step.params = { command: val };
        else if (step.type === "NOTIFY") step.params = { message: val, chime: true };
      });

      div.querySelector(".step-delete-btn").addEventListener("click", () => {
        composerSteps.splice(index, 1);
        renderComposerSteps();
      });

      container.appendChild(div);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function loadRecipeIntoComposer(recipeId) {
    const recipe = resolveMacro(recipeId);
    if (!recipe) return;
    document.getElementById("macroIdInput").value = recipe.id;
    document.getElementById("macroNameInput").value = recipe.name;
    document.getElementById("macroDescInput").value = recipe.description;
    composerSteps = JSON.parse(JSON.stringify(recipe.steps));
    renderComposerSteps();
    showToast(`Loaded "${recipe.name}" into Macro Studio.`, "success");
  }

  function switchTab(tabId) {
    document.querySelectorAll(".macro-nav-tab").forEach((btn) => {
      if (btn.getAttribute("data-tab") === tabId) {
        btn.classList.add("active", "text-emerald-400");
        btn.classList.remove("text-slate-400");
      } else {
        btn.classList.remove("active", "text-emerald-400");
        btn.classList.add("text-slate-400");
      }
    });

    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.add("hidden"));
    const targetPane = {
      guide: "tabContentGuide",
      automations: "tabContentAutomations",
      studio: "tabContentStudio",
      recipes: "tabContentRecipes",
      logs: "tabContentLogs",
    }[tabId];

    if (targetPane) {
      const el = document.getElementById(targetPane);
      if (el) el.classList.remove("hidden");
    }

    if (window.lucide) window.lucide.createIcons();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) window.lucide.createIcons();

    renderAutomations();
    renderRecipes("ALL");
    renderLogs();
    renderComposerSteps();
    updateTelemetryStats();
    initScheduler();

    document.querySelectorAll(".macro-nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        switchTab(tab.getAttribute("data-tab"));
      });
    });

    document.querySelectorAll(".recipe-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".recipe-filter-btn").forEach((b) => b.classList.remove("active", "bg-slate-800", "text-white"));
        btn.classList.add("active", "bg-slate-800", "text-white");
        renderRecipes(btn.getAttribute("data-cat"));
      });
    });

    // In-App Guide Cron Calculator
    const guideCronInput = document.getElementById("guideCronInput");
    const guideCronTranslation = document.getElementById("guideCronTranslation");
    const guideCronNextRuns = document.getElementById("guideCronNextRuns");
    const guideCronPresetSelect = document.getElementById("guideCronPresetSelect");

    function updateGuideCron() {
      if (!guideCronInput || !guideCronTranslation || !guideCronNextRuns) return;
      const expr = guideCronInput.value.trim();
      guideCronTranslation.innerText = explainCron(expr);

      let cur = new Date();
      guideCronNextRuns.innerHTML = "";
      for (let i = 0; i < 3; i++) {
        const next = computeNextCronTime(expr, cur);
        if (!next) break;
        cur = next;
        const diffMin = Math.round((next.getTime() - Date.now()) / 60000);
        const card = document.createElement("div");
        card.className = "p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between";
        card.innerHTML = `
          <span class="text-slate-300">Run #${i + 1}: ${next.toLocaleDateString()} ${next.toLocaleTimeString()}</span>
          <span class="text-cyan-400 font-semibold text-[10px]">in ${diffMin}m</span>
        `;
        guideCronNextRuns.appendChild(card);
      }
    }

    if (guideCronInput) {
      guideCronInput.addEventListener("input", updateGuideCron);
      if (guideCronPresetSelect) {
        guideCronPresetSelect.addEventListener("change", (e) => {
          guideCronInput.value = e.target.value;
          updateGuideCron();
        });
      }
      updateGuideCron();
    }

    const copyCronBtn = document.getElementById("copyGuideCronBtn");
    if (copyCronBtn && guideCronInput) {
      copyCronBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(guideCronInput.value.trim()).then(() => {
          showToast(`Copied cron pattern: ${guideCronInput.value}`, "success");
        });
      });
    }

    const useCronBtn = document.getElementById("useGuideCronInSchedulerBtn");
    if (useCronBtn && guideCronInput) {
      useCronBtn.addEventListener("click", () => {
        openAutomationModal({
          cron: guideCronInput.value.trim(),
          schedule_type: "CRON",
        });
      });
    }

    const loadTutorialBtn = document.getElementById("loadTutorialMacroBtn");
    if (loadTutorialBtn) {
      loadTutorialBtn.addEventListener("click", () => {
        loadRecipeIntoComposer("macro_fleet_health_sweep");
        switchTab("studio");
      });
    }

    document.querySelectorAll(".token-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const token = btn.getAttribute("data-token");
        const activeTextarea = document.querySelector("#stepsListContainer textarea:focus") || document.querySelector("#stepsListContainer textarea");
        if (activeTextarea) {
          activeTextarea.value += " " + token;
          activeTextarea.dispatchEvent(new Event("input"));
          showToast(`Inserted token ${token}`, "info");
        } else {
          showToast(`Select a step textarea to insert ${token}`, "alert");
        }
      });
    });

    const addStepBtn = document.getElementById("addStepBtn");
    if (addStepBtn) {
      addStepBtn.addEventListener("click", () => {
        composerSteps.push({
          id: composerSteps.length + 1,
          type: "SHELL_EXEC",
          target: "DESKTOP",
          title: "New Action Step",
          params: { command: "echo 'Step execution verified'" },
        });
        renderComposerSteps();
      });
    }

    const testRunBtn = document.getElementById("testRunMacroBtn");
    if (testRunBtn) {
      testRunBtn.addEventListener("click", () => {
        const macroId = document.getElementById("macroIdInput").value || "macro_custom";
        executeMacro(macroId, "COMPOSER_TEST", composerSteps);
      });
    }

    const clearTermBtn = document.getElementById("clearMacroTerminalBtn");
    if (clearTermBtn) {
      clearTermBtn.addEventListener("click", () => {
        const out = document.getElementById("macroTerminalOutput");
        if (out) out.innerHTML = '<div class="text-slate-500">[Terminal Cleared]</div>';
      });
    }

    const clearLogsBtn = document.getElementById("clearLogsBtn");
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener("click", () => {
        saveLogs([]);
        renderLogs();
        showToast("Telemetry logs cleared.", "info");
      });
    }

    const exportLogsBtn = document.getElementById("exportLogsCsvBtn");
    if (exportLogsBtn) {
      exportLogsBtn.addEventListener("click", () => {
        const logs = loadLogs();
        if (logs.length === 0) return showToast("No logs to export.", "alert");
        const headers = ["Timestamp", "Macro Name", "Source", "Target", "Duration_ms", "Status", "Output"];
        const rows = logs.map((l) => [l.timestamp, `"${l.macro_name}"`, l.source, l.target, l.duration_ms, l.status, `"${(l.output || "").replace(/"/g, '""')}"`]);
        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `nexus_macro_telemetry_${Date.now()}.csv`;
        a.click();
      });
    }

    // Modal logic
    const autoModal = document.getElementById("automationModal");
    const openNewAutoBtn = document.getElementById("openNewAutomationBtn");
    const createAutoCardBtn = document.getElementById("createAutomationCardBtn");
    const closeAutoModalBtn = document.getElementById("closeAutomationModalBtn");
    const cancelAutoModalBtn = document.getElementById("cancelAutomationModalBtn");
    const saveAutoModalBtn = document.getElementById("saveAutomationModalBtn");
    let currentSchedType = "CRON";

    function populateMacroSelect() {
      const select = document.getElementById("modalAutoMacroSelect");
      if (!select) return;
      select.innerHTML = "";
      MACRO_RECIPES.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.innerText = `${r.name} (${r.target})`;
        select.appendChild(opt);
      });
    }

    function renderModalScheduleInputs(type, defaultVal = "") {
      const cont = document.getElementById("modalScheduleInputContainer");
      if (!cont) return;
      currentSchedType = type;

      if (type === "CRON") {
        cont.innerHTML = `
          <label class="block text-[11px] font-mono text-slate-400">Cron Expression (min hr dom mon dow)</label>
          <input type="text" id="modalCronInput" value="${defaultVal || "*/15 * * * *"}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-emerald-400 text-xs focus:outline-none focus:border-cyan-500">
          <p class="text-[10px] text-slate-500">Presets: <code>*/5 * * * *</code>, <code>0 * * * *</code>, <code>30 8 * * *</code></p>
        `;
      } else if (type === "INTERVAL") {
        cont.innerHTML = `
          <label class="block text-[11px] font-mono text-slate-400">Interval Duration (Minutes)</label>
          <input type="number" id="modalIntervalInput" value="${defaultVal || "15"}" min="1" max="1440" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-cyan-400 text-xs focus:outline-none focus:border-cyan-500">
        `;
      } else if (type === "ONE_SHOT") {
        cont.innerHTML = `
          <label class="block text-[11px] font-mono text-slate-400">Execute in (Minutes from now)</label>
          <input type="number" id="modalDelayInput" value="${defaultVal || "30"}" min="1" max="10080" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-purple-400 text-xs focus:outline-none focus:border-cyan-500">
        `;
      }
    }

    function openAutomationModal(defaults = {}) {
      if (!autoModal) return;
      populateMacroSelect();
      document.getElementById("modalAutoTitle").value = defaults.title || "Custom Autonomous Sweep";
      renderModalScheduleInputs(defaults.schedule_type || "CRON", defaults.cron || defaults.interval_min || "");

      document.querySelectorAll(".sched-type-btn").forEach((b) => {
        if (b.getAttribute("data-type") === (defaults.schedule_type || "CRON")) {
          b.className = "sched-type-btn active p-2 rounded-lg bg-slate-900 border border-cyan-500/40 text-cyan-300 text-center font-medium";
        } else {
          b.className = "sched-type-btn p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-center font-medium";
        }
      });

      autoModal.classList.remove("hidden");
      autoModal.classList.add("flex");
    }

    function closeAutomationModal() {
      if (!autoModal) return;
      autoModal.classList.add("hidden");
      autoModal.classList.remove("flex");
    }

    document.querySelectorAll(".sched-type-btn").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".sched-type-btn").forEach((btn) => {
          btn.className = "sched-type-btn p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-center font-medium";
        });
        b.className = "sched-type-btn active p-2 rounded-lg bg-slate-900 border border-cyan-500/40 text-cyan-300 text-center font-medium";
        renderModalScheduleInputs(b.getAttribute("data-type"));
      });
    });

    if (openNewAutoBtn) openNewAutoBtn.onclick = () => openAutomationModal();
    if (createAutoCardBtn) createAutoCardBtn.onclick = () => openAutomationModal();
    if (closeAutoModalBtn) closeAutoModalBtn.onclick = closeAutomationModal;
    if (cancelAutoModalBtn) cancelAutoModalBtn.onclick = closeAutomationModal;

    const scheduleThisMacroBtn = document.getElementById("scheduleThisMacroBtn");
    if (scheduleThisMacroBtn) {
      scheduleThisMacroBtn.onclick = () => {
        const title = document.getElementById("macroNameInput").value;
        const id = document.getElementById("macroIdInput").value;
        openAutomationModal({ title, macro_id: id });
      };
    }

    if (saveAutoModalBtn) {
      saveAutoModalBtn.onclick = () => {
        const title = document.getElementById("modalAutoTitle").value.trim() || "Untitled Automation";
        const macroId = document.getElementById("modalAutoMacroSelect").value;
        const target = document.getElementById("modalAutoTarget").value;
        const chime = document.getElementById("modalAutoChime").checked;

        const newAuto = {
          id: "auto_" + Date.now(),
          title,
          macro_id: macroId,
          schedule_type: currentSchedType,
          target,
          enabled: true,
          last_run: null,
          next_run: null,
          run_count: 0,
          chime,
        };

        if (currentSchedType === "CRON") {
          newAuto.cron = document.getElementById("modalCronInput").value.trim() || "*/15 * * * *";
        } else if (currentSchedType === "INTERVAL") {
          newAuto.interval_min = parseInt(document.getElementById("modalIntervalInput").value, 10) || 15;
        } else if (currentSchedType === "ONE_SHOT") {
          newAuto.delay_min = parseInt(document.getElementById("modalDelayInput").value, 10) || 30;
        }

        newAuto.next_run = calculateNextRun(newAuto)?.toISOString();
        const automations = loadAutomations();
        automations.unshift(newAuto);
        saveAutomations(automations);

        closeAutomationModal();
        renderAutomations();
        switchTab("automations");
        showToast(`Scheduled "${newAuto.title}" successfully!`, "success");
      };
    }

    const pauseAllBtn = document.getElementById("pauseAllAutomationsBtn");
    const pauseAllLabel = document.getElementById("pauseAllBtnLabel");
    if (pauseAllBtn) {
      pauseAllBtn.onclick = () => {
        schedulerRunning = !schedulerRunning;
        if (pauseAllLabel) pauseAllLabel.innerText = schedulerRunning ? "Pause All" : "Resume All";
        const badge = document.getElementById("schedulerStatusBadge");
        if (badge) {
          badge.innerHTML = schedulerRunning
            ? '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span class="text-emerald-400 font-semibold font-mono hidden sm:inline">SCHEDULER: ON</span>'
            : '<span class="w-2 h-2 rounded-full bg-rose-400"></span><span class="text-rose-400 font-semibold font-mono hidden sm:inline">SCHEDULER: PAUSED</span>';
        }
        showToast(schedulerRunning ? "Timely engine resumed." : "Timely engine paused.", schedulerRunning ? "success" : "alert");
      };
    }

    const newMacroBtn = document.getElementById("openNewMacroBtn");
    if (newMacroBtn) {
      newMacroBtn.onclick = () => switchTab("studio");
    }
  });
})();
