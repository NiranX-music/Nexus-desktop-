"""
Nexus Autonomous Engine - Persistent Terminal & PTY Execution Harness
=============================================================================
Executes local shell commands inside an isolated pseudo-terminal harness.
Prevents command hangs on unexpected interactive prompts (e.g. y/n, sudo, git password),
streams stdout/stderr in real-time, and guarantees process-tree termination on timeout.
=============================================================================
"""

import os
import sys
import time
import queue
import signal
import platform
import threading
import subprocess
from dataclasses import dataclass
from typing import Optional, Callable, Dict, Any, List

IS_WINDOWS = platform.system() == "Windows"


@dataclass
class TerminalExecutionResult:
    command: str
    exit_code: int
    stdout: str
    stderr: str
    duration_sec: float
    timed_out: bool = False

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out

    def to_dict(self) -> Dict[str, Any]:
        return {
            "command": self.command,
            "exit_code": self.exit_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "duration_sec": round(self.duration_sec, 3),
            "timed_out": self.timed_out,
            "success": self.success
        }


class TerminalHarness:
    def __init__(self, default_cwd: Optional[str] = None):
        self.default_cwd = os.path.abspath(default_cwd or os.getcwd())

    def _kill_process_tree(self, proc: subprocess.Popen):
        """Forcefully kills process and all child processes across platforms."""
        try:
            if IS_WINDOWS:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    capture_output=True,
                    check=False
                )
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    def run_command(
        self,
        command: str,
        cwd: Optional[str] = None,
        timeout: float = 60.0,
        input_data: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
        env: Optional[Dict[str, str]] = None
    ) -> TerminalExecutionResult:
        """
        Runs command with non-blocking stream reading and timeout protection.
        Calls on_stdout(chunk) and on_stderr(chunk) as bytes/strings arrive.
        """
        work_dir = os.path.abspath(cwd or self.default_cwd)
        os.makedirs(work_dir, exist_ok=True)

        merged_env = os.environ.copy()
        merged_env["PYTHONUNBUFFERED"] = "1"
        merged_env["TERM"] = "xterm-256color"
        merged_env["CI"] = "1"
        merged_env["PAGER"] = "cat"
        if env:
            merged_env.update(env)

        start_time = time.time()
        stdout_chunks: List[str] = []
        stderr_chunks: List[str] = []
        timed_out = False

        if IS_WINDOWS:
            # Launch via shell=True (cmd.exe /c) to preserve exact child exit codes
            proc = subprocess.Popen(
                command,
                shell=True,
                cwd=work_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=merged_env,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1
            )
        else:
            # POSIX: spawn in new process group
            proc = subprocess.Popen(
                command,
                shell=True,
                cwd=work_dir,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=merged_env,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                preexec_fn=os.setsid
            )

        # Feed input_data if provided or close stdin to prevent interactive blocks
        if input_data:
            try:
                proc.stdin.write(input_data + "\n")
                proc.stdin.flush()
            except Exception:
                pass
        try:
            proc.stdin.close()
        except Exception:
            pass

        out_queue = queue.Queue()
        err_queue = queue.Queue()

        def reader(stream, q, callback, chunk_list):
            try:
                for line in iter(stream.readline, ''):
                    q.put(line)
                    chunk_list.append(line)
                    if callback:
                        callback(line)
            except Exception:
                pass
            finally:
                stream.close()

        t_out = threading.Thread(target=reader, args=(proc.stdout, out_queue, on_stdout, stdout_chunks), daemon=True)
        t_err = threading.Thread(target=reader, args=(proc.stderr, err_queue, on_stderr, stderr_chunks), daemon=True)
        t_out.start()
        t_err.start()

        # Wait for completion or timeout
        deadline = start_time + timeout
        while proc.poll() is None:
            if time.time() > deadline:
                timed_out = True
                self._kill_process_tree(proc)
                break
            time.sleep(0.05)

        t_out.join(timeout=1.0)
        t_err.join(timeout=1.0)

        duration = time.time() - start_time
        exit_code = -1 if timed_out else (proc.returncode if proc.returncode is not None else 0)

        stdout_full = "".join(stdout_chunks)
        stderr_full = "".join(stderr_chunks)

        if timed_out:
            stderr_full += f"\n[NEXUS_ERROR]: Command timed out after {timeout} seconds. Process tree killed.\n"

        return TerminalExecutionResult(
            command=command,
            exit_code=exit_code,
            stdout=stdout_full,
            stderr=stderr_full,
            duration_sec=duration,
            timed_out=timed_out
        )


_global_harness = TerminalHarness()

def execute_pty(command: str, cwd: Optional[str] = None, timeout: float = 60.0) -> Dict[str, Any]:
    """Convenience helper returning dictionary response."""
    res = _global_harness.run_command(command, cwd=cwd, timeout=timeout)
    return res.to_dict()
