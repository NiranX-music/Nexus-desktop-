"""
Nexus Desktop Autonomous Daemon
Execution Layer: Local Desktop Machine (Windows/Linux/macOS)
Role: Polls Cloudflare D1 queue for tasks targeted to 'DESKTOP', drives local OS
(PowerShell/Bash, PyAutoGUI, pynput, TTS, and Nexus Electron App), uploads screenshots
to Cloudflare R2, and posts real-time execution logs back to Edge.
"""

import os
import sys
import io

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "buffer"):
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass
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
# 1. Configuration & Automation Libraries
# ------------------------------------------------------------------------------
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

def load_config() -> Dict[str, Any]:
    default_cfg = {
        "device_id": f"nexus-desktop-{socket.gethostname().lower()}",
        "device_type": "DESKTOP",
        "device_name": f"{socket.gethostname()} Workstation",
        "d1_api_url": "https://nexus-bridge-7l1.pages.dev/api",
        "auth_token": "",
        "poll_interval_seconds": 2.0,
        "heartbeat_interval_seconds": 30.0,
        "capture_screenshot_on_complete": True,
        "nexus_electron_port": 17173,
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                user_cfg = json.load(f)
                default_cfg.update(user_cfg)
        except Exception as e:
            print(f"[Warning] Failed to read config.json, using defaults: {e}")
    return default_cfg

CONFIG = load_config()

# Optional Automation Libraries with Graceful Fallbacks
try:
    import pyautogui
    pyautogui.FAILSAFE = False
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False

try:
    from pynput.keyboard import Controller as KeyboardController, Key
    keyboard_ctl = KeyboardController()
    HAS_PYNPUT = True
except ImportError:
    HAS_PYNPUT = False

try:
    import pyttsx3
    HAS_PYTTSX3 = True
except ImportError:
    HAS_PYTTSX3 = False

# Setup Logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("DesktopDaemon")

status_lock = threading.Lock()
current_status = "ONLINE"

# ------------------------------------------------------------------------------
# 2. HTTP Helper Client
# ------------------------------------------------------------------------------
def api_call(method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, raw_body: Optional[bytes] = None, headers_extra: Optional[Dict[str, str]] = None, timeout: float = 15.0) -> Optional[Dict[str, Any]]:
    base_url = CONFIG["d1_api_url"].rstrip("/")
    clean_ep = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    url = f"{base_url}{clean_ep}"

    headers = {
        "User-Agent": f"Nexus-Desktop-Daemon/2.0 ({platform.system()})",
    }
    if CONFIG.get("auth_token"):
        headers["Authorization"] = f"Bearer {CONFIG['auth_token']}"

    if headers_extra:
        headers.update(headers_extra)

    body_bytes = None
    if raw_body is not None:
        body_bytes = raw_body
    elif data is not None:
        headers["Content-Type"] = "application/json"
        body_bytes = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {"ok": True}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        logger.error(f"HTTP Error {e.code} on {method} {url}: {err_msg}")
        return None
    except urllib.error.URLError as e:
        logger.warning(f"Connection failed to {url}: {e.reason}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error on {method} {url}: {e}")
        return None

# ------------------------------------------------------------------------------
# 3. Action Execution Handlers (Shell, PyAutoGUI, Voice, Nexus Electron)
# ------------------------------------------------------------------------------
def execute_shell(command: str) -> Dict[str, Any]:
    """Runs local shell/powershell command and captures stdout/stderr."""
    logger.info(f"⚡ [Shell] Running: {command}")
    start = time.time()
    try:
        proc = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=180,
        )
        elapsed = round(time.time() - start, 3)
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
            "stderr": "Command timed out after 180s",
            "elapsed_seconds": 180.0,
        }
    except Exception as e:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": str(e),
            "elapsed_seconds": round(time.time() - start, 3),
        }

def trigger_voice_output(text: str):
    """Speaks text using local OS speech engine with 0 cloud API consumption."""
    logger.info(f"🔊 [Voice] Speaking: '{text}'")
    if HAS_PYTTSX3:
        try:
            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
            return
        except Exception:
            pass

    if platform.system() == "Windows":
        clean_text = text.replace("'", " ")
        ps_cmd = f"Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('{clean_text}')"
        subprocess.Popen(["powershell", "-Command", ps_cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def capture_and_upload_screenshot(task_id: str) -> Optional[str]:
    """Captures desktop screenshot and uploads directly to Cloudflare R2 via Edge API."""
    if not HAS_PYAUTOGUI:
        return None
    try:
        filename = f"screenshot-{task_id[:8]}-{int(time.time())}.png"
        temp_path = os.path.join(os.path.dirname(__file__), filename)
        screenshot = pyautogui.screenshot()
        screenshot.save(temp_path)

        with open(temp_path, "rb") as f:
            image_bytes = f.read()

        # Upload to Cloudflare R2
        upload_resp = api_call(
            "POST",
            f"/upload?filename={filename}",
            raw_body=image_bytes,
            headers_extra={"Content-Type": "image/png"}
        )

        if os.path.exists(temp_path):
            try: os.remove(temp_path)
            except Exception: pass

        if upload_resp and upload_resp.get("ok"):
            logger.info(f"📸 Screenshot uploaded to R2: {upload_resp.get('url')}")
            return upload_resp.get("url")
    except Exception as e:
        logger.warning(f"Screenshot capture/upload failed: {e}")
    return None

def check_nexus_electron_active() -> bool:
    """Checks if Nexus Desktop Electron App is listening on port 17173."""
    port = CONFIG.get("nexus_electron_port", 17173)
    url = f"http://127.0.0.1:{port}/health"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("ok", False)
    except Exception:
        return False

def forward_to_nexus_electron(command_type: str, payload: str) -> Optional[Dict[str, Any]]:
    """Dispatches directly into Nexus Desktop Electron window."""
    port = CONFIG.get("nexus_electron_port", 17173)
    url = f"http://127.0.0.1:{port}/mobile-command"
    body = json.dumps({"source": "nexus-web-remote", "type": command_type, "payload": payload}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"Failed to communicate with Nexus Electron app: {e}")
        return None

def execute_action_step(step: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a single step emitted by Modal AI action plan."""
    action_type = (step.get("action") or step.get("tool") or "").upper()
    result: Dict[str, Any] = {"action": action_type, "success": True}

    if action_type in ("SHELL", "BASH", "CMD"):
        cmd = step.get("cmd") or step.get("command") or ""
        shell_res = execute_shell(cmd)
        result.update(shell_res)

    elif action_type in ("KEYPRESS", "HOTKEY", "KEYBOARD"):
        keys = step.get("keys") or step.get("hotkey") or []
        if isinstance(keys, str):
            keys = [keys]
        if HAS_PYAUTOGUI:
            logger.info(f"⌨️ [Keyboard] Hotkey: {'+'.join(keys)}")
            try:
                pyautogui.hotkey(*keys)
                result["message"] = f"Pressed {'+'.join(keys)}"
            except Exception as e:
                result["warning"] = f"Hotkey warning: {e}"
        else:
            result["warning"] = "pyautogui not installed"

    elif action_type in ("TYPE_TEXT", "TYPE"):
        text = step.get("text", "")
        if HAS_PYAUTOGUI:
            logger.info(f"✍️ [Typing] Text: {text[:20]}...")
            pyautogui.write(text, interval=0.02)
            result["message"] = f"Typed {len(text)} characters"
        else:
            result["warning"] = "pyautogui not installed"

    elif action_type in ("MOUSE_CLICK", "CLICK"):
        x = step.get("x")
        y = step.get("y")
        if HAS_PYAUTOGUI:
            if x is not None and y is not None:
                pyautogui.moveTo(x, y, duration=0.2)
            pyautogui.click()
            result["message"] = f"Clicked at ({x}, {y})"
        else:
            result["warning"] = "pyautogui not installed"

    elif action_type in ("SPEAK", "VOICE"):
        text = step.get("text", "")
        trigger_voice_output(text)
        result["message"] = f"Spoke: {text}"

    elif action_type in ("SCREENSHOT", "CAPTURE"):
        result["message"] = "Screenshot scheduled for task completion"

    else:
        result["warning"] = f"Unknown action '{action_type}'"

    return result

# ------------------------------------------------------------------------------
# 4. Task Processing Pipeline
# ------------------------------------------------------------------------------
def process_desktop_task(task: Dict[str, Any]) -> Dict[str, Any]:
    """Executes task and returns comprehensive execution log."""
    task_id = task["id"]
    command_type = task["command_type"]
    prompt_raw = task.get("prompt_raw") or ""
    action_plan_raw = task.get("action_plan")

    logger.info(f"🚀 [Executing Task] ID: {task_id} | Type: {command_type}")

    # Parse action plan if present
    plan_obj = None
    if action_plan_raw:
        try:
            plan_obj = json.loads(action_plan_raw) if isinstance(action_plan_raw, str) else action_plan_raw
        except Exception:
            pass

    # A. Execute Plan Steps (if generated by Modal AI)
    if plan_obj and "steps" in plan_obj:
        step_results = []
        for step in plan_obj["steps"]:
            step_res = execute_action_step(step)
            step_results.append(step_res)
            time.sleep(0.2)
        return {
            "mode": "modal_action_plan",
            "steps_executed": len(step_results),
            "details": step_results,
        }

    # B. Direct Terminal Execution
    if command_type == "TERMINAL_EXEC":
        shell_res = execute_shell(prompt_raw)
        return {"mode": "terminal_exec", "result": shell_res}

    # C. Direct Desktop GUI Execution
    if command_type == "DESKTOP_GUI":
        # Check if prompt looks like hotkeys (e.g. "ctrl+shift+p")
        if "+" in prompt_raw:
            keys = [k.strip().lower() for k in prompt_raw.split("+")]
            step_res = execute_action_step({"action": "KEYPRESS", "keys": keys})
            return {"mode": "desktop_gui", "result": step_res}
        shell_res = execute_shell(prompt_raw)
        return {"mode": "desktop_gui_fallback", "result": shell_res}

    # D. Forward to Nexus Desktop Electron Window if running
    if check_nexus_electron_active():
        logger.info("Forwarding directly to Nexus Desktop Electron app...")
        electron_res = forward_to_nexus_electron("command", prompt_raw)
        return {"mode": "nexus_electron_forward", "response": electron_res}

    # E. Standard Fallback Execution
    shell_res = execute_shell(prompt_raw)
    return {"mode": "standard_exec", "result": shell_res}

# ------------------------------------------------------------------------------
# 5. Background Heartbeat & Poller Threads
# ------------------------------------------------------------------------------
def heartbeat_loop():
    """Background thread sending heartbeats every 30s to /api/heartbeat."""
    logger.info("💓 Heartbeat monitor thread started.")
    while True:
        try:
            with status_lock:
                status = current_status

            payload = {
                "device_id": CONFIG["device_id"],
                "device_type": "DESKTOP",
                "device_name": CONFIG["device_name"],
                "status": status,
                "battery_level": 100,
            }
            resp = api_call("POST", "/heartbeat", payload, timeout=5.0)
            if resp and resp.get("ok"):
                logger.debug(f"Heartbeat OK ({status}).")
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")

        time.sleep(CONFIG.get("heartbeat_interval_seconds", 30.0))

def poller_loop():
    """Main loop checking Cloudflare D1 for tasks targeted to 'DESKTOP'."""
    global current_status
    poll_sec = CONFIG.get("poll_interval_seconds", 2.0)
    logger.info(f"🔄 Polling D1 Queue at {CONFIG['d1_api_url']}/tasks/pending?device_type=DESKTOP every {poll_sec}s...")

    while True:
        try:
            resp = api_call("GET", "/tasks/pending?device_type=DESKTOP", timeout=6.0)
            if resp and resp.get("ok"):
                tasks = resp.get("tasks", [])
                for task in tasks:
                    task_id = task["id"]
                    logger.info(f"📥 Dispatched Task: {task_id}")

                    # 1. Update status to DISPATCHED
                    with status_lock:
                        current_status = "BUSY"

                    api_call("PATCH", f"/tasks/{task_id}", {"status": "DISPATCHED"})

                    # 2. Execute locally
                    success = True
                    try:
                        exec_log = process_desktop_task(task)
                        final_status = "COMPLETED"
                    except Exception as err:
                        logger.error(f"Task {task_id} failed: {err}")
                        exec_log = {"error": str(err)}
                        final_status = "FAILED"

                    # 3. Capture desktop screenshot if configured
                    media_url = None
                    if CONFIG.get("capture_screenshot_on_complete", True):
                        media_url = capture_and_upload_screenshot(task_id)

                    # 4. Report completion back to D1
                    patch_payload = {
                        "status": final_status,
                        "execution_log": exec_log,
                    }
                    if media_url:
                        patch_payload["media_r2_url"] = media_url

                    api_call("PATCH", f"/tasks/{task_id}", patch_payload)
                    logger.info(f"🏁 Task {task_id} marked as {final_status}")

                    with status_lock:
                        current_status = "ONLINE"

        except Exception as e:
            logger.error(f"Poller error: {e}")

        time.sleep(poll_sec)

# ------------------------------------------------------------------------------
# 6. Main Entry Point
# ------------------------------------------------------------------------------
def main():
    print("=" * 65)
    print(" 🚀 NEXUS DESKTOP AUTONOMOUS DAEMON (V2.0)")
    print(" Multi-Device Target: DESKTOP | 100% Free-Tier Bridge")
    print("=" * 65)
    print(f" Device ID:       {CONFIG['device_id']}")
    print(f" Device Name:     {CONFIG['device_name']}")
    print(f" D1 API Endpoint: {CONFIG['d1_api_url']}")
    print(f" Poll Interval:   {CONFIG['poll_interval_seconds']}s")
    print(f" PyAutoGUI:       {'Available' if HAS_PYAUTOGUI else 'Not installed'}")
    print(f" Pynput:          {'Available' if HAS_PYNPUT else 'Not installed'}")
    print(f" Voice TTS:       {'Available' if HAS_PYTTSX3 else 'Windows SAPI Fallback'}")
    print("=" * 65)

    # Start Heartbeat Thread
    hb_th = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_th.start()

    # Start Main Poller Loop
    try:
        poller_loop()
    except KeyboardInterrupt:
        print("\nStopping Nexus Desktop Daemon...")
        api_call("POST", "/heartbeat", {
            "device_id": CONFIG["device_id"],
            "device_type": "DESKTOP",
            "status": "OFFLINE",
        }, timeout=2.0)
        sys.exit(0)

if __name__ == "__main__":
    main()
