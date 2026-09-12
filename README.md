# ScribeBA — Context-Native Autonomous Agile BA Agent

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

1. **Detect**: Triggered by `@ScribeBA` or `/ba-summarize` in any Slack/Discord channel.
2. **Analyze**: Claude Sonnet reads the multi-person thread against the team's **Skill**, extracts a User Story, computes an **INVEST score**, and labels every claim:
   - 🟢 **Verified** — Directly quoted and agreed in the thread.
   - 🟡 **Inferred** — Reasoned logically from a verified statement.
   - 🟣 **Assumed** — Reasonable assumption not yet confirmed.
   - 🔴 **Blocked** — Missing critical information preventing delivery.
3. **Resolve**: If any required field is Assumed or Blocked, ScribeBA *asks back in-channel* instead of hallucinating.
4. **Validate**: Upon confirmation, ScribeBA creates an audited task in **ClickUp** with provenance linked back to the source thread.

---

## 🛠️ Project Structure

```
KAFKON/
├── .env.example                    # Environment variables template
├── .gitignore
├── README.md
├── requirements.txt                # Python dependencies
├── pyproject.toml                  # Package config & CLI entry point
│
├── frontend/                       # React + Vite + Tailwind UI
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── types.ts
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── HomeView.tsx
│       │   ├── RoomsView.tsx
│       │   ├── ArtifactsView.tsx
│       │   ├── AutomationsView.tsx
│       │   ├── ReviewView.tsx
│       │   ├── WorkspaceModal.tsx
│       │   ├── SkillsModal.tsx
│       │   └── SkillMarkdownRenderer.tsx
│       └── data/
│           └── mockData.ts
│
├── backend/                        # Python Backend & CLI
│   ├── __init__.py
│   ├── app.py                      # Slack Bolt Socket Mode entry point
│   ├── cli.py                      # Click & Rich interactive CLI
│   ├── config.py                   # Pydantic BaseSettings loader
│   ├── core/
│   │   ├── __init__.py
│   │   ├── models.py               # Pydantic data models
│   │   ├── analyzer.py             # Claude-powered analysis engine
│   │   ├── scorer.py               # INVEST scoring (I, N, V, E, S, T)
│   │   └── skills.py               # Skill template manager
│   ├── platforms/
│   │   ├── __init__.py
│   │   ├── base.py                 # Abstract platform adapter
│   │   ├── slack_adapter.py        # Slack Bolt integration
│   │   ├── discord_adapter.py      # Discord adapter
│   │   └── message_formatter.py    # Rich Block Kit formatters
│   └── integrations/
│       ├── __init__.py
│       └── clickup_client.py       # ClickUp task creation & audit
│
├── skills/                         # Team-customizable YAML skills
│   ├── default.yaml                # Standard Scrum team
│   ├── startup_lean.yaml           # High-velocity MVP
│   └── agency_detailed.yaml        # Billable contract & GDPR scope
│
├── tests/                          # Unit & integration tests
│   ├── __init__.py
│   ├── test_core.py                # INVEST scorer & SkillManager tests
│   └── test_analyzer.py            # Analyzer & ClickUp pipeline tests
│
├── demo/                           # Demo assets
│   ├── sample_conversation.md      # Multi-person Slack thread
│   └── demo_script.md             # 2-minute live demo script
│
└── docs/                           # Documentation & reference
    ├── investigation/
    │   └── prove-it-day-02-investigate-2026-09-12.md
    └── stitch-screens/             # Google Stitch MCP screen exports
        ├── screen_automations.html
        ├── screen_skills_mcp.html
        ├── screen_ticket_review.html
        └── screen_workspace.html
```

---

## 🚀 Quickstart Guide

### 1. Python Backend & CLI

```bash
# Install dependencies
pip install -r requirements.txt

# Run the 2-minute interactive demo showcase
python -m backend.cli demo

# Analyze a conversation with a specific skill
python -m backend.cli analyze --file demo/sample_conversation.md --skill startup_lean

# Compare with agency_detailed skill
python -m backend.cli analyze --file demo/sample_conversation.md --skill agency_detailed

# Create an audited task in ClickUp
python -m backend.cli create-ticket --file demo/sample_conversation.md --skill startup_lean

# List all installed team skills
python -m backend.cli list-skills
```

### 2. Frontend Dashboard (React + Vite)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/) to manage Skills, Connections, Agents, Knowledge, and Credentials.

### 3. Run Tests

```bash
python -m unittest discover tests
```

---

## 🎯 Personalization Proof (Skill Comparison)

Running the same conversation (`demo/sample_conversation.md`) through different skills produces distinct outputs:

| Feature | `startup_lean` | `agency_detailed` |
|---|---|---|
| **Title Prefix** | `[MVP]` | `[Feature-Spec]` |
| **INVEST Threshold** | 65/100 (Velocity focused) | 85/100 (Contract compliance) |
| **Scope Boundaries** | Focus on immediate hypothesis | Explicit In-Scope vs Out-of-Scope |
| **Compliance Check** | Fast-follow | Mandatory GDPR & PII data minimization |
| **Clarification** | Accepts reasonable assumptions | Halts on any Assumed/Blocked field |

---

## 📜 License

MIT
