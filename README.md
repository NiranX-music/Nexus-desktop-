# Nexus Desktop — Remote Web Control Bridge 🌐⚡

> **Principal Architecture:** 100% Free-Tier, Zero-Subscription, Zero-Card Edge-to-Desktop Autonomous Bridge connecting [Nexus Desktop](https://github.com/NiranX-music/Nexus-desktop-) with a responsive remote web control dashboard.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Frontend Client (Cloudflare Pages: *.pages.dev)                     │
│    - Responsive Dark-Mode Mission Dashboard (Tailwind CSS)             │
│    - Web Audio API Voice Recorder & Canvas Visualizer                  │
│    - Live Agent Heartbeat Monitor & Real-Time Task Stream              │
│    - 100% Free: Unlimited global CDN bandwidth, zero egress fees       │
└────────────────────┬───────────────────────────────────▲───────────────┘
                     │                                   │
                     ▼                                   │
┌────────────────────────────────────────┐               │
│ 2. Edge State & Storage                │               │
│    (Cloudflare D1 & R2)                │               │
│    - D1: Serverless SQLite Task Queue  │               │
│    - R2: Raw Voice Blobs & Screenshots │               │
│    - Zero egress penalties, 100% free  │               │
└────────────────────┬───────────────────┘               │
                     │                                   │
                     ▼                                   │
┌────────────────────────────────────────┐               │
│ 3. Heavy AI Compute Engine             │               │
│    (Modal Labs: *.modal.run)           ├───────────────┘
│    - NVIDIA T4 Cloud GPU (CUDA)        │ (Free: $30/mo credits & 1 TiB storage)
│    - Whisper STT (Fast Speech-to-Text) │
│    - Autonomous Action Planner (LLM)   │ (Auto-scales to 0 when idle)
└────────────────────┬───────────────────┘
                     │
                     ▼ (Edge Task Polling / Dispatch)
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Local Execution Agent (`Nexus Desktop` Daemon & Bridge)             │
│    - Runs on user's physical machine (Windows/Linux/macOS)             │
│    - Drives OS: Shell/PowerShell, PyAutoGUI, Keyboard, Mouse, TTS     │
│    - Native Integration: Directly hooks Nexus Desktop app (port 17173) │
│    - Pings D1 /api/heartbeat & reports task outputs back to Edge       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💰 The 100% Free-Tier Guarantee

| Component | Platform | Free Tier Allocation | Credit Card Required? |
| :--- | :--- | :--- | :--- |
| **Dashboard CDN** | Cloudflare Pages | **Unlimited** requests & bandwidth | ❌ No |
| **Edge Database** | Cloudflare D1 | **5,000,000 reads / day**, 100,000 writes / day | ❌ No |
| **Object Storage**| Cloudflare R2 | **10 GB storage**, Zero egress fees | ❌ No |
| **GPU Compute**   | Modal Labs | **\$30.00 / month free credits** + 1 TiB volume | ❌ No |
| **Local Daemon**  | Local Machine | Runs natively on host hardware | ❌ No |

---

## 📂 Repository Structure

```
.
├── schema.sql                   # Cloudflare D1 SQL schema (nexus_tasks & heartbeat)
├── wrangler.toml                # Cloudflare Pages Functions & D1/R2 configuration
├── functions/
│   └── api/
│       └── [[route]].js         # Edge Worker API Router (Tasks, Heartbeat, R2, CORS)
├── backend/
│   ├── modal_ai.py              # Modal Labs GPU Serverless microservice (Whisper + Planner)
│   └── requirements.txt         # Modal backend Python dependencies
├── frontend/
│   ├── index.html               # Responsive dark-mode Tailwind dashboard
│   ├── app.js                   # Client logic (Web Audio recording, polling, D1 API)
│   └── style.css                # Custom scrollbars, glowing animations
├── nexus_bridge/
│   ├── nexus_bridge.py          # Local Python daemon (Heartbeat, D1 polling, OS automation)
│   ├── requirements.txt         # Python requirements for local daemon
│   └── .env.example             # Local daemon environment template
├── nexus_bridge.py              # Root runner wrapper (python nexus_bridge.py)
└── README.md                    # System architecture & deployment guide
```

---

## 🚀 Step-by-Step Setup & Deployment

### Step 1: Cloudflare D1 Database & Edge API Setup

1. **Install Wrangler CLI** (if not already installed):
   ```bash
   npm install -g wrangler
   # Authenticate with your free Cloudflare account
   npx wrangler login
   ```

2. **Create the Serverless D1 SQLite Database**:
   ```bash
   npx wrangler d1 create nexus-db
   ```
   *Wrangler will print your `database_id` UUID. Copy it and paste it into `wrangler.toml`:*
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "nexus-db"
   database_id = "<PASTE-YOUR-D1-DATABASE-ID-HERE>"
   ```

3. **Execute the Database Schema**:
   - For **Local Development**:
     ```bash
     npx wrangler d1 execute nexus-db --local --file=schema.sql
     ```
   - For **Production Remote Database**:
     ```bash
     npx wrangler d1 execute nexus-db --remote --file=schema.sql
     ```

4. **Deploy the Frontend & Edge Functions to Cloudflare Pages**:
   ```bash
   npx wrangler pages deploy frontend --project-name=nexus-desktop-bridge
   ```
   *(Or link your GitHub repo directly in the Cloudflare Pages web console with build directory set to `frontend`)*.

---

### Step 2: Deploy Modal Labs GPU AI Microservice

Modal provides **\$30/mo in free GPU credits** and automatically sleeps when not in use (0 cold cost).

1. **Install Modal CLI and Authenticate**:
   ```bash
   pip install modal
   modal setup
   ```

2. **Deploy the GPU App (`nexus-cloud-brain`)**:
   ```bash
   modal deploy backend/modal_ai.py
   ```

3. **Copy your generated Web Endpoint**:
   Modal will display your live ASGI URL:
   ```
   Created web endpoint: https://<username>--nexus-cloud-brain-fastapi-app.modal.run
   ```

4. **Verify the GPU Microservice**:
   Open `https://<username>--nexus-cloud-brain-fastapi-app.modal.run/health` in your browser. You should see:
   ```json
   {
     "ok": true,
     "service": "Nexus Cloud Brain",
     "gpu_available": true,
     "device_name": "Tesla T4",
     "status": "READY"
   }
   ```

---

### Step 3: Run the Local Nexus Desktop Bridge Daemon

The bridge daemon runs on your physical computer, listens to the Cloudflare D1 queue, and carries out the commands.

1. **Install Dependencies**:
   ```bash
   pip install -r nexus_bridge/requirements.txt
   ```
   *(Note: The bridge works even without PyAutoGUI using standard library fallback tools, but PyAutoGUI enables mouse/keyboard automation).*

2. **Configure Environment Variables**:
   Copy the `.env.example` file:
   ```bash
   cp nexus_bridge/.env.example nexus_bridge/.env
   ```
   Edit `nexus_bridge/.env`:
   ```ini
   # For local testing:
   D1_API_URL=http://127.0.0.1:8788/api

   # For production Cloudflare Pages deployment:
   # D1_API_URL=https://nexus-desktop-bridge.pages.dev/api

   POLL_INTERVAL_SECONDS=2.0
   HEARTBEAT_INTERVAL_SECONDS=30.0
   ```

3. **Start the Bridge Daemon**:
   ```bash
   python nexus_bridge.py
   ```

   You will see the startup banner:
   ```
   =================================================================
    🚀 NEXUS DESKTOP REMOTE BRIDGE DAEMON 
    100% Free Edge-To-Desktop Autonomous Control Bridge
   =================================================================
    Agent ID:       nexus-desktop-primary
    D1 Endpoint:    http://127.0.0.1:8788/api
    Poll Interval:  2.0s
    PyAutoGUI:      Installed
    Local TTS:      Windows SAPI Fallback
   =================================================================
   💓 Heartbeat background thread started.
   🔄 Polling D1 Queue every 2.0s...
   ```

---

### Step 4: Access Your Remote Web Dashboard

1. Open your Cloudflare Pages URL (e.g. `https://nexus-desktop-bridge.pages.dev`) from **any device** (Phone, Tablet, or Laptop).
2. The header indicator will instantly pulse green: **`Nexus Agent: ONLINE`**.
3. Click the ⚙️ Settings button to verify or paste your **Modal Labs URL**.
4. **Trigger Commands**:
   - **Voice**: Click **Record Voice** on your phone, speak your command (e.g., *"Check git status and capture a screenshot"*), and release. Modal's Whisper transcribes the speech, and the action plan is sent to D1.
   - **Bash / Terminal**: Select the **Bash / Shell** tab and run `dir`, `git log`, or custom shell scripts.
   - **Desktop Control**: Trigger keyboard shortcuts (`ctrl+shift+p`), mouse clicks, or typing.
5. The command will instantly execute on your PC, and the execution logs will stream back to your phone dashboard in real time!

---

## 🔒 Security & Best Practices

- **Zero Inbound Port Forwarding Required**: Because the local daemon polls D1 from inside your private network, you never need to open firewall ports or configure dynamic DNS.
- **Heartbeat Expiry**: The dashboard automatically flags the agent as `OFFLINE` if no heartbeat is received within 60 seconds.
- **Auth Tokens**: You can set an optional `AUTH_SECRET` in both Cloudflare Pages environment variables and `nexus_bridge/.env` to require Bearer authentication for all queue endpoints.
