import unittest
import asyncio
from backend.core.models import ThreadContext, ChatMessage, EvidenceLabel
from backend.core.analyzer import ScribeBAAnalyzer
from backend.integrations.clickup_client import ClickUpClient
from backend.core.skills import SkillManager


class TestAnalyzerAndClickUp(unittest.TestCase):
    def setUp(self):
        self.thread = ThreadContext(
            thread_id="th-12345",
            channel="dev-enterprise",
            messages=[
                ChatMessage(
                    author="@alex",
                    timestamp="10:00",
                    text="We need Google SSO for Acme Corp engineers.",
                ),
                ChatMessage(
                    author="@oliver",
                    timestamp="10:05",
                    text="Must restrict to @acmecorp.com and default role Engineer.",
                ),
            ],
        )
        self.analyzer = ScribeBAAnalyzer()
        self.clickup = ClickUpClient()
        self.sm = SkillManager()

    def test_analyzer_lean_mode(self):
        result = asyncio.run(
            self.analyzer.analyze_thread(self.thread, skill_name="startup_lean")
        )
        self.assertIsNotNone(result.story)
        self.assertTrue(result.story.title.startswith("[MVP]"))
        self.assertGreaterEqual(result.invest_score.overall, 80)
        self.assertGreater(len(result.acceptance_criteria), 0)
        self.assertIn("hours", result.clarifying_question)

    def test_analyzer_agency_mode(self):
        result = asyncio.run(
            self.analyzer.analyze_thread(self.thread, skill_name="agency_detailed")
        )
        self.assertIsNotNone(result.story)
        self.assertTrue(result.story.title.startswith("[Feature-Spec]"))
        self.assertTrue(
            any(e.label == EvidenceLabel.BLOCKED for e in result.evidence_items)
        )
        self.assertIn("Contractual", result.clarifying_question)

    def test_clickup_ticket_creation(self):
        # Forced offline: this test must not create a task in the team's real ClickUp list.
        from backend.config import settings
        previous, settings.scribeba_mode = settings.scribeba_mode, "local"
        self.addCleanup(setattr, settings, "scribeba_mode", previous)
        result = asyncio.run(
            self.analyzer.analyze_thread(self.thread, skill_name="startup_lean")
        )
        skill = self.sm.get_skill("startup_lean")
        ticket = asyncio.run(
            self.clickup.create_task_from_analysis(
                result, skill, "slack://thread/1789201948"
            )
        )
        self.assertTrue(ticket.created_task_id.startswith("CLK-"))
        self.assertIn("clickup.com", ticket.clickup_url)
        self.assertEqual(ticket.title, result.story.title)
        self.assertIn("INVEST", ticket.description_markdown)


if __name__ == "__main__":
    unittest.main()
