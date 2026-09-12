from typing import List, Dict, Any
from ..core.models import AnalysisResult, EvidenceLabel, TicketPayload

class MessageFormatter:
    """Formats ScribeBA results for Slack Block Kit, Discord embeds, and Markdown."""

    @classmethod
    def to_markdown(cls, result: AnalysisResult) -> str:
        story = result.story
        score = result.invest_score

        lines = [
            f"### 📋 {story.title}",
            "",
            f"**As a** {story.as_a}  ",
            f"**I want** {story.i_want}  ",
            f"**So that** {story.so_that}",
            "",
            f"**INVEST Score: {score.overall}/100** "
            f"(I:{score.independent} N:{score.negotiable} V:{score.valuable} "
            f"E:{score.estimable} S:{score.small} T:{score.testable})",
            "",
            "#### ✅ Acceptance Criteria:",
        ]

        for ac in result.acceptance_criteria:
            badge = cls._badge_emoji(ac.evidence)
            lines.append(f"- {badge} **{ac.id}: {ac.scenario}**")
            lines.append(f"  - *Given* {ac.given}")
            lines.append(f"  - *When* {ac.when}")
            lines.append(f"  - *Then* {ac.then}")

        lines.extend([
            "",
            "#### 🔍 Evidence Breakdown:",
        ])

        for ev in result.evidence_items:
            badge = cls._badge_emoji(ev.label)
            lines.append(f"- {badge} **[{ev.label.value.upper()}] {ev.field}**: `{ev.value}`")
            if ev.quote_source:
                lines.append(f"  *Source*: {ev.quote_source}")

        if result.clarifying_question:
            lines.extend([
                "",
                "---",
                f"❓ **Clarification Required**:  \n> {result.clarifying_question}"
            ])

        return "\n".join(lines)

    @classmethod
    def to_slack_blocks(cls, result: AnalysisResult) -> List[Dict[str, Any]]:
        """Format as Slack Block Kit JSON."""
        story = result.story
        score = result.invest_score

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"📋 ScribeBA: {story.title}", "emoji": True}
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*As a* {story.as_a}\n"
                        f"*I want* {story.i_want}\n"
                        f"*So that* {story.so_that}\n\n"
                        f"*INVEST Score*: `{score.overall}/100` "
                        f"(Indep: {score.independent}, Testable: {score.testable})"
                    )
                }
            },
            {"type": "divider"}
        ]

        # Criteria
        ac_lines = []
        for ac in result.acceptance_criteria:
            emoji = cls._badge_emoji(ac.evidence)
            ac_lines.append(f"{emoji} *{ac.id}*: {ac.scenario} → `{ac.then}`")

        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*Acceptance Criteria:*\n" + "\n".join(ac_lines)}
        })

        # Clarification question
        if result.clarifying_question:
            blocks.extend([
                {"type": "divider"},
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"⚠️ *Clarification Needed Before ClickUp Sync:*\n>{result.clarifying_question}"
                    }
                }
            ])
        else:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Approve & Create ClickUp Task"},
                        "style": "primary",
                        "action_id": "approve_ticket"
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Edit Story"},
                        "action_id": "edit_story"
                    }
                ]
            })

        return blocks

    @classmethod
    def _badge_emoji(cls, label: EvidenceLabel) -> str:
        if label == EvidenceLabel.VERIFIED:
            return "🟢"
        elif label == EvidenceLabel.INFERRED:
            return "🟡"
        elif label == EvidenceLabel.ASSUMED:
            return "🟣"
        elif label == EvidenceLabel.BLOCKED:
            return "🔴"
        return "⚪"
