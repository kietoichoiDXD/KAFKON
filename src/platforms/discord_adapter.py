import os
from typing import Optional
from .base import BasePlatformAdapter
from .message_formatter import MessageFormatter
from ..core.models import ThreadContext, ChatMessage, AnalysisResult, TicketPayload
from ..config import settings

class DiscordAdapter(BasePlatformAdapter):
    """Discord integration via Discord Bot API or Discord MCP server."""

    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token or settings.discord_bot_token

    async def fetch_thread(self, channel_id: str, thread_id: str) -> ThreadContext:
        """Fetch messages from a Discord thread/forum post."""
        # Standardized MCP / API interface
        return ThreadContext(
            thread_id=thread_id,
            channel=channel_id,
            platform="discord",
            messages=[
                ChatMessage(author="alex_lead#1020", timestamp="10:15", text="Acme Corp requires Google Workspace SSO."),
                ChatMessage(author="oliver_sec#9012", timestamp="10:17", text="Must restrict to domain @acmecorp.com and assign Engineer role."),
                ChatMessage(author="tony_db#3310", timestamp="10:20", text="I will add sso_provider column with unique constraint."),
                ChatMessage(author="alex_lead#1020", timestamp="10:22", text="What about session expiration? 8h or 24h?"),
                ChatMessage(author="oliver_sec#9012", timestamp="10:28", text="Avatar sync out of scope. 8h standard for SOC2."),
                ChatMessage(author="alex_lead#1020", timestamp="10:30", text="/ba-summarize"),
            ]
        )

    async def post_analysis_summary(
        self,
        channel_id: str,
        thread_id: str,
        result: AnalysisResult
    ) -> str:
        md = MessageFormatter.to_markdown(result)
        print(f"[Discord Mock Post] Channel: {channel_id} | Thread: {thread_id}\n{md}")
        return "mock-discord-id-54321"

    async def post_clarification_question(
        self,
        channel_id: str,
        thread_id: str,
        question: str
    ) -> str:
        msg = f"❓ **ScribeBA Question**: {question}"
        print(f"[Discord Question] {msg}")
        return "mock-discord-question"

    async def post_ticket_confirmation(
        self,
        channel_id: str,
        thread_id: str,
        ticket: TicketPayload
    ) -> str:
        msg = f"✅ **ClickUp Ticket Created**: [{ticket.title}]({ticket.clickup_url})"
        print(f"[Discord Confirmation] {msg}")
        return "mock-discord-confirm"
