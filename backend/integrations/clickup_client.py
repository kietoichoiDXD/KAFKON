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

    async def list_tasks(self, page_size: int = 50, max_pages: int = 3) -> List[Dict[str, str]]:
        """Read a bounded set of tasks from the configured ClickUp list."""
        if not self.api_key or not self.list_id:
            raise ValueError("ClickUp is not configured. Set CLICKUP_API_KEY and CLICKUP_LIST_ID to load tasks.")
        page_size = max(1, min(int(page_size), 100))
        max_pages = max(1, min(int(max_pages), 3))
        output: List[Dict[str, str]] = []
        for page in range(max_pages):
            url = f"https://api.clickup.com/api/v2/list/{self.list_id}/task"
            headers = {"Authorization": self.api_key, "Content-Type": "application/json"}
            params = {"page": page, "per_page": page_size, "order_by": "updated", "reverse": "true", "include_closed": "true", "subtasks": "true"}
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()
            tasks = data.get("tasks", [])
            for task in tasks:
                status = task.get("status") or {}
                status_name = status.get("status") if isinstance(status, dict) else status
                output.append({
                    "id": str(task.get("id") or ""),
                    "name": str(task.get("name") or "Untitled task"),
                    "description": str(task.get("description") or ""),
                    "url": str(task.get("url") or ""),
                    "status": str(status_name or "Open"),
                })
            if len(tasks) < page_size:
                break
        return output[:page_size * max_pages]

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
                print(f"[ClickUp] Task was NOT created: {e}")

        # Not filed. A fabricated CLK-xxxxxx id and a link that 404s would read exactly like a
        # real ticket in a demo; leaving both empty is the honest signal that nothing was created.
        return TicketPayload(
            title=story.title,
            description_markdown=description_md,
            priority=priority_str,
            tags=tags,
            custom_fields=custom_fields,
            thread_link=thread_url,
            created_task_id=None,
            clickup_url=None,
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
            f"- **Source Thread**: {thread_url or 'Unavailable'}",
            f"- **INVEST Verification Score**: `{result.invest_score.overall}/100`",
            f"- **Verified Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Verified')}",
            f"- **Inferred Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Inferred')}",
            f"- **Assumed Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Assumed')}",
            f"- **Blocked Claims**: {sum(1 for e in result.evidence_items if e.label.value == 'Blocked')}",
            "",
            "### Source Evidence by Claim",
        ]
        for evidence in result.evidence_items:
            source = evidence.source_message
            audit_trail.append(f"- **{evidence.field}** — `{evidence.label.value}`: {evidence.value}")
            if source and source.match_status == "matched":
                excerpt = source.excerpt.replace("\n", " ").strip()
                source_label = " · ".join(part for part in [source.author, source.timestamp] if part)
                source_url = source.thread_url or thread_url
                if source_url:
                    source_label = f"[{source_label or 'Open source thread'}]({source_url})"
                audit_trail.append(f"  - **Source**: {source_label or 'Matched message'} · `{source.message_id}`")
                if excerpt:
                    audit_trail.append(f"  - **Excerpt**: > {excerpt[:500]}")
            else:
                citation = evidence.quote_source or "No source quote recorded."
                audit_trail.append(f"  - **Source unresolved**: {citation}")
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
