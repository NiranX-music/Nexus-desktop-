"""
Nexus Local Settings Manager CLI
Role: Interactive command-line utility to inspect, configure, and secure
Developer Mode settings, API keys (via Windows DPAPI), AI models, and
local execution engines (Open Interpreter, UFO, Browser-Use, ADB).
"""

import sys
import os
import io
import getpass
from typing import Dict, Any

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "buffer"):
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "buffer"):
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

from user_config import load_user_config, save_user_config, enabled_engines
from ai_client import build_client, DEFAULT_MODELS, AIError


def _mask(s: str) -> str:
    if not s:
        return "(none)"
    if len(s) <= 8:
        return "****"
    return s[:4] + "****" + s[-4:]


def print_banner(cfg: Dict[str, Any]):
    dev = cfg.get("developer_mode", False)
    ai = cfg.get("ai", {})
    engines = cfg.get("engines", {})
    bridge = cfg.get("bridge", {})

    print("\n" + "=" * 62)
    print(" 🛠️  NEXUS LOCAL SETTINGS & DEVELOPER MODE MANAGER")
    print("=" * 62)
    print(f" Developer Mode:       {'🟢 ON (Bring-Your-Own-Key / Local)' if dev else '⚪ OFF (Standard Zero-Card Cloudflare AI)'}")
    print(f" AI Provider:          {ai.get('provider', 'gemini').upper()}")
    print(f" Chat Model:           {ai.get('model') or '(default for provider)'}")
    print(f" STT Whisper Model:    {ai.get('stt_model') or '(default for provider)'}")
    print(f" Base URL:             {ai.get('base_url') or '(default for provider)'}")
    print(f" API Key:              {_mask(ai.get('api_key', ''))}  [Hardware encrypted with Windows DPAPI]")
    print(f" Bridge Auth Token:    {_mask(bridge.get('auth_token', ''))}")
    print("-" * 62)
    print(" Execution Engines:")
    print(f"   • Shell / Interpreter:  {'✅ Enabled' if engines.get('shell') else '❌ Disabled'}")
    print(f"   • Win32 UI / UFO:       {'✅ Enabled' if engines.get('ui') else '❌ Disabled'}")
    print(f"   • Browser-Use:          {'✅ Enabled' if engines.get('browser') else '❌ Disabled'}")
    print(f"   • Android ADB / WSA:    {'✅ Enabled' if engines.get('android') else '❌ Disabled'}")
    print("=" * 62 + "\n")


def toggle_dev_mode(cfg: Dict[str, Any]):
    current = cfg.get("developer_mode", False)
    cfg["developer_mode"] = not current
    save_user_config(cfg)
    state_str = "ENABLED" if cfg["developer_mode"] else "DISABLED"
    print(f"\n✨ Developer Mode is now {state_str}!\n")


def configure_provider(cfg: Dict[str, Any]):
    ai = cfg.setdefault("ai", {})
    print("\nChoose AI Provider:")
    print("  1. Google Gemini (Interactions API: gemini-3.8-flash, gemini-3.5-transcribe)")
    print("  2. Groq Cloud (Ultra-Fast: llama-3.3-70b-versatile, whisper-large-v3-turbo)")
    print("  3. OpenAI / OpenRouter (gpt-4o-mini, whisper-1)")
    print("  4. Local Endpoint (Ollama, Edge0 MoE, LM Studio, vLLM)")
    choice = input("Select [1-4] (Enter to keep current): ").strip()

    p_map = {"1": "gemini", "2": "groq", "3": "openai", "4": "custom"}
    provider = p_map.get(choice, ai.get("provider", "gemini"))
    ai["provider"] = provider

    defaults = DEFAULT_MODELS.get(provider, DEFAULT_MODELS["custom"])

    # API Key
    key_prompt = f"Enter API key for {provider} (Press Enter to keep existing): "
    new_key = getpass.getpass(key_prompt).strip()
    if new_key:
        ai["api_key"] = new_key

    # Base URL (for custom or proxy)
    if provider == "custom":
        current_base = ai.get("base_url") or defaults.get("base_url", "http://localhost:11434/v1")
        new_base = input(f"Base URL [{current_base}]: ").strip()
        ai["base_url"] = new_base or current_base
    else:
        ai["base_url"] = defaults.get("base_url", "")

    # Models
    current_model = ai.get("model") or defaults.get("model", "")
    new_model = input(f"Chat/Planning Model [{current_model}]: ").strip()
    ai["model"] = new_model or current_model

    current_stt = ai.get("stt_model") or defaults.get("stt_model", "")
    new_stt = input(f"STT Whisper Model [{current_stt}]: ").strip()
    ai["stt_model"] = new_stt or current_stt

    save_user_config(cfg)
    print(f"\n✨ Provider configuration for '{provider}' saved securely!\n")


def toggle_engines(cfg: Dict[str, Any]):
    engines = cfg.setdefault("engines", {})
    print("\nToggle Local Execution Engines:")
    print(f"  1. Shell / Open Interpreter   [Currently: {'ON' if engines.get('shell') else 'OFF'}]")
    print(f"  2. Win32 UI / Microsoft UFO   [Currently: {'ON' if engines.get('ui') else 'OFF'}]")
    print(f"  3. Browser-Use (Web Autom.)   [Currently: {'ON' if engines.get('browser') else 'OFF'}]")
    print(f"  4. Android ADB (WSABuilds)    [Currently: {'ON' if engines.get('android') else 'OFF'}]")
    choice = input("Enter number to toggle [1-4] or 'done': ").strip()

    key_map = {"1": "shell", "2": "ui", "3": "browser", "4": "android"}
    if choice in key_map:
        k = key_map[choice]
        engines[k] = not engines.get(k, False)
        save_user_config(cfg)
        print(f"\n✨ Engine '{k}' toggled to {'ON' if engines[k] else 'OFF'}!\n")


def set_bridge_secret(cfg: Dict[str, Any]):
    bridge = cfg.setdefault("bridge", {})
    current = bridge.get("auth_token", "")
    print(f"\nCurrent Bridge Secret: {_mask(current)}")
    new_tok = getpass.getpass("Enter new Bridge Secret (press Enter to clear or leave): ").strip()
    bridge["auth_token"] = new_tok
    save_user_config(cfg)
    print("\n✨ Bridge Secret updated!\n")


def test_ai_connection(cfg: Dict[str, Any]):
    print("\nTesting AI connection with current configuration...")
    try:
        from nexus_daemon import load_config
        d_cfg = load_config()
        client = build_client(cfg, d_cfg["d1_api_url"], d_cfg.get("auth_token", ""))
        print(f"Testing client: {client.name}")
        res = client.chat_completion([
            {"role": "system", "content": "You are a test ping agent."},
            {"role": "user", "content": "Reply with 'PONG' and nothing else."}
        ])
        print(f"\n✅ Connection SUCCESS! Response from {res.get('provider')}: '{res.get('text', '').strip()}'\n")
    except Exception as e:
        print(f"\n❌ Test failed: {e}\n")


def main():
    while True:
        cfg = load_user_config()
        print_banner(cfg)
        print("Menu Options:")
        print("  1. Toggle Developer Mode (ON / OFF)")
        print("  2. Configure AI Provider & API Key (Gemini, Groq, OpenAI, Ollama/Edge0)")
        print("  3. Toggle Local Execution Engines (Shell, UI, Browser, ADB)")
        print("  4. Set Bridge Authentication Token")
        print("  5. Test AI Ping Connection")
        print("  6. Exit")

        choice = input("\nSelect an option [1-6]: ").strip()
        if choice == "1":
            toggle_dev_mode(cfg)
        elif choice == "2":
            configure_provider(cfg)
        elif choice == "3":
            toggle_engines(cfg)
        elif choice == "4":
            set_bridge_secret(cfg)
        elif choice == "5":
            test_ai_connection(cfg)
        elif choice == "6" or choice.lower() in ("q", "quit", "exit"):
            print("Exiting Nexus Settings.")
            break
        else:
            print("Invalid choice, please select 1-6.")


if __name__ == "__main__":
    main()
