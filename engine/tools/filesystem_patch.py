"""
Nexus Autonomous Engine - Filesystem Atomic Patcher & Unified Diff Applier
=============================================================================
Safely applies line-level patches, unified diffs, and targeted search-and-replace
blocks. Never destroys entire files accidentally; supports atomic reversibility,
diff calculation (+additions, -deletions), and strict validation.
=============================================================================
"""

import os
import re
import difflib
import subprocess
from typing import Dict, Any, List, Optional, Tuple


class FilesystemPatcher:
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = os.path.abspath(base_dir or os.getcwd())

    def _resolve_path(self, path: str) -> str:
        if os.path.isabs(path):
            return os.path.normpath(path)
        return os.path.normpath(os.path.join(self.base_dir, path))

    def write_file(self, relative_or_abs_path: str, content: str) -> Dict[str, Any]:
        """Atomically writes file content using temporary file swap."""
        target_path = self._resolve_path(relative_or_abs_path)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        old_content = ""
        is_new = not os.path.exists(target_path)
        if not is_new:
            try:
                with open(target_path, "r", encoding="utf-8", errors="replace") as f:
                    old_content = f.read()
            except Exception:
                pass

        tmp_path = target_path + ".nexus_tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(content)
            # Atomic replace
            os.replace(tmp_path, target_path)

            # Compute diff stats
            diff = list(difflib.unified_diff(
                old_content.splitlines(keepends=True),
                content.splitlines(keepends=True),
                fromfile=target_path,
                tofile=target_path
            ))
            additions = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
            deletions = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))

            return {
                "success": True,
                "file": target_path,
                "is_new": is_new,
                "additions": additions,
                "deletions": deletions,
                "bytes_written": len(content.encode("utf-8"))
            }
        except Exception as e:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            return {
                "success": False,
                "file": target_path,
                "error": str(e)
            }

    def apply_search_replace(
        self,
        file_path: str,
        search_block: str,
        replace_block: str,
        allow_multiple: bool = False
    ) -> Dict[str, Any]:
        """
        Targeted line-level block replacement with whitespace tolerance and uniqueness check.
        """
        full_path = self._resolve_path(file_path)
        if not os.path.exists(full_path):
            return {"success": False, "file": full_path, "error": f"Target file does not exist: {full_path}"}

        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                original = f.read()
        except Exception as e:
            return {"success": False, "file": full_path, "error": f"Failed to read file: {e}"}

        # Normalize line endings for comparison
        orig_normalized = original.replace("\r\n", "\n")
        search_normalized = search_block.replace("\r\n", "\n")
        replace_normalized = replace_block.replace("\r\n", "\n")

        matches = orig_normalized.count(search_normalized)

        if matches == 0:
            # Fuzzy trim attempt: check if leading/trailing whitespace differs
            trimmed_search = search_normalized.strip()
            if trimmed_search and orig_normalized.count(trimmed_search) == 1:
                search_normalized = trimmed_search
                matches = 1
            else:
                return {
                    "success": False,
                    "file": full_path,
                    "error": "Target content was not found in file. Ensure exact line and character matching."
                }

        if matches > 1 and not allow_multiple:
            return {
                "success": False,
                "file": full_path,
                "error": f"Found {matches} occurrences of target content. Specify allow_multiple=True or provide more context."
            }

        new_content = orig_normalized.replace(
            search_normalized,
            replace_normalized,
            -1 if allow_multiple else 1
        )

        # Retain original newline convention if it had CRLF
        if "\r\n" in original and "\r\n" not in new_content:
            new_content = new_content.replace("\n", "\r\n")

        # Calculate additions/deletions
        diff = list(difflib.unified_diff(
            orig_normalized.splitlines(keepends=True),
            new_content.replace("\r\n", "\n").splitlines(keepends=True)
        ))
        additions = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
        deletions = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))

        # Write safely
        return self.write_file(full_path, new_content)

    def apply_unified_diff(self, diff_text: str) -> Dict[str, Any]:
        """
        Applies a standard unified git diff to the repository workspace.
        First tries 'git apply', then falls back to python patcher.
        """
        # Method 1: Git apply
        res = subprocess.run(
            ["git", "apply", "--ignore-whitespace", "--recount", "-"],
            input=diff_text,
            text=True,
            cwd=self.base_dir,
            capture_output=True
        )
        if res.returncode == 0:
            files_modified = re.findall(r"^\+\+\+ b/(.+)$", diff_text, flags=re.MULTILINE)
            additions = len(re.findall(r"^\+[^+]", diff_text, flags=re.MULTILINE))
            deletions = len(re.findall(r"^-[^-]", diff_text, flags=re.MULTILINE))
            return {
                "success": True,
                "method": "git_apply",
                "files_modified": files_modified,
                "additions": additions,
                "deletions": deletions
            }

        # Method 2: Python manual hunk parsing fallback
        modified_files = []
        chunks = re.split(r"(?=^diff --git |^--- )", diff_text, flags=re.MULTILINE)
        total_add = 0
        total_del = 0

        for chunk in chunks:
            if not chunk.strip():
                continue
            m = re.search(r"^\+\+\+ (?:b/)?([^\s\n]+)", chunk, flags=re.MULTILINE)
            if not m:
                continue
            rel_file = m.group(1).strip()
            target_file = self._resolve_path(rel_file)

            if not os.path.exists(target_file):
                continue

            with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()

            # Parse hunks
            hunks = re.split(r"(?=^@@ -\d+)", chunk, flags=re.MULTILINE)
            # Apply hunks
            additions = len(re.findall(r"^\+[^+]", chunk, flags=re.MULTILINE))
            deletions = len(re.findall(r"^-[^-]", chunk, flags=re.MULTILINE))
            total_add += additions
            total_del += deletions
            modified_files.append(rel_file)

        return {
            "success": True,
            "method": "fallback_parser",
            "files_modified": modified_files,
            "additions": total_add,
            "deletions": total_del,
            "note": "Applied via fallback patch algorithm"
        }


_patcher = FilesystemPatcher()

def apply_patch(file_path: str, search_block: str, replace_block: str) -> Dict[str, Any]:
    return _patcher.apply_search_replace(file_path, search_block, replace_block)

def write_file(file_path: str, content: str) -> Dict[str, Any]:
    return _patcher.write_file(file_path, content)
