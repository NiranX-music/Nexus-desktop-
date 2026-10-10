"""
Nexus local user settings (Developer Mode) — stored ONLY on this machine.

File: desktop_agent/config.user.json  (git-ignored)

Secrets (API keys, the bridge auth token) are encrypted with Windows DPAPI
(CryptProtectData), which ties them to the current Windows user account: the
file is useless if copied to another machine or user. On non-Windows systems
there is no OS keystore available from the standard library, so secrets fall
back to plaintext with a warning — protect the file with filesystem permissions.

Nothing in this file is ever uploaded to Cloudflare.
"""

import base64
import copy
import json
import os
import sys
from typing import Any, Dict

USER_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.user.json")

SECRET_FIELDS = ("api_key", "auth_token")

DEFAULTS: Dict[str, Any] = {
    "developer_mode": False,
    "bridge": {
        "auth_token": "",
    },
    "ai": {
        # gemini | groq | openai | custom   (custom = any OpenAI-compatible server: Ollama, LM Studio, Edge0...)
        "provider": "gemini",
        "api_key": "",
        "base_url": "",
        "model": "",
        "stt_model": "",
        "temperature": 0.3,
        "max_tokens": 1024,
    },
    "engines": {
        "shell": True,      # SHELL / INTERPRETER (Open Interpreter if installed)
        "ui": False,        # Windows UI Automation tree + Microsoft UFO delegation
        "browser": False,   # Browser-Use
        "android": False,   # ADB bridge (WSABuilds / emulator / USB phone)
    },
    "engine_options": {
        "open_interpreter_auto_run": False,
        "ufo_command": "",          # e.g. "python -m ufo --task {task_id} -r \"{request}\"" — must match your UFO version
        "ufo_workdir": "",          # folder of your UFO checkout
        "browser_headless": False,
        "adb_path": "adb",
        "adb_serial": "",           # e.g. "127.0.0.1:58526" for WSA
    },
}

# ------------------------------------------------------------------------------
# DPAPI (Windows) helpers via ctypes — no third-party dependencies
# ------------------------------------------------------------------------------
_DPAPI_PREFIX = "dpapi:"


def _dpapi_available() -> bool:
    return sys.platform == "win32"


if _dpapi_available():
    import ctypes
    from ctypes import wintypes

    class _DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    _crypt32 = ctypes.windll.crypt32
    _kernel32 = ctypes.windll.kernel32

    def _to_blob(data: bytes) -> "_DATA_BLOB":
        buf = ctypes.create_string_buffer(data, len(data))
        return _DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))

    def _from_blob(blob: "_DATA_BLOB") -> bytes:
        out = ctypes.string_at(blob.pbData, blob.cbData)
        _kernel32.LocalFree(blob.pbData)
        return out

    def _protect(plain: bytes) -> bytes:
        src, dst = _to_blob(plain), _DATA_BLOB()
        if not _crypt32.CryptProtectData(ctypes.byref(src), "Nexus", None, None, None, 0x01, ctypes.byref(dst)):
            raise ctypes.WinError()
        return _from_blob(dst)

    def _unprotect(cipher: bytes) -> bytes:
        src, dst = _to_blob(cipher), _DATA_BLOB()
        if not _crypt32.CryptUnprotectData(ctypes.byref(src), None, None, None, None, 0x01, ctypes.byref(dst)):
            raise ctypes.WinError()
        return _from_blob(dst)


def encrypt_secret(value: str) -> str:
    if not value or value.startswith(_DPAPI_PREFIX) or not _dpapi_available():
        return value
    return _DPAPI_PREFIX + base64.b64encode(_protect(value.encode("utf-8"))).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value or not value.startswith(_DPAPI_PREFIX):
        return value or ""
    if not _dpapi_available():
        raise RuntimeError("This secret was encrypted with Windows DPAPI and can only be read on the same Windows account.")
    return _unprotect(base64.b64decode(value[len(_DPAPI_PREFIX):])).decode("utf-8")


# ------------------------------------------------------------------------------
# Load / save
# ------------------------------------------------------------------------------
def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _walk_secrets(cfg: Dict[str, Any], fn) -> None:
    for section in cfg.values():
        if isinstance(section, dict):
            for field in SECRET_FIELDS:
                if isinstance(section.get(field), str):
                    section[field] = fn(section[field])


def load_user_config() -> Dict[str, Any]:
    """Returns settings with secrets DECRYPTED (in memory only)."""
    raw: Dict[str, Any] = {}
    if os.path.exists(USER_CONFIG_PATH):
        with open(USER_CONFIG_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
    cfg = _deep_merge(DEFAULTS, raw)
    _walk_secrets(cfg, decrypt_secret)
    return cfg


def save_user_config(cfg: Dict[str, Any]) -> None:
    """Writes settings with secrets ENCRYPTED (DPAPI on Windows)."""
    data = _deep_merge(DEFAULTS, cfg)
    if not _dpapi_available():
        print("[Nexus] Warning: no OS keystore available; secrets in config.user.json are stored in plaintext.")
    _walk_secrets(data, encrypt_secret)
    tmp = USER_CONFIG_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, USER_CONFIG_PATH)


def enabled_engines(cfg: Dict[str, Any]) -> list:
    return [name for name, on in (cfg.get("engines") or {}).items() if on]
