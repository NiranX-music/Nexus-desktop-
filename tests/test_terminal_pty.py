"""
Unit & Integration Test: Persistent Terminal PTY Execution Harness
=============================================================================
Verifies:
1. Real-time stdout/stderr streaming via callback
2. Non-zero exit code capture
3. Timeout protection and process tree cleanup without hanging
=============================================================================
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.tools.terminal_pty import TerminalHarness, TerminalExecutionResult


class TestTerminalHarness(unittest.TestCase):
    def setUp(self):
        self.harness = TerminalHarness()

    def test_stdout_streaming_and_exit_code_zero(self):
        chunks = []
        def callback(chunk):
            chunks.append(chunk)

        result = self.harness.run_command(
            'python -c "print(\'Hello Nexus Stream\'); print(\'Line 2\')"',
            on_stdout=callback
        )

        self.assertEqual(result.exit_code, 0)
        self.assertTrue(result.success)
        self.assertIn("Hello Nexus Stream", result.stdout)
        self.assertGreaterEqual(len(chunks), 1)

    def test_stderr_and_nonzero_exit_code(self):
        result = self.harness.run_command(
            'python -c "import sys; sys.stderr.write(\'Simulated stderr error\\n\'); sys.exit(42)"'
        )

        self.assertEqual(result.exit_code, 42)
        self.assertFalse(result.success)
        self.assertIn("Simulated stderr error", result.stderr)

    def test_timeout_protection(self):
        # Command that attempts to sleep for 10 seconds, but timeout is 1.5 seconds
        result = self.harness.run_command(
            'python -c "import time; time.sleep(10)"',
            timeout=1.5
        )

        self.assertTrue(result.timed_out)
        self.assertFalse(result.success)
        self.assertIn("timed out", result.stderr.lower())


if __name__ == "__main__":
    unittest.main()
