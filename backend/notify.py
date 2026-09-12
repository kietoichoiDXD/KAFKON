"""Where an approval request goes.

Slack and Discord are two places a team already watches; there will be others. Each channel
implements the same two moves — ask, then report what happened — so adding one is a class and a
config entry, and the incident code never learns which channels exist.

A failed notification is reported, never swallowed into a silent success: if nobody was asked,
the operator needs to know that before they trust the loop.
"""
import os
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import httpx

from .config import settings


class Notifier(ABC):
    """One place a human is asked to approve, and told the outcome."""

    kind: str

    @abstractmethod
    async def ask(self, action: Dict[str, Any], target: Optional[str] = None) -> Dict[str, Any]:
        """Post the proposal. Returns whatever is needed to reply to it later."""

    @abstractmethod
    async def report(self, handle: Dict[str, Any], outcome: str) -> None:
        """Post the outcome next to the request that asked for it."""

    @staticmethod
    def summary(action: Dict[str, Any]) -> str:
        p = action["parameters"]
        return (
            f"**{action['summary']}**  `{action['action_id']}`\n"
            f"• Environment: `{action.get('environment', 'default')}`\n"
            f"• Runbook: `{action['runbook']}`  ·  Target: `{action['target']}`\n"
            f"• Change: `{p['name']}={action['observed']}` → `{p['name']}={p['value']}`\n"
            f"• Pinned to resourceVersion `{action['resource_version']}` — refused if the "
            f"deployment changes before approval\n"
            f"_Nothing has been written. Approve in the Incidents console._"
        )


class SlackNotifier(Notifier):
    kind = "slack"

    def __init__(self, channel: Optional[str] = None) -> None:
        self.channel = channel

    @property
    def available(self) -> bool:
        return bool(settings.slack_user_token or settings.slack_bot_token)

    async def ask(self, action: Dict[str, Any], target: Optional[str] = None) -> Dict[str, Any]:
        from .platforms.slack_adapter import SlackAdapter

        channel = target or self.channel
        if not channel:
            raise RuntimeError("No Slack channel given for the approval request.")
        # Slack renders *bold*, not **bold**.
        text = "🚨 *ScribeBA — approval needed*\n" + self.summary(action).replace("**", "*")
        ts = await SlackAdapter()._post(channel, None, text)
        return {"kind": self.kind, "channel": channel, "ts": ts}

    async def report(self, handle: Dict[str, Any], outcome: str) -> None:
        from .platforms.slack_adapter import SlackAdapter

        await SlackAdapter()._post(handle["channel"], handle["ts"], outcome.replace("**", "*"))


class DiscordNotifier(Notifier):
    """Webhook rather than a bot: no gateway, no scopes, one URL in the environment."""

    kind = "discord"

    def __init__(self, webhook_url: Optional[str] = None) -> None:
        self.webhook_url = webhook_url or os.environ.get("DISCORD_WEBHOOK_URL", "")

    @property
    def available(self) -> bool:
        return bool(self.webhook_url)

    async def _post(self, content: str) -> None:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(self.webhook_url, json={"content": content[:1900]})
        if r.status_code >= 400:
            raise RuntimeError(f"Discord webhook failed: {r.status_code} {r.text[:160]}")

    async def ask(self, action: Dict[str, Any], target: Optional[str] = None) -> Dict[str, Any]:
        if not self.available:
            raise RuntimeError("No DISCORD_WEBHOOK_URL configured.")
        await self._post("🚨 **ScribeBA — approval needed**\n" + self.summary(action))
        return {"kind": self.kind, "action_id": action["action_id"]}

    async def report(self, handle: Dict[str, Any], outcome: str) -> None:
        await self._post(f"{outcome}\n`{handle.get('action_id', '')}`")


def build(channels: Optional[List[Dict[str, Any]]] = None) -> List[Notifier]:
    """Every notifier that is actually configured.

    `channels` comes from integrations.yaml; with nothing declared, whatever has credentials is
    used, so a webhook in .env works without touching the YAML.
    """
    out: List[Notifier] = []
    for spec in channels or []:
        kind = spec.get("kind")
        if kind == "slack":
            n = SlackNotifier(spec.get("channel"))
        elif kind == "discord":
            n = DiscordNotifier(spec.get("webhook_url"))
        else:
            continue
        if n.available:
            out.append(n)
    if out:
        return out

    for n in (SlackNotifier(), DiscordNotifier()):
        if n.available:
            out.append(n)
    return out
