"""
Root runner for Nexus Desktop Remote Bridge Daemon.
Invokes nexus_bridge/nexus_bridge.py cleanly without import collisions.
"""
import sys
import os
import importlib.util

current_dir = os.path.dirname(os.path.abspath(__file__))
daemon_path = os.path.join(current_dir, "nexus_bridge", "nexus_bridge.py")

spec = importlib.util.spec_from_file_location("nexus_bridge_module", daemon_path)
nexus_bridge_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nexus_bridge_module)

if __name__ == "__main__":
    nexus_bridge_module.main()
