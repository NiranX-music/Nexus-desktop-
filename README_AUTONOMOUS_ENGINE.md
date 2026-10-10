# Nexus Antigravity Autonomous Agent Execution Engine

> **Distributed Infrastructure & Autonomous Systems Architecture**  
> 100% Free-Tier Services ONLY (Zero mandatory credit/debit cards).  
> Connected to Local Machine PTY, Isolated Git Worktrees, Headless Playwright, and Cloudflare Edge / D1.  
> **Strict Privacy Sovereignty**: 100% of reasoning traces, code contents, prompts, diffs, and memories remain strictly local on `~/.nexus-agent/db/agent_local.db`.

---

## 1. System Architecture & Lifecycle

The Nexus Autonomous Engine implements the complete **Antigravity Execution Lifecycle**:

```
[Thought / Plan] ──► [Tool Execution] ──► [Verification] ──► [Self-Correction] ──► [Review Artifact]
```

```
                        ┌───────────────────────────────────────────────┐
                        │      Cloudflare Edge Bridge (/api/bridge)      │
                        │    (Pages Functions, SSE Stream, Free D1)     │
                        │    *PRESENCE & EPHEMERAL SIGNALS ONLY*        │
                        └───────────────────────┬───────────────────────┘
                                                │ Persistent SSE Stream (<50ms)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL DESKTOP ENGINE RUNTIME                              │
│                                                                                        │
│   ┌───────────────────────────┐         ┌──────────────────────────────────────────┐   │
│   │     Intent Router &       │         │        Autonomous Orchestrator           │   │
│   │     Provider Mesh         ├────────►│   - Generates TASK_PLAN.md               │   │
│   │   (Groq / Gemini /        │         │   - Self-Correction Loop (Up to 3x)      │   │
│   │    Ollama / Custom)       │         │   - Streams Granular AgentStep Events    │   │
│   └─────────────┬─────────────┘         │   - Enforces Usage Governor (MAX 12)     │   │
│                 │                       │   - Dynamic ETA Predictor (EMA)          │   │
│                 ▼                       └────────────────────┬─────────────────────┘   │
│   ┌───────────────────────────┐                              │                         │
│   │ Local Sovereignty Store   │                              │                         │
│   │ ~/.nexus-agent/           │                              │                         │
│   │ - agent_local.db          │         ┌────────────────────┴─────────────────────┐   │
│   │ - Offline HTML Viewer     │         ▼                                          ▼   │
│   └───────────────────────────┘ ┌─────────────────────────────────┐ ┌──────────────────┐│
│                                 │   Isolated Git Worktrees        │ │ Tri-Tool Harness ││
│                                 │   git worktree add ../task-<id> │ │ - terminal_pty   ││
│                                 │   Atomic commits & rollback     │ │ - browser_verify ││
│                                 │                                 │ │ - fs_patch       ││
│                                 │                                 │ │ - desktop_ufo    ││
│                                 │                                 │ │ - tts_speaker    ││
│                                 └─────────────────────────────────┘ └──────────────────┘│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure & Zero-Cost Constraints Matrix

| Layer | Service / Technology | Cost | Role |
| :--- | :--- | :--- | :--- |
| **Local PTY Harness** | Python `TerminalHarness` (Win / POSIX) | $0.00 | Non-blocking command execution, timeout termination, stream capture. |
| **Git Sandboxing** | `WorkspaceManager` (Git Worktrees) | $0.00 | Ephemeral worktree isolation preventing dirty repo corruption. |
| **Browser Verifier** | Headless Playwright / Chromium | $0.00 | DOM verification, console log inspection, PNG screenshot proofing. |
| **Windows Accessibility** | `DesktopUFOInspector` (Microsoft UFO) | $0.00 | UI Automation tree walker grounding clicks without coordinate guessing. |
| **Usage Governor** | `UsageGovernor` & Rate Limiter | $0.00 | Step-count circuit breaker (MAX 12) & 20% quota warning broadcast. |
| **Dynamic ETA** | `ETAPredictor` (EMA Weights) | $0.00 | Dynamically updates duration forecasts as steps complete. |
| **Provider Mesh** | `ProviderMesh` (Groq, Gemini, Ollama) | $0.00 | Automated fallback cascade and dynamic custom model scaffolder. |
| **Local Sovereignty** | `LocalAgentStore` & `DataExporter` | $0.00 | 100% local SQLite storage & offline HTML single-file viewer. |
| **Cloud Edge Bridge** | Cloudflare Pages Functions (`/api/bridge`)| $0.00 | Free-tier persistent SSE stream (<50ms latency) & task dispatch. |
| **Cloud Queue / State** | Cloudflare D1 (`schema.sql`) | $0.00 | Free-tier serverless SQLite database for auth & presence only. |
| **Primary AI Inference** | Groq Cloud API (`llama-3.3-70b-versatile`)| $0.00 | High-speed intent decomposition & multi-step planning. |
| **Developer Mode AI** | Google AI Studio (`Gemini Pro / Flash`) | $0.00 | Free developer API keys stored strictly in local configuration. |

---

## 3. Scaffolding & Directory Structure

```
nexus-desktop/
├── engine/
│   ├── orchestrator.py             # Agent state machine, milestone planner & self-healing loop
│   ├── workspace.py                # Isolated Git worktree manager & unified diff engine
│   ├── governor.py                 # Usage restrictions: token bucket & step circuit breaker (MAX 12)
│   ├── eta_predictor.py            # Dynamic step-weighted ETA predictor (Exponential Moving Average)
│   ├── provider_mesh.py            # Quota trigger (<20%), dynamic adapter scaffolder & failover cascade
│   ├── local_store.py              # 100% local SQLite database (~/.nexus-agent/db/agent_local.db)
│   ├── exporter.py                 # Timestamped ZIP archiver with standalone READABLE_EXPORT_VIEWER.html
│   ├── router.py                   # Intent dispatcher (Shell vs. Win32 GUI vs. Browser vs. Voice)
│   └── tools/
│       ├── terminal_pty.py         # Persistent pseudo-terminal execution harness
│       ├── browser_verifier.py     # Headless Playwright runner, console inspector & screenshot capturer
│       ├── desktop_ufo.py          # Windows UI Automation accessibility tree walker (Microsoft UFO pattern)
│       └── filesystem_patch.py     # Line-level atomic patcher & unified diff applier
├── bridge/
│   ├── sse_client.py               # Low-latency SSE client with auto-reconnect (<50ms delivery)
│   ├── cloudflare_listener.py      # Persistent SSE daemon listening to /api/bridge
│   ├── tts_speaker.py              # Zero-cost local voice feedback (Edge-TTS / SAPI)
│   └── tts_feedback.py             # Local Edge-TTS engine with fallback
├── web_control/
│   ├── functions/
│   │   ├── _middleware.js          # Shared secret Bearer token auth & uniform CORS
│   │   └── api/
│   │       ├── bridge.js           # Low-latency persistent SSE stream router & signal dispatcher
│   │       ├── quota.js            # Usage tracker & 20% quota warning broadcast endpoint
│   │       └── devices.js          # Device presence & heartbeat registry
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentTraceFeed.tsx  # Interactive agent activity feed: thoughts, diffs, terminal logs
│   │   │   ├── QuotaModal.tsx      # Low-quota (<20%) interception modal for key injection
│   │   │   ├── SettingsModal.tsx   # Developer Mode settings: provider selector & local endpoints
│   │   │   └── Settings.tsx        # Settings core form
│   │   ├── services/
│   │   │   └── drive_sync.ts       # Google Drive appDataFolder zero-cost persistence sync
│   │   ├── App.tsx                 # Main dashboard layout with status telemetry & active run HUD
│   │   ├── sw.ts                   # PWA Service Worker for offline mobile caching
│   │   └── manifest.json           # Mobile installable configuration
│   └── schema.sql                  # Cloudflare D1 schema (auth, presence, ephemeral signals ONLY)
├── scripts/
│   ├── uninstall_hook.py           # Pre-uninstall data sovereignty preservation hook
│   ├── uninstall.sh                # POSIX uninstallation shell script
│   └── installer.nsi               # Windows NSIS installer with pre-uninstall preservation
├── tests/
│   ├── test_workspace.py           # Worktree branch creation and safe teardown
│   ├── test_terminal_pty.py        # PTY stdout streaming and exit code capture
│   ├── test_self_healing.py        # Self-healing loop recovery on simulated failures
│   ├── test_governor.py            # Usage restrictions, circuit breaker, and 20% quota trigger
│   ├── test_eta_predictor.py       # Dynamic step-weighted ETA predictor with EMA
│   ├── test_provider_mesh.py       # Multi-provider cascade and custom endpoint scaffolding
│   └── test_local_store_and_export.py # Local sovereignty database and offline HTML viewer bundle
└── nexus_runner.py                 # Unified CLI/TUI runner with live milestone rendering
```

---

## 4. Local Execution & CLI Commands

### 1. Run an Autonomous Task
```bash
python nexus_runner.py --task "Implement new auth component, run unit tests, and verify in headless browser"
```

### 2. Launch Interactive REPL Loop
```bash
python nexus_runner.py --interactive
```

### 3. Export 100% Local Sovereignty Archive
```bash
python nexus_runner.py --export-data
```
Generates a timestamped archive (`nexus_agent_export_<TIMESTAMP>.zip`) on your Desktop or home directory containing:
- `data/agent_local.db`
- `data/tasks_full.json`, `data/memories.json`, `data/diffs.json`
- `READABLE_EXPORT_VIEWER.html`: Open this file in **any browser offline** to view all reasoning traces, tool executions, code diffs, and episodic memories without needing a server!

### 4. Check System & Sovereignty Status
```bash
python nexus_runner.py --status
```

### 5. Run Complete Test Suite
```bash
python -m unittest discover -s tests -v
```
