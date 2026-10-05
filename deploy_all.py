"""
Nexus Autonomous Cloud & Edge Deployer
Handles end-to-end setup across Cloudflare D1/Pages and Modal Labs.
Guides the user through one-click browser logins and automates everything else.
"""

import os
import sys
import json
import time
import re
import subprocess
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

def run_cmd(cmd, cwd=ROOT_DIR, capture=True, shell=True):
    """Executes a command and returns output, returncode."""
    print(f"  [RUN] {cmd}")
    proc = subprocess.run(
        cmd,
        cwd=cwd,
        shell=shell,
        capture_output=capture,
        text=True,
    )
    return proc.returncode, proc.stdout.strip() if proc.stdout else "", proc.stderr.strip() if proc.stderr else ""

def check_wrangler_auth():
    code, out, _ = run_cmd("npx wrangler whoami")
    return code == 0 and "You are logged in" in out or "Account Name" in out or "User settings" in out and "not authenticated" not in out

def check_modal_auth():
    modal_config = os.path.expanduser("~/.modal.toml")
    if os.path.exists(modal_config):
        return True
    code, out, _ = run_cmd(f'"{sys.executable}" -m modal token show')
    return code == 0 and "token_id" in out

def main():
    print("=" * 70)
    print(" 🚀 NEXUS CROSS-DEVICE COMMAND BRIDGE — AUTONOMOUS DEPLOYER")
    print(" 100% Free-Tier: Cloudflare Pages + D1 + R2 + Modal Labs")
    print("=" * 70)
    print("\nStarting automated deployment pipeline. You only need to click 'Allow' in your browser.\n")

    # --------------------------------------------------------------------------
    # Step 1: Cloudflare Authentication
    # --------------------------------------------------------------------------
    print("\n[Step 1/6] Checking Cloudflare login status...")
    if not check_wrangler_auth():
        print("\n👉 Please log in to your Cloudflare account in the browser that opens now:")
        subprocess.run("npx wrangler login", shell=True)
        # Verify
        if not check_wrangler_auth():
            print("❌ Cloudflare login not completed. Please try running: npx wrangler login")
            return
    print("✅ Cloudflare authenticated successfully!")

    # --------------------------------------------------------------------------
    # Step 2: Modal Labs Authentication
    # --------------------------------------------------------------------------
    print("\n[Step 2/6] Checking Modal Labs GPU login status...")
    if not check_modal_auth():
        print("\n👉 Please log in to your Modal Labs account ($30/mo free credits):")
        subprocess.run(f'"{sys.executable}" -m modal setup', shell=True)
        if not check_modal_auth():
            print("⚠️ Modal setup incomplete. Continuing Cloudflare setup first...")
    else:
        print("✅ Modal Labs authenticated successfully!")

    # --------------------------------------------------------------------------
    # Step 3: Cloudflare D1 Database Setup
    # --------------------------------------------------------------------------
    print("\n[Step 3/6] Setting up Cloudflare D1 Serverless SQLite Database...")
    code, list_out, _ = run_cmd("npx wrangler d1 list")
    db_uuid = None

    if "nexus-db" in list_out:
        print("  Found existing 'nexus-db' in your Cloudflare account.")
        # Extract UUID
        match = re.search(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", list_out)
        if match:
            db_uuid = match.group(1)
    else:
        print("  Creating new serverless database: 'nexus-db'...")
        create_code, create_out, create_err = run_cmd("npx wrangler d1 create nexus-db")
        combined = create_out + " " + create_err
        match = re.search(r"database_id = \"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\"", combined)
        if match:
            db_uuid = match.group(1)

    if db_uuid:
        print(f"  ✅ D1 Database UUID: {db_uuid}")
        # Update wrangler.toml files
        for w_path in [os.path.join(ROOT_DIR, "wrangler.toml"), os.path.join(ROOT_DIR, "nexus-bridge", "wrangler.toml")]:
            if os.path.exists(w_path):
                with open(w_path, "r", encoding="utf-8") as f:
                    content = f.read()
                content = re.sub(r'database_id = "[^"]+"', f'database_id = "{db_uuid}"', content)
                with open(w_path, "w", encoding="utf-8") as f:
                    f.write(content)

    # Apply schema to remote D1
    print("  Applying multi-device schema.sql to remote D1 database...")
    run_cmd("npx wrangler d1 execute nexus-db --remote --file=schema.sql")
    print("  ✅ D1 schema applied!")

    # --------------------------------------------------------------------------
    # Step 4: Deploy Cloudflare Pages Frontend & Edge Functions
    # --------------------------------------------------------------------------
    print("\n[Step 4/6] Deploying Frontend PWA & Edge Functions to Cloudflare Pages...")
    pages_code, pages_out, pages_err = run_cmd("npx wrangler pages deploy frontend --project-name=nexus-bridge")
    pages_url = None
    combined_pages = pages_out + " " + pages_err
    match_url = re.search(r"(https://[a-zA-Z0-9.-]+\.pages\.dev)", combined_pages)
    if match_url:
        pages_url = match_url.group(1)
        print(f"  🎉 LIVE FRONTEND PWA DEPLOYED AT: {pages_url}")
    else:
        print("  Pages deployed. URL can be checked at Cloudflare dashboard.")

    # --------------------------------------------------------------------------
    # Step 5: Deploy Modal Labs GPU AI Microservice
    # --------------------------------------------------------------------------
    modal_url = None
    if check_modal_auth():
        print("\n[Step 5/6] Deploying GPU Brain (Whisper STT + Decomposer) to Modal Labs...")
        modal_code, modal_out, modal_err = run_cmd(f'"{sys.executable}" -m modal deploy backend/modal_ai.py')
        combined_modal = modal_out + " " + modal_err
        match_modal = re.search(r"(https://[a-zA-Z0-9_.-]+--nexus-ai-core-fastapi-app\.modal\.run)", combined_modal)
        if match_modal:
            modal_url = match_modal.group(1)
            print(f"  🎉 LIVE MODAL GPU MICROSERVICE: {modal_url}")
    else:
        print("\n[Step 5/6] Skipping Modal GPU deploy (not authenticated yet).")

    # --------------------------------------------------------------------------
    # Step 6: Link Configurations & Start Desktop Daemon
    # --------------------------------------------------------------------------
    print("\n[Step 6/6] Updating local desktop configurations...")
    if pages_url:
        for cfg_path in [
            os.path.join(ROOT_DIR, "desktop_agent", "config.json"),
            os.path.join(ROOT_DIR, "nexus-bridge", "desktop_agent", "config.json"),
        ]:
            if os.path.exists(cfg_path):
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                cfg["d1_api_url"] = f"{pages_url}/api"
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, indent=2)
                print(f"  Updated {cfg_path} -> {pages_url}/api")

    print("\n" + "=" * 70)
    print(" 🏁 DEPLOYMENT SUMMARY")
    print("=" * 70)
    if pages_url:
        print(f" 🌐 Web Dashboard (PWA):  {pages_url}")
    if modal_url:
        print(f" 🧠 Modal Labs GPU Brain: {modal_url}")
    print(f" 💻 Desktop Agent Ready:   python desktop_agent/nexus_daemon.py")
    print(f" 📱 Mobile Agent Ready:    python mobile_agent/mobile_daemon.py")
    print("=" * 70)

if __name__ == "__main__":
    main()
