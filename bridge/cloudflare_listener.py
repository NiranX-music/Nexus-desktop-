"""
Nexus Bridge - Persistent Cloudflare SSE Listener & Telemetry Daemon
=============================================================================
Maintains persistent SSE connection to Cloudflare Pages (/api/bridge),
dispatches real-time commands from remote mobile/web clients to the
Autonomous Engine orchestrator, and streams back granular execution traces
and telemetry.
=============================================================================
"""

import os
import sys
import time
import json
import platform
import threading
import requests
from typing import Optional, Dict, Any

from engine.orchestrator import AutonomousOrchestrator
from bridge.tts_feedback import speak_feedback

DEFAULT_BRIDGE_URL = os.getenv("NEXUS_BRIDGE_URL", "https://nexus-bridge-7l1.pages.dev/api").rstrip("/")
DEVICE_ID = os.getenv("NEXUS_DEVICE_ID", "nexus-desktop-primary")


class CloudflareBridgeListener:
    def __init__(
        self,
        bridge_url: str = DEFAULT_BRIDGE_URL,
        device_id: str = DEVICE_ID,
        auth_token: str = ""
    ):
        self.bridge_url = bridge_url.rstrip("/")
        self.device_id = device_id
        self.auth_token = auth_token
        self.running = False
        self.last_heartbeat = 0
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": f"NexusBridgeListener/2.2.0 ({platform.platform()})",
            "X-Nexus-Auth-Token": self.auth_token,
            "Content-Type": "application/json"
        })
        self.orchestrator = AutonomousOrchestrator(
            event_callback=self._stream_trace_event
        )

    def _stream_trace_event(self, event_dict: Dict[str, Any]):
        """Dispatches an AgentStep event directly down the Cloudflare SSE bridge."""
        event_endpoint = f"{self.bridge_url}/bridge/events"
        try:
            self.session.post(event_endpoint, json=event_dict, timeout=3.0)
        except Exception:
            # Fallback: ignore network jitter on trace push
            pass

    def send_heartbeat(self):
        """Pings /api/heartbeat with hardware and agent telemetry."""
        url = f"{self.bridge_url}/heartbeat"
        payload = {
            "device_id": self.device_id,
            "device_type": "DESKTOP",
            "device_name": "Nexus Primary Workstation",
            "status": "ONLINE",
            "battery_level": 100,
            "agent_version": "2.2.0"
        }
        try:
            res = self.session.post(url, json=payload, timeout=4.0)
            if res.ok:
                self.last_heartbeat = time.time()
        except Exception:
            pass

    def handle_incoming_task(self, task_data: Dict[str, Any]):
        """Dispatches task payload into Autonomous Orchestrator."""
        task_id = task_data.get("id", "task_unknown")
        prompt = task_data.get("prompt_raw") or task_data.get("command", "")
        if not prompt:
            return

        print(f"\n[BRIDGE] Processing incoming task [{task_id}]: {prompt}", flush=True)
        speak_feedback(f"Executing task: {prompt[:40]}")

        # Execute through isolated agent state machine
        result = self.orchestrator.execute_task(prompt, isolate_worktree=True)

        status_str = "COMPLETED" if result.get("success") else "FAILED"
        speak_feedback(f"Task {status_str.lower()}")

        # Report task resolution back to Cloudflare
        try:
            self.session.post(
                f"{self.bridge_url}/tasks",
                json={
                    "task_id": task_id,
                    "status": status_str,
                    "result_summary": result
                },
                timeout=5.0
            )
        except Exception as e:
            print(f"[BRIDGE] Failed to report task resolution: {e}", flush=True)

    def listen_sse_stream(self):
        """Connects to persistent SSE stream at /api/bridge."""
        sse_url = f"{self.bridge_url}/bridge?device=DESKTOP"
        print(f"[BRIDGE] Connecting persistent SSE listener to: {sse_url}", flush=True)

        while self.running:
            try:
                with self.session.get(sse_url, stream=True, timeout=(5.0, 60.0)) as resp:
                    if resp.status_code != 200:
                        time.sleep(3.0)
                        continue

                    current_event = None
                    for line in resp.iter_lines(decode_unicode=True):
                        if not self.running:
                            break
                        if not line:
                            continue

                        if line.startswith("event:"):
                            current_event = line.replace("event:", "").strip()
                        elif line.startswith("data:"):
                            raw_data = line.replace("data:", "").strip()
                            try:
                                payload = json.loads(raw_data)
                                if current_event == "task":
                                    self.handle_incoming_task(payload)
                            except Exception:
                                pass
            except requests.exceptions.RequestException:
                time.sleep(2.0)

    def start(self):
        """Starts background listener and heartbeat loops."""
        self.running = True
        self.send_heartbeat()

        # SSE Listener Thread
        sse_thread = threading.Thread(target=self.listen_sse_stream, daemon=True)
        sse_thread.start()

        # Polling and Heartbeat Monitor loop
        while self.running:
            now = time.time()
            if now - self.last_heartbeat > 25:
                self.send_heartbeat()

            # Secondary safety poll for tasks queued in D1
            try:
                resp = self.session.get(
                    f"{self.bridge_url}/tasks",
                    params={"target": "DESKTOP", "status": "QUEUED", "limit": 2},
                    timeout=4.0
                )
                if resp.ok:
                    tasks = resp.json().get("tasks", [])
                    for t in tasks:
                        self.handle_incoming_task(t)
            except Exception:
                pass

            time.sleep(2.0)

    def stop(self):
        self.running = False


def main():
    listener = CloudflareBridgeListener()
    try:
        listener.start()
    except KeyboardInterrupt:
        listener.stop()
        print("\n[BRIDGE] Stopped listener.")


if __name__ == "__main__":
    main()
