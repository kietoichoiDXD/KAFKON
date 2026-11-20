import re
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
        # None means the legacy CLI may use a server-configured token. An explicit
        # empty string means a browser request has no authorized workspace and
        # must not silently fall back to a different workspace's credentials.
        self.token = (settings.slack_user_token or settings.slack_bot_token) if token is None else token
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


def parse_slack_link(text: str) -> Optional[Dict[str, Optional[str]]]:
    """Extract channel ID and optional timestamp (ts) from a Slack link or text containing a link."""
    if not text:
        return None
    # 1. Archives format: /archives/C0CFE9GL4AK/p1795162883105679
    m = re.search(r"slack\.com/archives/([CDG][A-Z0-9]+)/p(\d{10})(\d{0,6})", text, re.I)
    if m:
        usec = m.group(3).ljust(6, "0") if m.group(3) else "000000"
        return {"channel": m.group(1).upper(), "ts": f"{m.group(2)}.{usec}"}

    # 2. Client thread format: /client/T.../C0CFE9GL4AK/thread/C0CFE9GL4AK-1795162883.105679
    m = re.search(r"slack\.com/client/[^/]+/([CDG][A-Z0-9]+)/thread/[CDG][A-Z0-9]+-(\d{10}\.\d{1,6})", text, re.I)
    if m:
        return {"channel": m.group(1).upper(), "ts": m.group(2)}

    # 3. Client with query params: ?ts=... or ?thread_ts=...
    m = re.search(r"slack\.com/client/[^/]+/([CDG][A-Z0-9]+).*?[?&](?:thread_)?ts=(\d{10}(?:\.\d{1,6})?)", text, re.I)
    if m:
        ts = m.group(2)
        if "." not in ts:
            ts = f"{ts}.000000"
        return {"channel": m.group(1).upper(), "ts": ts}

    # 4. Archive channel without ts: /archives/C0CFE9GL4AK
    m = re.search(r"slack\.com/archives/([CDG][A-Z0-9]+)", text, re.I)
    if m:
        return {"channel": m.group(1).upper(), "ts": None}

    # 5. Client channel without ts: /client/T.../C0CFE9GL4AK
    m = re.search(r"slack\.com/client/[^/]+/([CDG][A-Z0-9]+)", text, re.I)
    if m:
        return {"channel": m.group(1).upper(), "ts": None}

    # 6. Raw Slack channel ID if provided directly
    m = re.search(r"\b([CDG][A-Z0-9]{8,12})\b", text)
    if m and not text.startswith("http"):
        return {"channel": m.group(1).upper(), "ts": None}

    return None
