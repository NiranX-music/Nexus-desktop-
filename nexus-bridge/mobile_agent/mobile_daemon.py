"""
Nexus Mobile Autonomous Daemon for Android Termux
Execution Layer: Android Device (Termux + Termux:API)
Role: Polls Cloudflare D1 for tasks targeted to 'MOBILE', executes device-native
actions (Vibration, Notifications, Battery telemetry, Clipboard, Toast, TTS, Shell),
and reports live battery percentage and status back to Edge.

Zero required external pip packages: Works purely on Python 3 standard library!
"""

import os
import sys
import time
import json
import socket
import logging
import threading
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional
import urllib.request
import urllib.error

# ------------------------------------------------------------------------------
# 1. Configuration & Logging
# ------------------------------------------------------------------------------
D1_API_URL = os.getenv("D1_API_URL", "http://127.0.0.1:8788/api").rstrip("/")
AUTH_TOKEN = os.getenv("NEXUS_SECRET_KEY", "")
DEVICE_ID = os.getenv("MOBILE_DEVICE_ID", f"nexus-mobile-{socket.gethostname().lower()}")
DEVICE_NAME = os.getenv("MOBILE_DEVICE_NAME", "Android Companion (Termux)")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "2.5"))
HEARTBEAT_INTERVAL = float(os.getenv("HEARTBEAT_INTERVAL", "30.0"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("MobileDaemon")

current_status = "ONLINE"
status_lock = threading.Lock()

# ------------------------------------------------------------------------------
# 2. Termux:API Hardware Hooks
# ------------------------------------------------------------------------------
def run_termux_cmd(cmd_list: list, timeout: float = 10.0) -> Dict[str, Any]:
    """Runs a Termux API command and returns stdout/stderr."""
    try:
        proc = subprocess.run(
            cmd_list,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "success": proc.returncode == 0,
            "stdout": proc.stdout.strip(),
            "stderr": proc.stderr.strip(),
        }
    except FileNotFoundError:
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Command '{cmd_list[0]}' not found. Is termux-api installed?",
        }
    except Exception as e:
        return {"success": False, "stdout": "", "stderr": str(e)}

def get_mobile_battery() -> int:
    """Fetches real-time battery level via termux-battery-status."""
    res = run_termux_cmd(["termux-battery-status"], timeout=3.0)
    if res["success"] and res["stdout"]:
        try:
            data = json.loads(res["stdout"])
            return int(data.get("percentage", 100))
        except Exception:
            pass
    return 100

def trigger_termux_vibrate(duration_ms: int = 500) -> Dict[str, Any]:
    """Triggers phone vibration."""
    return run_termux_cmd(["termux-vibrate", "-d", str(duration_ms)])

def trigger_termux_notification(title: str, content: str) -> Dict[str, Any]:
    """Pushes a local Android notification."""
    return run_termux_cmd([
        "termux-notification",
        "--title", title,
        "--content", content,
        "--priority", "high",
        "--id", "nexus_task_alert"
    ])

def trigger_termux_toast(text: str) -> Dict[str, Any]:
    """Displays Android on-screen toast popup."""
    return run_termux_cmd(["termux-toast", "-s", text])

def trigger_termux_tts(text: str) -> Dict[str, Any]:
    """Speaks text using Android Text-to-Speech."""
    return run_termux_cmd(["termux-tts-speak", text])

def set_termux_clipboard(text: str) -> Dict[str, Any]:
    """Sets Android system clipboard."""
    return run_termux_cmd(["termux-clipboard-set", text])

def get_termux_clipboard() -> Dict[str, Any]:
    """Reads Android system clipboard."""
    return run_termux_cmd(["termux-clipboard-get"])

def set_termux_torch(state: str = "on") -> Dict[str, Any]:
    """Toggles phone flashlight."""
    return run_termux_cmd(["termux-torch", state])

# ------------------------------------------------------------------------------
# 3. HTTP Client Helpers
# ------------------------------------------------------------------------------
def api_request(method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, timeout: float = 12.0) -> Optional[Dict[str, Any]]:
    clean_ep = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    url = f"{D1_API_URL}{clean_ep}"

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Nexus-Mobile-Daemon/2.0 (Android-Termux)",
    }
    if AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {AUTH_TOKEN}"

    body_bytes = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {"ok": True}
    except urllib.error.HTTPError as e:
        logger.error(f"HTTP Error {e.code} on {method} {url}: {e.read().decode('utf-8', 'ignore')}")
        return None
    except Exception as e:
        logger.warning(f"Network error on {method} {url}: {e}")
        return None

# ------------------------------------------------------------------------------
# 4. Mobile Task Execution
# ------------------------------------------------------------------------------
def execute_mobile_step(step: Dict[str, Any]) -> Dict[str, Any]:
    """Executes a single step for Android."""
    action = (step.get("action") or step.get("tool") or "").upper()
    logger.info(f"📱 [Mobile Step] Executing: {action}")

    if action in ("VIBRATE", "TERMUX_VIBRATE"):
        duration = int(step.get("duration_ms") or 500)
        return trigger_termux_vibrate(duration)

    elif action in ("NOTIFICATION", "NOTIFY", "TERMUX_NOTIFICATION"):
        title = step.get("title") or "Nexus Mobile Alert"
        content = step.get("content") or step.get("text") or "Task complete"
        return trigger_termux_notification(title, content)

    elif action in ("TOAST", "TERMUX_TOAST"):
        text = step.get("text") or "Nexus Action Triggered"
        return trigger_termux_toast(text)

    elif action in ("SPEAK", "TTS", "TERMUX_TTS"):
        text = step.get("text") or ""
        return trigger_termux_tts(text)

    elif action in ("CLIPBOARD_SET", "TERMUX_CLIPBOARD_SET"):
        text = step.get("text") or ""
        return set_termux_clipboard(text)

    elif action in ("CLIPBOARD_GET", "TERMUX_CLIPBOARD_GET"):
        return get_termux_clipboard()

    elif action in ("BATTERY_CHECK", "TERMUX_BATTERY"):
        pct = get_mobile_battery()
        return {"battery_percentage": pct}

    elif action in ("TORCH", "TERMUX_TORCH", "FLASHLIGHT"):
        state = step.get("state", "on")
        return set_termux_torch(state)

    elif action in ("SHELL", "BASH", "CMD"):
        cmd = step.get("cmd") or step.get("command") or ""
        try:
            proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
            return {"success": proc.returncode == 0, "stdout": proc.stdout.strip(), "stderr": proc.stderr.strip()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    return {"warning": f"Unsupported mobile action: {action}"}

def process_mobile_task(task: Dict[str, Any]) -> Dict[str, Any]:
    """Processes task targeted to MOBILE."""
    task_id = task["id"]
    prompt_raw = task.get("prompt_raw") or ""
    action_plan_raw = task.get("action_plan")

    logger.info(f"📱 Processing Mobile Task: {task_id}")

    plan_obj = None
    if action_plan_raw:
        try:
            plan_obj = json.loads(action_plan_raw) if isinstance(action_plan_raw, str) else action_plan_raw
        except Exception:
            pass

    # A. Multi-step action plan
    if plan_obj and "steps" in plan_obj:
        results = []
        for step in plan_obj["steps"]:
            res = execute_mobile_step(step)
            results.append(res)
            time.sleep(0.3)
        return {"mode": "mobile_plan", "steps": results}

    # B. Natural Language heuristics
    lower = prompt_raw.lower()
    if "vibrate" in lower:
        return trigger_termux_vibrate(600)
    elif "battery" in lower:
        return {"battery_level": get_mobile_battery()}
    elif "notify" in lower:
        return trigger_termux_notification("Nexus Mobile", prompt_raw)
    elif "toast" in lower:
        return trigger_termux_toast(prompt_raw)

    # C. Default Shell in Termux
    try:
        proc = subprocess.run(prompt_raw, shell=True, capture_output=True, text=True, timeout=60)
        return {"mode": "termux_shell", "stdout": proc.stdout.strip(), "stderr": proc.stderr.strip()}
    except Exception as e:
        return {"error": str(e)}

# ------------------------------------------------------------------------------
# 5. Heartbeat & Poller Threads
# ------------------------------------------------------------------------------
def heartbeat_loop():
    """Reports phone status and live battery percentage every 30s."""
    logger.info("💓 Mobile heartbeat thread started.")
    while True:
        try:
            with status_lock:
                status = current_status

            battery = get_mobile_battery()
            payload = {
                "device_id": DEVICE_ID,
                "device_type": "MOBILE",
                "device_name": DEVICE_NAME,
                "status": status,
                "battery_level": battery,
            }
            resp = api_request("POST", "/heartbeat", payload, timeout=5.0)
            if resp and resp.get("ok"):
                logger.debug(f"Mobile Heartbeat sent (Battery: {battery}%).")
        except Exception as e:
            logger.warning(f"Mobile heartbeat failed: {e}")

        time.sleep(HEARTBEAT_INTERVAL)

def poller_loop():
    """Continuously queries for tasks targeted to 'MOBILE'."""
    global current_status
    logger.info(f"🔄 Polling D1 for MOBILE tasks at {D1_API_URL}/tasks/pending?device_type=MOBILE...")

    while True:
        try:
            resp = api_request("GET", "/tasks/pending?device_type=MOBILE", timeout=6.0)
            if resp and resp.get("ok"):
                tasks = resp.get("tasks", [])
                for task in tasks:
                    task_id = task["id"]
                    logger.info(f"📥 Dispatched Mobile Task: {task_id}")

                    with status_lock:
                        current_status = "BUSY"

                    # 1. Mark DISPATCHED
                    api_request("PATCH", f"/tasks/{task_id}", {"status": "DISPATCHED"})

                    # 2. Execute
                    try:
                        exec_log = process_mobile_task(task)
                        final_status = "COMPLETED"
                    except Exception as err:
                        logger.error(f"Mobile execution failed: {err}")
                        exec_log = {"error": str(err)}
                        final_status = "FAILED"

                    # 3. Report completion
                    api_request("PATCH", f"/tasks/{task_id}", {
                        "status": final_status,
                        "execution_log": exec_log,
                    })
                    logger.info(f"🏁 Mobile Task {task_id} marked as {final_status}")

                    with status_lock:
                        current_status = "ONLINE"

        except Exception as e:
            logger.error(f"Mobile poller error: {e}")

        time.sleep(POLL_INTERVAL)

# ------------------------------------------------------------------------------
# 6. Main Entrypoint
# ------------------------------------------------------------------------------
def main():
    print("=" * 65)
    print(" 📱 NEXUS MOBILE DAEMON (Android Termux Bridge)")
    print(" 100% Free Edge-to-Mobile Execution Layer")
    print("=" * 65)
    print(f" Device ID:       {DEVICE_ID}")
    print(f" Device Name:     {DEVICE_NAME}")
    print(f" D1 Endpoint:     {D1_API_URL}")
    print(f" Poll Interval:   {POLL_INTERVAL}s")
    print(f" Initial Battery: {get_mobile_battery()}%")
    print("=" * 65)

    hb_th = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_th.start()

    try:
        poller_loop()
    except KeyboardInterrupt:
        print("\nStopping Nexus Mobile Daemon...")
        api_request("POST", "/heartbeat", {
            "device_id": DEVICE_ID,
            "device_type": "MOBILE",
            "status": "OFFLINE",
        }, timeout=2.0)
        sys.exit(0)

if __name__ == "__main__":
    main()
