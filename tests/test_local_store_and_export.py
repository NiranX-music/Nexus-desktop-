import unittest
import tempfile
import zipfile
import json
from pathlib import Path
from engine.local_store import LocalAgentStore
from engine.exporter import DataSovereigntyExporter


class TestLocalStoreAndExport(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "agent_local.db"
        self.store = LocalAgentStore(db_path=self.db_path)
        self.exporter = DataSovereigntyExporter(store=self.store)

    def tearDown(self):
        try:
            self.temp_dir.cleanup()
        except Exception:
            pass

    def test_local_store_logging_lifecycle(self):
        task_id = "test_task_01"
        # 1. Start task
        self.store.log_task_start(task_id, "Refactor database models", "AUTONOMOUS_EXEC")

        # 2. Log thoughts
        self.store.log_thought(task_id, "step_0", "Analyzing schema relations...")

        # 3. Log tool executions
        self.store.log_tool_execution(
            task_id=task_id,
            tool_name="terminal",
            command_or_args="pytest tests/test_db.py",
            output="PASSED 5 tests",
            exit_code=0,
            success=True,
            duration_sec=1.45
        )

        # 4. Log diff
        self.store.log_diff(
            task_id=task_id,
            file_path="models.py",
            diff_content="+ def to_dict(): ...",
            additions=5,
            deletions=0
        )

        # 5. Episodic memory
        self.store.save_episodic_memory(
            category="build_rules",
            key="pytest_flag",
            value="Always use -v --tb=short",
            confidence=0.95
        )

        # 6. Complete task
        self.store.update_task_status(task_id, "COMPLETED", duration_sec=3.2, summary="Refactored cleanly")

        # Verify retrieval
        dossier = self.store.get_task_full_traces(task_id)
        self.assertEqual(dossier["task"]["status"], "COMPLETED")
        self.assertEqual(len(dossier["thoughts"]), 1)
        self.assertEqual(len(dossier["tools"]), 1)
        self.assertEqual(len(dossier["diffs"]), 1)

        memories = self.store.get_memories(category="build_rules")
        self.assertEqual(len(memories), 1)
        self.assertEqual(memories[0]["memory_key"], "pytest_flag")

    def test_exporter_generates_valid_zip_with_viewer(self):
        # Seed test data
        t_id = "export_task_99"
        self.store.log_task_start(t_id, "Create standalone offline viewer", "AUTONOMOUS_EXEC")
        self.store.log_thought(t_id, "th_1", "Generating embedded HTML artifact...")
        self.store.log_diff(t_id, "export.html", "+<html>...</html>", 10, 0)
        self.store.save_episodic_memory("user_preference", "theme", "dark", 1.0)
        self.store.update_task_status(t_id, "COMPLETED", duration_sec=2.1, summary="Done")

        # Generate export bundle
        export_out_dir = Path(self.temp_dir.name) / "exports"
        zip_file = self.exporter.generate_export_bundle(export_out_dir)

        self.assertTrue(zip_file.exists())
        self.assertTrue(zipfile.is_zipfile(str(zip_file)))

        # Inspect ZIP archive contents
        with zipfile.ZipFile(str(zip_file), "r") as zf:
            namelist = zf.namelist()
            self.assertIn("READABLE_EXPORT_VIEWER.html", namelist)
            self.assertIn("data/agent_local.db", namelist)
            self.assertIn("data/tasks_full.json", namelist)
            self.assertIn("data/memories.json", namelist)
            self.assertIn("data/diffs.json", namelist)

            # Validate that READABLE_EXPORT_VIEWER.html contains valid HTML and data
            html_content = zf.read("READABLE_EXPORT_VIEWER.html").decode("utf-8")
            self.assertIn("<!DOCTYPE html>", html_content)
            self.assertIn("Nexus AI Agent - Local Sovereignty Archive", html_content)
            self.assertIn("export_task_99", html_content)
            self.assertIn("user_preference", html_content)


if __name__ == "__main__":
    unittest.main()
