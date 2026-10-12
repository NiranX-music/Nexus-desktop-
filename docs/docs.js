// Nexus Macros Documentation Client Script
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // 1. Copy Code Buttons
  document.querySelectorAll(".copy-code-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const container = btn.closest(".rounded-2xl");
      if (!container) return;
      const codeBlock = container.querySelector("pre code");
      if (!codeBlock) return;
      
      navigator.clipboard.writeText(codeBlock.innerText).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i> Copied!`;
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          if (window.lucide) window.lucide.createIcons();
        }, 2000);
      });
    });
  });

  // 2. Interactive Cron Calculator & Plain English Explainer
  const cronInput = document.getElementById("interactiveCronInput");
  const cronHuman = document.getElementById("interactiveCronHuman");
  const nextRunsList = document.getElementById("interactiveNextRunsList");
  const tzSelect = document.getElementById("interactiveTzSelect");
  const clockDisplay = document.getElementById("cronTickingClock");
  const openInAppBtn = document.getElementById("openInAppCronBtn");

  function explainCron(cron) {
    const parts = (cron || "").trim().split(/\s+/);
    if (parts.length !== 5) {
      return "Invalid cron expression (requires 5 fields: minute, hour, day-of-month, month, day-of-week)";
    }
    const [min, hr, dom, mon, dow] = parts;

    if (min === "*/5" && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
      return "Every 5 minutes, 24 hours a day";
    }
    if (min === "*/15" && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
      return "Every 15 minutes, 24 hours a day";
    }
    if (min === "0" && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
      return "At the start of every hour (e.g. 01:00, 02:00, 03:00)";
    }
    if (min === "0" && hr === "0" && dom === "*" && mon === "*" && dow === "*") {
      return "Every day at midnight (00:00:00)";
    }
    if (min === "30" && hr === "8" && dom === "*" && mon === "*" && dow === "*") {
      return "At 08:30 AM every day";
    }
    if (min === "0" && hr === "18" && dom === "*" && mon === "*" && (dow === "1-5" || dow === "MON-FRI")) {
      return "At 06:00 PM (18:00), Monday through Friday";
    }
    if (min === "0" && hr === "9" && dom === "*" && mon === "*" && (dow === "1-5" || dow === "MON-FRI")) {
      return "At 09:00 AM, Monday through Friday";
    }

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
      else if (dow === "0" || dow === "7") desc += " on Sundays";
      else desc += ` on day-of-week ${dow}`;
    }

    if (dom !== "*") desc += ` on day-of-month ${dom}`;
    if (mon !== "*") desc += ` in month ${mon}`;

    return desc;
  }

  function computeNextRuns(cron, count = 5) {
    const parts = (cron || "").trim().split(/\s+/);
    if (parts.length !== 5) return [];

    const [minStr, hrStr, domStr, monStr, dowStr] = parts;
    const now = new Date();
    const results = [];
    const checkDate = new Date(now.getTime() + 60000); // start next minute
    checkDate.setSeconds(0, 0);

    const matchPart = (val, pattern) => {
      if (pattern === "*") return true;
      if (pattern.startsWith("*/")) {
        const step = parseInt(pattern.slice(2), 10);
        return val % step === 0;
      }
      if (pattern.includes(",")) {
        return pattern.split(",").map(Number).includes(val);
      }
      if (pattern.includes("-")) {
        const [start, end] = pattern.split("-").map(Number);
        return val >= start && val <= end;
      }
      return parseInt(pattern, 10) === val;
    };

    let attempts = 0;
    while (results.length < count && attempts < 100000) {
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
        results.push(new Date(checkDate));
      }
      checkDate.setMinutes(checkDate.getMinutes() + 1);
    }
    return results;
  }

  function updateCronCalculator() {
    if (!cronInput || !cronHuman || !nextRunsList) return;
    const expr = cronInput.value.trim();
    cronHuman.innerText = explainCron(expr);

    const nextRuns = computeNextRuns(expr, 5);
    nextRunsList.innerHTML = "";

    if (nextRuns.length === 0) {
      nextRunsList.innerHTML = `<div class="p-2 text-rose-400">Invalid cron pattern or no matches found in next 60 days.</div>`;
      return;
    }

    nextRuns.forEach((date, i) => {
      const diffMs = date.getTime() - Date.now();
      const diffMin = Math.round(diffMs / 60000);
      let relative = "";
      if (diffMin < 60) relative = `in ${diffMin}m`;
      else if (diffMin < 1440) relative = `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
      else relative = `in ${Math.floor(diffMin / 1440)}d`;

      const div = document.createElement("div");
      div.className = "p-2.5 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-between";
      div.innerHTML = `
        <span class="text-slate-300">#${i + 1} &bull; ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
        <span class="text-emerald-400 font-semibold text-[10px] bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20">${relative}</span>
      `;
      nextRunsList.appendChild(div);
    });

    if (openInAppBtn) {
      openInAppBtn.href = `https://ecosystem-landing.pages.dev/macros.html?cron=${encodeURIComponent(expr)}`;
    }
  }

  if (cronInput) {
    cronInput.addEventListener("input", updateCronCalculator);
    document.querySelectorAll(".cron-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        cronInput.value = btn.getAttribute("data-cron");
        updateCronCalculator();
      });
    });
    updateCronCalculator();
  }

  // Live ticking clock
  setInterval(() => {
    if (clockDisplay) {
      clockDisplay.innerText = new Date().toLocaleTimeString();
    }
  }, 1000);

  // 3. Search Filter in Docs
  const searchInput = document.getElementById("docsSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const sections = document.querySelectorAll("main section");
      sections.forEach(sec => {
        if (!q) {
          sec.style.display = "";
          return;
        }
        const text = sec.innerText.toLowerCase();
        sec.style.display = text.includes(q) ? "" : "none";
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && searchInput) {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
        searchInput.blur();
      }
    });
  }

  // 4. Live JSON Validator
  const validatorInput = document.getElementById("jsonValidatorInput");
  const validatorFeedback = document.getElementById("validatorFeedback");
  const runValidationBtn = document.getElementById("runValidationBtn");

  function validateMacroJson() {
    if (!validatorInput || !validatorFeedback) return;
    try {
      const parsed = JSON.parse(validatorInput.value);
      if (!parsed.id || !parsed.name || !Array.isArray(parsed.steps)) {
        validatorFeedback.className = "text-amber-400 flex items-center gap-1.5 text-[11px]";
        validatorFeedback.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4"></i> JSON is valid, but missing required fields ('id', 'name', or 'steps' array).`;
      } else {
        validatorFeedback.className = "text-emerald-400 flex items-center gap-1.5 text-[11px]";
        validatorFeedback.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Valid Nexus Macro v4.2 Schema (${parsed.steps.length} steps configured)`;
      }
    } catch (err) {
      validatorFeedback.className = "text-rose-400 flex items-center gap-1.5 text-[11px]";
      validatorFeedback.innerHTML = `<i data-lucide="x-circle" class="w-4 h-4"></i> Syntax Error: ${err.message}`;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  if (runValidationBtn) {
    runValidationBtn.addEventListener("click", validateMacroJson);
  }
  if (validatorInput) {
    validatorInput.addEventListener("input", validateMacroJson);
  }

  // 5. Sidebar Navigation Spy
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll(".docs-nav-link").forEach(link => {
          if (link.getAttribute("href") === `#${id}`) {
            link.classList.add("active");
          } else {
            link.classList.remove("active");
          }
        });
      }
    });
  }, { rootMargin: "-20% 0px -70% 0px" });

  document.querySelectorAll("main section").forEach(sec => {
    if (sec.id) observer.observe(sec);
  });
});
