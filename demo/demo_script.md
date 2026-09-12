# ScribeBA — 2-Minute Demo Script

**What the panel must see**: the agent working *inside Slack*, end to end, and a real ticket coming out
the other side. Not slides, not a file on disk.

**Before you hit record** — seed a clean thread so the channel has no leftovers:

```bash
python demo/seed_slack_thread.py C0BFQCXHM2T     # prints the thread ts, keep it
```

Open Slack `#new-channel` on screen. Have a terminal in the second half of the screen.

---

## Act 1 — The place the work already happens (25s)

Scroll the thread on screen. Say, over it:

> "Four people just decided how enterprise SSO works. Oliver set the domain restriction, Tony
> committed to a schema migration, and Alex asked twice about session expiry — nobody answered.
> None of this is in a ticket. This is where requirements actually get made, and where they die."

Point at the last line of the thread: `@ScribeBA /ba-summarize`.

---

## Act 2 — The agent answers in the thread (45s)

```bash
python -m backend.cli slack-run --channel C0BFQCXHM2T --ts <TS> --skill startup_lean
```

Cut back to Slack. The reply is already in the thread. Show, in this order:

1. The drafted user story and **INVEST 91/100**.
2. The evidence ledger: **4 Verified** claims, each carrying the quote it came from — and **1 Assumed**,
   the session timeout.
3. The separate message ScribeBA posted:
   > *"Should idle session timeout be strictly enforced at 8 hours (SOC2 standard) or 24 hours?"*

Say the line that carries the whole pitch:

> "It didn't guess the timeout. It labelled it Assumed and asked the channel — because it read who
> said what, who agreed, and who stayed silent. A chatbox can't do that; it was never in the room."

---

## Act 3 — A real ticket, with provenance (30s)

Click the ClickUp link in the thread's last message. On the ticket, show:

- Title `[MVP] Google Workspace SSO & Auto-Provisioning`, tags `mvp` · `lean` · `fast-follow`.
- The audit ledger at the bottom: applied Skill, the claim counts, and the **Slack permalink** —
  click it, it goes back to the exact thread.

> "Every line in this ticket traces to a message. The provenance is the product."

---

## Act 4 — The team's rules, not our prompt (20s)

Same thread, different Skill:

```bash
python -m backend.cli slack-run --channel C0BFQCXHM2T --ts <TS> --skill agency_detailed
```

Put the two ClickUp tickets side by side. Same thread, same agent:

| | `startup_lean` | `agency_detailed` |
|---|---|---|
| Title | `[MVP] Google Workspace SSO & Auto-Provisioning` | `[Feature-Spec] Google Workspace OAuth 2.0 Enterprise SSO` |
| Tags | `mvp` · `lean` · `fast-follow` | `client-deliverable` · `contract-scope` · `audited` |
| INVEST | 91/100 | 83/100 against a stricter rubric |

> "Same thread, same agent, different team rules — the behaviour comes from a Skill file the team
> owns, not from our prompt."

---

## If asked in Q&A

- **"Is the analysis a real LLM call?"** — Right now it's our deterministic engine; we had no model
  key during the build. The router in `backend/core/fallback_router.py` sends the same prompt to
  OpenRouter the moment the key is set — the Slack and ClickUp paths you just watched are unchanged.
- **"Is it a bot?"** — The Slack integration runs on a user token with `channels:history` and
  `chat:write`. A bot token is a one-line env swap; we did not have app-install rights in time.
- **"What was built today?"** — Everything in `backend/`, `frontend/` and `skills/`. First commit
  12:51 today.
