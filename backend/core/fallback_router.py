import asyncio
import json
import re
import logging
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
import httpx
from .models import (
    ThreadContext,
    AnalysisResult,
    UserStory,
    AcceptanceCriterion,
    EvidenceItem,
    EvidenceLabel,
    SkillConfig,
)
from .scorer import InvestScorer
from ..config import settings

logger = logging.getLogger("scribeba.fallback")

def parse_model_json(raw_text: str) -> Dict[str, Any]:
    """Models return JSON wrapped in prose or a ```json fence often enough to matter.

    A bare json.loads on that raises, the cascade treats it as a dead model, and the run degrades
    to the local engine without anyone noticing. Pull the outermost object out instead.
    """
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"```\s*$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise
        return json.loads(text[start:end + 1])


class FallbackTier(str, Enum):
    LOW = "low"         # Minimum cost & latency (triage / lightweight)
    MEDIUM = "medium"   # Balanced (standard agile specification)
    HIGH = "high"       # Maximum reasoning (deep compliance, strict INVEST)

class ModelFallbackRouter:
    """Intelligent multi-tier fallback orchestrator.
    
    When a model is out of credit (402), rate limited (429) or otherwise unreachable, the chain
    moves on:
        [OpenRouter primary -> OpenRouter alternates -> Anthropic direct -> local engine]
    """

    # Every id below was checked against GET https://openrouter.ai/api/v1/models on 2026-09-12.
    # Do not add an id without checking it there first: an unknown id 404s, the cascade eats the
    # error, and the run silently degrades to the local engine.
    TIER_MODEL_MAP: Dict[FallbackTier, List[Dict[str, str]]] = {
        FallbackTier.LOW: [
            {"alias": "openrouter_primary", "model": "anthropic/claude-haiku-4.5",  "provider": "openrouter"},
            {"alias": "luna",               "model": "meta-llama/llama-3.1-8b-instruct", "provider": "openrouter"},
            {"alias": "sol",                "model": "qwen/qwen-2.5-7b-instruct",   "provider": "openrouter"},
            {"alias": "anthropic_direct",   "model": "claude-haiku-4-5",            "provider": "anthropic"},
        ],
        FallbackTier.MEDIUM: [
            {"alias": "openrouter_primary", "model": "anthropic/claude-sonnet-5",   "provider": "openrouter"},
            {"alias": "luna",               "model": "meta-llama/llama-3.1-70b-instruct", "provider": "openrouter"},
            {"alias": "sol",                "model": "deepseek/deepseek-chat-v3.1", "provider": "openrouter"},
            {"alias": "anthropic_direct",   "model": "claude-sonnet-5",             "provider": "anthropic"},
        ],
        FallbackTier.HIGH: [
            {"alias": "openrouter_primary", "model": "anthropic/claude-opus-5",     "provider": "openrouter"},
            {"alias": "luna",               "model": "deepseek/deepseek-r1",        "provider": "openrouter"},
            {"alias": "sol",                "model": "google/gemini-2.5-pro",       "provider": "openrouter"},
            {"alias": "anthropic_direct",   "model": "claude-opus-5",               "provider": "anthropic"},
        ]
    }

    def __init__(self):
        self.http_timeout = 25.0

    def get_chain_for_tier(self, tier_name: str) -> List[Dict[str, str]]:
        tier_key = FallbackTier.MEDIUM
        try:
            tier_key = FallbackTier(tier_name.lower())
        except ValueError:
            if tier_name.lower() in ("minimum", "min"):
                tier_key = FallbackTier.LOW

        return self.TIER_MODEL_MAP.get(tier_key, self.TIER_MODEL_MAP[FallbackTier.MEDIUM])

    async def execute_with_fallback(
        self,
        system_prompt: str,
        user_prompt: str,
        thread: ThreadContext,
        skill: SkillConfig,
        tier: str = "medium"
    ) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
        """Execute LLM call across the fallback cascade.
        
        Returns:
            (parsed_json_result, fallback_audit_trail)
        """
        chain = self.get_chain_for_tier(tier)
        audit_trail: List[Dict[str, Any]] = []

        # If running in explicit local mode without any API keys, skip straight to local
        has_any_key = bool(settings.openrouter_api_key or settings.openai_api_key or settings.anthropic_api_key)
        if settings.scribeba_mode == "local" and not has_any_key:
            audit_trail.append({
                "step": 1,
                "alias": "local_engine",
                "model": "deterministic_offline_orchestrator",
                "status": "success",
                "reason": "Running in local offline mode"
            })
            return None, audit_trail

        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            for idx, item in enumerate(chain, 1):
                alias = item["alias"]
                model_id = item["model"]
                provider = item["provider"]

                try:
                    # Attempt provider call
                    if provider == "openrouter":
                        if not settings.openrouter_api_key:
                            audit_trail.append({"step": idx, "alias": alias, "model": model_id, "status": "skipped", "reason": "No OPENROUTER_API_KEY"})
                            continue

                        result = await self._call_openrouter(client, model_id, system_prompt, user_prompt)
                        audit_trail.append({"step": idx, "alias": alias, "model": model_id, "status": "success", "provider": "openrouter"})
                        return result, audit_trail

                    elif provider == "openai":
                        if not settings.openai_api_key:
                            audit_trail.append({"step": idx, "alias": alias, "model": model_id, "status": "skipped", "reason": "No OPENAI_API_KEY"})
                            continue

                        result = await self._call_openai(client, model_id, system_prompt, user_prompt)
                        audit_trail.append({"step": idx, "alias": alias, "model": model_id, "status": "success", "provider": "openai_direct"})
                        return result, audit_trail

                    elif provider == "anthropic":
                        if not settings.anthropic_api_key:
                            audit_trail.append({"step": idx, "alias": alias, "model": model_id, "status": "skipped", "reason": "No ANTHROPIC_API_KEY"})
                            continue

                        result = await self._call_anthropic(client, model_id, system_prompt, user_prompt)
                        audit_trail.append({"step": idx, "alias": alias, "model": model_id, "status": "success", "provider": "anthropic_direct"})
                        return result, audit_trail

                except httpx.HTTPStatusError as e:
                    status = e.response.status_code
                    reason = "Out of tokens (402 Payment Required)" if status == 402 else "Rate limited (429)" if status == 429 else f"HTTP {status}"
                    print(f"⚠️ [Fallback Triggered] {alias} ({model_id}) failed with {reason}. Cascading to next candidate...")
                    audit_trail.append({
                        "step": idx,
                        "alias": alias,
                        "model": model_id,
                        "status": "failed",
                        "status_code": status,
                        "reason": reason
                    })
                except Exception as e:
                    print(f"⚠️ [Fallback Triggered] {alias} ({model_id}) error: {e}. Cascading...")
                    audit_trail.append({
                        "step": idx,
                        "alias": alias,
                        "model": model_id,
                        "status": "failed",
                        "reason": str(e)
                    })

        # All network models exhausted -> Ultimate local fallback
        audit_trail.append({
            "step": len(chain) + 1,
            "alias": "local_engine",
            "model": "deterministic_offline_orchestrator",
            "status": "success",
            "reason": "All remote models exhausted (zero-downtime safety net)"
        })
        return None, audit_trail

    async def _call_openrouter(self, client: httpx.AsyncClient, model: str, system: str, user: str) -> Dict[str, Any]:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "HTTP-Referer": "https://github.com/kietoichoiDXD/KAFKON",
                "X-Title": "ScribeBA AI Tinkerers",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user}
                ]
            }
        )
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["choices"][0]["message"]["content"]
        return parse_model_json(raw_text)

    async def _call_openai(self, client: httpx.AsyncClient, model: str, system: str, user: str) -> Dict[str, Any]:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user}
                ]
            }
        )
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["choices"][0]["message"]["content"]
        return parse_model_json(raw_text)

    async def _call_anthropic(self, client: httpx.AsyncClient, model: str, system: str, user: str) -> Dict[str, Any]:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key or "",
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": model,
                "max_tokens": 2048,
                "system": system,
                "messages": [
                    {"role": "user", "content": user}
                ]
            }
        )
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["content"][0]["text"]
        return parse_model_json(raw_text)
