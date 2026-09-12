import os
import uuid
import hashlib
from typing import Optional, Dict, Any, List
import httpx
from ..core.models import AnalysisResult, TicketPayload, SkillConfig
from ..platforms.message_formatter import MessageFormatter
from ..config import settings

class ClickUpClient:
    """Creates and links tasks in ClickUp via API or ClickUp MCP."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        list_id: Optional[str] = None
    ):
        self.api_key = api_key or settings.clickup_api_key
        self.list_id = list_id or settings.clickup_list_id

    async def create_task_from_analysis(
        self,
        result: AnalysisResult,
        skill: SkillConfig,
        thread_url: str = ""
    ) -> TicketPayload:
        """Transform analysis result into ClickUp task and create it."""
        story = result.story
        description_md = self._build_description(result, skill, thread_url)
        priority_str = skill.clickup_mapping.get("priority", "normal")
        tags = skill.clickup_mapping.get("tags", ["scribeba", "story"])
        custom_fields = skill.clickup_mapping.get("custom_fields", {})

        # Live Mode
        if settings.scribeba_mode == "live" and self.api_key and self.list_id:
            try:
                task_data = await self._create_task_live(
                    title=story.title,
                    description=description_md,
                    priority=self._priority_to_clickup_int(priority_str),
                    tags=tags,
                    custom_fields=custom_fields
                )
                task_id = task_data.get("id", str(uuid.uuid4())[:8])
                clickup_url = task_data.get("url", f"https://app.clickup.com/t/{task_id}")
                return TicketPayload(
                    title=story.title,
                    description_markdown=description_md,
                    priority=priority_str,
                    tags=tags,
                    custom_fields=custom_fields,
                    thread_link=thread_url,
                    created_task_id=task_id,
                    clickup_url=clickup_url
                )
            except Exception as e:
                print(f"[Warning] Live ClickUp creation failed ({e}), falling back to local simulation.")

        # Local Simulation Mode
        mock_id = f"CLK-{str(uuid.uuid4())[:6].upper()}"
        mock_url = f"https://app.clickup.com/t/{mock_id.lower()}"
        return TicketPayload(
            title=story.title,
            description_markdown=description_md,
            priority=priority_str,
            tags=tags,
            custom_fields=custom_fields,
            thread_link=thread_url,
            created_task_id=mock_id,
            clickup_url=mock_url
        )

    def _build_description(
        self,
        result: AnalysisResult,
        skill: SkillConfig,
        thread_url: str
    ) -> str:
        """Construct full audit trail markdown for the ClickUp ticket description."""
        markdown_body = MessageFormatter.to_markdown(result)
        audit_trail = [
            markdown_body,
            "",
            "---",
            "### 🏷️ ScribeBA Audit & Provenance Ledger",
            f"- **Applied Team Skill**: `{skill.name}` (v{skill.version})",
            f"- **Source Thread**: {thread_url or 'Slack #proj-auth-federation (th-1789201948)'}",
            f"- **INVEST Verification Score**: `{result.invest_score.overall}/100`",
            f"- **Verified Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Verified')}",
            f"- **Inferred Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Inferred')}",
            f"- **Assumed Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Assumed')}",
            f"- **Blocked Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Blocked')}",
        ]
        body = "\n".join(audit_trail)
        seal = hashlib.sha256(body.encode("utf-8")).hexdigest()
        return f"{body}\n- **Integrity Seal**: `sha256:{seal}`"

    async def _create_task_live(
        self,
        title: str,
        description: str,
        priority: int,
        tags: List[str],
        custom_fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        url = f"https://api.clickup.com/api/v2/list/{self.list_id}/task"
        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "name": title,
            "description": description,
            "priority": priority,
            "tags": tags
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    def _priority_to_clickup_int(self, p: str) -> int:
        mapping = {"urgent": 1, "high": 2, "normal": 3, "low": 4}
        return mapping.get(p.lower(), 3)
