#!/usr/bin/env python3
"""
Nexus Unified Autonomous Engine Runner (CLI / TUI)
=============================================================================
Antigravity-Style Autonomous Development & Systems Coordinator.
Transforms Nexus into an autonomous execution engine running inside
isolated local environments and connected to Cloudflare Edge / D1.

Usage:
    python nexus_runner.py --task "Build and test feature"
    python nexus_runner.py --interactive
    python nexus_runner.py --bridge
    python nexus_runner.py --export-data
    python nexus_runner.py --status
    python nexus_runner.py --test-all
=============================================================================
"""

import os
import sys
import time
import argparse
from typing import Dict, Any

# Ensure Windows console uses UTF-8 encoding
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.syntax import Syntax

from engine.orchestrator import AutonomousOrchestrator
from engine.exporter import create_export
from engine.local_store import LocalAgentStore
from bridge.cloudflare_listener import CloudflareBridgeListener
from bridge.tts_speaker import speak

console = Console(force_terminal=True, legacy_windows=False)


def render_banner():
    banner_text = """[bold cyan]
=============================================================================
  N E X U S   D E S K T O P   -   A U T O N O M O U S   E N G I N E
=============================================================================
[/bold cyan]
[dim]Antigravity Autonomous Agent Execution Engine | 100% Local Sovereignty & Free-Tier Edge[/dim]
"""
    console.print(banner_text)


def run_live_task(prompt: str, isolate_worktree: bool = True):
    console.print(Panel(f"[bold white]{prompt}[/bold white]", title="[bold green]Goal", border_style="green"))

    # Live Event Stream Table
    table = Table(title="Live Execution Milestones & Telemetry", border_style="dim", expand=True)
    table.add_column("Timestamp", style="dim", width=10)
    table.add_column("Type", style="bold", width=14)
    table.add_column("Milestone / Tool", style="cyan", width=34)
    table.add_column("Status", width=12)
    table.add_column("Duration", style="yellow", width=10)
    table.add_column("ETA Left", style="magenta", width=10)

    def on_event(ev: Dict[str, Any]):
        t_str = ev.get("timestamp", "").split("T")[-1].replace("Z", "")[:8]
        typ = ev.get("type", "").upper()
        title = ev.get("title", "")[:33]
        status = ev.get("status", "").upper()
        dur = ev.get("duration", "--")
        eta_raw = ev.get("etaSecondsRemaining")
        eta_str = f"{eta_raw:.1f}s" if eta_raw is not None else "--"

        color_status = (
            "[green]SUCCESS[/green]" if status == "SUCCESS"
            else "[red]FAILED[/red]" if status == "FAILED"
            else "[yellow]RUNNING[/yellow]" if status == "RUNNING"
            else "[magenta]APPROVAL[/magenta]"
        )

        icon_map = {
            "THOUGHT": "🧠",
            "TOOL_CALL": "⚙️",
            "TOOL_RESULT": "📋",
            "APPROVAL_REQUEST": "🛡️",
            "ERROR": "❌"
        }
        icon = icon_map.get(typ, "•")

        table.add_row(t_str, f"{icon} {typ}", title, color_status, dur, eta_str)

        # Highlight thoughts and command outputs
        if ev.get("thoughtContent"):
            console.print(f"[dim purple]🧠 Thought:[/dim purple] [italic]{ev['thoughtContent']}[/italic]")
        if ev.get("payload", {}).get("cmd"):
            console.print(f"[dim blue]$[/dim blue] [bold]{ev['payload']['cmd']}[/bold]")

    orchestrator = AutonomousOrchestrator(event_callback=on_event)
    speak(f"Initiating autonomous plan for {prompt[:30]}")

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold cyan]{task.description}"),
        console=console,
        transient=True
    ) as progress:
        p_task = progress.add_task("Executing Autonomous Lifecycle...", total=None)
        result = orchestrator.execute_task(prompt, isolate_worktree=isolate_worktree)
        progress.update(p_task, completed=True)

    console.print("\n")
    console.print(table)

    # Render Governor & Quota summary
    gov_status = result.get("governor_status", {})
    rem_pct = gov_status.get("remaining_pct", 100.0)
    quota_color = "green" if rem_pct > 20 else "yellow"

    # Render Final Review Panel
    status_color = "green" if result.get("success") else "red"
    summary_text = (
        f"[bold]Task ID:[/bold] {result.get('task_id')}\n"
        f"[bold]Duration:[/bold] {result.get('duration_sec')}s\n"
        f"[bold]Self-Corrections Applied:[/bold] {result.get('corrections_made')}\n"
        f"[bold]Quota Remaining:[/bold] [{quota_color}]{rem_pct}% ({gov_status.get('remaining_tokens', 0)} tokens)[/{quota_color}]\n"
        f"[bold]Diff Summary:[/bold] [green]+{result['diff_summary']['additions']}[/green] [red]-{result['diff_summary']['deletions']}[/red] files: {', '.join(result['diff_summary']['files_modified']) or 'None'}\n"
        f"[bold]Review Artifact:[/bold] [underline]{result.get('review_artifact')}[/underline]"
    )
    console.print(Panel(summary_text, title=f"[{status_color}]Execution Result: {'SUCCESS' if result.get('success') else 'FAILED'}[/{status_color}]", border_style=status_color))

    speak(f"Task complete. Status: {'Success' if result.get('success') else 'Failed'}")
    return result


def export_agent_data():
    render_banner()
    console.print("[bold cyan]Generating 100% Local Data Sovereignty Archive...[/bold cyan]")
    try:
        archive_path = create_export()
        console.print(f"[bold green]Archive generated successfully:[/bold green] {archive_path}")
        console.print("[dim]Open 'READABLE_EXPORT_VIEWER.html' inside the ZIP to explore your thoughts and memories offline.[/dim]")
    except Exception as e:
        console.print(f"[bold red]Failed to create export archive: {e}[/bold red]")


def show_system_status():
    render_banner()
    store = LocalAgentStore()
    tasks = store.get_task_history(limit=5)
    memories = store.get_memories()

    table = Table(title="Local Data Sovereignty State (~/.nexus-agent/db/agent_local.db)", border_style="cyan")
    table.add_column("Category", style="bold")
    table.add_column("Count / Value", style="green")

    table.add_row("Total Tasks Executed Locally", str(len(store.get_task_history(limit=1000))))
    table.add_row("Episodic Memories Stored", str(len(memories)))
    table.add_row("Remote Data Stored on Cloudflare", "0% (Strictly zero raw chats/code)")
    table.add_row("Free-Tier Services in Use", "Groq, Cloudflare Pages/D1, Edge-TTS, Local PTY")
    console.print(table)


def interactive_mode():
    render_banner()
    console.print("[bold yellow]Interactive Agent Prompt active.[/bold yellow] Type your task or [dim]'exit'[/dim] to quit.\n")
    while True:
        try:
            task = console.input("[bold green]nexus> [/bold green]").strip()
            if not task:
                continue
            if task.lower() in ("exit", "quit", "q"):
                console.print("[dim]Exiting Nexus Runner.[/dim]")
                break
            run_live_task(task)
        except (KeyboardInterrupt, EOFError):
            break


def run_bridge_daemon():
    render_banner()
    console.print("[bold cyan]Starting Persistent Cloudflare SSE Bridge Listener Daemon...[/bold cyan]")
    listener = CloudflareBridgeListener()
    try:
        listener.start()
    except KeyboardInterrupt:
        listener.stop()
        console.print("\n[yellow]Daemon terminated.[/yellow]")


def run_all_tests():
    render_banner()
    console.print("[bold cyan]Running Nexus Autonomous Engine Test Suite...[/bold cyan]\n")
    import subprocess
    cmd = [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"]
    subprocess.run(cmd)


def main():
    parser = argparse.ArgumentParser(description="Nexus Autonomous Agent Runner")
    parser.add_argument("--task", type=str, help="Autonomous task prompt to execute")
    parser.add_argument("--bridge", action="store_true", help="Run persistent Cloudflare SSE bridge daemon")
    parser.add_argument("--interactive", action="store_true", help="Launch interactive prompt loop")
    parser.add_argument("--export-data", action="store_true", help="Export local sovereignty archive ZIP with offline viewer")
    parser.add_argument("--status", action="store_true", help="Display local sovereignty and quota status")
    parser.add_argument("--test-all", action="store_true", help="Run comprehensive test suite")
    parser.add_argument("--no-worktree", action="store_true", help="Disable isolated Git worktree sandboxing")

    args = parser.parse_args()

    if args.export_data:
        export_agent_data()
    elif args.status:
        show_system_status()
    elif args.bridge:
        run_bridge_daemon()
    elif args.test_all:
        run_all_tests()
    elif args.task:
        render_banner()
        run_live_task(args.task, isolate_worktree=not args.no_worktree)
    elif args.interactive or len(sys.argv) == 1:
        interactive_mode()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
