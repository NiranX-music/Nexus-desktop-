"""
Nexus Autonomous Engine - Isolated Workspace & Git Worktree Manager
=============================================================================
Manages ephemeral, isolated Git worktrees for agent tasks so edits, builds,
and experimental self-corrections never corrupt the active working tree or branch.

Lifecycle:
1. create_worktree(task_id, base_ref) -> Isolated worktree directory & branch
2. stage_patch(diff_text) / apply_file_changes(...)
3. inspect_diff() -> Unified diff metrics (+additions, -deletions)
4. commit_worktree(message) -> Snapshot atomic milestone
5. merge_or_teardown(merge=True/False) -> Merge to base branch or clean discard
=============================================================================
"""

import os
import re
import sys
import uuid
import shutil
import stat
import subprocess
from dataclasses import dataclass
from typing import Optional, Dict, Any, Generator, Tuple
from contextlib import contextmanager


@dataclass
class WorktreeContext:
    task_id: str
    worktree_path: str
    branch_name: str
    base_branch: str
    is_active: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "worktree_path": self.worktree_path,
            "branch_name": self.branch_name,
            "base_branch": self.base_branch,
            "is_active": self.is_active
        }


def _force_remove_readonly(func, path, exc_info):
    """Clear the readonly bit and reattempt file removal on Windows."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


class WorkspaceManager:
    def __init__(self, repo_root: Optional[str] = None):
        self.repo_root = os.path.abspath(repo_root or os.getcwd())
        self._ensure_git_repo()

    def _ensure_git_repo(self):
        """Verifies repository has an initialized Git tree."""
        dot_git = os.path.join(self.repo_root, ".git")
        if not os.path.exists(dot_git):
            # Check if parent or current is git
            res = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                cwd=self.repo_root,
                capture_output=True,
                text=True
            )
            if res.returncode == 0 and res.stdout.strip():
                self.repo_root = os.path.abspath(res.stdout.strip())
            else:
                # Initialize repo if missing to guarantee isolation works
                subprocess.run(["git", "init"], cwd=self.repo_root, check=True, capture_output=True)

    def _run_git(self, args: list, cwd: Optional[str] = None, check: bool = True) -> subprocess.CompletedProcess:
        """Executes a git command with UTF-8 encoding."""
        target_cwd = cwd or self.repo_root
        res = subprocess.run(
            ["git"] + args,
            cwd=target_cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if check and res.returncode != 0:
            raise RuntimeError(
                f"Git command failed: git {' '.join(args)}\n"
                f"Exit: {res.returncode}\nStderr: {res.stderr}\nStdout: {res.stdout}"
            )
        return res

    def get_current_branch(self) -> str:
        """Returns active branch name or HEAD commit hash."""
        res = self._run_git(["rev-parse", "--abbrev-ref", "HEAD"], check=False)
        if res.returncode == 0 and res.stdout.strip() and res.stdout.strip() != "HEAD":
            return res.stdout.strip()
        # Fallback to current commit hash
        hash_res = self._run_git(["rev-parse", "--short", "HEAD"], check=False)
        return hash_res.stdout.strip() if hash_res.returncode == 0 else "main"

    def create_worktree(self, task_id: Optional[str] = None, base_ref: Optional[str] = None) -> WorktreeContext:
        """
        Creates an isolated Git worktree:
        git worktree add ../nexus-task-<uuid> -b agent/task-<uuid>
        """
        uid = (task_id or str(uuid.uuid4())[:8]).replace("/", "-").replace(" ", "-")
        branch_name = f"agent/task-{uid}"
        base = base_ref or self.get_current_branch()

        # Worktree path adjacent to repository root
        parent_dir = os.path.dirname(self.repo_root)
        worktree_name = f"nexus-task-{uid}"
        worktree_path = os.path.abspath(os.path.join(parent_dir, worktree_name))

        # Ensure branch doesn't conflict
        self._run_git(["branch", "-D", branch_name], check=False)

        # Check if worktree directory exists already
        if os.path.exists(worktree_path):
            self._cleanup_worktree_dir(worktree_path)

        # Create the worktree
        cmd = ["worktree", "add", worktree_path, "-b", branch_name]
        if base:
            cmd.append(base)

        self._run_git(cmd)

        # Synchronize essential directories into isolated worktree if untracked in checked out HEAD
        for item in ["tests", "engine", "bridge", "web_control"]:
            src = os.path.join(self.repo_root, item)
            dst = os.path.join(worktree_path, item)
            if os.path.exists(src) and not os.path.exists(dst):
                try:
                    if os.path.isdir(src):
                        shutil.copytree(src, dst)
                    else:
                        shutil.copy2(src, dst)
                except Exception:
                    pass

        return WorktreeContext(
            task_id=uid,
            worktree_path=worktree_path,
            branch_name=branch_name,
            base_branch=base,
            is_active=True
        )

    def get_diff(self, context: WorktreeContext, staged_only: bool = False) -> Dict[str, Any]:
        """
        Captures unified diff and calculates additions/deletions.
        """
        args = ["diff"]
        if staged_only:
            args.append("--staged")

        res = self._run_git(args, cwd=context.worktree_path, check=False)
        diff_text = res.stdout

        additions = 0
        deletions = 0
        files_modified = set()

        for line in diff_text.splitlines():
            if line.startswith("+++ b/"):
                files_modified.add(line[6:])
            elif line.startswith("+") and not line.startswith("+++"):
                additions += 1
            elif line.startswith("-") and not line.startswith("---"):
                deletions += 1

        # Also count untracked files
        status_res = self._run_git(["status", "--porcelain"], cwd=context.worktree_path, check=False)
        untracked = []
        for line in status_res.stdout.splitlines():
            if line.startswith("?? "):
                untracked.append(line[3:].strip())

        return {
            "diff": diff_text,
            "additions": additions,
            "deletions": deletions,
            "files_modified": sorted(list(files_modified)),
            "untracked_files": untracked,
            "has_changes": bool(diff_text.strip() or untracked)
        }

    def commit_changes(self, context: WorktreeContext, message: str) -> str:
        """Stages all changes and creates an atomic commit."""
        self._run_git(["add", "-A"], cwd=context.worktree_path)
        commit_res = self._run_git(["commit", "-m", message], cwd=context.worktree_path, check=False)
        if commit_res.returncode == 0:
            rev_res = self._run_git(["rev-parse", "--short", "HEAD"], cwd=context.worktree_path)
            return rev_res.stdout.strip()
        return ""

    def merge_worktree(self, context: WorktreeContext, target_branch: Optional[str] = None) -> bool:
        """Merges worktree branch back into target base branch."""
        target = target_branch or context.base_branch
        self._run_git(["checkout", target], cwd=self.repo_root)
        res = self._run_git(["merge", "--no-ff", "-m", f"feat(agent): merge {context.branch_name}", context.branch_name], cwd=self.repo_root, check=False)
        return res.returncode == 0

    def remove_worktree(self, context: WorktreeContext, delete_branch: bool = True):
        """Cleanly removes git worktree and deletes ephemeral task branch."""
        # 1. Ask git to remove worktree
        self._run_git(["worktree", "remove", "--force", context.worktree_path], check=False)
        self._run_git(["worktree", "prune"], check=False)

        # 2. Hard clean directory if anything remains
        self._cleanup_worktree_dir(context.worktree_path)

        # 3. Delete branch if requested
        if delete_branch:
            self._run_git(["branch", "-D", context.branch_name], check=False)

        context.is_active = False

    def _cleanup_worktree_dir(self, path: str):
        """Safely deletes worktree filesystem directory on Windows and POSIX."""
        if os.path.exists(path):
            try:
                shutil.rmtree(path, onerror=_force_remove_readonly)
            except Exception:
                pass

    @contextmanager
    def isolated_worktree(self, task_id: Optional[str] = None, auto_merge: bool = False) -> Generator[WorktreeContext, None, None]:
        """
        Context manager for safe ephemeral execution.
        Usage:
            with manager.isolated_worktree("feat-ui") as ctx:
                # edit files inside ctx.worktree_path
                manager.commit_changes(ctx, "feat: update")
        """
        ctx = self.create_worktree(task_id=task_id)
        try:
            yield ctx
            if auto_merge:
                self.commit_changes(ctx, f"feat(agent): complete task {ctx.task_id}")
                self.merge_worktree(ctx)
        finally:
            self.remove_worktree(ctx, delete_branch=not auto_merge)
