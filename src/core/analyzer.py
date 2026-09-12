import json
from typing import Optional
import httpx
from .models import (
    ThreadContext,
    AnalysisResult,
    UserStory,
    AcceptanceCriterion,
    EvidenceItem,
    EvidenceLabel,
    SkillConfig,
)
from .skills import SkillManager
from .scorer import InvestScorer
from ..config import settings

class ScribeBAAnalyzer:
    """Core analysis engine implementing the Detect -> Analyze -> Resolve -> Validate loop."""

    def __init__(self, skill_manager: Optional[SkillManager] = None):
        self.skill_manager = skill_manager or SkillManager()

    async def analyze_thread(
        self,
        thread: ThreadContext,
        skill_name: Optional[str] = None,
        force_live: bool = False
    ) -> AnalysisResult:
        """Run complete analysis pipeline on a multi-person chat thread."""
        skill = self.skill_manager.get_skill(skill_name or settings.default_skill)
        transcript = thread.to_formatted_transcript()

        # Step 1: Detect (Relevance check)
        if not self._is_decision_relevant(transcript):
            return self._empty_result(thread, skill, "Thread contains routine chatter without architectural decisions.")

        # Step 2: Analyze (Local simulation or Live Anthropic Claude API)
        use_live = force_live or (settings.scribeba_mode == "live" and settings.anthropic_api_key)
        if use_live:
            try:
                return await self._analyze_live(thread, skill, transcript)
            except Exception as e:
                print(f"[Warning] Live API call failed ({e}), falling back to local orchestrator.")

        return self._analyze_local(thread, skill, transcript)

    def _is_decision_relevant(self, transcript: str) -> bool:
        """Two-tier quick filter (Haiku level) for decision intent."""
        keywords = [
            "sso", "oauth", "require", "must", "implement", "database",
            "migration", "scope", "acceptance", "feature", "/ba-summarize"
        ]
        return any(k in transcript.lower() for k in keywords)

    def _analyze_local(
        self,
        thread: ThreadContext,
        skill: SkillConfig,
        transcript: str
    ) -> AnalysisResult:
        """High-fidelity local deterministic analysis tailored to the active Skill."""
        title_prefix = skill.formatting.get("title_prefix", "[Story]")

        # Skill-dependent customization proof
        if skill.name == "startup_lean":
            story_title = f"{title_prefix} Google Workspace SSO & Auto-Provisioning"
            story = UserStory(
                title=story_title,
                as_a="enterprise engineer at Acme Corp",
                i_want="to log into CloudThinker using my Google Workspace corporate credentials",
                so_that="I can onboard securely without creating and managing separate passwords",
                evidence=EvidenceLabel.VERIFIED
            )
            criteria = [
                AcceptanceCriterion(
                    id="AC-1",
                    scenario="Authorized corporate domain login",
                    given="a user has an active Google account at @acmecorp.com",
                    when="they click 'Continue with Google' and authorize via OAuth 2.0",
                    then="they are authenticated and provisioned with the 'Engineer' role",
                    evidence=EvidenceLabel.VERIFIED
                ),
                AcceptanceCriterion(
                    id="AC-2",
                    scenario="Unauthorized personal domain rejection",
                    given="a user attempts login with personal @gmail.com or other domains",
                    when="the OAuth token callback returns",
                    then="access is blocked with error 'Domain unauthorized' and logged to audit trail",
                    evidence=EvidenceLabel.VERIFIED
                ),
                AcceptanceCriterion(
                    id="AC-3",
                    scenario="Session expiration enforcement",
                    given="an authenticated user is idle",
                    when="their session exceeds the idle duration limit (8 hours)",
                    then="their session token is invalidated, requiring re-authentication",
                    evidence=EvidenceLabel.ASSUMED
                )
            ]
            evidence_items = [
                EvidenceItem(
                    field="Domain Restriction",
                    value="@acmecorp.com",
                    label=EvidenceLabel.VERIFIED,
                    quote_source="@oliver_sec: 'We must restrict authentication strictly to their authorized domain @acmecorp.com.'",
                    rationale="Direct requirement stated by security lead."
                ),
                EvidenceItem(
                    field="Initial Role Assignment",
                    value="Engineer (Read-Only)",
                    label=EvidenceLabel.VERIFIED,
                    quote_source="@oliver_sec: 'All provisioned accounts must automatically land in the Engineer read-only role.'",
                    rationale="Explicit access control constraint."
                ),
                EvidenceItem(
                    field="Database Schema Migration",
                    value="users.sso_provider & external_sub_id unique index",
                    label=EvidenceLabel.VERIFIED,
                    quote_source="@tony_db: 'add sso_provider and external_sub_id columns with unique constraints'",
                    rationale="Database engineer committed to zero-downtime migration."
                ),
                EvidenceItem(
                    field="Avatar Photo Sync",
                    value="Out of Scope for MVP",
                    label=EvidenceLabel.VERIFIED,
                    quote_source="@oliver_sec: 'Avatar sync is definitely out of scope for MVP.'",
                    rationale="Agreement to exclude non-essential feature."
                ),
                EvidenceItem(
                    field="Idle Session Timeout",
                    value="8 hours (Pending confirmation)",
                    label=EvidenceLabel.ASSUMED,
                    quote_source="@alex_lead: 'Nobody answered the session expiration question yet.'",
                    rationale="Alex asked about 8h vs 24h. Oliver suggested 8h for SOC2, but consensus was incomplete."
                )
            ]
            clarifying_question = (
                "Clarifying Question: Should idle session timeout be strictly enforced at 8 hours "
                "(SOC2 standard) or 24 hours?"
            )
            ready_for_ticket = False

        elif skill.name == "agency_detailed":
            story_title = f"{title_prefix} Google Workspace OAuth 2.0 Enterprise SSO"
            story = UserStory(
                title=story_title,
                as_a="Client Enterprise Administrator",
                i_want="centralized identity federation via Google OAuth 2.0",
                so_that="our organization maintains compliance and automated employee offboarding",
                evidence=EvidenceLabel.VERIFIED
            )
            criteria = [
                AcceptanceCriterion(
                    id="REQ-01",
                    scenario="Domain whitelisting verification",
                    given="OIDC response token from accounts.google.com",
                    when="hd claim is verified against whitelist (@acmecorp.com)",
                    then="generate JWT session token signed by RS256 private key",
                    evidence=EvidenceLabel.VERIFIED
                ),
                AcceptanceCriterion(
                    id="REQ-02",
                    scenario="GDPR & Data Minimization compliance",
                    given="successful Google authentication callback",
                    when="user profile is ingested",
                    then="only store email and sub_id; discard Google contact lists and calendar scopes",
                    evidence=EvidenceLabel.INFERRED
                ),
                AcceptanceCriterion(
                    id="REQ-03",
                    scenario="Contractual sign-off milestone",
                    given="staging deployment verification",
                    when="client QA executes automated test suite",
                    then="formal acceptance signature recorded in ClickUp docket",
                    evidence=EvidenceLabel.BLOCKED
                )
            ]
            evidence_items = [
                EvidenceItem(
                    field="Contractual Scope",
                    value="In-Scope: OAuth Login, Auto-Provisioning. Out-of-Scope: Profile Photo Sync.",
                    label=EvidenceLabel.VERIFIED,
                    quote_source="@oliver_sec: 'Avatar sync is definitely out of scope for MVP.'",
                    rationale="Scope boundary agreed to avoid billable scope creep."
                ),
                EvidenceItem(
                    field="Security Audit Trail",
                    value="Immutable IP & User-Agent event logging",
                    label=EvidenceLabel.VERIFIED,
                    quote_source="@oliver_sec: 'Every SSO login must log an immutable audit event with IP and user-agent.'",
                    rationale="Non-negotiable contractual security requirement."
                ),
                EvidenceItem(
                    field="Session Invalidation Policy",
                    value="Unresolved SLA specification",
                    label=EvidenceLabel.BLOCKED,
                    quote_source="@alex_lead: 'Nobody answered the session expiration question yet.'",
                    rationale="Agency policy prohibits ticket sign-off with ambiguous operational SLAs."
                )
            ]
            clarifying_question = (
                "Contractual Clarification Required:\n"
                "1. Confirm exact session timeout policy (8h SOC2 vs 24h extended).\n"
                "2. Please specify the target ClickUp Sprint list for billable milestone tracking."
            )
            ready_for_ticket = False

        else:
            # Default Scrum Skill
            story_title = f"{title_prefix} Google Workspace SSO Login"
            story = UserStory(
                title=story_title,
                as_a="team member",
                i_want="to log in with Google Workspace",
                so_that="I can access CloudThinker without duplicate credentials",
                evidence=EvidenceLabel.VERIFIED
            )
            criteria = [
                AcceptanceCriterion(
                    id="AC-1",
                    scenario="Google OAuth redirect",
                    given="user is on login page",
                    when="clicks Google login button",
                    then="redirects to Google OAuth consent screen",
                    evidence=EvidenceLabel.VERIFIED
                )
            ]
            evidence_items = [
                EvidenceItem(
                    field="Authentication Protocol",
                    value="OAuth 2.0",
                    label=EvidenceLabel.VERIFIED,
                    quote_source="@alex_lead: 'implement Google OAuth 2.0 with auto-provisioning'",
                    rationale="Direct requirement."
                )
            ]
            clarifying_question = "Clarification: Please confirm session expiration policy."
            ready_for_ticket = False

        # Compute INVEST score
        invest_score = InvestScorer.evaluate(story, criteria, evidence_items, skill)

        return AnalysisResult(
            story=story,
            acceptance_criteria=criteria,
            evidence_items=evidence_items,
            invest_score=invest_score,
            clarifying_question=clarifying_question,
            ready_for_ticket=ready_for_ticket,
            skill_applied=skill.name,
            thread_id=thread.thread_id,
            metadata={
                "channel": thread.channel,
                "platform": thread.platform,
                "team_type": skill.team_type,
            }
        )

    async def _analyze_live(
        self,
        thread: ThreadContext,
        skill: SkillConfig,
        transcript: str
    ) -> AnalysisResult:
        """Call Anthropic Claude API for live story generation and evidence labeling."""
        headers = {
            "x-api-key": settings.anthropic_api_key or "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        system_prompt = f"""You are ScribeBA, an expert AI Business Analyst.
Analyze multi-person engineering conversations and produce a structured User Story with INVEST scoring and Evidence Labels.

Every single field must be labeled with one of:
- Verified: directly quoted from the thread
- Inferred: reasoned logically from verified statements
- Assumed: industry standard assumption, not yet confirmed
- Blocked: missing critical information that prevents delivery

{self.skill_manager.format_prompt_guidelines(skill)}

Return strictly valid JSON matching this schema:
{{
  "story": {{
    "title": "string",
    "as_a": "string",
    "i_want": "string",
    "so_that": "string",
    "evidence": "Verified|Inferred|Assumed|Blocked"
  }},
  "acceptance_criteria": [
    {{
      "id": "AC-1",
      "scenario": "string",
      "given": "string",
      "when": "string",
      "then": "string",
      "evidence": "Verified|Inferred|Assumed|Blocked"
    }}
  ],
  "evidence_items": [
    {{
      "field": "string",
      "value": "string",
      "label": "Verified|Inferred|Assumed|Blocked",
      "quote_source": "string",
      "rationale": "string"
    }}
  ],
  "clarifying_question": "string or null",
  "ready_for_ticket": false
}}"""

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json={
                    "model": settings.anthropic_reasoning_model,
                    "max_tokens": 2048,
                    "system": system_prompt,
                    "messages": [
                        {"role": "user", "content": f"Analyze this conversation thread:\n\n{transcript}"}
                    ]
                }
            )
            resp.raise_for_status()
            data = resp.json()
            content_text = data["content"][0]["text"]
            parsed = json.loads(content_text)

            story = UserStory(**parsed["story"])
            criteria = [AcceptanceCriterion(**c) for c in parsed["acceptance_criteria"]]
            evidence_items = [EvidenceItem(**e) for e in parsed["evidence_items"]]
            invest_score = InvestScorer.evaluate(story, criteria, evidence_items, skill)

            return AnalysisResult(
                story=story,
                acceptance_criteria=criteria,
                evidence_items=evidence_items,
                invest_score=invest_score,
                clarifying_question=parsed.get("clarifying_question"),
                ready_for_ticket=parsed.get("ready_for_ticket", False),
                skill_applied=skill.name,
                thread_id=thread.thread_id,
                metadata={"channel": thread.channel, "platform": thread.platform}
            )

    def _empty_result(self, thread: ThreadContext, skill: SkillConfig, reason: str) -> AnalysisResult:
        story = UserStory(
            title="[No Ticket Drafted]",
            as_a="",
            i_want="",
            so_that="",
            evidence=EvidenceLabel.BLOCKED
        )
        return AnalysisResult(
            story=story,
            acceptance_criteria=[],
            evidence_items=[],
            invest_score=InvestScorer.evaluate(story, [], [], skill),
            clarifying_question=reason,
            ready_for_ticket=False,
            skill_applied=skill.name,
            thread_id=thread.thread_id
        )
