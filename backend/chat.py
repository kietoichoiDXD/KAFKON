"""Answer whatever is asked.

ScribeBA's analysis pipeline turns a discussion into a labelled specification. That is the point
of the product, but it is not an answer to "what does this do?" — asked that, the pipeline used to
reply "routine chatter without architectural decisions", which reads as a broken assistant.

So: decide first. A pasted discussion goes to the analyser; a question gets a sentence, grounded
in what this instance can actually see.
"""
import re
from typing import Any, Dict, List

from .config import settings
from .core.analyzer import ScribeBAAnalyzer
from .core.fallback_router import ModelFallbackRouter
from .core.models import ChatMessage, ThreadContext
from .core.redaction import redact
from .core.skills import SkillManager

SYSTEM = """You are ScribeBA, an AI Business Analyst built by team KAFKON.

What you are: an agent that lives in a Slack thread. You read the whole conversation, draft a user
story, score it against the INVEST rubric, and label every claim Verified (quoted from the thread),
Inferred (reasoned from a verified claim), Assumed (convention, not confirmed) or Blocked (nobody
answered). When a required field is only Assumed you ask the channel rather than inventing a value.
On confirmation you file a ClickUp ticket carrying a permalink back to the source message.

A team's Skill file (startup_lean, agency_detailed, default) sets the title convention, the INVEST
threshold and the required fields, so the same thread produces different tickets for different
teams. An incident console applies the same discipline to a Kubernetes namespace: labelled
findings, one named runbook, an exact patch, nothing written without human approval.

Answer the user directly and briefly — a few sentences, plain language, no bullet-point padding and
no marketing words. If they ask about something you cannot see from the context given below, say so
rather than guessing. If they paste a discussion and want it specified, tell them to send it as the
message and you will label it."""

# A discussion has several speakers or several lines of requirement talk; a question does not.
DISCUSSION_HINTS = re.compile(
    r"(?im)^\s*[@*]|(\bmust\b|\brequire|\bwe need\b|\bshould\b|\bout of scope\b|/ba-summarize)"
)


def looks_like_a_discussion(messages: List[str]) -> bool:
    joined = "\n".join(messages)
    if len(messages) >= 3:
        return True
    speakers = len(re.findall(r"(?m)^\s*\*?@\w+", joined))
    if speakers >= 2:
        return True
    # One long paragraph stating requirements is still a specification job.
    return len(joined.split()) > 25 and bool(DISCUSSION_HINTS.search(joined))


def _context_line() -> str:
    return (
        f"This instance right now: model provider "
        f"{'OpenRouter' if settings.openrouter_api_key else 'Anthropic' if settings.anthropic_api_key else 'none (local deterministic engine)'}, "
        f"Slack {'connected' if (settings.slack_user_token or settings.slack_bot_token) else 'not connected'}, "
        f"ClickUp {'connected' if settings.clickup_api_key else 'not configured'}, "
        f"Exa {'connected' if settings.exa_api_key else 'not configured'}, "
        f"default skill {settings.default_skill}."
    )


class ChatResponder:
    def __init__(self, skill_manager: SkillManager = None) -> None:
        self.skills = skill_manager or SkillManager()
        self.analyzer = ScribeBAAnalyzer(self.skills)
        self.router = ModelFallbackRouter()

    async def respond(self, messages: List[str], skill: str, tier: str) -> Dict[str, Any]:
        if looks_like_a_discussion(messages):
            thread = ThreadContext(
                thread_id="chat", channel="chat", platform="chat",
                messages=[ChatMessage(author=f"@speaker{i+1}", timestamp="now", text=m)
                          for i, m in enumerate(messages)],
            )
            result = await self.analyzer.analyze_thread(thread, skill_name=skill, tier=tier)
            # An empty analysis is not an answer; fall through to prose rather than tell someone
            # their question was routine chatter.
            if result.evidence_items:
                return {"type": "analysis", "result": result}

        return {"type": "text", "text": await self._answer(messages, tier)}

    async def _answer(self, messages: List[str], tier: str) -> str:
        # The same egress rule as the analyser: nothing leaves unmasked.
        transcript, masked = redact("\n".join(messages))
        if masked:
            print(f"[Redaction] masked before egress: {masked}")

        reply = await self.router.complete_text(
            f"{SYSTEM}\n\n{_context_line()}", transcript, tier=tier
        )
        if reply:
            return reply.strip()
        return (
            "I cannot answer that right now: no model provider responded. "
            "Set OPENROUTER_API_KEY in .env and try again — the Slack, ClickUp and incident paths "
            "keep working either way, but a written answer needs a model."
        )
