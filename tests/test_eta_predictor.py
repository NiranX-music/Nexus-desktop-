import unittest
from engine.eta_predictor import ETAPredictor


class TestETAPredictor(unittest.TestCase):
    def setUp(self):
        self.predictor = ETAPredictor(alpha=0.4)

    def test_baseline_predictions(self):
        steps = ["terminal", "filesystem", "browser"]
        res = self.predictor.predict_remaining(steps)
        # Expected: 3.8 + 1.2 + 5.5 = 10.5s
        self.assertAlmostEqual(res["eta_seconds_remaining"], 10.5, delta=0.2)
        self.assertIn(res["formatted_eta"], ["10s", "11s"])
        self.assertEqual(len(res["breakdown"]), 3)

    def test_exponential_moving_average_update(self):
        # Baseline for terminal is 3.8s
        # If observed is 10.0s with alpha 0.4:
        # new_weight = 0.4 * 10.0 + 0.6 * 3.8 = 4.0 + 2.28 = 6.28
        new_weight = self.predictor.record_actual_duration("terminal", 10.0)
        self.assertAlmostEqual(new_weight, 6.28, delta=0.05)

        # Subsequent prediction should use updated weight
        res = self.predictor.predict_remaining(["terminal"])
        self.assertAlmostEqual(res["eta_seconds_remaining"], 6.3, delta=0.1)

    def test_duration_formatter(self):
        self.assertEqual(ETAPredictor.format_duration(25.4), "25s")
        self.assertEqual(ETAPredictor.format_duration(85.0), "1m 25s")
        self.assertEqual(ETAPredictor.format_duration(3605.0), "60m 05s")


if __name__ == "__main__":
    unittest.main()
