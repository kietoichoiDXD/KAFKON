import unittest
from backend.config import settings
import asyncio
from backend.core.fallback_router import ModelFallbackRouter, FallbackTier, parse_model_json
from backend.core.models import ThreadContext, ChatMessage, SkillConfig

class TestModelFallbackRouter(unittest.TestCase):
    def setUp(self):
        self.router = ModelFallbackRouter()
        # Offline by default: the cascade must be exercised against its own logic, not against a
        # paid endpoint. test_live_path.py covers the live branch with the HTTP call replaced.
        for name in ("scribeba_mode", "openrouter_api_key", "anthropic_api_key",
                     "openai_api_key", "nebius_api_key"):
            self.addCleanup(setattr, settings, name, getattr(settings, name))
        settings.scribeba_mode = "local"
        settings.openrouter_api_key = None
        settings.anthropic_api_key = None
        settings.openai_api_key = None
        settings.nebius_api_key = None

        self.skill = SkillConfig(name="startup_lean", team_type="early_stage_startup")
        self.thread = ThreadContext(
            thread_id="th-fallback",
            channel="dev-test",
            messages=[
                ChatMessage(author="@user", timestamp="now", text="Implement SSO")
            ]
        )

    def test_every_tier_ends_at_a_direct_anthropic_backup(self):
        for tier in [FallbackTier.LOW, FallbackTier.MEDIUM, FallbackTier.HIGH]:
            chain = self.router.get_chain_for_tier(tier.value)
            aliases = [item["alias"] for item in chain]
            self.assertEqual(aliases[0], "openrouter_primary")
            self.assertIn("anthropic_direct", aliases)

    def test_openrouter_ids_are_namespaced(self):
        """An id without a vendor prefix is not an OpenRouter id and will 404 silently."""
        for tier in [FallbackTier.LOW, FallbackTier.MEDIUM, FallbackTier.HIGH]:
            for item in self.router.get_chain_for_tier(tier.value):
                if item["provider"] == "openrouter":
                    self.assertIn("/", item["model"], f"{item['model']} is not an OpenRouter id")

    def test_low_tier_uses_cost_effective_models(self):
        low_chain = self.router.get_chain_for_tier("low")
        primary = low_chain[0]
        self.assertEqual(primary["model"], "anthropic/claude-haiku-4.5")

    def test_high_tier_uses_advanced_reasoners(self):
        high_chain = self.router.get_chain_for_tier("high")
        luna_item = next(item for item in high_chain if item["alias"] == "luna")
        self.assertIn("deepseek", luna_item["model"])

    def test_local_engine_fallback_when_offline(self):
        parsed, trail = asyncio.run(
            self.router.execute_with_fallback(
                system_prompt="System",
                user_prompt="User",
                thread=self.thread,
                skill=self.skill,
                tier="medium"
            )
        )
        self.assertTrue(len(trail) > 0)
        final_step = trail[-1]
        self.assertEqual(final_step["alias"], "local_engine")
        self.assertEqual(final_step["status"], "success")

    def test_model_json_survives_fences_and_prose(self):
        """The commonest way a live run silently degrades: JSON the model wrapped in something."""
        self.assertEqual(parse_model_json('```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(parse_model_json('Here you go:\n{"a": 1}\nhope that helps'), {"a": 1})
        self.assertEqual(parse_model_json('{"a": 1}'), {"a": 1})

if __name__ == "__main__":
    unittest.main()
