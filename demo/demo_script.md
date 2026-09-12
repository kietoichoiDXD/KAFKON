# ScribeBA — 2-Minute Live Demo Script

**Presenter Goal**: Demonstrate the **Detect → Analyze → Resolve → Validate** loop, Evidence Labeling, and Real Skill Personalization.

---

## Act 1: The Problem & Trigger (30s)
1. **Show the Thread**: Open Slack (or `demo/sample_conversation.md` in CLI).
   - Point out: 4 team members discussing Google Workspace SSO.
   - Oliver agreed on domain restrictions (`@acmecorp.com`).
   - Tony committed to zero-downtime DB schema changes.
   - *Key observation*: Alex asked about session duration (8h vs 24h), but no final consensus was reached.
2. **Trigger ScribeBA**:
   ```bash
   python -m src.cli analyze --file demo/sample_conversation.md --skill startup_lean
   ```
   Or type `/ba-summarize` in channel.

---

## Act 2: Analyze & Evidence Labeling (45s)
1. **Highlight the Evidence Breakdown**:
   - 🟢 **Verified**: Domain constraint `@acmecorp.com`, `users` table unique index, OAuth 2.0 flow.
   - 🟡 **Inferred**: Frontend button component placement on `/login`.
   - 🟣 **Assumed**: Session timeout set to standard 8 hours.
   - 🔴 **Blocked**: Missing confirmation on idle session duration.
2. **Show INVEST Score**:
   - Score: **88/100** (Passes Startup Lean threshold of 65).
   - Independent: 95 | Negotiable: 85 | Valuable: 90 | Estimable: 85 | Small: 85 | Testable: 90.
3. **The Intelligent Question (Resolve)**:
   - ScribeBA does *not* hallucinate. It posts back to the thread:
     > *"Clarifying Question: Should idle session timeout be strictly enforced at 8 hours (SOC2 standard) or 24 hours?"*

---

## Act 3: Confirmation & ClickUp Ticket Creation (30s)
1. **User Confirms**: Answer "8 hours" and approve ticket creation.
   ```bash
   python -m src.cli create-ticket --file demo/sample_conversation.md --skill startup_lean
   ```
2. **Real ClickUp Sync**:
   - Task `[MVP] Google Workspace SSO & Auto-Provisioning` created in ClickUp.
   - Audit trail links directly back to the Slack Thread ID `th-1789201948`.
   - Tags applied: `mvp`, `lean`, `fast-follow`.

---

## Act 4: The Skill Difference — Personalization Proof (15s)
1. Run the **exact same conversation** with `agency_detailed`:
   ```bash
   python -m src.cli analyze --file demo/sample_conversation.md --skill agency_detailed
   ```
2. **Show Contrast**:
   - Title changes to: `[Feature-Spec] Google Workspace OAuth 2.0 Enterprise SSO`.
   - Adds mandatory In-Scope / Out-of-Scope boundaries (Avatar sync explicitly Out-of-Scope).
   - Adds GDPR Data Privacy Compliance flag.
   - Proves ScribeBA's behavior is dictated by team rules, not hardcoded prompt templates.
