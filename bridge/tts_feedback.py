"""
Nexus Bridge - Local Edge-TTS & Voice Feedback Engine
=============================================================================
Zero-Cost Spoken Voice Status Synthesizer.
Uses Microsoft Edge-TTS neural models without consuming paid cloud API tokens.
Gracefully falls back to Windows SAPI (System.Speech.Synthesis) or system players.
=============================================================================
"""

import os
import sys
import time
import asyncio
import platform
import subprocess
from typing import Optional

IS_WINDOWS = platform.system() == "Windows"


class VoiceFeedbackEngine:
    def __init__(self, voice_name: str = "en-US-AriaNeural"):
        self.voice_name = voice_name
        self.temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_cache")
        os.makedirs(self.temp_dir, exist_ok=True)

    def speak(self, text: str, block: bool = False) -> bool:
        """Speaks text using edge-tts with Windows SAPI fallback."""
        clean_text = text.strip()
        if not clean_text:
            return True

        # 1. Try edge-tts
        try:
            import edge_tts
            out_file = os.path.join(self.temp_dir, f"speech_{int(time.time())}.mp3")

            async def _synthesize():
                comm = edge_tts.Communicate(clean_text, self.voice_name)
                await comm.save(out_file)

            asyncio.run(_synthesize())

            if os.path.exists(out_file) and os.path.getsize(out_file) > 0:
                if IS_WINDOWS:
                    play_cmd = f'powershell -c "(New-Object Media.SoundPlayer \'{out_file}\').PlaySync()"'
                    res = subprocess.run(play_cmd, shell=True, capture_output=True)
                    if res.returncode != 0:
                        subprocess.Popen(f'start "" /min wmplayer "{out_file}"', shell=True)
                else:
                    subprocess.Popen(["ffplay", "-nodisp", "-autoexit", out_file], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True
        except Exception:
            pass

        # 2. Windows System SAPI fallback
        if IS_WINDOWS:
            try:
                escaped = clean_text.replace('"', '""').replace("'", "''")
                ps_sapi = f"""
                Add-Type -AssemblyName System.Speech
                $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
                $synth.Rate = 1
                $synth.Speak('{escaped}')
                """
                if block:
                    subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_sapi], capture_output=True)
                else:
                    subprocess.Popen(["powershell.exe", "-NoProfile", "-Command", ps_sapi], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True
            except Exception:
                pass

        # 3. Print fallback if audio device disabled
        print(f"[VOICE STATUS]: {clean_text}", flush=True)
        return True


_global_voice = VoiceFeedbackEngine()

def speak_feedback(text: str, block: bool = False) -> bool:
    return _global_voice.speak(text, block=block)
