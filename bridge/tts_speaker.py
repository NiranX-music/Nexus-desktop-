"""
Nexus Bridge - Local TTS Speaker Runner (Zero-Cost Audio Feedback)
=============================================================================
Provides asynchronous and synchronous speech synthesis without cloud GPU fees:
- Primary: Microsoft Edge-TTS neural models (edge_tts)
- Secondary: Windows SAPI (System.Speech.Synthesis)
- Headless / Linux: ffplay / aplay / espeak fallback
=============================================================================
"""

import sys
import os

# Add project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bridge.tts_feedback import VoiceFeedbackEngine, speak_feedback


class TTSSpeaker:
    """Wrapper class providing speech feedback methods for orchestrator & tools."""
    def __init__(self, default_voice: str = "en-US-AriaNeural"):
        self.engine = VoiceFeedbackEngine(voice_name=default_voice)

    def speak(self, text: str, block: bool = False) -> bool:
        return self.engine.speak(text, block=block)

    def announce_task_start(self, goal: str) -> None:
        short_goal = goal[:40] if len(goal) > 40 else goal
        self.speak(f"Starting task: {short_goal}", block=False)

    def announce_task_complete(self, success: bool = True) -> None:
        status = "Task completed successfully." if success else "Task finished with warnings."
        self.speak(status, block=False)


_speaker_instance = TTSSpeaker()


def speak(text: str, block: bool = False) -> bool:
    return _speaker_instance.speak(text, block=block)


if __name__ == "__main__":
    msg = sys.argv[1] if len(sys.argv) > 1 else "Nexus AI Agent voice engine online."
    speak(msg, block=True)
