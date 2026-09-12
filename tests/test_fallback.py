import unittest
import asyncio
from backend.core.fallback_router import ModelFallbackRouter, FallbackTier
from backend.core.models import ThreadContext, ChatMessage, SkillConfig

class TestModelFallbackRouter(unittest.TestCase):
    def setUp(self):
        self.router = ModelFallbackRouter()
        self.skill = SkillConfig(name="startup_lean", team_type="early_stage_startup")
        self.thread = ThreadContext(
            thread_id="th-fallback",
            channel="dev-test",
            messages=[
                ChatMessage(author="@user", timestamp="now", text="Implement SSO")
            ]
        )

    def test_tier_chains_contain_requested_models(self):
        # Must contain: gpt, luna, sonet, 5, gpt sol
        for tier in [FallbackTier.LOW, FallbackTier.MEDIUM, FallbackTier.HIGH]:
            chain = self.router.get_chain_for_tier(tier.value)
            aliases = [item["alias"] for item in chain]
            self.assertIn("gpt", aliases)
            self.assertIn("luna", aliases)
            self.assertIn("sonet", aliases)
            self.assertIn("5", aliases)
            self.assertIn("gpt sol", aliases)

    def test_low_tier_uses_cost_effective_models(self):
        low_chain = self.router.get_chain_for_tier("low")
        gpt_item = next(item for item in low_chain if item["alias"] == "gpt")
        self.assertEqual(gpt_item["model"], "gpt-4o-mini")

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

if __name__ == "__main__":
    unittest.main()
