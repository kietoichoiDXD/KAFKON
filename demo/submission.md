# Submission copy — paste into the portal

## Project title

ScribeBA — the Business Analyst that lives in your Slack thread

## Written description

Requirements are not written in a Jira textarea. They are argued out in a Slack thread, where a
security lead sets a constraint, a DBA commits to a migration, and a question about session
expiry gets asked twice and answered by nobody. Then someone writes a ticket from memory, and the
constraints that were actually agreed never make it in.

ScribeBA is an agent that lives in that thread. Mention it, and it reads the whole conversation —
who said what, who agreed, and who stayed silent — drafts the user story, scores it against the
INVEST rubric, and labels every single claim with where it came from: **Verified** (quoted from the
thread), **Inferred**, **Assumed**, or **Blocked**. When a required field is only Assumed, it does
not guess. It asks the channel, in the thread, and waits.

On confirmation it creates the ticket in ClickUp, with the evidence ledger and a permalink back to
the exact message the requirement came from. Every line of the ticket traces to something a human
actually said.

The behaviour is owned by the team, not by us: a Skill file (`startup_lean`, `agency_detailed`)
sets the title convention, the INVEST threshold, the required fields and the compliance checks. The
same thread produces `[MVP] Google Workspace SSO & Auto-Provisioning` at 91/100 for a lean team and
`[Feature-Spec] Google Workspace OAuth 2.0 Enterprise SSO` for an agency team billing against a
contract.

This only works because the agent is in the room. A chatbox has to be handed a transcript, stripped
of context about who holds which role; it cannot know that the security lead's "non-negotiable" out-
ranks the frontend dev's aside, or that a question nobody answered is a Blocked field rather than an
invitation to invent one.

**What is live, verified end to end today**: reading a real Slack thread, replying in-thread with
Block Kit, asking the clarifying question, and creating a real ClickUp task carrying the Slack
permalink. **What is not**: the analysis runs on our deterministic engine tuned to this conversation
shape — we had no model key during the build; the router switches it to OpenRouter with one
environment variable, and the Slack and ClickUp paths do not change. The Telegram and Discord
adapters are written but were not exercised, and the React dashboard still reads mock data. The
README carries this same table, because a claim a judge can disprove costs more than an honest line.

Built during the event. First commit 12:51, 12 September 2026.

## Repository

https://github.com/kietoichoiDXD/KAFKON

## Social post

> We built **ScribeBA** at the AI Tinkerers Da Nang hackathon: an AI Business Analyst that lives
> inside your Slack thread instead of a chatbox.
>
> It reads the whole argument, labels every requirement Verified / Inferred / Assumed / Blocked,
> asks the channel when something is missing instead of hallucinating it, and files a ClickUp ticket
> that links back to the exact message each line came from.
>
> Agents, everywhere — starting with the thread where the decision actually happened.
>
> #AITinkerers #AgentsEverywhere @<tag every event partner from the Sponsors page here>

**Before posting**: open the hackathon portal → Sponsors → View all, and tag every partner listed.
The post is a required submission field and the tags are part of it.
