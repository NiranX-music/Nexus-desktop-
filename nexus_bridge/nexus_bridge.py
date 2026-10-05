"""
Nexus Desktop Remote Bridge Daemon
Connects local PC environment with Cloudflare D1 Edge Queue & Remote Web Dashboard.

Runs locally on the user's computer:
- Heartbeat thread: Pings Cloudflare D1 every 30s to broadcast ONLINE status.
- Task Polling loop: Fetches PENDING tasks from D1, executes OS automations,
  and reports execution results back to D1.
- Deep integration with local Nexus Desktop Electron app (port 17173) and OS automations.
"""

import os
import sys
import time
import json
import socket
import logging
import platform
import threading
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional, List
import urllib.request
import urllib.error

# ------------------------------------------------------------------------------
# Configuration & Environment
# ------------------------------------------------------------------------------
# Try loading .env if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

D1_API_URL = os.getenv("D1_API_URL", "http://127.0.0.1:8788/api").rstrip("/")
AUTH_SECRET = os.getenv("AUTH_SECRET", "")
POLL_INTERVAL_SECONDS = float(os.getenv("POLL_INTERVAL_SECONDS", "2.0"))
HEARTBEAT_INTERVAL_SECONDS = float(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "30.0"))
AGENT_ID = os.getenv("AGENT_ID", f"nexus-pc-{socket.gethostname().lower()}")
NEXUS_DESKTOP_PORT = int(os.getenv("NEXUS_DESKTOP_PORT", "17173"))
NEXUS_DESKTOP_URL = f"http://127.0.0.1:{NEXUS_DESKTOP_PORT}"

# Optional automation libraries
try:
    import pyautogui
    pyautogui.FAILSAFE = True
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False

try:
    import pyttsx3
    HAS_PYTTSX3 = True
except ImportError:
    HAS_PYTTSX3 = False

# Setup Console Logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("NexusBridge")

current_agent_status = "ONLINE"
status_lock = threading.Lock()

# ------------------------------------------------------------------------------
# HTTP Helpers (Zero external dependencies fallback using urllib)
# ------------------------------------------------------------------------------
def api_request(method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, timeout: float = 10.0) -> Optional[Dict[str, Any]]:
    """Makes HTTP request to Cloudflare D1 Edge API with retry and timeout."""
    url = f"{D1_API_URL}{endpoint}" if endpoint.startswith("/") else f"{D1_API_URL}/{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": f"Nexus-Bridge-Daemon/1.0 ({platform.system()})",
    }
    if AUTH_SECRET:
        headers["Authorization"] = f"Bearer {AUTH_SECRET}"

    body_bytes = json.dumps(data).encode("utf-8") if data is not None else None

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            res_body = response.read().decode("utf-8")
            if res_body:
                return json.loads(res_body)
            return {"ok": True}
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8", errors="replace")
        logger.error(f"HTTP Error {e.code} on {method} {url}: {error_msg}")
        return None
    except urllib.error.URLError as e:
        logger.warning(f"Connection failed to {url}: {e.reason}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error on {method} {url}: {str(e)}")
        return None

# ------------------------------------------------------------------------------
# Local Nexus Desktop Integration (Electron App Bridge)
# ------------------------------------------------------------------------------
def check_nexus_desktop_status() -> bool:
    """Checks if local Nexus Desktop Electron app is running on port 17173."""
    url = f"{NEXUS_DESKTOP_URL}/health"
    req = urllib.request.Request(url, headers={"User-Agent": "NexusBridge"})
    try:
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("ok", False)
    except Exception:
        return False

def send_to_nexus_desktop(command_type: str, payload: str) -> Optional[Dict[str, Any]]:
    """Dispatches command directly to Nexus Desktop's internal HTTP server."""
    url = f"{NEXUS_DESKTOP_URL}/mobile-command"
    body = json.dumps({
        "source": "nexus-web-remote",
        "type": command_type,
        "payload": payload,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"Failed to dispatch to Nexus Desktop Electron app: {e}")
        return None

# ------------------------------------------------------------------------------
# Action Execution Engine (Shell, PyAutoGUI, TTS, Nexus)
# ------------------------------------------------------------------------------
def execute_shell_command(cmd: str) -> Dict[str, Any]:
    """Executes bash/powershell command locally and captures outputs."""
    logger.info(f"⚡ [Shell Exec] Running: {cmd}")
    start_time = time.time()
    try:
        # Use PowerShell on Windows or default shell on Unix
        shell_binary = True
        proc = subprocess.run(
            cmd,
            shell=shell_binary,
            capture_output=True,
            text=True,
            timeout=120,
        )
        elapsed = round(time.time() - start_time, 3)
        return {
            "success": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": proc.stdout.strip(),
            "stderr": proc.stderr.strip(),
            "elapsed_seconds": elapsed,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": "Command timed out after 120 seconds",
            "elapsed_seconds": 120,
        }
    except Exception as e:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": str(e),
            "elapsed_seconds": round(time.time() - start_time, 3),
        }

def execute_desktop_action(action: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a single structured desktop automation step."""
    tool = action.get("tool", "").lower()
    res: Dict[str, Any] = {"tool": tool, "success": True}

    try:
        # 1. Shell Tool
        if tool == "shell":
            command = action.get("command", "")
            shell_res = execute_shell_command(command)
            res.update(shell_res)

        # 2. Keyboard Hotkey Tool
        elif tool == "keyboard":
            hotkeys = action.get("hotkey", [])
            if isinstance(hotkeys, str):
                hotkeys = [hotkeys]
            if HAS_PYAUTOGUI:
                logger.info(f"⌨️ [Keyboard] Pressing hotkey: {' + '.join(hotkeys)}")
                pyautogui.hotkey(*hotkeys)
                res["message"] = f"Pressed {' + '.join(hotkeys)}"
            else:
                logger.warning("pyautogui is not installed. Hotkey skipped.")
                res["success"] = False
                res["warning"] = "pyautogui not installed"

        # 3. Typing Tool
        elif tool == "type":
            text = action.get("text", "")
            if HAS_PYAUTOGUI:
                logger.info(f"✍️ [Type] Typing {len(text)} characters")
                pyautogui.write(text, interval=0.02)
                res["message"] = f"Typed {len(text)} characters"
            else:
                res["success"] = False
                res["warning"] = "pyautogui not installed"

        # 4. Mouse Control Tool
        elif tool == "mouse":
            action_type = action.get("action", "click")
            x = action.get("x")
            y = action.get("y")
            if HAS_PYAUTOGUI:
                if x is not None and y is not None:
                    pyautogui.moveTo(x, y, duration=0.2)
                if action_type == "click":
                    pyautogui.click()
                elif action_type == "double_click":
                    pyautogui.doubleClick()
                elif action_type == "right_click":
                    pyautogui.rightClick()
                res["message"] = f"Mouse action '{action_type}' performed"
            else:
                res["success"] = False
                res["warning"] = "pyautogui not installed"

        # 5. Speech Tool
        elif tool == "speak":
            text = action.get("text", "")
            logger.info(f"🔊 [Speech] Saying: '{text}'")
            if HAS_PYTTSX3:
                try:
                    engine = pyttsx3.init()
                    engine.say(text)
                    engine.runAndWait()
                except Exception as tts_err:
                    logger.warning(f"TTS engine error: {tts_err}")
            elif platform.system() == "Windows":
                # Fallback to Windows SAPI PowerShell voice
                clean_text = text.replace("'", " ")
                subprocess.Popen(["powershell", "-Command", f"Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{clean_text}')"])
            res["message"] = f"Spoke: {text}"

        # 6. Screenshot Tool
        elif tool == "screenshot":
            filename = action.get("filename", f"screenshot_{int(time.time())}.png")
            if HAS_PYAUTOGUI:
                screenshot_path = os.path.join(os.getcwd(), filename)
                img = pyautogui.screenshot()
                img.save(screenshot_path)
                logger.info(f"📸 [Screenshot] Saved to {screenshot_path}")
                res["saved_to"] = screenshot_path
            else:
                res["success"] = False
                res["warning"] = "pyautogui not installed"

        # 7. Native Nexus Desktop App Dispatch
        elif tool == "nexus_command":
            cmd_type = action.get("type", "command")
            payload = action.get("payload", "")
            desktop_res = send_to_nexus_desktop(cmd_type, payload)
            res["nexus_desktop_response"] = desktop_res

        # 8. Wait / Sleep Tool
        elif tool == "wait":
            seconds = float(action.get("seconds", 1.0))
            time.sleep(seconds)
            res["message"] = f"Waited {seconds} seconds"

        else:
            res["success"] = False
            res["error"] = f"Unknown tool '{tool}'"

    except Exception as e:
        logger.error(f"Error executing action {action}: {e}")
        res["success"] = False
        res["error"] = str(e)

    return res

def process_task(task: Dict[str, Any]) -> Dict[str, Any]:
    """Processes a single task based on its command_type."""
    task_id = task["id"]
    command_type = task["command_type"]
    raw_payload = task["payload"]

    logger.info(f"🚀 Processing Task [{task_id}] | Type: {command_type}")

    # Parse payload if JSON
    payload_obj = None
    if isinstance(raw_payload, str):
        try:
            payload_obj = json.loads(raw_payload)
        except Exception:
            payload_obj = raw_payload
    else:
        payload_obj = raw_payload

    # 1. Bash / Shell Execution
    if command_type == "bash_exec":
        cmd_str = payload_obj if isinstance(payload_obj, str) else str(payload_obj.get("command", ""))
        exec_result = execute_shell_command(cmd_str)
        return {
            "type": "bash_exec",
            "command": cmd_str,
            "result": exec_result,
        }

    # 2. Desktop Control / Action Plan
    elif command_type in ("desktop_control", "voice_prompt", "workflow"):
        # Check if payload contains an action sequence (e.g. from Modal planner)
        if isinstance(payload_obj, dict) and "action_sequence" in payload_obj:
            sequence = payload_obj["action_sequence"]
            results: List[Dict[str, Any]] = []
            for step in sequence:
                step_res = execute_desktop_action(step)
                results.append(step_res)
                # Short pause between steps
                time.sleep(0.3)
            return {
                "type": "action_sequence",
                "steps_executed": len(results),
                "details": results,
            }

        # Check if this should be routed directly to Nexus Desktop Electron app
        if check_nexus_desktop_status():
            desktop_type = "command" if command_type != "voice_prompt" else "voice"
            payload_text = payload_obj if isinstance(payload_obj, str) else json.dumps(payload_obj)
            logger.info("Forwarding directly to active Nexus Desktop Electron window...")
            res = send_to_nexus_desktop(desktop_type, payload_text)
            return {
                "dispatched_to_electron": True,
                "response": res,
            }

        # Otherwise treat as shell or natural intent
        cmd_str = payload_obj if isinstance(payload_obj, str) else json.dumps(payload_obj)
        exec_result = execute_shell_command(cmd_str)
        return {
            "type": "direct_execution",
            "result": exec_result,
        }

    else:
        return {
            "error": f"Unsupported command_type '{command_type}'",
        }

# ------------------------------------------------------------------------------
# Daemon Threads: Heartbeat & Poller
# ------------------------------------------------------------------------------
def heartbeat_worker():
    """Background worker broadcasting agent online status to Cloudflare D1 every 30s."""
    logger.info("💓 Heartbeat background thread started.")
    hostname = socket.gethostname()

    while True:
        try:
            with status_lock:
                status = current_agent_status

            ping_data = {
                "agent_id": AGENT_ID,
                "status": status,
                "ip_hint": hostname,
            }
            resp = api_request("POST", "/heartbeat", ping_data, timeout=5.0)
            if resp and resp.get("ok"):
                logger.debug(f"Heartbeat sent successfully ({status}).")
            else:
                logger.warning(f"Heartbeat ping to {D1_API_URL}/heartbeat failed.")
        except Exception as e:
            logger.warning(f"Heartbeat exception: {e}")

        time.sleep(HEARTBEAT_INTERVAL_SECONDS)

def poller_worker():
    """Main loop checking Cloudflare D1 for pending tasks."""
    global current_agent_status
    logger.info(f"🔄 Polling D1 Queue at {D1_API_URL}/tasks/pending every {POLL_INTERVAL_SECONDS}s...")

    nexus_electron_online = check_nexus_desktop_status()
    if nexus_electron_online:
        logger.info(f"✅ Connected to local Nexus Desktop Electron App at {NEXUS_DESKTOP_URL}")
    else:
        logger.info(f"ℹ️ Nexus Desktop Electron app not detected on {NEXUS_DESKTOP_PORT} (Running in standalone OS automation mode)")

    while True:
        try:
            resp = api_request("GET", "/tasks/pending", timeout=5.0)
            if resp and resp.get("ok"):
                tasks = resp.get("tasks", [])
                for task in tasks:
                    task_id = task["id"]
                    logger.info(f"📥 Picked up Task {task_id}")

                    # 1. Update status to DISPATCHED_TO_NEXUS
                    with status_lock:
                        current_agent_status = "BUSY"

                    api_request("PATCH", f"/tasks/{task_id}", {
                        "status": "DISPATCHED_TO_NEXUS"
                    })

                    # 2. Execute
                    success = True
                    try:
                        result_output = process_task(task)
                        final_status = "COMPLETED"
                    except Exception as exec_err:
                        logger.error(f"Failed to execute task {task_id}: {exec_err}")
                        result_output = {"error": str(exec_err)}
                        final_status = "FAILED"

                    # 3. Report back to D1
                    api_request("PATCH", f"/tasks/{task_id}", {
                        "status": final_status,
                        "result_output": result_output
                    })
                    logger.info(f"🏁 Task {task_id} finished with status: {final_status}")

                    with status_lock:
                        current_agent_status = "ONLINE"

        except Exception as e:
            logger.error(f"Error in poller loop: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)

# ------------------------------------------------------------------------------
# Main Entry Point
# ------------------------------------------------------------------------------
def main():
    print("=" * 65)
    print(" 🚀 NEXUS DESKTOP REMOTE BRIDGE DAEMON ")
    print(" 100% Free Edge-To-Desktop Autonomous Control Bridge")
    print("=" * 65)
    print(f" Agent ID:       {AGENT_ID}")
    print(f" D1 Endpoint:    {D1_API_URL}")
    print(f" Poll Interval:  {POLL_INTERVAL_SECONDS}s")
    print(f" PyAutoGUI:      {'Installed' if HAS_PYAUTOGUI else 'Not installed (Key/mouse simulation disabled)'}")
    print(f" Local TTS:      {'Installed' if HAS_PYTTSX3 else 'Windows SAPI Fallback'}")
    print("=" * 65)

    # Start Heartbeat Thread
    hb_thread = threading.Thread(target=heartbeat_worker, daemon=True)
    hb_thread.start()

    # Start Task Poller (Main thread)
    try:
        poller_worker()
    except KeyboardInterrupt:
        print("\nStopping Nexus Bridge Daemon. Goodbye!")
        # Send offline heartbeat
        api_request("POST", "/heartbeat", {"agent_id": AGENT_ID, "status": "OFFLINE"}, timeout=2.0)
        sys.exit(0)

if __name__ == "__main__":
    main()
