"""
Nexus execution engines — thin adapters that delegate to battle-tested open-source tools.

    shell   -> SHELL (built-in subprocess) / INTERPRETER (Open Interpreter, optional)
    ui      -> UI_INSPECT / UI_CLICK / UI_TYPE (Windows UI Automation tree via `uiautomation`)
               UFO_TASK (delegates to your Microsoft UFO checkout via a command template)
    browser -> BROWSER_TASK (Browser-Use, optional)
    android -> ADB_* (Android Debug Bridge: WSABuilds, emulator or USB phone)

Every engine is opt-in via config.user.json -> "engines". The daemon refuses any step whose
engine is disabled on THIS machine, regardless of what the cloud planner sent.
Missing libraries never crash the daemon; the step returns an install hint instead.
"""

import asyncio
import logging
import os
import shutil
import subprocess
from typing import Any, Dict, Optional

from ai_client import DEFAULT_MODELS, ENGINE_FOR_ACTION

logger = logging.getLogger("NexusEngines")


class EngineDisabled(Exception):
    pass


def _fail(msg: str, **extra) -> Dict[str, Any]:
    return {"success": False, "error": msg, **extra}


def _tail(text: str, limit: int = 4000) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else "…" + text[-limit:]


# ------------------------------------------------------------------------------
# shell: Open Interpreter
# ------------------------------------------------------------------------------
def _litellm_model(ai: Dict[str, Any]) -> Dict[str, Any]:
    """Maps Nexus provider settings to LiteLLM-style settings used by Open Interpreter."""
    provider = (ai.get("provider") or "gemini").lower()
    model = ai.get("model") or DEFAULT_MODELS.get(provider, DEFAULT_MODELS["custom"])["model"]
    if provider == "gemini":
        return {"model": f"gemini/{model}", "api_key": ai.get("api_key")}
    if provider == "groq":
        return {"model": f"groq/{model}", "api_key": ai.get("api_key")}
    if provider == "openai":
        return {"model": model, "api_key": ai.get("api_key")}
    return {"model": f"openai/{model}", "api_key": ai.get("api_key") or "local", "api_base": ai.get("base_url")}


def run_interpreter(task: str, user_cfg: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from interpreter import interpreter  # type: ignore
    except ImportError:
        return _fail("Open Interpreter is not installed.", hint="pip install open-interpreter")

    opts = user_cfg.get("engine_options", {})
    ai = user_cfg.get("ai", {})
    if not user_cfg.get("developer_mode") or not (ai.get("api_key") or ai.get("provider") == "custom"):
        return _fail("Open Interpreter needs its own LLM. Enable Developer Mode and set a provider/key "
                     "(or a local OpenAI-compatible server) with: python nexus_settings.py")
    if not opts.get("open_interpreter_auto_run"):
        return _fail("Open Interpreter auto_run is OFF, so it cannot execute code unattended. "
                     "Enable 'open_interpreter_auto_run' in nexus_settings.py if you accept that risk.")

    llm = _litellm_model(ai)
    interpreter.reset()
    interpreter.auto_run = True
    interpreter.llm.model = llm["model"]
    interpreter.llm.api_key = llm.get("api_key")
    if llm.get("api_base"):
        interpreter.llm.api_base = llm["api_base"]
        interpreter.offline = True
    logger.info(f"🧠 [Open Interpreter] {task[:80]}")
    messages = interpreter.chat(task, display=False, stream=False) or []
    final = [m.get("content", "") for m in messages if m.get("role") == "assistant" and m.get("type") == "message"]
    outputs = [m.get("content", "") for m in messages if m.get("type") == "console" and m.get("format") == "output"]
    return {"success": True, "message": _tail(final[-1] if final else ""), "console": _tail("\n".join(outputs), 2000)}


# ------------------------------------------------------------------------------
# ui: Windows UI Automation (the same accessibility tree Microsoft UFO reads)
# ------------------------------------------------------------------------------
def _uia():
    try:
        import uiautomation as auto  # type: ignore
        return auto
    except ImportError:
        return None


def _foreground_window(auto):
    ctrl = auto.GetForegroundControl()
    return ctrl.GetTopLevelControl() if ctrl else None


def ui_inspect(max_items: int = 150) -> Dict[str, Any]:
    auto = _uia()
    if not auto:
        return _fail("uiautomation is not installed.", hint="pip install uiautomation")
    win = _foreground_window(auto)
    if not win:
        return _fail("No foreground window")
    items = []

    def walk(ctrl, depth):
        if len(items) >= max_items or depth > 8:
            return
        for child in ctrl.GetChildren():
            if child.Name or child.AutomationId:
                items.append({"name": child.Name, "type": child.ControlTypeName, "automation_id": child.AutomationId})
            walk(child, depth + 1)

    walk(win, 0)
    return {"success": True, "window": win.Name, "controls": items, "truncated": len(items) >= max_items}


def _find_control(auto, win, name: str, control_type: Optional[str]):
    finder = getattr(win, f"{control_type}Control", None) if control_type else None
    finder = finder or win.Control
    for kwargs in ({"Name": name}, {"SubName": name}):
        ctrl = finder(searchDepth=12, **kwargs)
        if ctrl.Exists(2, 0.25):
            return ctrl
    return None


def ui_click(name: str, control_type: Optional[str] = None) -> Dict[str, Any]:
    auto = _uia()
    if not auto:
        return _fail("uiautomation is not installed.", hint="pip install uiautomation")
    win = _foreground_window(auto)
    ctrl = _find_control(auto, win, name, control_type) if win else None
    if not ctrl:
        return _fail(f"Control '{name}' not found in '{win.Name if win else '?'}'. Try UI_INSPECT first.")
    try:
        pattern = ctrl.GetInvokePattern()
        if pattern:
            pattern.Invoke()
        else:
            ctrl.Click(simulateMove=False)
    except Exception:
        ctrl.Click(simulateMove=False)
    return {"success": True, "message": f"Clicked {ctrl.ControlTypeName} '{ctrl.Name}'"}


def ui_type(name: str, text: str) -> Dict[str, Any]:
    auto = _uia()
    if not auto:
        return _fail("uiautomation is not installed.", hint="pip install uiautomation")
    win = _foreground_window(auto)
    ctrl = _find_control(auto, win, name, "Edit") or (_find_control(auto, win, name, None) if win else None)
    if not ctrl:
        return _fail(f"Edit control '{name}' not found")
    ctrl.SetFocus()
    try:
        ctrl.GetValuePattern().SetValue(text)
    except Exception:
        ctrl.SendKeys(text.replace("{", "{{}").replace("}", "{}}"), interval=0.01)
    return {"success": True, "message": f"Typed {len(text)} chars into '{ctrl.Name}'"}


def run_ufo(task: str, task_id: str, user_cfg: Dict[str, Any]) -> Dict[str, Any]:
    opts = user_cfg.get("engine_options", {})
    template = (opts.get("ufo_command") or "").strip()
    if not template:
        return _fail("Microsoft UFO is not configured. Set 'ufo_command' and 'ufo_workdir' with: python nexus_settings.py",
                     hint="Clone https://github.com/microsoft/UFO, configure its config.yaml, then use the CLI form your version documents.")
    cmd = template.replace("{task_id}", f"nexus_{task_id[:8]}").replace("{request}", task.replace('"', "'"))
    logger.info(f"🪟 [UFO] {cmd}")
    try:
        proc = subprocess.run(cmd, shell=True, cwd=opts.get("ufo_workdir") or None,
                              capture_output=True, text=True, timeout=900)
        return {"success": proc.returncode == 0, "returncode": proc.returncode,
                "stdout": _tail(proc.stdout), "stderr": _tail(proc.stderr, 1500)}
    except subprocess.TimeoutExpired:
        return _fail("UFO task timed out after 15 minutes")


# ------------------------------------------------------------------------------
# browser: Browser-Use
# ------------------------------------------------------------------------------
def _browser_use_llm(ai: Dict[str, Any]):
    provider = (ai.get("provider") or "gemini").lower()
    model = ai.get("model") or DEFAULT_MODELS.get(provider, DEFAULT_MODELS["custom"])["model"]
    import browser_use  # type: ignore
    if provider == "gemini":
        return browser_use.ChatGoogle(model=model, api_key=ai.get("api_key"))
    if provider == "groq" and hasattr(browser_use, "ChatGroq"):
        return browser_use.ChatGroq(model=model, api_key=ai.get("api_key"))
    base = ai.get("base_url") or DEFAULT_MODELS.get(provider, DEFAULT_MODELS["custom"]).get("base_url")
    return browser_use.ChatOpenAI(model=model, api_key=ai.get("api_key") or "local", base_url=base)


def run_browser_task(task: str, user_cfg: Dict[str, Any]) -> Dict[str, Any]:
    try:
        import browser_use  # type: ignore  # noqa: F401
    except ImportError:
        return _fail("Browser-Use is not installed.", hint="pip install browser-use && playwright install chromium")
    ai = user_cfg.get("ai", {})
    if not user_cfg.get("developer_mode") or not (ai.get("api_key") or ai.get("provider") == "custom"):
        return _fail("Browser-Use needs its own LLM. Enable Developer Mode and set a provider/key with: python nexus_settings.py")

    headless = bool(user_cfg.get("engine_options", {}).get("browser_headless"))

    async def _run():
        from browser_use import Agent  # type: ignore
        llm = _browser_use_llm(ai)
        kwargs: Dict[str, Any] = {"task": task, "llm": llm}
        try:
            from browser_use import BrowserProfile  # type: ignore
            kwargs["browser_profile"] = BrowserProfile(headless=headless)
        except ImportError:
            pass
        history = await Agent(**kwargs).run(max_steps=25)
        return history.final_result() if hasattr(history, "final_result") else str(history)

    logger.info(f"🌐 [Browser-Use] {task[:80]}")
    try:
        result = asyncio.run(_run())
        return {"success": True, "message": _tail(str(result or ""))}
    except Exception as e:  # noqa: BLE001
        return _fail(f"Browser-Use failed: {e}")


# ------------------------------------------------------------------------------
# android: ADB (WSABuilds / emulator / USB device)
# ------------------------------------------------------------------------------
_ADB_TEXT_SPECIAL = set("()<>|;&*\\~\"'$`")
_ADB_KEYS = {"HOME": 3, "BACK": 4, "ENTER": 66, "MENU": 82, "APP_SWITCH": 187, "POWER": 26, "VOLUME_UP": 24, "VOLUME_DOWN": 25}


def _adb(args, opts) -> Dict[str, Any]:
    adb = opts.get("adb_path") or "adb"
    if not (shutil.which(adb) or os.path.exists(adb)):
        return _fail("adb not found.", hint="Install Android platform-tools and add it to PATH, or set adb_path.")
    cmd = [adb] + (["-s", opts["adb_serial"]] if opts.get("adb_serial") else []) + [str(a) for a in args]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return {"success": proc.returncode == 0, "returncode": proc.returncode,
                "stdout": _tail(proc.stdout, 2000), "stderr": _tail(proc.stderr, 1000)}
    except subprocess.TimeoutExpired:
        return _fail("adb command timed out")


def run_adb(action: str, step: Dict[str, Any], opts: Dict[str, Any]) -> Dict[str, Any]:
    if action == "ADB_TAP":
        return _adb(["shell", "input", "tap", int(step.get("x", 0)), int(step.get("y", 0))], opts)
    if action == "ADB_TEXT":
        text = "".join("\\" + c if c in _ADB_TEXT_SPECIAL else c for c in str(step.get("text", ""))).replace(" ", "%s")
        return _adb(["shell", "input", "text", text], opts)
    if action == "ADB_LAUNCH":
        pkg = str(step.get("package", "")).strip()
        if not pkg:
            return _fail("ADB_LAUNCH needs 'package'")
        if "/" in pkg:
            return _adb(["shell", "am", "start", "-n", pkg], opts)
        return _adb(["shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"], opts)
    if action == "ADB_KEY":
        key = str(step.get("key", "HOME")).upper().replace("KEYCODE_", "")
        code = key if key.isdigit() else _ADB_KEYS.get(key, f"KEYCODE_{key}")
        return _adb(["shell", "input", "keyevent", code], opts)
    if action == "ADB_SHELL":
        return _adb(["shell", str(step.get("cmd", ""))], opts)
    return _fail(f"Unknown ADB action {action}")


# ------------------------------------------------------------------------------
# Router
# ------------------------------------------------------------------------------
def is_engine_action(action: str) -> bool:
    return action in ENGINE_FOR_ACTION and action != "SHELL"


def run_engine_action(action: str, step: Dict[str, Any], user_cfg: Dict[str, Any], task_id: str = "") -> Dict[str, Any]:
    engine = ENGINE_FOR_ACTION.get(action)
    if engine and not (user_cfg.get("engines") or {}).get(engine):
        raise EngineDisabled(f"Engine '{engine}' is disabled on this PC (enable it with: python nexus_settings.py)")

    if action == "INTERPRETER":
        return run_interpreter(str(step.get("task") or step.get("text") or ""), user_cfg)
    if action == "UI_INSPECT":
        return ui_inspect()
    if action == "UI_CLICK":
        return ui_click(str(step.get("name", "")), step.get("control_type"))
    if action == "UI_TYPE":
        return ui_type(str(step.get("name", "")), str(step.get("text", "")))
    if action == "UFO_TASK":
        return run_ufo(str(step.get("task", "")), task_id, user_cfg)
    if action == "BROWSER_TASK":
        return run_browser_task(str(step.get("task", "")), user_cfg)
    if action.startswith("ADB_"):
        return run_adb(action, step, user_cfg.get("engine_options", {}))
    return _fail(f"No engine handles {action}")
