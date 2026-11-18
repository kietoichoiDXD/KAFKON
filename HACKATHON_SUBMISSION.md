# ScribeBA — Hackathon Submission Kit

> **Dự án:** ScribeBA — Context-Native Autonomous Agile BA Agent & Incident Console
> **Repository:** https://github.com/kietoichoiDXD/KAFKON
> **Chủ đề thi:** AI Tinkerers Hackathon / Agents Everywhere

---

## 📌 PHẦN 1: CÁC TRƯỜNG FORM CƠ BẢN (FORM FIELDS)

### 1. Project Title
```text
ScribeBA — Context-Native Autonomous Agile BA & Incident Console
```

### 2. Provide a short tagline for the project (Dưới 200 ký tự)
*Độ dài thực tế: 86 ký tự*
```text
Turn messy team chats into verified, traceable Agile tickets — with zero AI hallucination.
```

### 3. Elevator Pitch (Bản giới hạn dưới 200 ký tự)
*Độ dài thực tế: 166 ký tự (bao gồm dấu cách)*
```text
ScribeBA turns messy team chats into verified Agile tickets without AI hallucination. Unresolved debates are marked Blocked; nothing publishes without human approval.
```

*(Phiên bản có kèm Sponsor Nebius - 167 ký tự)*
```text
ScribeBA turns team chats into verified Agile tickets without AI hallucination. Powered by Nebius and Claude, it marks missing details as Blocked until human approval.
```

---

## 📖 PHẦN 2: ABOUT THE PROJECT (Markdown with LaTeX)
*(Copy toàn bộ nội dung trong khối dưới đây để dán vào ô **About the project** trên portal)*

```markdown
# ScribeBA — Context-Native Autonomous Agile BA & Incident Console

> **"A claim must carry where it came from; a missing answer is Blocked, not invented."**

---

### 💡 Inspiration

In modern software development, crucial product and architectural decisions happen inside chaotic **Slack and Discord threads**. Teams debate scope, suggest edge-case workarounds, and trade off technical debt. But after the discussion ends, these vital decisions evaporate into the scroll.

When teams attempt to bridge this gap using standard LLMs, a dangerous pattern emerges: **discussion is mistaken for agreement**, and **missing details turn into AI hallucinations**. An offhand suggestion like *"we could auto-refresh tokens"* gets synthesized into an official requirement, while unresolved questions (like session timeouts or rate limits) are silently filled in with generic assumptions.

We built **ScribeBA** to end this guesswork. We envisioned a **context-native Agile Business Analyst agent** that lives directly inside team channels. Instead of inventing answers, ScribeBA enforces verifiable evidence provenance: every single requirement is traced to an exact speaker, unresolved ambiguities are tagged as $\text{Blocked}$, and changes are pushed to task trackers or infrastructure only after explicit **human verification**.

---

### ⚙️ What It Does & Mathematical Rigor

ScribeBA operates on a strict **3-Axis Verification Model**:
1. **Evidence Axis:** $\text{Claim} \to \{\text{Verified}, \text{Inferred}, \text{Assumed}, \text{Blocked}\}$
2. **Decision Axis:** $\text{State} \to \{\text{Proposed}, \text{Approved}, \text{Superseded}, \text{Unresolved}\}$
3. **Readiness Axis:** $\text{Requirement} \to \{\text{Draft}, \text{Needs Review}, \text{Blocked}, \text{Ready}\}$

A requirement is mathematically prevented from publishing unless all required fields pass the zero-blocker constraint:

$$P_{\text{publish}} = \mathbb{I}(\text{Readiness} = \text{Ready}) \times \prod_{i=1}^{N} \mathbb{I}(\text{Claim}_i \neq \text{Blocked}) \times \mathbb{I}(\text{HumanApproval} = 1)$$

To guarantee story quality before handoff, ScribeBA calculates a composite **INVEST Score** $S_{\text{INVEST}} \in [0, 100]$:

$$S_{\text{INVEST}} = \sum_{k \in \{I, N, V, E, S, T\}} w_k \cdot s_k \quad \text{where} \quad \sum_{k} w_k = 1.0$$

* **Agile Specification Engine:** Synthesizes multi-person chat threads into structured user stories, Gherkin acceptance criteria (`Given-When-Then`), clarifying questions, and SHA-256 tamper-evident integrity seals.
* **AIOps Incident Console:** Applies the same evidence-grounded philosophy to infrastructure. ScribeBA reads Kubernetes cluster states and Prometheus metrics ($RPS$, $P95$, $5xx$ error rates), diagnoses root causes against declarative allowlists, and proposes un-replayable patches locked by Kubernetes `resourceVersion`.

---

### 🛠️ How We Built It

ScribeBA was engineered as a fault-tolerant, multi-tier agentic mesh:

* **High-Speed AI Core (Nebius AI Studio):** Integrated Nebius AI Studio utilizing `Qwen/Qwen3-30B-A3B-Instruct-2507` over an OpenAI-compatible endpoint. Operating at ultra-low latency (~1s), Nebius serves as our high-speed extraction engine, converting complex conversational transcripts into structured JSON specifications with deterministic reliability.
* **Multi-Tier Fallback Cascade:** Designed an autonomous fallback router across 3 tiers (Low, Medium, High). If the primary OpenRouter route (`anthropic/claude-sonnet-5`) hits a rate limit ($429$) or balance limit ($402$), it cascades seamlessly:
  $$\text{OpenRouter} \xrightarrow{\text{failover}} \text{Google Gemini (2.5-Flash/Pro)} \xrightarrow{\text{failover}} \text{Nebius (Qwen-30B)} \xrightarrow{\text{failover}} \text{Local Deterministic Engine}$$
* **Exa Neural Search Grounding:** Powered by Exa's semantic highlights API to ground requirements against industry standards (RFC 6749, SOC2 compliance, OAuth2 session lifecycles).
* **Enterprise Security & PII Redaction:** In-flight regex filters mask Slack/GitHub tokens, AWS credentials, credit cards, IP addresses, and email local-parts before any text leaves the perimeter.
* **Frontend Web Studio:** Built with **React 18, Vite, and Tailwind CSS**, providing real-time telemetry, live Slack-run triggering, ClickUp task synchronization, and interactive Kubernetes diff reviews.
* **Platform Ingestion:** Native integrations for Slack (Bolt Socket Mode & Web API), Discord webhooks, Telegram long-polling, and a rich Terminal UI (`interactive_cli.py`).

---

### 🧗 Challenges We Faced

1. **Eliminating the LLM "Helpfulness Trap":** LLMs are trained to be helpful, meaning they naturally try to answer unresolved questions by hallucinating reasonable-sounding defaults. We engineered rigorous prompt constraints and structured extraction schemas that explicitly reward the model for recognizing ignorance and flagging items as $\text{Blocked}$.
2. **Defensive JSON Extraction Across Diverse Models:** Different models format JSON responses with varying fences or prose wrappers. We built a resilient parsing utility (`parse_model_json`) using dynamic substring window extraction to ensure zero JSON parse crashes across Claude, Qwen, and Gemini.
3. **Zero-Replay Infrastructure Safety:** In AIOps remediation, blindly applying patches is dangerous. We enforced an optimistic concurrency lock: every proposed remediation captures the Kubernetes resource's `uid` and `resourceVersion`. If the cluster mutates before human approval is granted, the action is safely aborted.

---

### 🎓 What We Learned & Key Takeaways

* **Absence of data is not health:** When a Prometheus metrics tunnel drops, an AI agent should never report "all systems normal." It must report $\text{Blocked — telemetry unavailable}$.
* **Open-source models are production-ready:** Grounding **Nebius's Qwen-30B** demonstrated that specialized open-source models deliver near-frontier reasoning quality at a fraction of the latency and operational cost.
* **Human-in-the-loop is an accelerator, not a bottleneck:** Providing reviewers with exact message citations and red/green patch diffs reduces verification time from 30 minutes of thread archaeology to a 10-second informed sign-off.

---

### 🚀 What's Next for ScribeBA

* **Bidirectional Jira & Linear Sync:** Extending beyond ClickUp to support two-way synchronization and backlog refinement across enterprise project boards.
* **Automated Playwright/Cypress Test Generation:** Using OpenAI Codex/GPT-4o to turn ScribeBA's verified Gherkin acceptance criteria into executable end-to-end integration test suites.
* **Multi-Cluster GitOps Reconciliation:** Integrating remediation proposals directly into ArgoCD and Flux pull requests.
```

---

## 🌐 PHẦN 3: SOCIAL POST (BÀI ĐĂNG MẠNG XÃ HỘI)

```text
We built ScribeBA at the AI Tinkerers Hackathon: an autonomous, context-native Agile Business Analyst agent that lives directly inside Slack & Discord threads.

Instead of guessing or hallucinating, ScribeBA links every requirement to its exact message author, flags unresolved debates as Blocked, and creates verified ClickUp tickets only after human sign-off.

Supercharged by Nebius AI Studio (Qwen-30B), Google Gemini 2.5, OpenRouter, and Exa Neural Search.

#AITinkerers #AgentsEverywhere #Nebius #AI #SoftwareEngineering
```
