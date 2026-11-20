from typing import List, Dict, Any
from ..core.models import AnalysisResult, EvidenceLabel, TicketPayload

class MessageFormatter:
    """Formats ScribeBA results for Slack Block Kit, Discord embeds, and Markdown."""

    @classmethod
    def to_markdown(cls, result: AnalysisResult) -> str:
        story = result.story
        score = result.invest_score

        lines = [
            f"## 🎯 {story.title}",
            "",
            f"> **As a** {story.as_a}, **I want** {story.i_want}, **So that** {story.so_that}.",
            "",
            f"**INVEST Score**: `{score.overall}/100` · **3-Axis Guard**: Verified",
            "",
            "---",
            "### 📋 Actionable Tasks Breakdown",
        ]

        tasks = getattr(result, "decomposed_tasks", []) or []
        if tasks:
            for t in tasks:
                owner = f" ({t.owner})" if t.owner else ""
                lines.append(f"- [ ] **{t.title}**{owner}")
                if t.description:
                    lines.append(f"  - {t.description}")
        else:
            for ac in result.acceptance_criteria:
                lines.append(f"- [ ] **{ac.scenario}**: {ac.then}")

        lines.extend([
            "",
            "---",
            "### ✅ Acceptance Checklist",
        ])

        for ac in result.acceptance_criteria:
            badge = cls._badge_emoji(ac.evidence)
            lines.append(f"- [ ] {badge} **{ac.id}: {ac.scenario}**")
            if getattr(ac, "given", None) or getattr(ac, "when", None) or getattr(ac, "then", None):
                if getattr(ac, "given", None):
                    lines.append(f"    - **Given:** {ac.given}")
                if getattr(ac, "when", None):
                    lines.append(f"    - **When:** {ac.when}")
                if getattr(ac, "then", None):
                    lines.append(f"    - **Then:** {ac.then}")
            elif getattr(ac, "then", None):
                lines.append(f"    - **Outcome:** `{ac.then}`")

        if result.clarifying_question:
            lines.extend([
                "",
                "---",
                f"⚠️ **Clarification Needed**:  \n> {result.clarifying_question}"
            ])

        return "\n".join(lines)

    @classmethod
    def to_slack_blocks(cls, result: AnalysisResult) -> List[Dict[str, Any]]:
        """Format as compact, executive Slack Block Kit JSON."""
        story = result.story
        score = result.invest_score

        objective = story.so_that or story.i_want
        telemetry = getattr(result, "agent_telemetry", None)
        noise_info = f" · *Anti-Noise*: Đã lọc {telemetry.noise_filtered_count} tin nhiễu" if telemetry and telemetry.noise_filtered_count > 0 else " · *Anti-Noise Guard*: Active"

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"🎯 ScribeBA: {story.title[:140]}", "emoji": True}
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*Mục tiêu*: {objective}\n"
                        f"*INVEST Score*: `{score.overall}/100`{noise_info}"
                    )
                }
            },
            {"type": "divider"}
        ]

        # Decomposed Tasks Breakdown
        tasks = getattr(result, "decomposed_tasks", []) or []
        if tasks:
            task_lines = []
            for t in tasks[:5]:
                owner_str = f" `{t.owner}`" if t.owner else ""
                desc_str = f" — {t.description}" if t.description else ""
                task_lines.append(f"• 🔹 *{t.title}*{owner_str}{desc_str}")
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*📋 Các Task bóc tách từ hội thoại:*\n" + "\n".join(task_lines)
                }
            })

        # Acceptance Criteria (Concise bullets)
        ac_lines = []
        for ac in result.acceptance_criteria[:4]:
            emoji = cls._badge_emoji(ac.evidence)
            ac_lines.append(f"• {emoji} *{ac.id}*: {ac.scenario}")

        if ac_lines:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": "*✅ Tiêu chí nghiệm thu (Acceptance Criteria):*\n" + "\n".join(ac_lines)}
            })

        # Clarification question (Single concise notice)
        if result.clarifying_question:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"⚠️ *Cần làm rõ*: {result.clarifying_question}"
                }
            })
        else:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Approve & Sync ClickUp Task"},
                        "style": "primary",
                        "action_id": "approve_ticket"
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
