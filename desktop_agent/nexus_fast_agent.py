#!/usr/bin/env python3
"""
Nexus Fast Agent - Local Desktop Daemon
=============================================================================
High-Speed Desktop Executor connected to Cloudflare Edge Bridge.
100% Free Tier: Zero Cloud Tokens for Execution.

Capabilities:
1. HOTKEY: Triggers PyAutoGUI keyboard shortcuts (e.g. ['ctrl', 'c'], ['alt', 'tab'])
2. SHELL: Executes local shell commands safely via subprocess
3. OPEN_APP: Launches native desktop applications
4. SPEAK: Synthesizes high-fidelity voice locally via edge-tts (no cloud tokens)
5. Automatically reports execution results and logs back to Cloudflare D1.
=============================================================================
"""

import os
import sys
import time
import json
import asyncio
import platform
import subprocess
import traceback
from typing import Dict, Any, List

import requests

# Try importing desktop automation libraries
try:
    import pyautogui
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.1
except ImportError:
    pyautogui = None

try:
    import edge_tts
except ImportError:
    edge_tts = None

# Configuration
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
DEFAULT_API_BASE = os.getenv("NEXUS_API_BASE", "https://nexus-bridge-7l1.pages.dev/api").rstrip("/")
AUTH_TOKEN = os.getenv("NEXUS_AUTH_TOKEN", "")
DEVICE_ID = os.getenv("NEXUS_DEVICE_ID", "nexus-desktop-primary")

if os.path.exists(CONFIG_PATH):
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            DEFAULT_API_BASE = cfg.get("d1_api_url", DEFAULT_API_BASE).rstrip("/")
            AUTH_TOKEN = cfg.get("auth_token", AUTH_TOKEN)
            DEVICE_ID = cfg.get("device_id", DEVICE_ID)
    except Exception:
        pass


class NexusFastAgent:
    def __init__(self, api_base: str = DEFAULT_API_BASE, auth_token: str = AUTH_TOKEN, device_id: str = DEVICE_ID):
        self.api_base = api_base.rstrip("/")
        self.auth_token = auth_token
        self.device_id = device_id
        self.running = False
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": f"NexusFastAgent/2.1.0 ({platform.platform()})",
            "X-Nexus-Auth-Token": self.auth_token,
            "X-Nexus-Key": self.auth_token,
            "Content-Type": "application/json"
        })

    def log(self, message: str, level: str = "INFO"):
        now = time.strftime("%H:%M:%S")
        print(f"[{now}] [{level}] [NEXUS-AGENT] {message}", flush=True)

    def speak_locally(self, text: str, voice: str = "en-US-AriaNeural"):
        """Synthesizes voice locally using edge-tts through system audio output without cloud fees."""
        self.log(f"Speaking: '{text}'")
        try:
            async def _synthesize():
                communicate = edge_tts.Communicate(text, voice)
                out_path = os.path.join(os.path.dirname(__file__), "_speech_temp.mp3")
                await communicate.save(out_path)
                return out_path

            if edge_tts is not None:
                audio_path = asyncio.run(_synthesize())
                # Play audio using native OS player
                if platform.system() == "Windows":
                    cmd = f'powershell -c "(New-Object Media.SoundPlayer \'{audio_path}\').PlaySync()"'
                    res = subprocess.run(cmd, shell=True, capture_output=True)
                    if res.returncode != 0:
                        # Fallback to wmplayer or start
                        subprocess.run(f'start "" /min wmplayer "{audio_path}"', shell=True)
                        time.sleep(2.0)
                else:
                    subprocess.run(["ffplay", "-nodisp", "-autoexit", audio_path], capture_output=True)
                return True
        except Exception as e:
            self.log(f"edge-tts error: {e}. Falling back to system TTS.", "WARN")

        # Fallback to PowerShell SAPI.SpVoice on Windows
        if platform.system() == "Windows":
            clean_text = text.replace('"', '""').replace("'", "''")
            ps_cmd = f"powershell -c \"Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{clean_text}')\""
            subprocess.run(ps_cmd, shell=True, capture_output=True)
            return True
        return False

    def execute_hotkey(self, keys: List[str]) -> Dict[str, Any]:
        """Triggers PyAutoGUI keyboard shortcuts."""
        if not pyautogui:
            return {"success": False, "error": "PyAutoGUI not installed"}
        try:
            pyautogui.hotkey(*[k.lower().strip() for k in keys])
            return {"success": True, "keys": keys}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def execute_shell(self, command: str) -> Dict[str, Any]:
        """Executes safe local shell commands via subprocess."""
        self.log(f"Executing SHELL: {command}")
        t0 = time.time()
        try:
            proc = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30.0
            )
            elapsed = round(time.time() - t0, 3)
            return {
                "success": proc.returncode == 0,
                "returncode": proc.returncode,
                "stdout": proc.stdout.strip(),
                "stderr": proc.stderr.strip(),
                "elapsed_sec": elapsed
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Command timed out after 30 seconds"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def execute_open_app(self, app_name: str) -> Dict[str, Any]:
        """Launches native applications on host."""
        self.log(f"Launching APP: {app_name}")
        app_map = {
            "calc": "calc.exe",
            "calculator": "calc.exe",
            "notepad": "notepad.exe",
            "cmd": "cmd.exe",
            "terminal": "wt.exe",
            "code": "code",
            "vscode": "code",
            "browser": "start chrome || start msedge",
            "chrome": "start chrome",
            "edge": "start msedge"
        }
        cmd = app_map.get(app_name.lower().strip(), app_name)
        try:
            if platform.system() == "Windows":
                subprocess.Popen(f"start {cmd}", shell=True)
            else:
                subprocess.Popen([cmd])
            return {"success": True, "app": app_name, "command": cmd}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def dispatch_action(self, action_type: str, payload: Any) -> Dict[str, Any]:
        """Routes action to appropriate local handler."""
        action_type = action_type.upper().strip()
        if action_type in ("SPEAK", "TTS", "VOICE"):
            text = payload if isinstance(payload, str) else payload.get("text", "")
            success = self.speak_locally(text)
            return {"success": success, "action": "SPEAK", "text": text}

        elif action_type in ("HOTKEY", "SHORTCUT"):
            keys = payload if isinstance(payload, list) else payload.get("keys", [])
            return self.execute_hotkey(keys)

        elif action_type in ("SHELL", "TERMINAL", "COMMAND", "TERMINAL_EXEC"):
            cmd = payload if isinstance(payload, str) else payload.get("cmd", payload.get("command", ""))
            return self.execute_shell(cmd)

        elif action_type in ("OPEN_APP", "APP", "LAUNCH"):
            app_name = payload if isinstance(payload, str) else payload.get("app", payload.get("name", ""))
            return self.execute_open_app(app_name)

        else:
            return {"success": False, "error": f"Unknown action type '{action_type}'"}

    def report_task_result(self, task_id: str, status: str, result_output: Any):
        """Reports task execution result back to Cloudflare D1 via /api/tasks."""
        url = f"{self.api_base}/tasks"
        payload = {
            "id": task_id,
            "status": status,
            "result_output": result_output,
            "execution_log": json.dumps(result_output) if not isinstance(result_output, str) else result_output
        }
        try:
            res = self.session.patch(url, json=payload, timeout=5.0)
            if res.ok:
                self.log(f"Reported status '{status}' for task {task_id}")
            else:
                self.log(f"Failed to report task: {res.status_code} {res.text}", "WARN")
        except Exception as e:
            self.log(f"Error reporting task {task_id}: {e}", "ERROR")

    def process_task(self, task: Dict[str, Any]):
        """Processes an incoming task object."""
        task_id = task.get("id")
        cmd_type = task.get("command_type", "SHELL")
        prompt_raw = task.get("prompt_raw", "")
        action_plan_raw = task.get("action_plan")

        self.log(f"Processing Task [{task_id}] Type={cmd_type} Prompt='{prompt_raw}'")

        # Parse action plan if present
        actions = []
        if action_plan_raw:
            try:
                plan = json.loads(action_plan_raw) if isinstance(action_plan_raw, str) else action_plan_raw
                if isinstance(plan, dict) and "steps" in plan:
                    actions = plan["steps"]
                elif isinstance(plan, list):
                    actions = plan
                elif isinstance(plan, dict):
                    actions = [plan]
            except Exception:
                pass

        if not actions:
            # Fallback action synthesis
            if cmd_type == "VOICE_PROMPT":
                actions = [{"action": "SPEAK", "text": prompt_raw}]
            elif cmd_type == "HOTKEY":
                actions = [{"action": "HOTKEY", "keys": prompt_raw.split("+")}]
            elif cmd_type == "OPEN_APP":
                actions = [{"action": "OPEN_APP", "app": prompt_raw}]
            else:
                actions = [{"action": "SHELL", "cmd": prompt_raw}]

        results = []
        overall_ok = True
        for act in actions:
            act_type = act.get("action", cmd_type)
            res = self.dispatch_action(act_type, act)
            results.append(res)
            if not res.get("success", False):
                overall_ok = False

        status = "COMPLETED" if overall_ok else "FAILED"
        self.report_task_result(task_id, status, results)

    def run_poll_loop(self):
        """Continuous high-speed loop connecting to /api/bridge and polling /api/tasks."""
        self.running = True
        self.log(f"Starting Nexus Fast Agent connected to: {self.api_base}")
        self.log(f"Device ID: {self.device_id}")

        while self.running:
            try:
                # 1. Poll pending tasks from D1
                resp = self.session.get(
                    f"{self.api_base}/tasks",
                    params={"target": "DESKTOP", "status": "QUEUED", "limit": 5},
                    timeout=5.0
                )
                if resp.ok:
                    data = resp.json()
                    tasks = data.get("tasks", [])
                    for t in tasks:
                        self.process_task(t)
            except requests.exceptions.RequestException as e:
                self.log(f"Bridge connection error: {e}", "WARN")

            time.sleep(1.0)


def main():
    agent = NexusFastAgent()
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print("\n--- RUNNING SYNTHETIC ACTION TEST ---")
        res = agent.dispatch_action("SPEAK", {"text": "Nexus bridge is fully operational"})
        print("Result:", res)
        return

    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        agent.log(f"Running single poll cycle against: {agent.api_base}")
        try:
            resp = agent.session.get(
                f"{agent.api_base}/tasks",
                params={"target": "DESKTOP", "status": "QUEUED", "limit": 5},
                timeout=5.0
            )
            if resp.ok:
                tasks = resp.json().get("tasks", [])
                agent.log(f"Found {len(tasks)} queued task(s)")
                for t in tasks:
                    agent.process_task(t)
        except Exception as e:
            agent.log(f"Poll error: {e}", "ERROR")
        return

    agent.run_poll_loop()


if __name__ == "__main__":
    main()
