import unittest
import tempfile
from pathlib import Path
from engine.provider_mesh import ProviderMesh, GenericOpenAICompatibleProvider


class TestProviderMesh(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = Path(self.temp_dir.name) / "test_providers.json"
        self.mesh = ProviderMesh(config_path=self.config_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_initial_adapters_registered(self):
        self.assertIn("groq", self.mesh.adapters)
        self.assertIn("gemini", self.mesh.adapters)
        self.assertIn("ollama", self.mesh.adapters)

    def test_scaffold_custom_provider(self):
        res = self.mesh.scaffold_custom_provider(
            name="local_deepseek",
            base_url="http://localhost:8000/v1",
            api_key="sk-test-local",
            model="deepseek-coder",
            probe_models=False
        )
        self.assertTrue(res["success"])
        self.assertIn("local_deepseek", self.mesh.adapters)
        adapter = self.mesh.adapters["local_deepseek"]
        self.assertIsInstance(adapter, GenericOpenAICompatibleProvider)
        self.assertEqual(adapter.model, "deepseek-coder")

        # Verify persisted to json config file
        reloaded_mesh = ProviderMesh(config_path=self.config_path)
        self.assertIn("local_deepseek", reloaded_mesh.adapters)

    def test_route_completion_fallback_flow(self):
        # Without valid keys, network calls fail gracefully through cascade
        res = self.mesh.route_completion("Hello, how are you?")
        self.assertIn("attempts", res)
        # Should attempt configured providers
        self.assertGreaterEqual(len(res["attempts"]), 1)


if __name__ == "__main__":
    unittest.main()
