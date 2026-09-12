"""Seed a Slack thread with demo/sample_conversation.md, verbatim.

Verbatim matters: the analysis engine quotes this conversation back into the thread, so the
text on screen and the text in the quotes must be the same words.

Usage: python demo/seed_slack_thread.py <CHANNEL_ID>   # prints the thread ts
"""
import asyncio
import re
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from backend.config import settings  # noqa: E402

TOKEN = settings.slack_user_token or settings.slack_bot_token
CHANNEL = sys.argv[1]
SOURCE = Path(__file__).parent / "sample_conversation.md"


def parse_messages():
    """Split the transcript into (author, body) pairs, keeping the body word for word."""
    blocks = re.split(r"^\*\*(@\w+) \([^)]+\):\*\*\s*$", SOURCE.read_text(encoding="utf-8"), flags=re.M)
    pairs = []
    for author, body in zip(blocks[1::2], blocks[2::2]):
        text = body.strip().split("\n---")[0].strip()
        if text:
            pairs.append((author, text))
    return pairs


async def main():
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json; charset=utf-8"}
    messages = parse_messages()
    async with httpx.AsyncClient(timeout=15.0) as client:
        async def post(text, thread_ts=None):
            payload = {"channel": CHANNEL, "text": text}
            if thread_ts:
                payload["thread_ts"] = thread_ts
            resp = await client.post("https://slack.com/api/chat.postMessage", headers=headers, json=payload)
            data = resp.json()
            if not data.get("ok"):
                raise SystemExit(f"Slack rejected the message: {data.get('error')}")
            return data["ts"]

        author, text = messages[0]
        ts = await post(f"*{author}:* {text}")
        for author, text in messages[1:]:
            await post(f"*{author}:* {text}", thread_ts=ts)
        print(ts)


asyncio.run(main())
