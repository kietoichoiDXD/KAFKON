import unittest
import asyncio
from backend.platforms.telegram_adapter import TelegramAdapter
from backend.core.analyzer import ScribeBAAnalyzer
from backend.core.models import TicketPayload, EvidenceLabel

class TestTelegramAdapter(unittest.TestCase):
    def setUp(self):
        self.adapter = TelegramAdapter(bot_token=None)
        self.analyzer = ScribeBAAnalyzer()

    def test_record_and_fetch_thread(self):
        self.adapter.record_incoming_message("chat-999", "@bob", "We need Google SSO.")
        self.adapter.record_incoming_message("chat-999", "@alice", "Yes, with @acme.com restriction.")

        thread = asyncio.run(self.adapter.fetch_thread("chat-999", "msg-101"))
        self.assertEqual(thread.platform, "telegram")
        self.assertEqual(len(thread.messages), 2)
        self.assertEqual(thread.messages[0].author, "@bob")

    def test_format_and_post_summary_mock(self):
        thread = asyncio.run(self.adapter.fetch_thread("chat-mock", "msg-1"))
        result = asyncio.run(self.analyzer.analyze_thread(thread, skill_name="startup_lean"))

        html = self.adapter.format_telegram_html(result)
        self.assertIn("<b>ScribeBA:", html)
        self.assertIn("INVEST Score:", html)
        self.assertIn("Acceptance Criteria:", html)

        msg_id = asyncio.run(self.adapter.post_analysis_summary("chat-mock", "msg-1", result))
        self.assertEqual(msg_id, "mock-tg-msg-id-1001")

    def test_post_clarification_and_confirmation(self):
        q_id = asyncio.run(self.adapter.post_clarification_question(
            "chat-mock", "msg-1", "Should session timeout be 8h or 24h?"
        ))
        self.assertEqual(q_id, "mock-tg-question-id")

        ticket = TicketPayload(
            title="[MVP] Google Workspace SSO",
            description_markdown="Ticket specs",
            created_task_id="CLK-TG-888",
            clickup_url="https://app.clickup.com/t/clk-tg-888",
            thread_link="tg://chat/999/1"
        )
        c_id = asyncio.run(self.adapter.post_ticket_confirmation("chat-mock", "msg-1", ticket))
        self.assertEqual(c_id, "mock-tg-confirm-id")

if __name__ == "__main__":
    unittest.main()
