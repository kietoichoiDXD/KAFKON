# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software engineering leads, agile product managers, business analysts, and DevOps/SRE engineers collaborating in fast-paced software teams. They work across communication channels (Slack, Discord, Telegram) and issue management tools (ClickUp, GitHub Issues, Jira), needing to transform chaotic discussion threads into verifiable, traceable engineering requirements and production incident remediation patches without hallucinated details.

## Product Purpose

ScribeBA eliminates requirement guesswork and hallucination in Agile development. It autonomously synthesizes multi-person chat threads into structured user stories, Gherkin acceptance criteria (`Given-When-Then`), clarifying questions, and cryptographic SHA-256 integrity seals. It also provides an AIOps incident console that diagnoses root causes from Kubernetes cluster states and Prometheus telemetry, proposing safe, zero-replay remediation plans with optimistic concurrency locking.

## Positioning

"A claim must carry where it came from; a missing answer is Blocked, not invented." Unlike generic LLM tools that hallucinate agreeable answers to unresolved debates, ScribeBA enforces a mathematical 3-Axis Verification Model (Evidence Axis, Decision Axis, Readiness Axis) where any unresolved question is strictly labeled as `Blocked` and prevented from publishing without explicit human sign-off.

## Operating Context

- **Team Chat Channels:** Ingestion from Slack (Bolt Socket Mode & Web API), Discord, and Telegram threads.
- **Issue Tracking & Project Management:** Bi-directional sync with ClickUp and GitHub.
- **Production Telemetry & Infrastructure:** Kubernetes live state inspection, resource versioning, and Prometheus metric monitoring ($RPS$, $P95$, $5xx$ error rates).
- **Web Studio Console:** Desktop web control center with real-time telemetry, thread analysis, artifact inspection, and human-in-the-loop governance.

## Capabilities and Constraints

- **Agile Specification Synthesis:** Converts conversational back-and-forth into INVEST-scored user stories, complete with speaker attribution, decision logs, and Gherkin scenarios.
- **Deterministic 3-Axis Verification Model:**
  - Evidence: Verified, Inferred, Assumed, Blocked.
  - Decision: Proposed, Approved, Superseded, Unresolved.
  - Readiness: Draft, Needs Review, Blocked, Ready.
- **Cryptographic Integrity:** Tamper-evident SHA-256 seal on finalized specifications.
- **AIOps Incident Console:** Real-time pod telemetry, error budget tracking, and atomic Kubernetes remediation proposals guarded by `resourceVersion`.
- **Zero-Replay Infrastructure Safety:** Optimistic concurrency locks on Kubernetes resource mutations.
- **PII & Credential Redaction:** In-flight regex scrubbing of tokens, keys, credentials, emails, and IPs.
- **Multi-Tier LLM Failover:** Cascade across Nebius AI Studio (Qwen-30B), OpenRouter (Claude 3.5 Sonnet), Google Gemini (2.5-Flash/Pro), and deterministic local rules.

## Brand Commitments

- **Name:** ScribeBA — Context-Native Autonomous Agile BA & Incident Console.
- **Identity:** High-craft, mission-critical engineering workstation. Clean, distraction-free, authoritative, and responsive.
- **Tone & Voice:** Precise, objective, grounded, mathematically sound. Transparent about confidence and blockers.

## Evidence on Hand

- Live React 18 + Vite + Tailwind TypeScript frontend at `frontend/`.
- Working FastAPI backend at `backend/` with full REST API and test suites.
- Verified mock operational telemetry and sample chat threads in `backend/` and `frontend/src/data/`.
- Submission kit and architecture specification in `HACKATHON_SUBMISSION.md`.

## Product Principles

1. **Evidence Over Assumption:** Every requirement must be anchored to an attributed speaker or source; missing facts are flagged as Blocked rather than synthesized.
2. **Human-in-the-Loop Governance:** Autonomous extraction prepares actionable drafts, but nothing commits to external trackers or production clusters without explicit human review.
3. **Clarity and High Signal Density:** Interfaces must maximize scannability, clear typography hierarchy, and instant comprehension of status, blocker count, and verification state.
4. **Resilience and Determinism:** Fail gracefully across network limits and LLM tiers with deterministic fallbacks.

## Accessibility & Inclusion

- Adherence to WCAG 2.2 AA standards: minimum 4.5:1 text contrast for body copy and 3:1 for large display elements.
- Accessible keyboard navigation and visible high-contrast focus rings throughout.
- Respect for `prefers-reduced-motion` for all transitions and motion.
