import os
from typing import Optional, List
from .base import BasePlatformAdapter
from .message_formatter import MessageFormatter
from ..core.models import ThreadContext, ChatMessage, AnalysisResult, TicketPayload
from ..config import settings

class SlackAdapter(BasePlatformAdapter):
    """Slack integration via Slack Bolt or Slack MCP tool interface."""

    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token or settings.slack_bot_token
        self.client = None
        if self.bot_token and settings.scribeba_mode == "live":
            try:
                from slack_sdk.web.async_client import AsyncWebClient
                self.client = AsyncWebClient(token=self.bot_token)
            except ImportError:
                pass

    async def fetch_thread(self, channel_id: str, thread_id: str) -> ThreadContext:
        """Fetch conversation messages from a Slack thread."""
        if self.client and settings.scribeba_mode == "live":
            resp = await self.client.conversations_replies(channel=channel_id, ts=thread_id)
            messages = []
            for m in resp.get("messages", []):
                messages.append(ChatMessage(
                    author=m.get("user", "Unknown"),
                    timestamp=m.get("ts", ""),
                    text=m.get("text", "")
                ))
            return ThreadContext(
                thread_id=thread_id,
                channel=channel_id,
                platform="slack",
                messages=messages
            )

        # Local mode mock data
        return ThreadContext(
            thread_id=thread_id,
            channel=channel_id,
            platform="slack",
            messages=[
                ChatMessage(author="@alex_lead", timestamp="10:15", text="Acme Corp requires Google Workspace SSO."),
                ChatMessage(author="@oliver_sec", timestamp="10:17", text="Must restrict to domain @acmecorp.com and assign Engineer role."),
                ChatMessage(author="@tony_db", timestamp="10:20", text="I will add sso_provider column with unique constraint."),
                ChatMessage(author="@alex_lead", timestamp="10:22", text="What about session expiration? 8h or 24h?"),
                ChatMessage(author="@oliver_sec", timestamp="10:28", text="Avatar sync out of scope. 8h standard for SOC2."),
                ChatMessage(author="@alex_lead", timestamp="10:30", text="/ba-summarize"),
            ]
        )

    async def post_analysis_summary(
        self,
        channel_id: str,
        thread_id: str,
        result: AnalysisResult
    ) -> str:
        """Post formatted analysis and Block Kit controls to the thread."""
        blocks = MessageFormatter.to_slack_blocks(result)
        text = f"ScribeBA: {result.story.title}"

        if self.client and settings.scribeba_mode == "live":
            resp = await self.client.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_id,
                text=text,
                blocks=blocks
            )
            return resp.get("ts", "")

        print(f"[Slack Mock Post] Channel: {channel_id} | Thread: {thread_id}\n{MessageFormatter.to_markdown(result)}")
        return "mock-slack-ts-12345"

    async def post_clarification_question(
        self,
        channel_id: str,
        thread_id: str,
        question: str
    ) -> str:
        text = f"❓ *ScribeBA Clarification*: {question}"
        if self.client and settings.scribeba_mode == "live":
            resp = await self.client.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_id,
                text=text
            )
            return resp.get("ts", "")
        print(f"[Slack Question] {text}")
        return "mock-question-ts"

    async def post_ticket_confirmation(
        self,
        channel_id: str,
        thread_id: str,
        ticket: TicketPayload
    ) -> str:
        text = (
            f"✅ *ClickUp Task Created*: <{ticket.clickup_url}|{ticket.title}>\n"
            f"• Priority: `{ticket.priority}`\n"
            f"• Linked Source Thread: `{ticket.thread_link}`"
        )
        if self.client and settings.scribeba_mode == "live":
            resp = await self.client.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_id,
                text=text
            )
            return resp.get("ts", "")
        print(f"[Slack Ticket Confirmation] {text}")
        return "mock-confirm-ts"
