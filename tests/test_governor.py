import unittest
import time
from engine.governor import UsageGovernor, TokenBucketRateLimiter, CircuitBreakerTripped


class TestUsageGovernor(unittest.TestCase):
    def test_token_bucket_consume_and_refill(self):
        bucket = TokenBucketRateLimiter(capacity=1000, refill_rate_per_sec=100.0)
        self.assertTrue(bucket.consume(500))
        self.assertLessEqual(bucket.get_available_tokens(), 510)
        self.assertFalse(bucket.consume(600))  # Exceeds current available

    def test_circuit_breaker_trips_at_max_steps(self):
        gov = UsageGovernor(max_steps=5)
        for i in range(1, 6):
            self.assertEqual(gov.record_step(f"step_{i}"), i)

        with self.assertRaises(CircuitBreakerTripped):
            gov.record_step("step_6")

    def test_quota_warning_at_20_percent(self):
        warning_received = []

        def on_warn(payload):
            warning_received.append(payload)

        gov = UsageGovernor(
            max_steps=10,
            total_quota_tokens=10_000,
            warning_threshold_pct=20.0,
            on_quota_warning=on_warn
        )

        # Consume 7,500 tokens (25% remaining -> no warning)
        status = gov.record_token_usage(prompt_tokens=4000, completion_tokens=3500)
        self.assertFalse(status["is_low_quota"])
        self.assertEqual(len(warning_received), 0)

        # Consume 1,000 more (15% remaining -> warning triggers!)
        status2 = gov.record_token_usage(prompt_tokens=500, completion_tokens=500)
        self.assertTrue(status2["is_low_quota"])
        self.assertEqual(len(warning_received), 1)
        self.assertEqual(warning_received[0]["event"], "LOW_QUOTA_WARNING")
        self.assertLessEqual(warning_received[0]["remaining_pct"], 20.0)


if __name__ == "__main__":
    unittest.main()
