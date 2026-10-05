-- ==============================================================================
-- Cloudflare D1 Multi-Device Database Schema for Nexus AI Agent Bridge
-- Target Platforms: Web Dashboard (PWA), Local Desktop Daemon, Android Termux
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
    action_plan TEXT,                       -- Validated JSON action steps emitted by Modal Labs AI
    media_r2_url TEXT,                      -- Cloudflare R2 object URL (voice clip, screenshot, log)
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED', 'PLANNING_AI', 'DISPATCHED', 'COMPLETED', 'FAILED')),
    execution_log TEXT,                     -- Stdout/stderr, action results, or failure traceback
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 3. Optimization Indexes for High-Frequency Edge Polling
CREATE INDEX IF NOT EXISTS idx_tasks_target_status ON tasks(target_device, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_heartbeat ON devices(last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
