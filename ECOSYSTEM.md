# NEXUS OS — Enterprise Multi-Site Architecture & Deployment Guide

Welcome to the **NEXUS OS** distributed intelligence runtime and multi-tier micro-frontend ecosystem.

---

## 1. Complete 16-Tier Architecture & System Matrix

| # | Layer / Tier | Name / Identifier | Type | Primary Role & Responsibilities | Host / Deployment Target | Implementation Location |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Frontend | **Landing & Distribution Portal** | Web (SPA / SSR) | 3D WebGL particle interface, minimal-maximalist layout, SEO JSON-LD schema, binary download hub. | Cloudflare Pages (`site-root`) | [`landing-site/index.html`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/landing-site/index.html) |
| **2** | Frontend | **User Identity Gateway** | Web (SPA) | User registration, password/WebAuthn login, cross-device JWT issuance, deep-link authentication handoff. | Cloudflare Pages (`auth.domain.com`) | [`auth-site/index.html`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/auth-site/index.html) |
| **3** | Frontend | **Live Radar & Telemetry** | Web (SPA) | Real-time agent status dashboard, latency tracking, uptime logs, service pulse telemetry. | Cloudflare Pages (`status.domain.com`) | [`status-site/index.html`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/status-site/index.html) |
| **4** | Frontend | **Tier-4 Admin Command HQ** | Web (SPA) | Restricted administrative portal with cryptographic master key verification and triple-mail OTP consensus. | Cloudflare Pages + Zero Trust (`admin.domain.com`) | [`admin-site/index.html`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/admin-site/index.html) |
| **5** | Native Client | **Linux Desktop & Daemon** | Native App / CLI | Standalone client (`.AppImage` / `.deb`) and background headless CLI daemon (`nexus-cli`) for Linux systems. | Local Linux (Tauri / Rust core) | [`src-tauri/`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/src-tauri), [`landing-site/binaries/`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/landing-site/binaries) |
| **6** | Native Client | **Android Mobile App** | Mobile App | Mobile client (`.apk`) with deep-link session bridging (`nexus://auth?token=...`) and push sync. | Android Runtime / APK | [`landing-site/binaries/nexus-mobile.apk`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/landing-site/binaries/nexus-mobile.apk) |
| **7** | Native Client | **Windows / macOS Desktop** | Desktop App | Native GUI desktop application (`.exe` / `.dmg`) maintaining persistent workstation sessions. | Local Windows / macOS (Tauri) | [`landing-site/binaries/nexus-setup.exe`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/landing-site/binaries/nexus-setup.exe) |
| **8** | Backend | **Auth & Session Bridge Service** | Microservice / Worker | Session lifecycle management, JWT signing/refresh, session revocation, cross-platform token sync. | Cloudflare Workers / D1 | [`functions/api/[[route]].js`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/functions/api/%5B%5Broute%5D%5D.js) (Section 5) |
| **9** | Backend | **Dual-Key & Triple-Mail Engine** | Microservice / Worker | Dispatches 3 parallel OTP tokens (Owner, Tech, SecOps), validates SHA-256 hashes, checks master passphrase. | Cloudflare Workers | [`functions/api/[[route]].js`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/functions/api/%5B%5Broute%5D%5D.js) (Section 6) |
| **10** | Backend | **Public Gateway API (v1)** | API Gateway | Reverse proxy and central router for web, mobile, and native client calls (`api.nexus.io/v1`). | Cloudflare Workers / Edge Gateway | [`functions/api/[[route]].js`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/functions/api/%5B%5Broute%5D%5D.js) (Section 7) |
| **11** | Backend | **Telemetry & Heartbeat Ingestion** | Microservice / Worker | Aggregates health pings, error rates, and round-trip latencies, streaming SSE/WebSocket feeds to the Radar. | Cloudflare Workers / Durable Objects | [`functions/api/[[route]].js`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/functions/api/%5B%5Broute%5D%5D.js) (Section 8) |
| **12** | Sub-Agent | **Agent Alpha** *(Frontend Architect)* | Automated Daemon | Monitors UI assets, WebGL canvas performance, and dynamic SEO metadata updates. | CI/CD & Background Worker | [`landing-site/`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/landing-site) & Edge Registry |
| **13** | Sub-Agent | **Agent Beta** *(Identity & Sync)* | Automated Daemon | Oversees session token handoffs, deep-link validations, and multi-device identity coherence. | CI/CD & Background Worker | [`auth-site/`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/auth-site) & Edge Registry |
| **14** | Sub-Agent | **Agent Gamma** *(Telemetry Radar)* | Automated Daemon | Pings all APIs, endpoints, and microservices on intervals to calculate uptime and response times. | Edge Cron Trigger / Daemon | [`status-site/`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/status-site) & Edge Registry |
| **15** | Sub-Agent | **Agent Delta** *(Security & Zero Trust)* | Automated Daemon | Audits authentication logs, flags anomalous admin login attempts, and enforces access control policies. | Cloudflare Security / Worker | [`admin-site/`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/admin-site) & Edge Registry |
| **16** | Sub-Agent | **Agent Epsilon** *(Binary Packaging)* | Automated Daemon | Orchestrates CI/CD pipelines to build and package native binaries (`.AppImage`, `.deb`, `.apk`, `.exe`). | GitHub Actions / Build Server | [`.github/workflows/package-binaries.yml`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/.github/workflows/package-binaries.yml) |

---

## 2. Security & Admin Protocol Specification

### A. Master Admin Cryptographic Passcode
```text
SEC-X94-K982-Z710-Q441-V019-DELTA
```

### B. Triple-Mail Authentication Sequence (3-Tier Consensus)
1. **Trigger:** The administrator clicks **"DISPATCH TOKENS"** in the Tier-4 security terminal.
2. **Dispatch:** The consensus engine generates three distinct 6-digit cryptographic TOTP tokens dispatched to:
   - `barhateniranjan725@gmail.com` (Master Token A - Owner)
   - `niranjanbarhate42@gmail.com` (Engineering Token B - Tech Lead)
   - `niranjanbarhate36@gmail.com` (Security Token C - SecOps)
3. **Consensus Validation:** The gate only resolves and issues an active Administrator session if all three tokens are validated alongside the Master Passcode within a strict **180-second cryptographic window**.
4. **Unlocked Command HQ:**
   - **Autonomous System Inspector:** Live continuous monitoring chips for D1, R2, Edge Gateways, and Sub-Agents.
   - **Sub-Agent Fleet Orchestrator:** Live controls to Restart, Scale, and Flush Agents Alpha through Epsilon.
   - **Emergency Kill Switch:** Purge all active sessions across web, desktop, and mobile clients with one click.
   - **Edge Maintenance Mode & Cache Purge:** Controls for instant Cloudflare CDN purging.
   - **D1 / SQLite Database Browser:** Live inspection of registered users, roles, and session states.

---

## 3. Instant Cloudflare Pages Deployment

### Option 1: Using Wrangler CLI (Recommended when `wrangler.toml` is present)
```bash
# Deploy Site 1: Landing Page & Download Hub
wrangler pages deploy ./landing-site --project-name=ecosystem-landing

# Deploy Site 2: Identity & Session Gateway
wrangler pages deploy ./auth-site --project-name=ecosystem-auth

# Deploy Site 3: Agent & API Operations Radar
wrangler pages deploy ./status-site --project-name=ecosystem-status

# Deploy Site 4: Tier-4 Admin Command HQ
wrangler pages deploy ./admin-site --project-name=ecosystem-admin
```

### Option 2: Using Cloudflare `cf` CLI
```bash
cf pages deploy ./landing-site --project-name=ecosystem-landing
cf pages deploy ./auth-site --project-name=ecosystem-auth
cf pages deploy ./status-site --project-name=ecosystem-status
cf pages deploy ./admin-site --project-name=ecosystem-admin
```

### Option 3: Automated One-Click Deployment Scripts
- **PowerShell (Windows):** `.\deploy-ecosystem.ps1 -Tool wrangler` or `.\deploy-ecosystem.ps1 -Tool cf`
- **Bash (Linux/macOS):** `./deploy-ecosystem.sh wrangler` or `./deploy-ecosystem.sh cf`

---

## 4. Custom Subdomain Routing in Cloudflare Dashboard

Once deployed to Cloudflare Pages, bind your custom subdomains under **Cloudflare Dashboard > Workers & Pages > Custom Domains**:

| Subdomain | Target Project | Purpose |
| :--- | :--- | :--- |
| `@` (`nexus.io`) | `ecosystem-landing` | 3D Glassmorphic Landing Page & Binary Downloads |
| `auth.` (`auth.nexus.io`) | `ecosystem-auth` | User Account Creation, Sign In & Deep-Link Bridge |
| `status.` (`status.nexus.io`) | `ecosystem-status` | Sub-Agent & Edge API Operations Radar |
| `admin.` (`admin.nexus.io`) | `ecosystem-admin` | Restricted Tier-4 Console (Protected by Zero Trust) |

---

## 5. Linux Packaging & Cross-Platform Wrapper (Tauri)

### Building Native Linux Executables (`.AppImage` & `.deb`)
```bash
# 1. Install Tauri CLI if not already present
cargo install tauri-cli --version "^1.5"

# 2. Compile Linux release bundles
cargo tauri build --target-dir src-tauri/target
```

Output binaries will be generated in:
- `src-tauri/target/release/bundle/appimage/NexusOS.AppImage`
- `src-tauri/target/release/bundle/deb/nexus-desktop_4.2.0_amd64.deb`

### Native Deep-Link Protocol Handler
The desktop application registers the `nexus://` custom URI scheme in both `tauri.conf.json` and Linux `.desktop` entries. When a user clicks **"Bridge Session to Native App"** on `auth.nexus.io`, the web browser hands off the session token directly into the native runtime:
```text
nexus://auth?token={JWT_TOKEN}&user={USER_EMAIL}
```

---

## 6. Pre-Installed Downloadable Binaries
The landing page includes ready-to-download binary packages under `/binaries/`:
- `landing-site/binaries/nexus-desktop.AppImage`
- `landing-site/binaries/nexus-desktop.deb`
- `landing-site/binaries/nexus-mobile.apk`
- `landing-site/binaries/nexus-setup.exe`
- `landing-site/binaries/nexus-cli-linux-amd64.tar.gz`
- `landing-site/binaries/install.sh` (Universal one-line terminal installer)

---

## 7. Autonomous System Inspector & Auto-Healing Watchdog

The ecosystem incorporates an autonomous 24/7 self-healing watchdog running both at the Cloudflare Edge (`/api/inspector/*`) and locally via [`system_inspector.py`](file:///c:/Users/NiranX/Documents/antigravity/Nexus%20Desktop/system_inspector.py).

### Capabilities
- **Continuous System Sweep:** Periodically monitors D1 SQLite database latency, R2 object store reachability, edge API gateway health, and Sub-Agent execution heartbeats.
- **Autonomous Remediation (Auto-Fix):**
  - Detects and automatically purges expired/orphaned JWT sessions.
  - Automatically clears temporary SQLite locks and flushes warm connection pools.
  - Rebalances edge routing if cross-region latency degrades.
- **Tri-Mail Incident Alerting Array:**
  If an anomaly or critical infrastructure degradation is detected, structured incident alerts are instantly dispatched to:
  1. `barhateniranjan725@gmail.com` (Owner)
  2. `niranjanbarhate42@gmail.com` (Tech Lead)
  3. `niranjanbarhate36@gmail.com` (SecOps)
- **Live Observability:**
  - Real-time diagnostic panel directly inside the **Tier-4 Admin Command HQ** (`admin-site/index.html`).
  - Active watchdog telemetry chip displayed on the **System Radar** (`status-site/index.html`).

### Running the System Inspector Daemon
```bash
# Single Diagnostic Health Sweep
python system_inspector.py --once

# Continuous Background Watchdog (Default: 10s intervals)
python system_inspector.py --daemon

# Dispatch Test Anomaly Alert to the 3 Admin Emails
python system_inspector.py --test-alert

# Trigger Manual Self-Healing Routine
python system_inspector.py --heal CACHE
```

