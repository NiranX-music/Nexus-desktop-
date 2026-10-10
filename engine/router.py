"""
Nexus Autonomous Engine - Intent Dispatcher & Multi-Tier AI Router
=============================================================================
Routes user prompts into structured execution plans across tool harnesses:
1. Terminal (Shell / Compiler / Test Runner / PTY)
2. Filesystem (Line-level atomic patcher / Search & Replace)
3. Browser (Playwright / Console Inspector / Screenshot proof)
4. Win32 Desktop UFO (Accessibility tree walker / Grounded UI clicks)
5. Voice / TTS Feedback (Edge-TTS)

Multi-Tier AI Strategy:
- Default Tier: Groq Cloud API (llama-3.3-70b-versatile, 100% Free Tier, zero credit card)
- Cloudflare Workers AI fallback
- Developer Mode: Gemini Pro / Flash API keys or Ollama (localhost:11434)
- Deterministic Offline Fallback: High-speed rule/regex compiler (0ms latency, zero tokens)
=============================================================================
"""

import os
import sys
import re
import json
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional


@dataclass
class PlannedStep:
    step_id: str
    tool: str  # "terminal" | "filesystem" | "browser" | "desktop_ufo" | "voice"
    title: str
    args: Dict[str, Any]
    requires_approval: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "tool": self.tool,
            "title": self.title,
            "args": self.args,
            "requires_approval": self.requires_approval
        }


@dataclass
class TaskPlan:
    goal: str
    intent_type: str  # "SHELL" | "FS_PATCH" | "BROWSER" | "DESKTOP_GUI" | "VOICE" | "COMPLEX_PIPELINE"
    milestone_phases: List[str]
    steps: List[PlannedStep] = field(default_factory=list)
    raw_thought: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "goal": self.goal,
            "intent_type": self.intent_type,
            "milestone_phases": self.milestone_phases,
            "steps": [s.to_dict() for s in self.steps],
            "raw_thought": self.raw_thought
        }


class IntentRouter:
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "desktop_agent", "config.json")
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def get_api_key(self, provider: str) -> Optional[str]:
        # Environment variable takes priority
        env_map = {
            "groq": "GROQ_API_KEY",
            "gemini": "GEMINI_API_KEY",
            "cloudflare": "CLOUDFLARE_API_TOKEN"
        }
        env_val = os.getenv(env_map.get(provider, ""))
        if env_val:
            return env_val

        # Check config.json
        ai_cfg = self.config.get("ai", {})
        if ai_cfg.get("provider") == provider and ai_cfg.get("api_key"):
            return ai_cfg.get("api_key")
        if self.config.get(f"{provider}_api_key"):
            return self.config.get(f"{provider}_api_key")
        return None

    def route_intent(self, prompt: str) -> TaskPlan:
        """Dispatches prompt into a structured TaskPlan."""
        # 1. Try Groq Cloud API (Free Tier)
        groq_key = self.get_api_key("groq")
        if groq_key:
            plan = self._call_groq_planner(prompt, groq_key)
            if plan:
                return plan

        # 2. Try Gemini (Developer Mode)
        gemini_key = self.get_api_key("gemini")
        if gemini_key:
            plan = self._call_gemini_planner(prompt, gemini_key)
            if plan:
                return plan

        # 3. Try Ollama local endpoint
        ollama_endpoint = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
        plan = self._call_ollama_planner(prompt, ollama_endpoint)
        if plan:
            return plan

        # 4. Instant Deterministic Rule-Based Fallback
        return self._rule_based_fallback(prompt)

    def _call_groq_planner(self, prompt: str, api_key: str) -> Optional[TaskPlan]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        system_prompt = (
            "You are the Nexus Autonomous Systems Orchestrator. Output ONLY a valid JSON object matching:\n"
            "{\n"
            '  "thought": "brief chain of thought reasoning",\n'
            '  "intent_type": "SHELL" | "FS_PATCH" | "BROWSER" | "DESKTOP_GUI" | "VOICE" | "COMPLEX_PIPELINE",\n'
            '  "milestone_phases": ["Phase 1: ...", "Phase 2: ..."],\n'
            '  "steps": [\n'
            '    {"step_id": "step_1", "tool": "terminal|filesystem|browser|desktop_ufo|voice", "title": "...", "args": {...}, "requires_approval": false}\n'
            "  ]\n"
            "}"
        )
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return self._parse_json_plan(prompt, parsed)
        except Exception:
            return None

    def _call_gemini_planner(self, prompt: str, api_key: str) -> Optional[TaskPlan]:
        model = self.config.get("ai", {}).get("model", "gemini-2.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        system_prompt = (
            "Output JSON with: thought (string), intent_type (string), milestone_phases (list of strings), "
            "steps (list of objects with step_id, tool, title, args, requires_approval)."
        )
        payload = {
            "contents": [{"parts": [{"text": f"{system_prompt}\nUser Task: {prompt}"}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                return self._parse_json_plan(prompt, parsed)
        except Exception:
            return None

    def _call_ollama_planner(self, prompt: str, endpoint: str) -> Optional[TaskPlan]:
        url = f"{endpoint.rstrip('/')}/api/generate"
        system_prompt = "Output valid JSON: thought, intent_type, milestone_phases, steps (tool, title, args, requires_approval)."
        payload = {
            "model": "qwen2.5-coder:7b",
            "prompt": f"{system_prompt}\nTask: {prompt}",
            "stream": False,
            "format": "json"
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                parsed = json.loads(data["response"])
                return self._parse_json_plan(prompt, parsed)
        except Exception:
            return None

    def _parse_json_plan(self, prompt: str, data: Dict[str, Any]) -> TaskPlan:
        steps = []
        for i, s in enumerate(data.get("steps", [])):
            steps.append(PlannedStep(
                step_id=s.get("step_id", f"step_{i+1}"),
                tool=s.get("tool", "terminal"),
                title=s.get("title", f"Execute action {i+1}"),
                args=s.get("args", {}),
                requires_approval=s.get("requires_approval", False)
            ))
        return TaskPlan(
            goal=prompt,
            intent_type=data.get("intent_type", "COMPLEX_PIPELINE"),
            milestone_phases=data.get("milestone_phases", ["Phase 1: Execution", "Phase 2: Verification"]),
            steps=steps,
            raw_thought=data.get("thought", "Formulated multi-step execution plan.")
        )

    def _rule_based_fallback(self, prompt: str) -> TaskPlan:
        """Deterministic zero-cost pattern compiler."""
        p_lower = prompt.lower().strip()
        thought = f"Deterministic intent parsed from command signature: '{prompt[:60]}...'"

        # 1. Browser intent
        if p_lower.startswith("http") or "localhost" in p_lower or "browse" in p_lower or "visit " in p_lower:
            url_match = re.search(r"https?://[^\s]+|localhost:[0-9]+", prompt)
            target_url = url_match.group(0) if url_match else "http://localhost:3000"
            if not target_url.startswith("http"):
                target_url = f"http://{target_url}"
            return TaskPlan(
                goal=prompt,
                intent_type="BROWSER",
                milestone_phases=["Phase 1: Navigate", "Phase 2: Verify Console & Screenshot"],
                steps=[
                    PlannedStep(
                        step_id="step_1",
                        tool="browser",
                        title=f"Verify surface {target_url}",
                        args={"url": target_url}
                    )
                ],
                raw_thought=thought
            )

        # 2. Filesystem / Patch intent
        if "patch " in p_lower or "replace " in p_lower or "edit file" in p_lower or "write file" in p_lower:
            return TaskPlan(
                goal=prompt,
                intent_type="FS_PATCH",
                milestone_phases=["Phase 1: Compute Unified Diff", "Phase 2: Apply Atomic Patch", "Phase 3: Verify Integrity"],
                steps=[
                    PlannedStep(
                        step_id="step_1",
                        tool="filesystem",
                        title="Apply filesystem modification",
                        args={"prompt": prompt}
                    )
                ],
                raw_thought=thought
            )

        # 3. Windows Desktop UFO intent
        if p_lower.startswith("click ") or p_lower.startswith("type ") or "button" in p_lower or "window" in p_lower:
            return TaskPlan(
                goal=prompt,
                intent_type="DESKTOP_GUI",
                milestone_phases=["Phase 1: Inspect Accessibility Tree", "Phase 2: Ground Element Coordinates", "Phase 3: Dispatch Interaction"],
                steps=[
                    PlannedStep(
                        step_id="step_1",
                        tool="desktop_ufo",
                        title=f"Interact with UI element: {prompt}",
                        args={"query": prompt}
                    )
                ],
                raw_thought=thought
            )

        # 4. Spoken Voice intent
        if p_lower.startswith("say ") or p_lower.startswith("speak ") or p_lower.startswith("tell me "):
            speech = prompt.replace("say ", "").replace("speak ", "").strip()
            return TaskPlan(
                goal=prompt,
                intent_type="VOICE",
                milestone_phases=["Phase 1: Synthesize Spoken Feedback"],
                steps=[
                    PlannedStep(
                        step_id="step_1",
                        tool="voice",
                        title=f"Spoken feedback: {speech[:30]}",
                        args={"text": speech}
                    )
                ],
                raw_thought=thought
            )

        # 5. Default Shell execution with safety approval detection
        dangerous_patterns = ["rm -rf", "drop table", "del /f", "format ", "git push --force"]
        is_risky = any(dp in p_lower for dp in dangerous_patterns)

        # Detect high-level intents (test suite, typecheck, build)
        if "test suite" in p_lower or "run tests" in p_lower or "unit test" in p_lower:
            cmd_str = f'"{sys.executable}" -m unittest discover -s tests -v'
        elif "typecheck" in p_lower:
            cmd_str = "npm run typecheck"
        elif "build" in p_lower and not any(p_lower.startswith(w) for w in ["docker", "cargo"]):
            cmd_str = "npm run build"
        else:
            cmd_str = prompt
            if p_lower.startswith("run ") or p_lower.startswith("execute ") or p_lower.startswith("exec "):
                cmd_str = re.sub(r'^(run|execute|exec)\s+', '', prompt, flags=re.IGNORECASE).strip()

        return TaskPlan(
            goal=prompt,
            intent_type="SHELL",
            milestone_phases=["Phase 1: Environment Preparation", "Phase 2: Command Execution", "Phase 3: Exit Code & Health Verification"],
            steps=[
                PlannedStep(
                    step_id="step_1",
                    tool="terminal",
                    title=f"Execute: {cmd_str}",
                    args={"cmd": cmd_str},
                    requires_approval=is_risky
                )
            ],
            raw_thought=thought
        )


_global_router = IntentRouter()

def route_user_task(prompt: str) -> TaskPlan:
    return _global_router.route_intent(prompt)
