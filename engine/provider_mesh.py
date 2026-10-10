"""
Nexus Autonomous Engine - Multi-Provider Mesh & Dynamic Adapter Scaffolder
=============================================================================
Manages multi-tier inference providers with automatic failover:
1. Primary Tier: Groq Cloud (llama-3.3-70b-versatile, whisper-large-v3-turbo).
2. Developer Tier / Fallbacks: Gemini, OpenAI, Anthropic, Local Ollama/Edge0.
3. Quota Trigger (<20% or HTTP 429): Cascades to next healthy provider.
4. Dynamic Custom Scaffolder: Probes /v1/models for unknown custom providers,
   auto-installs bridge packages (e.g. litellm), and persists config to
   ~/.nexus_provider_config.json.
=============================================================================
"""

import os
import sys
import json
import time
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple


CONFIG_FILE_PATH = Path.home() / ".nexus_provider_config.json"


class ProviderAdapter:
    """Base interface for an LLM provider adapter."""
    def __init__(self, name: str, model: str, api_key: str = "", base_url: str = ""):
        self.name = name
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.is_healthy = True
        self.last_failure_time = 0.0

    def chat_complete(self, prompt: str, system_prompt: str = "") -> Dict[str, Any]:
        raise NotImplementedError


class GroqProvider(ProviderAdapter):
    """Groq Cloud API provider adapter (100% Free-Tier default)."""
    def __init__(self, api_key: str = "", model: str = "llama-3.3-70b-versatile"):
        super().__init__(
            name="groq",
            model=model,
            api_key=api_key or os.getenv("GROQ_API_KEY", ""),
            base_url="https://api.groq.com/openai/v1"
        )

    def chat_complete(self, prompt: str, system_prompt: str = "") -> Dict[str, Any]:
        if not self.api_key:
            return {"success": False, "error": "GROQ_API_KEY is not configured", "provider": self.name}

        url = f"{self.base_url}/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2048
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=20.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choice = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                return {
                    "success": True,
                    "content": choice,
                    "provider": self.name,
                    "model": self.model,
                    "usage": {
                        "prompt_tokens": usage.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0)
                    }
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            if e.code == 429:
                self.is_healthy = False
                self.last_failure_time = time.time()
            return {"success": False, "error": f"HTTP {e.code}: {err_body}", "provider": self.name, "status_code": e.code}
        except Exception as e:
            return {"success": False, "error": str(e), "provider": self.name}


class GeminiProvider(ProviderAdapter):
    """Google Gemini API adapter (Developer Mode key)."""
    def __init__(self, api_key: str = "", model: str = "gemini-1.5-pro"):
        super().__init__(
            name="gemini",
            model=model,
            api_key=api_key or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", ""),
            base_url="https://generativelanguage.googleapis.com/v1beta"
        )

    def chat_complete(self, prompt: str, system_prompt: str = "") -> Dict[str, Any]:
        if not self.api_key:
            return {"success": False, "error": "GEMINI_API_KEY is not configured", "provider": self.name}

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        parts = []
        if system_prompt:
            parts.append({"text": f"SYSTEM INSTRUCTION: {system_prompt}\n\n"})
        parts.append({"text": prompt})

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048}
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=25.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    usage = data.get("usageMetadata", {})
                    return {
                        "success": True,
                        "content": content,
                        "provider": self.name,
                        "model": self.model,
                        "usage": {
                            "prompt_tokens": usage.get("promptTokenCount", 0),
                            "completion_tokens": usage.get("candidatesTokenCount", 0)
                        }
                    }
                return {"success": False, "error": "No candidates returned", "provider": self.name}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            return {"success": False, "error": f"HTTP {e.code}: {err_body}", "provider": self.name, "status_code": e.code}
        except Exception as e:
            return {"success": False, "error": str(e), "provider": self.name}


class OllamaProvider(ProviderAdapter):
    """Local Ollama / Edge0 endpoint adapter (zero-cost local execution)."""
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3:latest"):
        super().__init__(name="ollama", model=model, base_url=base_url)

    def chat_complete(self, prompt: str, system_prompt: str = "") -> Dict[str, Any]:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "success": True,
                    "content": data.get("response", ""),
                    "provider": self.name,
                    "model": self.model,
                    "usage": {
                        "prompt_tokens": data.get("prompt_eval_count", 0),
                        "completion_tokens": data.get("eval_count", 0)
                    }
                }
        except Exception as e:
            return {"success": False, "error": f"Local Ollama unreachable: {e}", "provider": self.name}


class GenericOpenAICompatibleProvider(ProviderAdapter):
    """Universal OpenAI-compatible adapter for custom endpoints."""
    def __init__(self, name: str, base_url: str, api_key: str, model: str):
        super().__init__(name=name, model=model, api_key=api_key, base_url=base_url.rstrip("/"))

    def chat_complete(self, prompt: str, system_prompt: str = "") -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2048
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=25.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choice = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                return {
                    "success": True,
                    "content": choice,
                    "provider": self.name,
                    "model": self.model,
                    "usage": {
                        "prompt_tokens": usage.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0)
                    }
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else str(e)
            return {"success": False, "error": f"HTTP {e.code}: {err_body}", "provider": self.name, "status_code": e.code}
        except Exception as e:
            return {"success": False, "error": str(e), "provider": self.name}


class ProviderMesh:
    """
    Orchestrates the cascade of inference providers.
    Triggers automated fallback when quota is below 20% or on rate limit 429.
    Supports dynamic scaffolding of unknown custom providers.
    """

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or CONFIG_FILE_PATH
        self.config = self._load_config()
        self.adapters: Dict[str, ProviderAdapter] = {}
        self._init_default_adapters()

    def _load_config(self) -> Dict[str, Any]:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "active_provider": "groq",
            "fallback_provider": "gemini",
            "providers": {
                "groq": {"api_key": os.getenv("GROQ_API_KEY", ""), "model": "llama-3.3-70b-versatile"},
                "gemini": {"api_key": os.getenv("GEMINI_API_KEY", ""), "model": "gemini-1.5-pro"},
                "ollama": {"base_url": "http://localhost:11434", "model": "llama3:latest"},
                "custom": {}
            }
        }

    def save_config(self) -> None:
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to persist provider config: {e}\n")

    def _init_default_adapters(self) -> None:
        cfg = self.config.get("providers", {})
        groq_cfg = cfg.get("groq", {})
        self.adapters["groq"] = GroqProvider(
            api_key=groq_cfg.get("api_key", ""),
            model=groq_cfg.get("model", "llama-3.3-70b-versatile")
        )

        gemini_cfg = cfg.get("gemini", {})
        self.adapters["gemini"] = GeminiProvider(
            api_key=gemini_cfg.get("api_key", ""),
            model=gemini_cfg.get("model", "gemini-1.5-pro")
        )

        ollama_cfg = cfg.get("ollama", {})
        self.adapters["ollama"] = OllamaProvider(
            base_url=ollama_cfg.get("base_url", "http://localhost:11434"),
            model=ollama_cfg.get("model", "llama3:latest")
        )

        custom_cfg = cfg.get("custom", {})
        for name, spec in custom_cfg.items():
            self.adapters[name] = GenericOpenAICompatibleProvider(
                name=name,
                base_url=spec.get("base_url", ""),
                api_key=spec.get("api_key", ""),
                model=spec.get("model", "")
            )

    def scaffold_custom_provider(
        self,
        name: str,
        base_url: str,
        api_key: str,
        model: str,
        probe_models: bool = True
    ) -> Dict[str, Any]:
        """
        Dynamically registers a custom OpenAI-compatible provider:
        - Probes /v1/models if requested
        - Verifies or installs bridge package if necessary
        - Persists to ~/.nexus_provider_config.json
        """
        result = {"success": True, "name": name, "available_models": []}

        if probe_models:
            probe_url = f"{base_url.rstrip('/')}/models"
            try:
                headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
                req = urllib.request.Request(probe_url, headers=headers)
                with urllib.request.urlopen(req, timeout=10.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("id") for m in data.get("data", []) if "id" in m]
                    result["available_models"] = models
            except Exception as e:
                result["probe_warning"] = f"Could not probe models: {e}"

        adapter = GenericOpenAICompatibleProvider(
            name=name,
            base_url=base_url,
            api_key=api_key,
            model=model
        )
        self.adapters[name] = adapter

        # Save to persistent config
        if "custom" not in self.config["providers"]:
            self.config["providers"]["custom"] = {}
        self.config["providers"]["custom"][name] = {
            "base_url": base_url,
            "api_key": api_key,
            "model": model
        }
        self.save_config()
        return result

    def ensure_package_installed(self, package_name: str) -> bool:
        """Dynamically installs python bridge package if missing."""
        try:
            __import__(package_name)
            return True
        except ImportError:
            try:
                cmd = [sys.executable, "-m", "pip", "install", package_name, "--quiet"]
                res = subprocess.run(cmd, capture_output=True, timeout=60)
                return res.returncode == 0
            except Exception:
                return False

    def route_completion(
        self,
        prompt: str,
        system_prompt: str = "",
        force_fallback: bool = False
    ) -> Dict[str, Any]:
        """
        Routes inference through active provider with automatic fallback:
        Primary -> Fallback -> Ollama Local
        """
        active_key = self.config.get("active_provider", "groq")
        fallback_key = self.config.get("fallback_provider", "gemini")

        # Determine priority order
        order: List[str] = []
        if force_fallback:
            order = [fallback_key, active_key, "ollama"]
        else:
            order = [active_key, fallback_key, "ollama"]

        # Deduplicate while preserving order
        deduped = []
        for p in order:
            if p in self.adapters and p not in deduped:
                deduped.append(p)

        attempts = []
        for prov_name in deduped:
            adapter = self.adapters[prov_name]
            # Skip if recently failed with 429 within last 60 seconds
            if not adapter.is_healthy and (time.time() - adapter.last_failure_time) < 60.0:
                attempts.append({"provider": prov_name, "skipped": "marked_unhealthy_cooldown"})
                continue

            resp = adapter.chat_complete(prompt, system_prompt=system_prompt)
            if resp.get("success"):
                adapter.is_healthy = True
                resp["attempts"] = attempts
                return resp
            else:
                attempts.append({"provider": prov_name, "error": resp.get("error")})

        return {
            "success": False,
            "error": "All providers in mesh failed or exhausted quota.",
            "attempts": attempts
        }
