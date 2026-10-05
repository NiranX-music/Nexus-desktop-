# Nexus AI Agent — Cross-Device Command Bridge 🌐⚡📱

> **Architecture Specification:** Production-grade, 100% Free-Tier, Zero-Card Cross-Device Autonomous Bridge connecting a **Web Dashboard (PWA)**, a **Mobile Agent (Android Termux)**, and a **Local Desktop Daemon** for [Nexus AI Agent](https://github.com/NiranX-music/Nexus-desktop-).

---

## 🏛️ End-to-End Cross-Device Architecture

```
[Mobile Phone / PWA]                 [Desktop Browser / PWA]
  (Mic Voice / Touch UI)                (Full Command Dashboard)
         │                                      │
         └──────────────────┬───────────────────┘
                            │ (HTTPS / Bearer Auth)
                            ▼
               [Cloudflare Edge Platform]
               ├── Pages (Zero-cost hosting, CDN, PWA Service Worker)
               ├── Functions API (_middleware.js Auth Guard & Router)
               ├── D1 Database (Multi-Device Task Queue & Device Registry)
               └── R2 Storage (Zero-egress Voice clips & Screenshots)
                            │
                            ├──────────────────────────┐
                            │ (Audio / Complex Task)   │ (Pending Task Pull)
                            ▼                          ▼
                  [Modal Labs Cloud GPU]     [Task Router & Dispatch]
                  - Whisper STT (T4 GPU)                │             │
                  - Action Decomposer (JSON)            │             │
                            │                           │             │
                            └───────────────────────────┤             │
                                                        ▼             ▼
                                                 [Desktop PC]   [Android Phone]
                                                  Nexus Daemon   Termux:API
                                                 (OS Control)   (Device Control)
```

---

## 💰 100% Zero-Cost Free-Tier Guarantee

| Layer | Service / Tool | Exact Free Quota | Payment Card Needed? |
| :--- | :--- | :--- | :--- |
| **Frontend & Mobile UI** | **Cloudflare Pages** | **Unlimited** bandwidth, global CDN, SSL | ❌ **No** |
| **Edge Task Queue & State** | **Cloudflare D1** | **5,000,000 reads/day**, 100,000 writes/day, 5 GB | ❌ **No** |
| **Media & Blob Storage** | **Cloudflare R2** | **10 GB storage**, **$0 egress fees** | ❌ **No** |
| **Cloud GPU AI Brain** | **Modal Labs** | **$30.00 / month recurring credits**, 1 TiB volume | ❌ **No** |
| **Desktop Automation** | **Nexus Desktop (PC)** | Runs natively on host machine hardware | ❌ **No** |
| **Mobile Automation** | **Termux + Termux:API** | Linux shell, battery, vibration, clipboard, notifications | ❌ **No** |

---

## 📂 Project Structure

```
nexus-bridge/
├── frontend/                     # Cloudflare Pages PWA
│   ├── index.html                # Responsive Glassmorphic Dark UI (Tailwind CSS)
│   ├── app.js                    # Web Audio recording, polling, device status
│   ├── manifest.json             # Mobile installable configuration (Standalone)
│   ├── sw.js                     # Service Worker for PWA caching & push listeners
│   └── style.css                 # Custom scrollbars, glow effects & animations
├── functions/                    # Cloudflare Pages Functions (Edge API)
│   ├── _middleware.js            # Secret Token Authentication & CORS verification
│   └── api/
│       ├── [[route]].js          # D1 Router: /tasks, /heartbeat, /devices
│       └── upload.js             # Direct pre-signed R2 image/audio upload handler
├── backend/                      # Modal Labs Cloud GPU Brain
│   └── modal_ai.py               # Whisper STT + LLM Action Planner on T4 GPU
├── desktop_agent/                # Local Desktop Execution Layer
│   ├── config.json               # Device ID, Auth Token, D1 API URL
│   ├── nexus_daemon.py           # Polling loop, OS automation dispatcher (PyAutoGUI/Shell)
│   └── requirements.txt          # requests, pyautogui, pynput, Pillow, pyttsx3
├── mobile_agent/                 # Android Termux Execution Layer
│   ├── mobile_daemon.py          # Lightweight Python client for Android Termux
│   └── setup_termux.sh           # Shell script to install python, termux-api, dependencies
├── schema.sql                    # Cloudflare D1 Multi-Device Database Schema
└── wrangler.toml                 # Cloudflare Pages, D1, and R2 configuration
```

---

## 🚀 Deployment & Verification Checklist

### 1. Initialize Cloudflare D1 Database & Apply Schema

```bash
# 1. Install Wrangler CLI & log in
npm install -g wrangler
npx wrangler login

# 2. Create the D1 SQLite database
npx wrangler d1 create nexus-db
# Copy the returned database_id UUID into wrangler.toml under [[d1_databases]]

# 3. Apply the multi-device database schema
# For local development:
npx wrangler d1 execute nexus-db --local --file=schema.sql

# For production remote Cloudflare D1:
npx wrangler d1 execute nexus-db --remote --file=schema.sql
```

### 2. Deploy Cloudflare Pages Frontend & Edge Functions

```bash
# Deploy PWA and Pages Functions to Cloudflare Pages (*.pages.dev)
npx wrangler pages deploy frontend --project-name=nexus-bridge
```

*Optional Token Authentication:* Set `NEXUS_SECRET_KEY` in Cloudflare Pages dashboard under **Settings > Environment variables** to secure API writes.

### 3. Deploy Modal Labs Cloud GPU Backend

```bash
# 1. Install Modal CLI & authenticate ($30/mo free credits)
pip install modal
modal setup

# 2. Deploy the GPU microservice to Modal cloud
modal deploy backend/modal_ai.py
```
Modal will output your live URL:
```
https://<username>--nexus-ai-core-fastapi-app.modal.run
```
Paste this URL into your Web Dashboard **Settings (⚙️)** or set `MODAL_API_URL` in Cloudflare Pages environment variables.

### 4. Run the Local Desktop Daemon (PC)

```bash
cd desktop_agent
pip install -r requirements.txt
# Update config.json with your Cloudflare Pages URL if using remote deployment
python nexus_daemon.py
```

### 5. Run the Mobile Agent Setup on Android (Termux)

On your Android phone:
1. Install **Termux** and **Termux:API** from [F-Droid](https://f-droid.org/).
2. Open Termux and clone or copy `mobile_agent/`:
   ```bash
   chmod +x setup_termux.sh
   ./setup_termux.sh
   ```
3. Edit `.env` to point `D1_API_URL` to your Cloudflare Pages domain.
4. Launch the daemon:
   ```bash
   python mobile_daemon.py
   ```

---

## 🎯 Cross-Device Interaction Examples

1. **Desktop Action:**
   - Prompt: *"Open VS Code and check git status"*
   - Target: `DESKTOP`
   - Execution: Desktop daemon launches VS Code, presses `ctrl+shift+p`, runs `git status`, takes a screenshot, uploads to R2, and reports logs.

2. **Mobile Action:**
   - Prompt: *"Vibrate phone and notify task completed"*
   - Target: `MOBILE`
   - Execution: Termux triggers phone hardware vibration (`termux-vibrate`), creates high-priority Android alert, and reports battery level to D1.

3. **Voice Command:**
   - Click or hold **Record Voice** on your phone PWA.
   - Speech is streamed to Modal's T4 GPU for instant Whisper STT.
   - Modal action decomposer parses intent into target-specific JSON action steps and pushes to D1.
