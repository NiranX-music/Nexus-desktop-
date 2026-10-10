"""
Nexus Skyvern & Screen-Use Engine.
Provides autonomous visual screen navigation and grounding:
1. Electron Skyvern Screen Agent (via local Nexus bridge port 17173)
2. Skyvern REST API (via local/remote Skyvern server port 8000 /api/v1/tasks)
3. Native Visual Screen Fallback (PIL + PyAutoGUI + Gemini Vision 0-1000 normalized grounding)
"""

import base64
import io
import json
import logging
import os
import subprocess
import time
from typing import Any, Dict, Optional
import urllib.error
import urllib.request

logger = logging.getLogger("NexusSkyvern")


def _fail(msg: str, **extra) -> Dict[str, Any]:
    return {"success": False, "error": msg, **extra}


def _post_json(url: str, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None, timeout: float = 30.0) -> Optional[Dict[str, Any]]:
    try:
        data = json.dumps(payload).encode("utf-8")
        req_headers = {
            "Content-Type": "application/json",
            "User-Agent": "NexusDesktopAgent/1.0"
        }
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(url, data=data, headers=req_headers, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except Exception as e:
        logger.debug(f"POST to {url} failed: {e}")
        return None


def _get_json(url: str, headers: Optional[Dict[str, str]] = None, timeout: float = 10.0) -> Optional[Dict[str, Any]]:
    try:
        req_headers = {"User-Agent": "NexusDesktopAgent/1.0"}
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except Exception as e:
        logger.debug(f"GET to {url} failed: {e}")
        return None


def run_skyvern_task(task: str, user_cfg: Dict[str, Any], url: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes an autonomous visual screen task.
    Tries in priority order:
    1. Active Nexus Electron App (port 17173 /skyvern-task)
    2. Local/Remote Skyvern REST Service (port 8000 /api/v1/tasks)
    3. Native Python Visual Grounding (ImageGrab + Gemini 3.8 Flash + PyAutoGUI)
    """
    logger.info(f"👁️ [Skyvern/ScreenUse] Goal: {task[:100]}")
    opts = user_cfg.get("engine_options", {})
    skyvern_url = (opts.get("skyvern_api_url") or "http://127.0.0.1:8000").rstrip("/")
    electron_port = int(opts.get("electron_port") or 17173)

    # --------------------------------------------------------------------------
    # Tier 1: Nexus Electron App Screen Agent (Port 17173)
    # --------------------------------------------------------------------------
    electron_endpoint = f"http://127.0.0.1:{electron_port}/screen-task"
    res = _post_json(electron_endpoint, {"goal": task, "url": url or "", "mode": "desktop"})
    if not res:
        res = _post_json(f"http://127.0.0.1:{electron_port}/skyvern-task", {"goal": task, "url": url or "", "mode": "desktop"})
    if res and res.get("ok"):
        result_data = res.get("result", {})
        return {
            "success": result_data.get("status") != "failed",
            "source": "nexus_electron_screen_agent",
            "message": result_data.get("finalResult") or f"Executed via Nexus Screen Agent: {result_data.get('status')}",
            "steps": len(result_data.get("steps", []))
        }

    # --------------------------------------------------------------------------
    # Tier 2: Skyvern Open-Source REST API (Port 8000)
    # --------------------------------------------------------------------------
    skyvern_api_key = opts.get("skyvern_api_key") or os.environ.get("SKYVERN_API_KEY", "")
    skyvern_task_endpoint = f"{skyvern_url}/api/v1/tasks"
    try:
        req_headers = {}
        if skyvern_api_key:
            req_headers["x-api-key"] = skyvern_api_key
        payload = {
            "navigation_goal": task,
            "url": url or "https://www.google.com"
        }
        task_resp = _post_json(skyvern_task_endpoint, payload, headers=req_headers, timeout=15.0)
        if task_resp and "task_id" in task_resp:
            task_id = task_resp["task_id"]
            status_url = f"{skyvern_task_endpoint}/{task_id}"
            for _ in range(30):
                time.sleep(3)
                poll_res = _get_json(status_url, headers=req_headers, timeout=10.0)
                if poll_res:
                    status = poll_res.get("status", "").lower()
                    if status in ("completed", "success"):
                        return {
                            "success": True,
                            "source": "skyvern_api",
                            "task_id": task_id,
                            "data": poll_res.get("extracted_information") or poll_res.get("navigation_payload")
                        }
                    elif status in ("failed", "terminated", "error"):
                        return _fail(f"Skyvern task failed: {poll_res.get('error_message') or status}")
            return {"success": True, "source": "skyvern_api", "task_id": task_id, "status": "running_background"}
    except Exception as e:
        logger.debug(f"Skyvern API endpoint error: {e}")

    # --------------------------------------------------------------------------
    # Tier 3: Native Screen Vision Grounding (PIL + Gemini Vision + PyAutoGUI)
    # --------------------------------------------------------------------------
    ai_cfg = user_cfg.get("ai", {})
    gemini_key = ai_cfg.get("api_key") or os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        return _fail(
            "Neither Nexus Desktop app (port 17173) nor Skyvern service (port 8000) was detected, "
            "and no GEMINI_API_KEY is configured for native vision fallback.",
            hint="Launch Nexus Desktop or install and run Skyvern (https://github.com/skyvern-ai/skyvern)"
        )

    try:
        from PIL import ImageGrab
        import pyautogui
    except ImportError:
        return _fail(
            "Native screen fallback requires Pillow and PyAutoGUI.",
            hint="pip install pillow pyautogui"
        )

    try:
        img = ImageGrab.grab(all_screens=False)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        width, height = img.size

        prompt = (
            f"You are a computer vision agent executing this user goal: \"{task}\".\n"
            f"Screen dimensions: {width}x{height}.\n"
            f"Inspect the screenshot and decide the single most critical action to take right now.\n"
            f"Respond ONLY with a JSON object: {{\"action\": \"CLICK\"|\"TYPE\"|\"PRESS\"|\"DONE\", \"target\": \"element name\", \"normalized_x\": 0-1000, \"normalized_y\": 0-1000, \"text\": \"string if TYPE\", \"key\": \"string if PRESS\", \"reasoning\": \"brief why\"}}"
        )

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={gemini_key}"
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/png", "data": b64}}
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json"}
        }
        res_json = _post_json(gemini_url, body, timeout=30.0)
        if not res_json:
            return _fail("Gemini Vision request failed during screen analysis")

        parts = res_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])
        text_out = parts[0].get("text", "{}")
        parsed = json.loads(text_out)
        act = parsed.get("action", "DONE").upper()
        norm_x = parsed.get("normalized_x")
        norm_y = parsed.get("normalized_y")

        if norm_x is not None and norm_y is not None:
            phys_x = int((norm_x / 1000.0) * width)
            phys_y = int((norm_y / 1000.0) * height)
            if act == "CLICK":
                pyautogui.moveTo(phys_x, phys_y, duration=0.3)
                pyautogui.click()
                if parsed.get("text"):
                    time.sleep(0.3)
                    pyautogui.typewrite(str(parsed["text"]), interval=0.02)
                return {"success": True, "source": "native_gemini_vision", "action": "CLICK", "coords": [phys_x, phys_y], "reasoning": parsed.get("reasoning")}
        elif act == "TYPE" and parsed.get("text"):
            pyautogui.typewrite(str(parsed["text"]), interval=0.02)
            return {"success": True, "source": "native_gemini_vision", "action": "TYPE", "text": parsed.get("text")}

        return {"success": True, "source": "native_gemini_vision", "result": parsed}
    except Exception as e:
        return _fail(f"Native screen use failed: {e}")


def ui_visual_click(target: str, user_cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Finds a target element on screen by visual description and clicks it."""
    logger.info(f"🎯 [VisualClick] Target: {target}")
    opts = user_cfg.get("engine_options", {})
    electron_port = int(opts.get("electron_port") or 17173)

    # 1. Forward to Electron App if listening
    res = _post_json(f"http://127.0.0.1:{electron_port}/screen-click", {"target": target})
    if not res:
        res = _post_json(f"http://127.0.0.1:{electron_port}/skyvern-click", {"target": target})
    if res and res.get("ok"):
        return {"success": True, "source": "nexus_electron", "data": res.get("result")}

    # 2. Native Vision fallback
    return run_skyvern_task(f"Click on the {target}", user_cfg)


# Alias
run_screen_task = run_skyvern_task
