from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class EvidenceLabel(str, Enum):
    VERIFIED = "Verified"
    INFERRED = "Inferred"
    ASSUMED = "Assumed"
    BLOCKED = "Blocked"

class EvidenceItem(BaseModel):
    field: str
    value: str
    label: EvidenceLabel
    quote_source: Optional[str] = None
    rationale: Optional[str] = None

class AcceptanceCriterion(BaseModel):
    id: str
    scenario: str
    given: str
    when: str
    then: str
    evidence: EvidenceLabel = EvidenceLabel.VERIFIED

class UserStory(BaseModel):
    title: str
    as_a: str
    i_want: str
    so_that: str
    evidence: EvidenceLabel = EvidenceLabel.VERIFIED

class InvestScore(BaseModel):
    independent: int = Field(ge=0, le=100)
    negotiable: int = Field(ge=0, le=100)
    valuable: int = Field(ge=0, le=100)
    estimable: int = Field(ge=0, le=100)
    small: int = Field(ge=0, le=100)
    testable: int = Field(ge=0, le=100)
    overall: int = Field(ge=0, le=100)
    feedback: List[str] = Field(default_factory=list)

class ChatMessage(BaseModel):
    author: str
    timestamp: str
    text: str

class ThreadContext(BaseModel):
    thread_id: str
    channel: str
    platform: str = "slack"
    messages: List[ChatMessage]

    def to_formatted_transcript(self) -> str:
        return "\n".join(
            f"[{msg.timestamp}] {msg.author}: {msg.text}"
            for msg in self.messages
        )

class SkillConfig(BaseModel):
    name: str
    version: str = "1.0.0"
    description: str = ""
    team_type: str = "general"
    formatting: Dict[str, Any] = Field(default_factory=dict)
    required_fields: List[str] = Field(default_factory=list)
    invest_thresholds: Dict[str, Any] = Field(default_factory=dict)
    clarification_policy: Dict[str, Any] = Field(default_factory=dict)
    clickup_mapping: Dict[str, Any] = Field(default_factory=dict)

class AnalysisResult(BaseModel):
    story: UserStory
    acceptance_criteria: List[AcceptanceCriterion]
    evidence_items: List[EvidenceItem]
    invest_score: InvestScore
    clarifying_question: Optional[str] = None
    ready_for_ticket: bool = False
    skill_applied: str = "default"
    thread_id: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)

class TicketPayload(BaseModel):
    title: str
    description_markdown: str
    priority: str = "normal"
    tags: List[str] = Field(default_factory=list)
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    thread_link: str = ""
    created_task_id: Optional[str] = None
    clickup_url: Optional[str] = None
