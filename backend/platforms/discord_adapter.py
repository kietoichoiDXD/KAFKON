"""Discord, over the REST API.

A thread in Discord is itself a channel, so `thread_id` is the channel id to read and post into;
`channel_id` is kept for the parent and is only used when a thread id is not supplied.
"""
from typing import Dict, Optional

import httpx

from .base import BasePlatformAdapter
from .message_formatter import MessageFormatter
from ..core.models import AnalysisResult, ChatMessage, ThreadContext, TicketPayload
from ..config import settings

DISCORD_API = "https://discord.com/api/v10"
# Discord rejects anything over 2000 characters rather than truncating it for you.
MAX_MESSAGE = 1900


class DiscordAdapter(BasePlatformAdapter):
    """Discord integration over the bot REST API."""

    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token or settings.discord_bot_token

    @property
    def is_live(self) -> bool:
        return bool(self.bot_token)

    def _require_token(self) -> None:
        if not self.is_live:
            raise RuntimeError(
                "No DISCORD_BOT_TOKEN configured. Create a bot at discord.com/developers, "
                "invite it to the server with Read Message History and Send Messages, and set the "
                "token in .env — there is no offline substitute for a real thread."
            )

    async def _call(self, method: str, path: str, **kwargs) -> Dict:
        self._require_token()
        headers = {"Authorization": f"Bot {self.bot_token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request(method, f"{DISCORD_API}{path}", headers=headers, **kwargs)
        if resp.status_code >= 400:
            raise RuntimeError(f"Discord {method} {path} failed: {resp.status_code} {resp.text[:200]}")
        return resp.json() if resp.content else {}

    async def fetch_thread(self, channel_id: str, thread_id: str) -> ThreadContext:
        """Read a thread. Discord returns newest first, so the order is reversed to read as a conversation."""
        target = thread_id or channel_id
        data = await self._call("GET", f"/channels/{target}/messages", params={"limit": 100})
        messages = [
            ChatMessage(
                author=f"@{m['author'].get('global_name') or m['author']['username']}",
                timestamp=m.get("timestamp", ""),
                text=m.get("content", ""),
            )
            for m in reversed(data)
            if m.get("content")
        ]
        return ThreadContext(
            thread_id=target, channel=channel_id, platform="discord", messages=messages
        )

    async def _post(self, target: str, text: str) -> str:
        data = await self._call("POST", f"/channels/{target}/messages",
                                json={"content": text[:MAX_MESSAGE]})
        return data.get("id", "")

    async def post_analysis_summary(
        self, channel_id: str, thread_id: str, result: AnalysisResult
    ) -> str:
        return await self._post(thread_id or channel_id, MessageFormatter.to_markdown(result))

    async def post_clarification_question(
        self, channel_id: str, thread_id: str, question: str
    ) -> str:
        return await self._post(thread_id or channel_id, f"❓ **ScribeBA question**: {question}")

    async def post_ticket_confirmation(
        self, channel_id: str, thread_id: str, ticket: TicketPayload
    ) -> str:
        if not ticket.clickup_url:
            text = f"⚠️ **{ticket.title}** was analysed but no ClickUp task was created."
        else:
            text = (
                f"✅ **ClickUp task created**: [{ticket.title}]({ticket.clickup_url})\n"
                f"• Priority: `{ticket.priority}`\n"
                f"• Source thread: {ticket.thread_link}"
            )
        return await self._post(thread_id or channel_id, text)
