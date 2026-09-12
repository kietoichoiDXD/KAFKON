from typing import List, Tuple
from .models import UserStory, AcceptanceCriterion, EvidenceItem, EvidenceLabel, InvestScore, SkillConfig

class InvestScorer:
    """Evaluates User Stories against the Agile INVEST rubric with Evidence grounding."""

    @classmethod
    def evaluate(
        cls,
        story: UserStory,
        criteria: List[AcceptanceCriterion],
        evidence_items: List[EvidenceItem],
        skill: SkillConfig
    ) -> InvestScore:
        feedback: List[str] = []

        # 1. Independent (Check for unresolved dependencies or blocked state)
        has_blocker = any(e.label == EvidenceLabel.BLOCKED for e in evidence_items)
        if has_blocker:
            independent = 60
            feedback.append("Story contains blocked architectural dependencies.")
        else:
            independent = 95

        # 2. Negotiable (Does it capture user need without hardcoding internal DB/variable names?)
        if "users table" in story.so_that.lower() or "sql" in story.so_that.lower():
            negotiable = 70
            feedback.append("Story contains technical implementation details in business benefit.")
        else:
            negotiable = 88

        # 3. Valuable (Does it state clear business or customer gain?)
        if len(story.so_that.strip()) > 15:
            valuable = 92
        else:
            valuable = 65
            feedback.append("Business benefit 'so that' lacks depth or quantifiable outcome.")

        # 4. Estimable (Are acceptance criteria well-specified?)
        verified_count = sum(1 for c in criteria if c.evidence in (EvidenceLabel.VERIFIED, EvidenceLabel.INFERRED))
        if len(criteria) >= 2 and verified_count >= 1:
            estimable = 88
        else:
            estimable = 60
            feedback.append("Insufficient verified acceptance criteria for reliable team sizing.")

        # 5. Small (Is it an MVP unit or a massive epic?)
        if skill.team_type == "early_stage_startup":
            # Startups value hyper-small scope
            small = 90 if len(criteria) <= 4 else 75
        else:
            small = 85

        # 6. Testable (Does each AC have unambiguous Given/When/Then outcomes?)
        has_testable_scenarios = all(bool(c.when and c.then) for c in criteria)
        testable = 92 if has_testable_scenarios else 65
        if not has_testable_scenarios:
            feedback.append("One or more acceptance criteria lack definitive verification outcomes.")

        # Weighted Overall Score
        overall = int(
            (independent * 0.20)
            + (negotiable * 0.10)
            + (valuable * 0.20)
            + (estimable * 0.20)
            + (small * 0.15)
            + (testable * 0.15)
        )

        return InvestScore(
            independent=independent,
            negotiable=negotiable,
            valuable=valuable,
            estimable=estimable,
            small=small,
            testable=testable,
            overall=overall,
            feedback=feedback
        )
