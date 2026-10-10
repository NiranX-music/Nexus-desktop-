"""
Nexus Autonomous Engine - Data Sovereignty Exporter
=============================================================================
Safeguards user sovereignty by exporting 100% of local agent data:
- Scans ~/.nexus-agent/ directory
- Generates timestamped ZIP archive: nexus_agent_export_<TIMESTAMP>.zip
- Embeds standalone READABLE_EXPORT_VIEWER.html inside the archive, allowing
  instant local viewing of all thoughts, diffs, tool logs, and memories
  offline in any browser without needing a server.
=============================================================================
"""

import os
import json
import time
import zipfile
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional

from .local_store import LocalAgentStore


HTML_VIEWER_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus Agent - Local Data Sovereignty Archive</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151b2b;
      --border: #232d42;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --cyan: #06b6d4;
      --indigo: #6366f1;
      --emerald: #10b981;
      --rose: #f43f5e;
      --amber: #f59e0b;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      line-height: 1.5;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-badge {
      background: linear-gradient(135deg, var(--cyan), var(--indigo));
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 20px;
      color: #fff;
    }
    h1 { font-size: 22px; font-weight: 700; }
    .subtitle { color: var(--text-muted); font-size: 13px; }
    .badge-sovereignty {
      background: rgba(16, 185, 129, 0.15);
      color: var(--emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .tab-btn:hover { color: var(--text); background: rgba(255,255,255,0.05); }
    .tab-btn.active {
      color: var(--cyan);
      background: rgba(6, 182, 212, 0.1);
      border-color: rgba(6, 182, 212, 0.3);
    }
    .panel { display: none; }
    .panel.active { display: block; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--cyan);
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .meta { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    pre {
      background: #060911;
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #e2e8f0;
      margin: 8px 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .diff-block {
      background: #060911;
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .diff-line-add { color: #34d399; background: rgba(16, 185, 129, 0.08); display: block; }
    .diff-line-del { color: #f87171; background: rgba(244, 63, 94, 0.08); display: block; }
    .diff-line-ctx { color: #94a3b8; display: block; }
    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .status-success { background: rgba(16, 185, 129, 0.2); color: var(--emerald); }
    .status-failed { background: rgba(244, 63, 94, 0.2); color: var(--rose); }
    .status-running { background: rgba(245, 158, 11, 0.2); color: var(--amber); }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-badge">N</div>
      <div>
        <h1>Nexus AI Agent - Local Sovereignty Archive</h1>
        <div class="subtitle">100% Offline Single-File Data Dossier &bull; Exported: <span id="export-time"></span></div>
      </div>
    </div>
    <div class="badge-sovereignty">
      &check; 100% Client-Side Sovereignty Guaranteed
    </div>
  </header>

  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('tasks')">Tasks &amp; Reasoning (<span id="task-count">0</span>)</button>
    <button class="tab-btn" onclick="switchTab('memories')">Episodic Memories (<span id="mem-count">0</span>)</button>
    <button class="tab-btn" onclick="switchTab('diffs')">Code Diffs (<span id="diff-count">0</span>)</button>
  </div>

  <div id="panel-tasks" class="panel active">
    <div id="tasks-container"></div>
  </div>

  <div id="panel-memories" class="panel">
    <div id="memories-container"></div>
  </div>

  <div id="panel-diffs" class="panel">
    <div id="diffs-container"></div>
  </div>

  <script>
    const ARCHIVE_DATA = __EMBEDDED_DATA__;

    document.getElementById('export-time').innerText = ARCHIVE_DATA.exported_at || new Date().toISOString();
    document.getElementById('task-count').innerText = ARCHIVE_DATA.tasks.length;
    document.getElementById('mem-count').innerText = ARCHIVE_DATA.memories.length;
    document.getElementById('diff-count').innerText = ARCHIVE_DATA.diffs.length;

    function switchTab(name) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('panel-' + name).classList.add('active');
    }

    // Render Tasks
    const tc = document.getElementById('tasks-container');
    if (ARCHIVE_DATA.tasks.length === 0) {
      tc.innerHTML = '<div class="card"><p style="color:var(--text-muted)">No tasks logged in this archive.</p></div>';
    } else {
      ARCHIVE_DATA.tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <div class="card-title">
            <span>${escapeHtml(t.prompt)}</span>
            <span class="status-pill status-${t.status.toLowerCase()}">${t.status}</span>
          </div>
          <div class="meta">ID: <code>${t.task_id}</code> &bull; Duration: ${t.duration_sec}s &bull; Intent: ${t.intent_type} &bull; ${t.created_at}</div>
          ${t.summary ? `<p style="margin-bottom:8px;"><strong>Summary:</strong> ${escapeHtml(t.summary)}</p>` : ''}
          ${(t.thoughts && t.thoughts.length) ? `
            <details style="margin-top:8px;">
              <summary style="cursor:pointer;color:var(--cyan);font-size:13px;font-weight:600;">View Internal Reasoning Chains (${t.thoughts.length})</summary>
              ${t.thoughts.map(th => `<pre>${escapeHtml(th.thought_text)}</pre>`).join('')}
            </details>
          ` : ''}
          ${(t.tools && t.tools.length) ? `
            <details style="margin-top:8px;">
              <summary style="cursor:pointer;color:var(--indigo);font-size:13px;font-weight:600;">View Tool Executions (${t.tools.length})</summary>
              ${t.tools.map(tl => `
                <div style="margin:8px 0;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;">
                  <div style="font-size:12px;font-weight:bold;color:var(--cyan);">[${tl.tool_name.toUpperCase()}] ${tl.exit_code === 0 ? '✓' : '✗'} (${tl.duration_sec}s)</div>
                  ${tl.command_or_args ? `<pre>Command/Args: ${escapeHtml(tl.command_or_args)}</pre>` : ''}
                  ${tl.output ? `<pre>Output: ${escapeHtml(tl.output)}</pre>` : ''}
                </div>
              `).join('')}
            </details>
          ` : ''}
        `;
        tc.appendChild(div);
      });
    }

    // Render Memories
    const mc = document.getElementById('memories-container');
    if (ARCHIVE_DATA.memories.length === 0) {
      mc.innerHTML = '<div class="card"><p style="color:var(--text-muted)">No episodic memories recorded.</p></div>';
    } else {
      ARCHIVE_DATA.memories.forEach(m => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <div class="card-title">
            <span>[${escapeHtml(m.category)}] ${escapeHtml(m.memory_key)}</span>
            <span class="status-pill status-success">Confidence: ${(m.confidence * 100).toFixed(0)}%</span>
          </div>
          <div class="meta">Recorded: ${m.updated_at || m.created_at}</div>
          <pre>${escapeHtml(m.memory_value)}</pre>
        `;
        mc.appendChild(div);
      });
    }

    // Render Diffs
    const dc = document.getElementById('diffs-container');
    if (ARCHIVE_DATA.diffs.length === 0) {
      dc.innerHTML = '<div class="card"><p style="color:var(--text-muted)">No code diffs in this archive.</p></div>';
    } else {
      ARCHIVE_DATA.diffs.forEach(d => {
        const div = document.createElement('div');
        div.className = 'card';
        const formattedDiff = d.diff_content.split('\\n').map(line => {
          if (line.startsWith('+') && !line.startsWith('+++')) return `<span class="diff-line-add">${escapeHtml(line)}</span>`;
          if (line.startsWith('-') && !line.startsWith('---')) return `<span class="diff-line-del">${escapeHtml(line)}</span>`;
          return `<span class="diff-line-ctx">${escapeHtml(line)}</span>`;
        }).join('');

        div.innerHTML = `
          <div class="card-title">
            <span>${escapeHtml(d.file_path)}</span>
            <span style="font-size:12px;font-family:var(--font-mono);color:var(--emerald);">+${d.additions} <span style="color:var(--rose);">-${d.deletions}</span></span>
          </div>
          <div class="meta">Task: <code>${d.task_id}</code> &bull; ${d.created_at}</div>
          <div class="diff-block">${formattedDiff}</div>
        `;
        dc.appendChild(div);
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  </script>
</body>
</html>
"""


class DataSovereigntyExporter:
    """
    Exports local agent databases, episodic memories, and traces into a
    standalone archive with an offline HTML inspection viewer.
    """
    def __init__(self, store: Optional[LocalAgentStore] = None):
        self.store = store or LocalAgentStore()

    def generate_export_bundle(self, destination_dir: Optional[Path] = None) -> Path:
        """
        Creates a timestamped ZIP containing:
        1. agent_local.db (raw SQLite database)
        2. tasks_full.json
        3. memories.json
        4. READABLE_EXPORT_VIEWER.html (interactive zero-dependency offline viewer)
        """
        ts = time.strftime("%Y%m%d_%H%M%S")
        if destination_dir is None:
            destination_dir = Path.home() / ".nexus-agent" / "exports"
        dest_dir = Path(destination_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)

        zip_path = dest_dir / f"nexus_agent_export_{ts}.zip"

        # 1. Fetch all local data
        tasks = self.store.get_task_history(limit=500)
        detailed_tasks = []
        all_diffs = []
        for t in tasks:
            dossier = self.store.get_task_full_traces(t["task_id"])
            t_copy = dict(t)
            t_copy["thoughts"] = dossier["thoughts"]
            t_copy["tools"] = dossier["tools"]
            detailed_tasks.append(t_copy)
            all_diffs.extend(dossier["diffs"])

        memories = self.store.get_memories()

        bundle_payload = {
            "exported_at": time.strftime("%Y-%m-%d %H:%M:%SZ", time.gmtime()),
            "tasks": detailed_tasks,
            "memories": memories,
            "diffs": all_diffs
        }

        # 2. Render HTML Viewer with embedded data
        json_str = json.dumps(bundle_payload, ensure_ascii=False)
        html_content = HTML_VIEWER_TEMPLATE.replace("__EMBEDDED_DATA__", json_str)

        # 3. Create ZIP archive
        with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
            # Add raw DB file
            if self.store.db_path.exists():
                zf.write(str(self.store.db_path), arcname="data/agent_local.db")

            # Add JSON metadata
            zf.writestr("data/tasks_full.json", json.dumps(detailed_tasks, indent=2))
            zf.writestr("data/memories.json", json.dumps(memories, indent=2))
            zf.writestr("data/diffs.json", json.dumps(all_diffs, indent=2))

            # Add Standalone HTML Viewer
            zf.writestr("READABLE_EXPORT_VIEWER.html", html_content)

        return zip_path


def create_export(destination_dir: Optional[str] = None) -> str:
    """Convenience helper to create an export bundle and return its absolute path."""
    exporter = DataSovereigntyExporter()
    dest = Path(destination_dir) if destination_dir else None
    return str(exporter.generate_export_bundle(dest))
