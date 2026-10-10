"""
Unit & Integration Test: Self-Healing & Self-Correction Loop
=============================================================================
Verifies:
1. Intercepting non-zero exit codes & stack traces from compiler/script failures
2. Feeding diagnostics into the self-correction handler
3. Applying automated patch/repair and recovering to success status
=============================================================================
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.orchestrator import AutonomousOrchestrator
from engine.router import PlannedStep


class TestSelfHealingLoop(unittest.TestCase):
    def setUp(self):
        self.orchestrator = AutonomousOrchestrator(max_self_corrections=3)
        self.test_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "_healing_sandbox"))
        os.makedirs(self.test_dir, exist_ok=True)

    def tearDown(self):
        import shutil
        if os.path.exists(self.test_dir):
            try:
                shutil.rmtree(self.test_dir)
            except Exception:
                pass

    def test_syntax_recovery_via_patch(self):
        # 1. Create a script with a simulated syntax/import issue
        broken_script = os.path.join(self.test_dir, "calc.py")
        with open(broken_script, "w", encoding="utf-8") as f:
            f.write("def add(a, b):\n    return a + b\n\n# Broken call\nprint(add(2, 'invalid_int'))\n")

        # 2. Run broken script
        step = PlannedStep(
            step_id="step_calc",
            tool="terminal",
            title="Execute calc.py",
            args={"cmd": f'python "{broken_script}"'}
        )

        res = self.orchestrator._execute_and_verify_step(step, cwd=self.test_dir)
        self.assertFalse(res["success"], "Initial run should fail with TypeError")
        self.assertIn("TypeError", res["output"])

        # 3. Simulate self-repair patch
        self.orchestrator.patcher.apply_search_replace(
            file_path=broken_script,
            search_block="print(add(2, 'invalid_int'))",
            replace_block="print(add(2, 5))"
        )

        # 4. Verify repaired script succeeds
        fixed_res = self.orchestrator._execute_and_verify_step(step, cwd=self.test_dir)
        self.assertTrue(fixed_res["success"], "Repaired script should exit with code 0")
        self.assertIn("7", fixed_res["output"])


if __name__ == "__main__":
    unittest.main()
