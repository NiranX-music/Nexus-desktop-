## 🚀 Nexus AI Desktop v2.1.1 — Production Release

The next-generation autonomous desktop command layer with bidirectional streaming voice intelligence, spatial window telekinesis, ghost sequence automation, and deep work defense.

---

### 📦 Official Windows Release Assets

| Asset Name | Type | Description |
| :--- | :--- | :--- |
| **`nexus-ai-2.1.1-setup.exe`** | **NSIS Installer** | Recommended standard Windows installer with Desktop & Start Menu shortcuts. |
| **`Nexus AI 2.1.1.exe`** | **Portable Standalone** | Single-file portable executable; run directly without installation. |
| **`Nexus-AI-2.1.1-Direct-Run.zip`** | **Unpacked Bundle** | Complete portable folder containing binaries, resources, and Electron runtime. |
| **`latest.yml`** | **Update Manifest** | Electron auto-updater signature metadata. |

---

### 🌟 What's New & Resolved in v2.1.1

1. **Gemini Live Bidirectional Voice Streaming**:
   - Fixed tool duplicate declarations (`google_search`, `ingest_codebase`, `consult_oracle`) that previously caused `INVALID_ARGUMENT` WebSocket handshake rejections.
   - Wired schemas and dispatchers for `set_wallpaper`, `open_wallpaper_forge`, `forge_presentation`, `forge_spreadsheet`, `open_doc_forge`, `start_focus_session`, and `stop_focus_session`.
   - Direct URI telephone parsing for WhatsApp messaging.

2. **Deep Work Focus Protocol**:
   - Upgraded from one-off termination to a continuous 15-second background guard actively terminating blacklisted gaming and social media processes.
   - Automatic session completion when the timer expires.

3. **Spatial Telekinesis Window Engine**:
   - Implemented Win32 PowerShell user32 `MoveWindow`/`ShowWindow` fallback so multi-monitor window management functions seamlessly on systems without native C++ compilation toolchains.

4. **WhatsApp Automation Queue**:
   - Implemented background queue runner (`startWhatsAppQueueRunner`) that checks due timestamps and dispatches pending scheduled messages automatically via URI and web fallbacks.
   - Added `whatsapp-delete-scheduled` IPC handler for cancellation.

5. **Local-First Zero-Knowledge Auth**:
   - Added automatic fallback to local bcrypt credential storage (`email-auth:login`, `email-auth:register`) and a 1-click **Local Operator Direct Access** button for offline operation without cloud Supabase dependencies.

6. **Build & Dependency Stabilization**:
   - Aligned ESLint to `^9.39.5` (resolving fatal `contextOrFilename.getFilename is not a function` crash from ESLint 10).
   - Moved `node-window-manager` to optional dependencies with `patch-native-fallbacks.cjs` safeguarding native module loading.
