-- =============================================================================
-- Nexus Autonomous Cloud Infrastructure - Cloudflare D1 Schema
-- Path: web_control/schema.sql
-- 100% Free-Tier Serverless SQLite Edge Schema
-- STRICT PRIVACY COMPLIANCE:
-- ONLY user authentication accounts, device heartbeats, and ephemeral signal IDs.
-- ABSOLUTELY NO user conversation prompts, raw code, thought reasoning traces (<think>),
-- diffs, or episodic memory files are EVER stored on Cloudflare D1.
-- All sensitive execution traces live 100% locally on ~/.nexus-agent/db/agent_local.db.
-- =============================================================================

-- 1. User Authentication Table (Strictly: Name, Email, Password Hash)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 2. Device Heartbeat & Presence Registry (Presence Only, Zero Logs)
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'DESKTOP',         -- DESKTOP, MOBILE, SERVER
    status TEXT NOT NULL DEFAULT 'ONLINE',        -- ONLINE, BUSY, OFFLINE
    battery_level INTEGER DEFAULT 100,
    agent_version TEXT DEFAULT '2.2.0',
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices (status, last_seen);

-- 3. Ephemeral Task Signals (Routing Signals Only - Zero Prompts, Zero Code, Zero Traces)
CREATE TABLE IF NOT EXISTS task_signals (
    signal_id TEXT PRIMARY KEY,
    target_device TEXT NOT NULL DEFAULT 'DESKTOP', -- DESKTOP, MOBILE, ALL
    status TEXT NOT NULL DEFAULT 'PENDING',        -- PENDING, CLAIMED, EXPIRED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (DATETIME('now', '+1 hour'))
);

CREATE INDEX IF NOT EXISTS idx_signals_target ON task_signals (target_device, status);
