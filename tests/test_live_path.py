"""The live path, exercised without a model key.

Everything else in this suite runs through `_analyze_local`, which builds the Pydantic objects by
hand. The code that turns a *model's* JSON into those objects had never executed, so a schema the
model follows faithfully could still raise - and the cascade's `except Exception` would swallow it
and quietly return the local result instead. This test is the one that asserts the goal: put a
key in, get a real analysis out.
"""
import asyncio
import unittest

from backend.config import settings
from backend.core.analyzer import ScribeBAAnalyzer
from backend.core.models import ChatMessage, ThreadContext

# Built literally from the schema in the analyzer's system prompt - if the prompt and the models
# disagree, this is where it shows.
MODEL_RESPONSE = {
    "story": {
        "title": "[MVP] Google Workspace SSO",
        "as_a": "enterprise engineer",
        "i_want": "to sign in with my corporate Google account",
        "so_that": "onboarding needs no separate password",
        "evidence": "Verified",
    },
    "acceptance_criteria": [
        {
            "id": "AC-1",
            "scenario": "Authorized domain login",
            "given": "a user at @acmecorp.com",
            "when": "they complete the OAuth flow",
            "then": "they are provisioned with the Engineer role",
            "evidence": "Verified",
        }
    ],
    "evidence_items": [
        {
            "field": "Domain Restriction",
            "value": "@acmecorp.com",
            "label": "Verified",
            "quote_source": "@oliver_sec: 'restrict authentication strictly to @acmecorp.com'",
            "rationale": "Stated by the security lead.",
        },
        {
            "field": "Idle Session Timeout",
            "value": "8 hours",
            "label": "Assumed",
            "quote_source": "@alex_lead: 'Nobody answered the session expiration question yet.'",
            "rationale": "Suggested, never agreed.",
        },
    ],
    "clarifying_question": "Should idle sessions expire at 8 or 24 hours?",
    "ready_for_ticket": False,
}


class TestLiveAnalysisPath(unittest.TestCase):
    def setUp(self):
        self.analyzer = ScribeBAAnalyzer()
        self.thread = ThreadContext(
            thread_id="th-live",
            channel="dev-test",
            messages=[
                ChatMessage(author="@alex_lead", timestamp="10:15", text="We must implement Google Workspace SSO."),
                ChatMessage(author="@oliver_sec", timestamp="10:17", text="Restrict authentication strictly to @acmecorp.com."),
            ],
        )
        # Pretend a key is present; the HTTP call itself is replaced below.
        self._previous_key = settings.openrouter_api_key
        settings.openrouter_api_key = "test-key"
        self.addCleanup(setattr, settings, "openrouter_api_key", self._previous_key)

        async def fake_call(client, model, system, user):
            self.sent_prompt = user
            return MODEL_RESPONSE

        self.analyzer.fallback_router._call_openrouter = fake_call

    def test_model_json_becomes_a_scored_analysis(self):
        result = asyncio.run(self.analyzer.analyze_thread(self.thread, skill_name="startup_lean"))

        trail = result.metadata.get("fallback_trail") or []
        self.assertTrue(trail, "no fallback trail recorded")
        self.assertEqual(trail[-1]["alias"], "openrouter_primary",
                         f"live path did not produce the result; trail={trail}")

        self.assertEqual(result.story.title, "[MVP] Google Workspace SSO")
        self.assertEqual(len(result.acceptance_criteria), 1)
        self.assertEqual([e.label.value for e in result.evidence_items], ["Verified", "Assumed"])
        self.assertGreater(result.invest_score.overall, 0)
        self.assertIn("8 or 24 hours", result.clarifying_question)

    def test_transcript_is_redacted_before_it_is_sent(self):
        self.thread.messages.append(
            ChatMessage(author="@tony_db", timestamp="10:20", text="token xoxb-1234567890-abcdefghijkl for the bot")
        )
        asyncio.run(self.analyzer.analyze_thread(self.thread, skill_name="startup_lean"))
        self.assertNotIn("xoxb-1234567890", self.sent_prompt)
        self.assertIn("[REDACTED_SLACK_TOKEN]", self.sent_prompt)


if __name__ == "__main__":
    unittest.main()
