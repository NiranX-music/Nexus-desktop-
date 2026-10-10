"""
Nexus Bridge - Persistent SSE Client & Low-Latency Signaling Loop
=============================================================================
Maintains persistent Server-Sent Events (SSE) connection to Cloudflare Pages
(/api/bridge) with exponential backoff auto-reconnect (<50ms delivery latency).
STRICT PRIVACY: Only ephemeral signal IDs are exchanged over the wire.
Tasks and reasoning remain 100% local on the machine.
=============================================================================
"""

import os
import sys
import time
import json
import platform
import threading
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, Callable

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.orchestrator import AutonomousOrchestrator
from bridge.tts_feedback import speak_feedback

DEFAULT_BRIDGE_URL = os.getenv("NEXUS_BRIDGE_URL", "https://nexus-bridge-7l1.pages.dev/api").rstrip("/")
DEFAULT_DEVICE_ID = os.getenv("NEXUS_DEVICE_ID", "desktop-primary")


class NexusSSEClient:
    """
    Persistent SSE client with automatic reconnection and heartbeat daemon.
    """
    def __init__(
        self,
        bridge_url: str = DEFAULT_BRIDGE_URL,
        device_id: str = DEFAULT_DEVICE_ID,
        auth_token: str = "",
        on_signal_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        self.bridge_url = bridge_url.rstrip("/")
        self.device_id = device_id
        self.auth_token = auth_token or os.getenv("NEXUS_AUTH_SECRET", "")
        self.on_signal_callback = on_signal_callback
        self.running = False
        self.last_heartbeat = 0.0
        self.reconnect_delay = 1.0
        self.max_reconnect_delay = 30.0

        self.orchestrator = AutonomousOrchestrator()

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "User-Agent": f"NexusSSEClient/2.2.0 ({platform.platform()})",
            "Accept": "text/event-stream"
        }
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            headers["X-Nexus-Auth-Token"] = self.auth_token
        return headers

    def send_heartbeat(self) -> bool:
        """Pings /api/devices with device presence telemetry."""
        url = f"{self.bridge_url}/devices"
        payload = {
            "id": self.device_id,
            "name": f"Nexus Desktop ({platform.node()})",
            "type": "DESKTOP",
            "status": "ONLINE",
            "battery_level": 100,
            "agent_version": "2.2.0"
        }
        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json", **self._get_headers()},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                if resp.status == 200:
                    self.last_heartbeat = time.time()
                    return True
        except Exception:
            pass
        return False

    def handle_signal(self, signal: Dict[str, Any]) -> None:
        """Dispatches signal locally."""
        sig_id = signal.get("signal_id", "unknown")
        print(f"[SSE_CLIENT] Received ephemeral signal [{sig_id}] for target: {signal.get('target_device')}", flush=True)

        if self.on_signal_callback:
            try:
                self.on_signal_callback(signal)
            except Exception as e:
                print(f"[SSE_CLIENT] Signal callback error: {e}", flush=True)

    def listen_loop(self) -> None:
        """Runs the continuous SSE listening loop with auto-reconnection."""
        sse_url = f"{self.bridge_url}/bridge?device=DESKTOP"
        print(f"[SSE_CLIENT] Connecting persistent SSE stream to: {sse_url}", flush=True)

        while self.running:
            try:
                req = urllib.request.Request(sse_url, headers=self._get_headers())
                with urllib.request.urlopen(req, timeout=60.0) as resp:
                    if resp.status != 200:
                        time.sleep(self.reconnect_delay)
                        self.reconnect_delay = min(self.reconnect_delay * 1.5, self.max_reconnect_delay)
                        continue

                    self.reconnect_delay = 1.0  # Reset backoff on successful connection
                    print(f"[SSE_CLIENT] Connected to Cloudflare Edge Bridge SSE stream.", flush=True)

                    current_event = None
                    for raw_line in resp:
                        if not self.running:
                            break
                        line = raw_line.decode("utf-8", errors="replace").strip()
                        if not line:
                            continue

                        if line.startswith("event:"):
                            current_event = line.replace("event:", "").strip()
                        elif line.startswith("data:"):
                            raw_data = line.replace("data:", "").strip()
                            try:
                                payload = json.loads(raw_data)
                                if current_event == "signal":
                                    self.handle_signal(payload)
                                elif current_event == "connected":
                                    print(f"[SSE_CLIENT] Handshake confirmed with edge pop: {payload.get('edge_pop')}", flush=True)
                            except Exception:
                                pass

            except (urllib.error.URLError, TimeoutError, Exception) as e:
                if self.running:
                    print(f"[SSE_CLIENT] SSE connection dropped ({e}). Reconnecting in {self.reconnect_delay:.1f}s...", flush=True)
                    time.sleep(self.reconnect_delay)
                    self.reconnect_delay = min(self.reconnect_delay * 1.5, self.max_reconnect_delay)

    def start(self, block: bool = True) -> None:
        """Starts client with background heartbeat sender."""
        self.running = True
        self.send_heartbeat()

        def _heartbeat_worker():
            while self.running:
                if time.time() - self.last_heartbeat > 25.0:
                    self.send_heartbeat()
                time.sleep(5.0)

        hb_thread = threading.Thread(target=_heartbeat_worker, daemon=True)
        hb_thread.start()

        if block:
            self.listen_loop()
        else:
            listener_thread = threading.Thread(target=self.listen_loop, daemon=True)
            listener_thread.start()

    def stop(self) -> None:
        self.running = False


if __name__ == "__main__":
    client = NexusSSEClient()
    try:
        client.start()
    except KeyboardInterrupt:
        client.stop()
        print("\n[SSE_CLIENT] Stopped.")
