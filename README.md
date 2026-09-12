# ScribeBA — AI Business Analyst Agent & System Design Suite

> **ScribeBA** is an AI Business Analyst agent that lives inside Slack and Discord — the exact channels where software teams argue about scope, drop half-formed feature ideas, and lose good decisions in the scroll.

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20Tailwind-teal.svg)](http://localhost:3000)

---

## 💡 The Problem ScribeBA Solves

1. **Decisions get lost in the scroll**: Crucial architectural choices and edge-case concessions made during Slack/Discord arguments evaporate without reaching task management.
2. **Missing acceptance criteria**: Manually written tickets lack precise Given/When/Then scenarios and fail quality gates.
3. **AI hallucination in requirements**: Standalone chatbox AI invents requirements because it lacks the thread context of *who said what, who agreed, and who remained silent*.

---

## 🔄 The 4-Stage Loop

```
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  DETECT   │ ──> │  ANALYZE  │ ──> │  RESOLVE  │ ──> │ VALIDATE  │
└───────────┘     └───────────┘     └───────────┘     └───────────┘
  @mention /        Claude Sonnet      Missing info?     ClickUp task
  /ba-summarize     + Team Skill       Ask in-thread!    created &
                    + INVEST Rubric    Never guess.      linked to thread
```

1. **Detect**: Triggered by an `@ScribeBA` mention or the `/ba-summarize` command in any Slack/Discord channel.
2. **Analyze**: Claude Sonnet reads the multi-person thread against the team's custom **Skill**, extracts the User Story, calculates an **INVEST score**, and categorizes every single claim into **Evidence Labels**:
   - 🟢 **Verified**: Directly quoted and agreed in the thread.
   - 🟡 **Inferred**: Reasoned logically from a verified statement.
   - 🟣 **Assumed**: Reasonable assumption not yet formally confirmed.
   - 🔴 **Blocked**: Missing critical information preventing delivery.
3. **Resolve**: If any required field is Assumed or Blocked, ScribeBA *asks the single missing question back in-channel* instead of hallucinating.
4. **Validate**: Upon human confirmation, ScribeBA creates an audited task in **ClickUp** with a cryptographic provenance hash linked back to the source thread.

---

## 🛠️ Project Structure

```
d:\Hackathon\AITinker\
├── .env.example              # Environment variables template
├── .gitignore
├── README.md                 # Documentation
├── requirements.txt          # Python dependencies
├── pyproject.toml            # Package configuration & CLI entry point
├── package.json              # React UI dependencies
├── vite.config.ts            # Vite dashboard configuration
├── src/                      # Backend & CLI code
│   ├── app.py                # Main entry point & Slack Bolt Socket Mode
│   ├── cli.py                # Rich interactive CLI
│   ├── config.py             # Settings & Environment loader
│   ├── core/
│   │   ├── models.py         # Pydantic data models
│   │   ├── analyzer.py       # Claude-powered analysis engine
│   │   ├── scorer.py         # INVEST scoring (I, N, V, E, S, T)
│   │   └── skills.py         # Skill template manager
│   ├── platforms/
│   │   ├── base.py           # Abstract platform adapter
│   │   ├── slack_adapter.py  # Slack Bolt integration
│   │   ├── discord_adapter.py# Discord adapter
│   │   └── message_formatter.py # Rich Block Kit & terminal formatters
│   └── integrations/
│       └── clickup_client.py # ClickUp task creation & audit linking
├── skills/                   # Team-customizable YAML skills
│   ├── default.yaml          # Standard Scrum team template
│   ├── startup_lean.yaml     # High-velocity MVP template
│   └── agency_detailed.yaml  # Billable contract & GDPR scope template
└── demo/
    ├── sample_conversation.md # Multi-person conversation thread
    └── demo_script.md        # 2-minute live demo script
```

---

## 🚀 Quickstart Guide

### 1. Python Backend & CLI

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the 2-minute interactive demo showcase
python -m src.cli demo

# 3. Analyze any conversation transcript with a specific skill
python -m src.cli analyze --file demo/sample_conversation.md --skill startup_lean

# 4. Compare with agency_detailed skill to see personalization in action
python -m src.cli analyze --file demo/sample_conversation.md --skill agency_detailed

# 5. Create an audited task in ClickUp
python -m src.cli create-ticket --file demo/sample_conversation.md --skill startup_lean

# 6. List all installed team skills
python -m src.cli list-skills
```

### 2. Frontend Dashboard (React + Vite)

The interactive CloudThinker workspace dashboard is already configured and running locally:

```bash
# Start frontend dev server
npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/) in your browser to manage Skills, Connections, Agents, Knowledge, and Credentials visually.

---

## 🎯 Personalization Proof (Skill Comparison)

Running the same conversation thread (`demo/sample_conversation.md`) through different skills produces distinct outputs:

| Feature | `startup_lean` | `agency_detailed` |
|---|---|---|
| **Title Prefix** | `[MVP]` | `[Feature-Spec]` |
| **INVEST Threshold** | 65/100 (Velocity focused) | 85/100 (Rigorous contract compliance) |
| **Scope Boundaries** | Focus on immediate hypothesis | Explicit In-Scope vs Out-of-Scope |
| **Compliance Check** | Fast-follow | Mandatory GDPR & PII data minimization |
| **Clarification** | Accepts reasonable assumptions | Halts on any Assumed/Blocked field |
