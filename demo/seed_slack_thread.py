import asyncio, sys, httpx
sys.path.insert(0, "/home/dinh/KAFKON")
from backend.config import settings

TOKEN = settings.slack_user_token or settings.slack_bot_token
CHANNEL = sys.argv[1]

PARENT = "*#proj-auth-federation* — Acme Corp enterprise pilot needs Google Workspace SSO before their 50 engineers onboard next week. We need Google OAuth 2.0 with auto-provisioning."

REPLIES = [
    "*oliver_sec:* Agreed, but the guardrails are non-negotiable: restrict auth strictly to `@acmecorp.com`, every provisioned account lands in the `Engineer` read-only role until an admin elevates it, and every SSO login logs an immutable audit event with IP and user-agent.",
    "*tony_db:* On the DB side I'll add `sso_provider` and `external_sub_id` columns with unique constraints on the `users` table so we avoid duplicate accounts. Migration is zero-downtime.",
    "*alex_lead:* What about session expiration? Should idle sessions expire after 8 hours or 24 hours?",
    "*sarah_frontend:* UI side is straightforward — \"Continue with Google\" button on `/login` plus the OAuth redirect callback.",
    "*alex_lead:* Nobody answered the session expiration question yet. Also, do we support avatar sync from Google profile photos, or keep our own gravatars for MVP?",
    "*oliver_sec:* Avatar sync is definitely out of scope for MVP. Session timeout needs a security decision — 8 hours is the SOC2 standard.",
    "@ScribeBA /ba-summarize",
]


async def main():
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json; charset=utf-8"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post("https://slack.com/api/chat.postMessage",
                              headers=headers, json={"channel": CHANNEL, "text": PARENT})
        data = r.json()
        assert data.get("ok"), data
        ts = data["ts"]
        for text in REPLIES:
            r = await client.post("https://slack.com/api/chat.postMessage",
                                  headers=headers,
                                  json={"channel": CHANNEL, "thread_ts": ts, "text": text})
            assert r.json().get("ok"), r.json()
        print(ts)

asyncio.run(main())
