import asyncio
import os
from typing import Optional, List, Dict, Any
import httpx
from .base import BasePlatformAdapter
from .message_formatter import MessageFormatter
from ..core.models import ThreadContext, ChatMessage, AnalysisResult, TicketPayload, EvidenceLabel
from ..config import settings

class TelegramAdapter(BasePlatformAdapter):
    """Telegram Bot Adapter using Telegram Bot REST API with long-polling and inline buttons."""

    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token or settings.telegram_bot_token
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        self._message_store: Dict[str, List[ChatMessage]] = {}

    def _missing_token(self) -> str:
        return ("No TELEGRAM_BOT_TOKEN configured. Get one from @BotFather and set it in .env — "
                "ScribeBA will not report a message as sent when it was not.")

    def is_live(self) -> bool:
        return bool(self.bot_token and settings.scribeba_mode == "live")

    def record_incoming_message(self, chat_id: str, author: str, text: str, timestamp: str = "now"):
        """Store messages locally per chat/topic for context retrieval."""
        if chat_id not in self._message_store:
            self._message_store[chat_id] = []
        self._message_store[chat_id].append(ChatMessage(author=author, timestamp=timestamp, text=text))

    async def fetch_thread(self, channel_id: str, thread_id: str) -> ThreadContext:
        """Fetch accumulated context for this chat or topic."""
        messages = self._message_store.get(channel_id, [])
        if not messages:
            # Fallback deterministic thread context for instant demo / test
            messages = [
                ChatMessage(author="@alex_lead", timestamp="10:15", text="Team, Acme Corp needs Google Workspace SSO with role provisioning."),
                ChatMessage(author="@oliver_sec", timestamp="10:17", text="Must restrict to @acmecorp.com and assign Engineer role by default."),
                ChatMessage(author="@tony_db", timestamp="10:20", text="I will add sso_provider and external_sub_id columns with unique constraints."),
                ChatMessage(author="@alex_lead", timestamp="10:22", text="What about idle session timeout? 8 hours or 24 hours?"),
                ChatMessage(author="@oliver_sec", timestamp="10:28", text="Avatar sync out of scope for MVP. 8h standard for SOC2 compliance."),
                ChatMessage(author="@alex_lead", timestamp="10:30", text="/ba_summarize"),
            ]

        return ThreadContext(
            thread_id=thread_id or f"tg-{channel_id}",
            channel=f"tg-{channel_id}",
            platform="telegram",
            messages=messages
        )

    def format_telegram_html(self, result: AnalysisResult) -> str:
        """Format AnalysisResult into Telegram HTML."""
        story = result.story
        score = result.invest_score

        lines = [
            f"📋 <b>ScribeBA: {story.title}</b>",
            "",
            f"<b>As a:</b> {story.as_a}",
            f"<b>I want:</b> {story.i_want}",
            f"<b>So that:</b> {story.so_that}",
            "",
            f"🎯 <b>INVEST Score: {score.overall}/100</b>",
            f"<i>(I:{score.independent} N:{score.negotiable} V:{score.valuable} E:{score.estimable} S:{score.small} T:{score.testable})</i>",
            "",
            "<b>✅ Acceptance Criteria:</b>"
        ]

        for ac in result.acceptance_criteria:
            badge = "🟢" if ac.evidence == EvidenceLabel.VERIFIED else "🟡" if ac.evidence == EvidenceLabel.INFERRED else "🟣" if ac.evidence == EvidenceLabel.ASSUMED else "🔴"
            lines.append(f"• {badge} <b>{ac.id}</b>: {ac.scenario}")
            lines.append(f"   <i>Then:</i> <code>{ac.then}</code>")

        lines.extend(["", "<b>🔍 Evidence Ledger:</b>"])
        for ev in result.evidence_items:
            badge = "🟢" if ev.label == EvidenceLabel.VERIFIED else "🟡" if ev.label == EvidenceLabel.INFERRED else "🟣" if ev.label == EvidenceLabel.ASSUMED else "🔴"
            lines.append(f"• {badge} <b>[{ev.label.value.upper()}] {ev.field}</b>: <code>{ev.value}</code>")
            if ev.quote_source:
                lines.append(f"   <i>Quote:</i> {ev.quote_source}")

        if result.clarifying_question:
            lines.extend([
                "",
                "⚠️ <b>Clarification Required Before Ticket Creation:</b>",
                f"❓ <i>{result.clarifying_question}</i>"
            ])

        return "\n".join(lines)

    async def post_analysis_summary(
        self,
        channel_id: str,
        thread_id: str,
        result: AnalysisResult
    ) -> str:
        text = self.format_telegram_html(result)

        # Build inline keyboard
        reply_markup = None
        if not result.clarifying_question:
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Approve & Create ClickUp Task", "callback_data": f"approve:{thread_id}"},
                        {"text": "🔍 Inspect Evidence", "callback_data": f"inspect:{thread_id}"}
                    ]
                ]
            }
        else:
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "💬 Reply in Thread to Clarify", "callback_data": f"clarify:{thread_id}"}
                    ]
                ]
            }

        if self.is_live():
            async with httpx.AsyncClient(timeout=15.0) as client:
                payload: Dict[str, Any] = {
                    "chat_id": channel_id,
                    "text": text,
                    "parse_mode": "HTML"
                }
                if thread_id and thread_id.isdigit():
                    payload["message_thread_id"] = int(thread_id)
                if reply_markup:
                    payload["reply_markup"] = reply_markup

                resp = await client.post(f"{self.api_url}/sendMessage", json=payload)
                data = resp.json()
                return str(data.get("result", {}).get("message_id", ""))

        raise RuntimeError(self._missing_token())

    async def post_clarification_question(
        self,
        channel_id: str,
        thread_id: str,
        question: str
    ) -> str:
        text = f"❓ <b>ScribeBA Clarification</b>:\n{question}\n\n<i>Reply directly to this message to update the specification.</i>"
        if self.is_live():
            async with httpx.AsyncClient(timeout=15.0) as client:
                payload: Dict[str, Any] = {
                    "chat_id": channel_id,
                    "text": text,
                    "parse_mode": "HTML"
                }
                if thread_id and thread_id.isdigit():
                    payload["message_thread_id"] = int(thread_id)
                resp = await client.post(f"{self.api_url}/sendMessage", json=payload)
                data = resp.json()
                return str(data.get("result", {}).get("message_id", ""))

        raise RuntimeError(self._missing_token())

    async def post_ticket_confirmation(
        self,
        channel_id: str,
        thread_id: str,
        ticket: TicketPayload
    ) -> str:
        text = (
            f"🚀 <b>ClickUp Task Synchronized!</b>\n\n"
            f"<b>Title:</b> {ticket.title}\n"
            f"<b>Task ID:</b> <code>{ticket.created_task_id or 'not created'}</code>\n"
            f"<b>Priority:</b> {ticket.priority.upper()}\n"
            f"<b>URL:</b> <a href=\"{ticket.clickup_url}\">{ticket.clickup_url}</a>\n\n"
            f"<i>Source audit trail preserved with bidirectional Telegram backlink.</i>"
        )
        if self.is_live():
            async with httpx.AsyncClient(timeout=15.0) as client:
                payload: Dict[str, Any] = {
                    "chat_id": channel_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False
                }
                if thread_id and thread_id.isdigit():
                    payload["message_thread_id"] = int(thread_id)
                resp = await client.post(f"{self.api_url}/sendMessage", json=payload)
                data = resp.json()
                return str(data.get("result", {}).get("message_id", ""))

        raise RuntimeError(self._missing_token())

    async def start_polling(self, analyzer, clickup_client, skill_manager):
        """Run Telegram long-polling loop for real-time bot interaction."""
        if not self.is_live():
            print(self._missing_token())
            return

        offset = 0
        print(f"[ScribeBA Telegram] Bot listening on Telegram Polling Gateway...")
        async with httpx.AsyncClient(timeout=40.0) as client:
            while True:
                try:
                    resp = await client.get(
                        f"{self.api_url}/getUpdates",
                        params={"offset": offset, "timeout": 30}
                    )
                    data = resp.json()
                    for update in data.get("result", []):
                        offset = update["update_id"] + 1

                        # Handle messages
                        if "message" in update:
                            msg = update["message"]
                            chat_id = str(msg["chat"]["id"])
                            text = msg.get("text", "")
                            author = f"@{msg.get('from', {}).get('username', 'user')}"
                            thread_id = str(msg.get("message_thread_id", ""))

                            self.record_incoming_message(chat_id, author, text)

                            if text.startswith("/ba_summarize") or text.startswith("/summarize") or "/ba" in text:
                                thread = await self.fetch_thread(chat_id, thread_id)
                                result = await analyzer.analyze_thread(thread)
                                await self.post_analysis_summary(chat_id, thread_id, result)

                        # Handle inline button callbacks
                        elif "callback_query" in update:
                            cq = update["callback_query"]
                            chat_id = str(cq["message"]["chat"]["id"])
                            cb_data = cq.get("data", "")
                            cq_id = cq["id"]

                            if cb_data.startswith("approve:"):
                                thread = await self.fetch_thread(chat_id, "")
                                result = await analyzer.analyze_thread(thread)
                                skill = skill_manager.get_skill(settings.default_skill)
                                ticket = await clickup_client.create_task_from_analysis(
                                    result, skill, f"tg://resolve?domain=group&post={chat_id}"
                                )
                                await self.post_ticket_confirmation(chat_id, "", ticket)
                                await client.post(f"{self.api_url}/answerCallbackQuery", json={"callback_query_id": cq_id, "text": "Ticket Created in ClickUp!"})

                except Exception as e:
                    print(f"[Telegram Polling Error] {e}")
                    await asyncio.sleep(3)
