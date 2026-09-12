from typing import Optional, Dict
import httpx
from .base import BasePlatformAdapter
from .message_formatter import MessageFormatter
from ..core.models import ThreadContext, ChatMessage, AnalysisResult, TicketPayload
from ..config import settings

SLACK_API = "https://slack.com/api"


class SlackAdapter(BasePlatformAdapter):
    """Slack integration over the Slack Web API (bot or user token)."""

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.slack_user_token or settings.slack_bot_token
        self._user_names: Dict[str, str] = {}

    @property
    def is_live(self) -> bool:
        return bool(self.token)

    async def _call(self, method: str, params: dict, post: bool = False) -> dict:
        headers = {"Authorization": f"Bearer {self.token}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            if post:
                headers["Content-Type"] = "application/json; charset=utf-8"
                resp = await client.post(f"{SLACK_API}/{method}", headers=headers, json=params)
            else:
                resp = await client.get(f"{SLACK_API}/{method}", headers=headers, params=params)
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"Slack {method} failed: {data.get('error')}")
        return data

    async def _display_name(self, user_id: str) -> str:
        if not user_id:
            return "Unknown"
        if user_id not in self._user_names:
            try:
                data = await self._call("users.info", {"user": user_id})
                profile = data["user"].get("profile", {})
                self._user_names[user_id] = (
                    profile.get("display_name") or profile.get("real_name") or user_id
                )
            except RuntimeError:
                self._user_names[user_id] = user_id
        return self._user_names[user_id]

    async def get_permalink(self, channel_id: str, thread_id: str) -> str:
        data = await self._call("chat.getPermalink", {"channel": channel_id, "message_ts": thread_id})
        return data.get("permalink", "")

    async def fetch_thread(self, channel_id: str, thread_id: str) -> ThreadContext:
        """Fetch conversation messages from a Slack thread."""
        if self.is_live:
            data = await self._call("conversations.replies", {"channel": channel_id, "ts": thread_id, "limit": 200})
            messages = []
            for m in data.get("messages", []):
                messages.append(ChatMessage(
                    author=f"@{await self._display_name(m.get('user', ''))}",
                    timestamp=m.get("ts", ""),
                    text=m.get("text", "")
                ))
            return ThreadContext(
                thread_id=thread_id,
                channel=channel_id,
                platform="slack",
                messages=messages
            )

        raise RuntimeError(
            "No Slack token configured. Set SLACK_USER_TOKEN or SLACK_BOT_TOKEN in .env — "
            "there is no offline substitute for a real thread."
        )

    async def _post(self, channel_id: str, thread_id: str, text: str, blocks=None) -> str:
        if not self.is_live:
            raise RuntimeError("No Slack token configured; refusing to pretend a message was posted.")
        # A top-level post has no thread_ts; sending null makes Slack reject the call.
        params = {"channel": channel_id, "text": text}
        if thread_id:
            params["thread_ts"] = thread_id
        if blocks:
            params["blocks"] = blocks
        try:
            data = await self._call("chat.postMessage", params, post=True)
        except RuntimeError:
            # A malformed block must not cost the demo the message.
            retry = {"channel": channel_id, "text": text}
            if thread_id:
                retry["thread_ts"] = thread_id
            data = await self._call("chat.postMessage", retry, post=True)
        return data.get("ts", "")

    async def post_analysis_summary(
        self,
        channel_id: str,
        thread_id: str,
        result: AnalysisResult
    ) -> str:
        """Post formatted analysis and Block Kit controls to the thread."""
        return await self._post(
            channel_id,
            thread_id,
            MessageFormatter.to_markdown(result),
            MessageFormatter.to_slack_blocks(result)
        )

    async def post_clarification_question(
        self,
        channel_id: str,
        thread_id: str,
        question: str
    ) -> str:
        return await self._post(channel_id, thread_id, f"❓ *ScribeBA Clarification*: {question}")

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
        return await self._post(channel_id, thread_id, text)
