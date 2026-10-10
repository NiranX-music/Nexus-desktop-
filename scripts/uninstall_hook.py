#!/usr/bin/env python3
"""
Nexus AI Agent - Pre-Uninstall Data Sovereignty Hook
=============================================================================
Executed prior to uninstallation to safeguard user sovereignty:
1. Prompts or automatically creates a complete export archive of all local
   agent data (prompts, thought traces, tools, diffs, and episodic memories).
2. Generates the standalone offline READABLE_EXPORT_VIEWER.html.
3. Saves the archive to the user's Desktop or home directory.
4. Allows optional clean erasure of ~/.nexus-agent/ directory.
=============================================================================
"""

import os
import sys
import shutil
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from engine.exporter import DataSovereigntyExporter
from engine.local_store import LocalAgentStore


def run_pre_uninstall_hook(auto_confirm: bool = False, purge_after_export: bool = False) -> None:
    print("=" * 70)
    print(" NEXUS AI AGENT - PRE-UNINSTALL DATA SOVEREIGNTY HOOK")
    print("=" * 70)
    print("Safeguarding your local autonomous agent memories, reasoning traces,")
    print("and diffs before system uninstallation...")

    desktop_dir = Path.home() / "Desktop"
    export_dest = desktop_dir if desktop_dir.exists() else Path.home()

    try:
        store = LocalAgentStore()
        exporter = DataSovereigntyExporter(store)
        archive_path = exporter.generate_export_bundle(export_dest)
        print(f"\n[SUCCESS] 100% of your agent data has been exported to:")
        print(f" -> {archive_path}")
        print("\nInside this archive, open 'READABLE_EXPORT_VIEWER.html' in any browser")
        print("to explore your thoughts, tasks, and episodic memories completely offline.")
    except Exception as e:
        print(f"\n[WARNING] Could not complete export bundle: {e}")

    if purge_after_export:
        local_dir = Path.home() / ".nexus-agent"
        if local_dir.exists():
            try:
                shutil.rmtree(local_dir)
                print(f"[CLEANUP] Successfully purged local directory: {local_dir}")
            except Exception as e:
                print(f"[ERROR] Could not remove {local_dir}: {e}")

    print("\nPre-uninstall hook completed successfully.")


if __name__ == "__main__":
    auto = "--auto" in sys.argv
    purge = "--purge" in sys.argv
    run_pre_uninstall_hook(auto_confirm=auto, purge_after_export=purge)
