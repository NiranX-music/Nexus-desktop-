"""
Nexus Autonomous Engine - Local Data Sovereignty Store
=============================================================================
Enforces strict 100% data sovereignty and local privacy.
All reasoning chains (<think>), tool invocations, bash/PTY outputs, code
diffs, chat prompts, and episodic memories are stored EXCLUSIVELY on the
local filesystem at:
    ~/.nexus-agent/db/agent_local.db

NO raw conversation logs, code, or thought traces are EVER transmitted
to Cloudflare D1 or remote edge servers.
=============================================================================
"""

import os
import sqlite3
import uuid
import time
from pathlib import Path
from contextlib import contextmanager
from typing import Dict, Any, List, Optional


class LocalAgentStore:
    """
    Local SQLite store guaranteeing 100% data sovereignty.
    """
    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            base_dir = Path.home() / ".nexus-agent" / "db"
            base_dir.mkdir(parents=True, exist_ok=True)
            self.db_path = base_dir / "agent_local.db"
        else:
            self.db_path = Path(db_path)
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Initializes all local sovereignty schema tables."""
        with self._get_connection() as conn:
            cur = conn.cursor()

            # 1. Tasks
            cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                intent_type TEXT NOT NULL DEFAULT 'AUTONOMOUS_EXEC',
                status TEXT NOT NULL DEFAULT 'QUEUED',
                duration_sec REAL DEFAULT 0.0,
                summary TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 2. Thoughts (<think> reasoning chains)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS thought_traces (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                step_id TEXT,
                thought_text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id)
            );
            """)

            # 3. Tool Executions (pty, filesystem, browser, ufo)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS tool_executions (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                tool_name TEXT NOT NULL,
                command_or_args TEXT,
                output TEXT,
                exit_code INTEGER DEFAULT 0,
                success INTEGER DEFAULT 1,
                duration_sec REAL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id)
            );
            """)

            # 4. Code Diffs & Patches
            cur.execute("""
            CREATE TABLE IF NOT EXISTS code_diffs (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                diff_content TEXT NOT NULL,
                additions INTEGER DEFAULT 0,
                deletions INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id)
            );
            """)

            # 5. Episodic Long-Term Memories
            cur.execute("""
            CREATE TABLE IF NOT EXISTS episodic_memories (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                memory_key TEXT NOT NULL,
                memory_value TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category, memory_key)
            );
            """)

            conn.commit()

    def log_task_start(self, task_id: str, prompt: str, intent_type: str = "AUTONOMOUS_EXEC") -> None:
        """Records task creation locally."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
            INSERT OR REPLACE INTO tasks (task_id, prompt, intent_type, status)
            VALUES (?, ?, ?, 'RUNNING');
            """, (task_id, prompt, intent_type))
            conn.commit()

    def update_task_status(
        self,
        task_id: str,
        status: str,
        duration_sec: float = 0.0,
        summary: Optional[str] = None
    ) -> None:
        """Updates task completion state locally."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
            UPDATE tasks
            SET status = ?, duration_sec = ?, summary = ?
            WHERE task_id = ?;
            """, (status, duration_sec, summary, task_id))
            conn.commit()

    def log_thought(self, task_id: str, step_id: str, thought_text: str) -> str:
        """Stores internal thought reasoning chain locally."""
        tid = str(uuid.uuid4())[:8]
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
            INSERT INTO thought_traces (id, task_id, step_id, thought_text)
            VALUES (?, ?, ?, ?);
            """, (tid, task_id, step_id, thought_text))
            conn.commit()
        return tid

    def log_tool_execution(
        self,
        task_id: str,
        tool_name: str,
        command_or_args: str,
        output: str,
        exit_code: int = 0,
        success: bool = True,
        duration_sec: float = 0.0
    ) -> str:
        """Stores tool execution outcome locally."""
        eid = str(uuid.uuid4())[:8]
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
            INSERT INTO tool_executions (id, task_id, tool_name, command_or_args, output, exit_code, success, duration_sec)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (eid, task_id, tool_name, command_or_args, output, exit_code, 1 if success else 0, duration_sec))
            conn.commit()
        return eid

    def log_diff(
        self,
        task_id: str,
        file_path: str,
        diff_content: str,
        additions: int = 0,
        deletions: int = 0
    ) -> str:
        """Stores file modifications and unified diffs locally."""
        did = str(uuid.uuid4())[:8]
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
            INSERT INTO code_diffs (id, task_id, file_path, diff_content, additions, deletions)
            VALUES (?, ?, ?, ?, ?, ?);
            """, (did, task_id, file_path, diff_content, additions, deletions))
            conn.commit()
        return did

    def save_episodic_memory(
        self,
        category: str,
        key: str,
        value: str,
        confidence: float = 1.0
    ) -> str:
        """Stores or updates learned episodic memory locally."""
        mid = str(uuid.uuid4())[:8]
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
            INSERT INTO episodic_memories (id, category, memory_key, memory_value, confidence, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(category, memory_key) DO UPDATE SET
                memory_value = excluded.memory_value,
                confidence = excluded.confidence,
                updated_at = CURRENT_TIMESTAMP;
            """, (mid, category, key, value, confidence))
            conn.commit()
        return mid

    def get_memories(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves stored episodic memories."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            if category:
                cur.execute("SELECT * FROM episodic_memories WHERE category = ? ORDER BY updated_at DESC;", (category,))
            else:
                cur.execute("SELECT * FROM episodic_memories ORDER BY updated_at DESC;")
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_task_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves historical tasks."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?;", (limit,))
            return [dict(r) for r in cur.fetchall()]

    def get_task_full_traces(self, task_id: str) -> Dict[str, Any]:
        """Retrieves complete local trace dossier for a given task."""
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM tasks WHERE task_id = ?;", (task_id,))
            task_row = cur.fetchone()
            task_dict = dict(task_row) if task_row else {}

            cur.execute("SELECT * FROM thought_traces WHERE task_id = ? ORDER BY created_at ASC;", (task_id,))
            thoughts = [dict(r) for r in cur.fetchall()]

            cur.execute("SELECT * FROM tool_executions WHERE task_id = ? ORDER BY created_at ASC;", (task_id,))
            tools = [dict(r) for r in cur.fetchall()]

            cur.execute("SELECT * FROM code_diffs WHERE task_id = ? ORDER BY created_at ASC;", (task_id,))
            diffs = [dict(r) for r in cur.fetchall()]

            return {
                "task": task_dict,
                "thoughts": thoughts,
                "tools": tools,
                "diffs": diffs
            }
