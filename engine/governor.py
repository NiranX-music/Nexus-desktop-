"""
Nexus Autonomous Engine - Usage Restrictions & Governor
=============================================================================
Enforces strict operational boundaries for autonomous task execution:
1. Token Bucket Rate Limiter: Smoothes API token consumption across time windows.
2. Step Circuit Breaker: Hard threshold (default MAX_STEPS = 12) preventing runaway loops.
3. Quota Monitor: Real-time quota tracking with sub-20% threshold warning broadcast.
=============================================================================
"""

import time
import threading
from typing import Dict, Any, Optional, Callable, List


class CircuitBreakerTripped(Exception):
    """Raised when an autonomous execution run exceeds the step count limit."""
    pass


class TokenQuotaExceeded(Exception):
    """Raised when token consumption exceeds the allowed burst capacity or interval limit."""
    pass


class TokenBucketRateLimiter:
    """
    Token bucket algorithm for rate limiting API token consumption.
    Allows bursts up to capacity while refilling at refill_rate_per_sec.
    """
    def __init__(self, capacity: int = 100_000, refill_rate_per_sec: float = 27.78):
        # 27.78 tokens/sec ~ 100,000 tokens per hour
        self.capacity = capacity
        self.refill_rate = refill_rate_per_sec
        self.tokens = float(capacity)
        self.last_refill = time.time()
        self.lock = threading.Lock()

    def _refill(self) -> None:
        now = time.time()
        elapsed = now - self.last_refill
        self.last_refill = now
        self.tokens = min(float(self.capacity), self.tokens + (elapsed * self.refill_rate))

    def consume(self, amount: int) -> bool:
        """
        Attempts to consume `amount` tokens. Returns True if granted, False if insufficient.
        """
        with self.lock:
            self._refill()
            if self.tokens >= amount:
                self.tokens -= amount
                return True
            return False

    def get_available_tokens(self) -> int:
        with self.lock:
            self._refill()
            return int(self.tokens)


class UsageGovernor:
    """
    Central operational safety governor:
    - Tracks step counts per task (hard cap: MAX_STEPS = 12).
    - Monitored free-tier quota pool (e.g., 100,000 free tokens).
    - Emits warning events when remaining tokens drop below 20%.
    """
    MAX_STEPS_DEFAULT = 12

    def __init__(
        self,
        max_steps: int = MAX_STEPS_DEFAULT,
        total_quota_tokens: int = 100_000,
        warning_threshold_pct: float = 20.0,
        on_quota_warning: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        self.max_steps = max_steps
        self.total_quota_tokens = total_quota_tokens
        self.warning_threshold_pct = warning_threshold_pct
        self.on_quota_warning = on_quota_warning

        self.current_step_count = 0
        self.total_tokens_consumed = 0
        self.bucket = TokenBucketRateLimiter(capacity=total_quota_tokens, refill_rate_per_sec=27.78)
        self.warning_emitted = False
        self.lock = threading.Lock()

    def reset_task(self) -> None:
        """Resets the task-specific step counter for a new autonomous run."""
        with self.lock:
            self.current_step_count = 0

    def record_step(self, step_name: str = "") -> int:
        """
        Increments step counter.
        Raises CircuitBreakerTripped if MAX_STEPS limit is breached.
        """
        with self.lock:
            self.current_step_count += 1
            if self.current_step_count > self.max_steps:
                raise CircuitBreakerTripped(
                    f"Execution halted: Maximum step limit ({self.max_steps}) exceeded at step: '{step_name}'. "
                    f"Circuit breaker tripped to prevent runaway execution."
                )
            return self.current_step_count

    def record_token_usage(self, prompt_tokens: int, completion_tokens: int) -> Dict[str, Any]:
        """
        Records consumed tokens and evaluates quota thresholds.
        If remaining quota drops below warning_threshold_pct (20%), triggers warning callback.
        """
        with self.lock:
            consumed = prompt_tokens + completion_tokens
            self.total_tokens_consumed += consumed
            self.bucket.consume(consumed)

            remaining_tokens = max(0, self.total_quota_tokens - self.total_tokens_consumed)
            remaining_pct = (remaining_tokens / self.total_quota_tokens) * 100.0 if self.total_quota_tokens > 0 else 0.0

            status = {
                "consumed_total": self.total_tokens_consumed,
                "remaining_tokens": remaining_tokens,
                "total_quota": self.total_quota_tokens,
                "remaining_pct": round(remaining_pct, 2),
                "is_low_quota": remaining_pct <= self.warning_threshold_pct,
                "steps_taken": self.current_step_count,
                "max_steps": self.max_steps
            }

            if status["is_low_quota"] and not self.warning_emitted:
                self.warning_emitted = True
                warning_payload = {
                    "event": "LOW_QUOTA_WARNING",
                    "remaining_pct": status["remaining_pct"],
                    "remaining_tokens": remaining_tokens,
                    "total_quota": self.total_quota_tokens,
                    "message": (
                        f"Free-tier quota has dropped to {status['remaining_pct']}% "
                        f"({remaining_tokens} tokens remaining). Automatic fallback or user key injection recommended."
                    )
                }
                if self.on_quota_warning:
                    try:
                        self.on_quota_warning(warning_payload)
                    except Exception:
                        pass

            return status

    def get_status(self) -> Dict[str, Any]:
        """Returns the current usage state and remaining quota."""
        with self.lock:
            remaining_tokens = max(0, self.total_quota_tokens - self.total_tokens_consumed)
            remaining_pct = (remaining_tokens / self.total_quota_tokens) * 100.0 if self.total_quota_tokens > 0 else 0.0
            return {
                "steps_taken": self.current_step_count,
                "max_steps": self.max_steps,
                "total_tokens_consumed": self.total_tokens_consumed,
                "remaining_tokens": remaining_tokens,
                "remaining_pct": round(remaining_pct, 2),
                "is_low_quota": remaining_pct <= self.warning_threshold_pct,
                "circuit_tripped": self.current_step_count >= self.max_steps
            }
