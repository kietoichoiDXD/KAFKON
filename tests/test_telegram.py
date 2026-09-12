import unittest
from backend.config import settings
import asyncio
from backend.platforms.telegram_adapter import TelegramAdapter
from backend.core.analyzer import ScribeBAAnalyzer
from backend.core.models import TicketPayload, EvidenceLabel

class TestTelegramAdapter(unittest.TestCase):
    def setUp(self):
        # Offline: these assert the adapter's formatting, not a model's wording.
        for name in ("scribeba_mode", "openrouter_api_key", "anthropic_api_key",
                     "openai_api_key", "nebius_api_key"):
            self.addCleanup(setattr, settings, name, getattr(settings, name))
        settings.scribeba_mode = "local"
        settings.openrouter_api_key = None
        settings.anthropic_api_key = None
        settings.openai_api_key = None
        settings.nebius_api_key = None
        self.adapter = TelegramAdapter(bot_token=None)
        self.analyzer = ScribeBAAnalyzer()

    def test_record_and_fetch_thread(self):
        self.adapter.record_incoming_message("chat-999", "@bob", "We need Google SSO.")
        self.adapter.record_incoming_message("chat-999", "@alice", "Yes, with @acme.com restriction.")

        thread = asyncio.run(self.adapter.fetch_thread("chat-999", "msg-101"))
        self.assertEqual(thread.platform, "telegram")
        self.assertEqual(len(thread.messages), 2)
        self.assertEqual(thread.messages[0].author, "@bob")

    def test_formatting_does_not_need_a_token(self):
        thread = asyncio.run(self.adapter.fetch_thread("chat-mock", "msg-1"))
        result = asyncio.run(self.analyzer.analyze_thread(thread, skill_name="startup_lean"))

        html = self.adapter.format_telegram_html(result)
        self.assertIn("<b>ScribeBA:", html)
        self.assertIn("INVEST Score:", html)
        self.assertIn("Acceptance Criteria:", html)

        # Sending without a token must fail loudly. Returning a fake message id told the caller
        # a message had been delivered when nothing left the process.
        with self.assertRaises(RuntimeError) as ctx:
            asyncio.run(self.adapter.post_analysis_summary("chat-mock", "msg-1", result))
        self.assertIn("TELEGRAM_BOT_TOKEN", str(ctx.exception))

    def test_sending_without_a_token_is_refused(self):
        with self.assertRaises(RuntimeError):
            asyncio.run(self.adapter.post_clarification_question(
                "chat-mock", "msg-1", "Should session timeout be 8h or 24h?"
            ))

        ticket = TicketPayload(
            title="[MVP] Google Workspace SSO",
            description_markdown="Ticket specs",
            created_task_id="CLK-TG-888",
            clickup_url="https://app.clickup.com/t/clk-tg-888",
            thread_link="tg://chat/999/1"
        )
        with self.assertRaises(RuntimeError):
            asyncio.run(self.adapter.post_ticket_confirmation("chat-mock", "msg-1", ticket))

if __name__ == "__main__":
    unittest.main()
