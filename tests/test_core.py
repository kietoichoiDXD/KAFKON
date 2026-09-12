import unittest
from pathlib import Path
from src.core.models import (
    UserStory,
    AcceptanceCriterion,
    EvidenceItem,
    EvidenceLabel,
    SkillConfig,
)
from src.core.scorer import InvestScorer
from src.core.skills import SkillManager


class TestInvestScorer(unittest.TestCase):
    def setUp(self):
        self.skill = SkillConfig(
            name="test_skill",
            team_type="early_stage_startup",
            required_fields=["user_story", "acceptance_criteria"],
            formatting={"title_prefix": "[MVP]"},
        )
        self.story = UserStory(
            title="[MVP] Google OAuth SSO",
            as_a="enterprise engineer",
            i_want="to log in via Google",
            so_that="I can access CloudThinker securely",
        )
        self.criteria = [
            AcceptanceCriterion(
                id="AC-1",
                scenario="Valid domain",
                given="User on login page",
                when="Clicks Google SSO",
                then="Successfully authenticated",
                evidence=EvidenceLabel.VERIFIED,
            ),
            AcceptanceCriterion(
                id="AC-2",
                scenario="Invalid domain",
                given="User on login page",
                when="Clicks with unauthorized email",
                then="Shows domain error",
                evidence=EvidenceLabel.VERIFIED,
            ),
        ]

    def test_invest_scoring_no_blockers(self):
        evidence = [
            EvidenceItem(
                field="Domain",
                value="@acmecorp.com",
                label=EvidenceLabel.VERIFIED,
                quote="Strictly @acmecorp.com",
            )
        ]
        score = InvestScorer.evaluate(
            story=self.story,
            criteria=self.criteria,
            evidence_items=evidence,
            skill=self.skill,
        )
        self.assertEqual(score.independent, 95)
        self.assertGreaterEqual(score.overall, 85)
        self.assertFalse(any("blocked" in f.lower() for f in score.feedback))

    def test_invest_scoring_with_blocker(self):
        evidence = [
            EvidenceItem(
                field="Session Policy",
                value="Unspecified SLA",
                label=EvidenceLabel.BLOCKED,
                quote="Waiting for customer confirmation",
            )
        ]
        score = InvestScorer.evaluate(
            story=self.story,
            criteria=self.criteria,
            evidence_items=evidence,
            skill=self.skill,
        )
        self.assertEqual(score.independent, 60)
        self.assertTrue(any("blocked" in f.lower() for f in score.feedback))


class TestSkillManager(unittest.TestCase):
    def setUp(self):
        self.sm = SkillManager()

    def test_skills_loaded(self):
        skills = self.sm.list_skills()
        self.assertIn("startup_lean", skills)
        self.assertIn("agency_detailed", skills)
        self.assertIn("default", skills)

    def test_get_skill_specific_and_fallback(self):
        lean = self.sm.get_skill("startup_lean")
        self.assertEqual(lean.team_type, "early_stage_startup")

        agency = self.sm.get_skill("agency_detailed")
        self.assertEqual(agency.team_type, "client_agency")

        unknown = self.sm.get_skill("non_existent_skill_xyz")
        self.assertIsNotNone(unknown)

    def test_prompt_guidelines_generation(self):
        lean = self.sm.get_skill("startup_lean")
        prompt_guide = self.sm.format_prompt_guidelines(lean)
        self.assertIn("Active Team Skill: startup_lean", prompt_guide)
        self.assertIn("Title Prefix: [MVP]", prompt_guide)


if __name__ == "__main__":
    unittest.main()
