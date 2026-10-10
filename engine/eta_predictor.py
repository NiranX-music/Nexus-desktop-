"""
Nexus Autonomous Engine - Dynamic Step-Weighted ETA Predictor
=============================================================================
Forecasts remaining task execution time using step-weighted Exponential
Moving Average (EMA). Continuously updates duration profiles as real-time
tool completions are observed.

Baseline Step Weights:
- SHELL / TERMINAL:  3.8s
- FS_PATCH:          1.2s
- BROWSER:           5.5s
- THOUGHT / PLAN:    1.8s
- DESKTOP_UFO:       2.5s
- VOICE / TTS:       1.0s
=============================================================================
"""

import time
from typing import Dict, Any, List, Union


class ETAPredictor:
    """
    Dynamically predicts remaining execution time for an autonomous plan
    using Exponential Moving Average (EMA) with baseline weights per step type.
    """

    DEFAULT_BASELINES: Dict[str, float] = {
        "terminal": 3.8,
        "shell": 3.8,
        "filesystem": 1.2,
        "fs_patch": 1.2,
        "browser": 5.5,
        "thought": 1.8,
        "planning": 1.8,
        "desktop_ufo": 2.5,
        "voice": 1.0,
        "approval": 5.0,
        "default": 2.5
    }

    def __init__(self, alpha: float = 0.35):
        """
        :param alpha: Smoothing factor for Exponential Moving Average (0 < alpha <= 1).
                      Higher alpha gives more weight to recent observations.
        """
        self.alpha = max(0.01, min(1.0, alpha))
        self.weights: Dict[str, float] = dict(self.DEFAULT_BASELINES)
        self.history: List[Dict[str, Any]] = []

    def _normalize_type(self, step_type: str) -> str:
        s = step_type.lower().strip()
        if s in ("terminal", "shell", "cmd", "bash", "pty"):
            return "terminal"
        if s in ("filesystem", "fs_patch", "patch", "write", "diff"):
            return "filesystem"
        if s in ("browser", "playwright", "web"):
            return "browser"
        if s in ("thought", "planning", "reasoning"):
            return "thought"
        if s in ("desktop_ufo", "ufo", "win32", "gui"):
            return "desktop_ufo"
        if s in ("voice", "tts", "speech"):
            return "voice"
        if s in ("approval", "human_gate"):
            return "approval"
        return "default"

    def record_actual_duration(self, step_type: str, observed_duration_sec: float) -> float:
        """
        Updates the running Exponential Moving Average for a step type
        based on the freshly observed real-world duration.
        Formula: weight_new = alpha * observed + (1 - alpha) * weight_current
        """
        norm = self._normalize_type(step_type)
        current = self.weights.get(norm, self.DEFAULT_BASELINES.get(norm, 2.5))
        new_weight = (self.alpha * observed_duration_sec) + ((1.0 - self.alpha) * current)
        self.weights[norm] = round(max(0.1, new_weight), 2)

        self.history.append({
            "step_type": norm,
            "observed": round(observed_duration_sec, 2),
            "updated_weight": self.weights[norm],
            "timestamp": time.time()
        })
        return self.weights[norm]

    def predict_remaining(self, remaining_steps: List[Union[str, Dict[str, Any]]]) -> Dict[str, Any]:
        """
        Calculates forecasted completion seconds for remaining planned steps.
        Accepts list of step type strings or PlannedStep dictionaries.
        """
        total_seconds = 0.0
        breakdown: List[Dict[str, Any]] = []

        for step in remaining_steps:
            if isinstance(step, dict):
                stype = step.get("tool") or step.get("type") or "default"
                title = step.get("title", stype)
            else:
                stype = str(step)
                title = stype

            norm = self._normalize_type(stype)
            est = self.weights.get(norm, self.DEFAULT_BASELINES.get(norm, 2.5))
            total_seconds += est
            breakdown.append({
                "step": title,
                "type": norm,
                "estimated_sec": round(est, 2)
            })

        total_seconds = round(total_seconds, 1)
        return {
            "eta_seconds_remaining": total_seconds,
            "formatted_eta": self.format_duration(total_seconds),
            "remaining_step_count": len(remaining_steps),
            "breakdown": breakdown
        }

    @staticmethod
    def format_duration(seconds: float) -> str:
        """Formats floating seconds into 'Xm Ys' or 'Xs' representation."""
        sec_int = int(round(seconds))
        if sec_int < 60:
            return f"{sec_int}s"
        mins = sec_int // 60
        rem_sec = sec_int % 60
        return f"{mins}m {rem_sec:02d}s"

    def get_current_weights(self) -> Dict[str, float]:
        """Returns the current dynamically tuned weight profile."""
        return dict(self.weights)
