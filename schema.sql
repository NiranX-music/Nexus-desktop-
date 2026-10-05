-- ==============================================================================
-- Cloudflare D1 Multi-Device Database Schema for Nexus AI Agent Bridge
-- Target Platforms: Web Dashboard (PWA), Local Desktop Daemon, Android Termux,
-- Landing Hub, Auth Gateway, Status Radar, and Tier-4 Admin Console.
-- Free-Tier Database: Cloudflare D1 Serverless SQLite (5GB storage, 5M reads/day)
-- ==============================================================================

-- 1. Devices Registry Table (Multi-Device Targeting & Real-time State)
CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    device_type TEXT NOT NULL CHECK(device_type IN ('DESKTOP', 'MOBILE', 'WEB')),
    device_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(status IN ('ONLINE', 'BUSY', 'OFFLINE')),
    battery_level INTEGER DEFAULT 100,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tasks Queue & Multi-Device Execution Log Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    source_device TEXT NOT NULL DEFAULT 'WEB',
    target_device TEXT NOT NULL DEFAULT 'DESKTOP' CHECK(target_device IN ('DESKTOP', 'MOBILE', 'ALL')),
    command_type TEXT NOT NULL CHECK(command_type IN ('VOICE_PROMPT', 'TERMINAL_EXEC', 'DESKTOP_GUI', 'MOBILE_ACTION')),
    prompt_raw TEXT NOT NULL,
    action_plan TEXT,                       -- Validated JSON action steps emitted by AI planner
    media_r2_url TEXT,                      -- Cloudflare R2 object URL (voice clip, screenshot, log)
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED', 'PLANNING_AI', 'DISPATCHED', 'COMPLETED', 'FAILED')),
    execution_log TEXT,                     -- Stdout/stderr, action results, or failure traceback
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 3. Users Table (Identity & Auth Gateway)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    salt_hex TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- 4. Sessions Table (Active JWT / Cross-Device Bridge Sessions)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Telemetry Logs Table (Real-time Operations & Sub-Agent Audit Trail)
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    latency_ms REAL DEFAULT 0,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. System Settings & Consensus State (Tier-4 Admin Controls)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Optimization Indexes for High-Frequency Edge Polling & Radar Queries
CREATE INDEX IF NOT EXISTS idx_tasks_target_status ON tasks(target_device, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_heartbeat ON devices(last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON telemetry_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_source ON telemetry_logs(source);
