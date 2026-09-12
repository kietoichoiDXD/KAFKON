"""Strip secrets and personal data out of a thread before it leaves the building.

A Slack thread is the least sanitised text in a company: people paste tokens into it. Nothing here
is sent to OpenRouter, Anthropic or Exa until it has been through `redact`.

The domain part of an email is kept (`@acmecorp.com` is often the requirement itself); the local
part is not. Company-internal identifiers the story depends on - table names, roles, scopes - are
deliberately left alone; masking them would make the analysis useless.
"""
import re
from typing import Dict, List, Tuple

# Ordered: the most specific pattern must win, so token shapes run before the generic ones.
PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("SLACK_TOKEN", re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}")),
    ("GITHUB_TOKEN", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}")),
    ("OPENAI_KEY", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}")),
    ("CLICKUP_KEY", re.compile(r"\bpk_[0-9]{4,}_[A-Za-z0-9]{10,}")),
    ("AWS_KEY", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("BEARER", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/-]{20,}")),
    ("CARD", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("IP", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")),
    ("PHONE", re.compile(r"(?<![\w.])(?:\+\d{1,3}[ .-]?)?0\d{8,9}(?![\w.])|(?<![\w.])\d{3}[ .-]\d{3}[ .-]\d{4}(?![\w.])")),
    ("EMAIL_USER", re.compile(r"\b[A-Za-z0-9._%+-]+(?=@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")),
]


def redact(text: str) -> Tuple[str, Dict[str, int]]:
    """Return the outbound-safe text and a count of what was masked, per category."""
    counts: Dict[str, int] = {}
    for name, pattern in PATTERNS:
        text, n = pattern.subn(f"[REDACTED_{name}]", text)
        if n:
            counts[name] = counts.get(name, 0) + n
    return text, counts
