"""
Unit & Integration Test: Git Worktree Manager & Isolation Harness
=============================================================================
Verifies:
1. Dynamic worktree creation under isolated paths (nexus-task-<uuid>)
2. Staging atomic patches and computing unified diffs
3. Clean worktree teardown and branch deletion without orphaned locks
=============================================================================
"""

import os
import sys
import unittest
import subprocess

# Ensure repo root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.workspace import WorkspaceManager, WorktreeContext


class TestWorkspaceManager(unittest.TestCase):
    def setUp(self):
        self.mgr = WorkspaceManager()

    def test_worktree_lifecycle_and_teardown(self):
        task_id = "test-unit-01"
        ctx = self.mgr.create_worktree(task_id=task_id)

        # 1. Verify directory and branch exist
        self.assertTrue(os.path.exists(ctx.worktree_path), "Worktree directory should exist on disk")
        self.assertTrue(ctx.is_active)

        # 2. Create a test file inside worktree
        test_file = os.path.join(ctx.worktree_path, "nexus_test_artifact.txt")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("Autonomous isolation proof line 1\nAutonomous isolation proof line 2\n")

        # 3. Check diff calculation
        diff_info = self.mgr.get_diff(ctx)
        self.assertTrue(diff_info["has_changes"])
        self.assertIn("nexus_test_artifact.txt", diff_info["untracked_files"])

        # 4. Commit changes inside worktree
        commit_hash = self.mgr.commit_changes(ctx, "test: isolated worktree commit")
        self.assertTrue(len(commit_hash) > 0, "Commit hash should be non-empty")

        # 5. Teardown worktree cleanly
        self.mgr.remove_worktree(ctx, delete_branch=True)
        self.assertFalse(os.path.exists(ctx.worktree_path), "Worktree directory should be deleted")

        # Verify branch is deleted
        res = subprocess.run(
            ["git", "branch", "--list", ctx.branch_name],
            cwd=self.mgr.repo_root,
            capture_output=True,
            text=True
        )
        self.assertNotIn(ctx.branch_name, res.stdout, "Ephemeral task branch should be pruned")

    def test_context_manager_isolation(self):
        with self.mgr.isolated_worktree("test-ctx-02") as ctx:
            self.assertTrue(os.path.exists(ctx.worktree_path))
            temp_file = os.path.join(ctx.worktree_path, "context_test.txt")
            with open(temp_file, "w") as f:
                f.write("data")
        # After exit, directory should be gone
        self.assertFalse(os.path.exists(ctx.worktree_path))


if __name__ == "__main__":
    unittest.main()
