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
                raw_priority = task.get("priority")
                priority_name = raw_priority.get("priority") if isinstance(raw_priority, dict) else (raw_priority or "normal")
                assignees = [
                    u.get("username") or u.get("email") or str(u.get("id"))
                    for u in task.get("assignees", [])
                    if isinstance(u, dict)
                ]
                tags = [t.get("name") for t in task.get("tags", []) if isinstance(t, dict)]
                output.append({
                    "id": str(task.get("id") or ""),
                    "name": str(task.get("name") or "Untitled task"),
                    "description": str(task.get("description") or ""),
                    "url": str(task.get("url") or ""),
                    "status": str(status_name or "Open"),
                    "priority": str(priority_name or "normal"),
                    "assignees": assignees,
                    "tags": tags,
                    "date_updated": str(task.get("date_updated") or ""),
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
        """Construct a clean, concise, executive Agile task description for ClickUp."""
        story = result.story
        score = result.invest_score

        sections = [
            "## 🎯 Objective & Business Value",
            f"> **As an** {story.as_a}, **I want** {story.i_want}, **So that** {story.so_that}.",
            "",
            f"**INVEST Score**: `{score.overall}/100` · **Skill**: `{skill.name}`",
            "",
            "---",
            "## 📋 Actionable Tasks Breakdown",
        ]

        tasks = getattr(result, "decomposed_tasks", []) or []
        if tasks:
            for t in tasks:
                owner_text = f" ({t.owner})" if t.owner else ""
                sections.append(f"- [ ] **{t.title}**{owner_text}")
                if t.description:
                    sections.append(f"  - {t.description}")
        else:
            for ac in result.acceptance_criteria:
                sections.append(f"- [ ] **{ac.scenario}**")
                sections.append(f"  - When {ac.when}, then {ac.then}")

        sections.extend([
            "",
            "---",
            "## ✅ Acceptance Checklist (Gherkin Scenarios)",
        ])
        for ac in result.acceptance_criteria:
            badge = "🟢" if getattr(ac.evidence, "value", str(ac.evidence)) == "Verified" else "🟡" if getattr(ac.evidence, "value", str(ac.evidence)) == "Inferred" else "🟣" if getattr(ac.evidence, "value", str(ac.evidence)) == "Assumed" else "🔴"
            sections.append(f"- [ ] {badge} **{ac.id}: {ac.scenario}**")
            if getattr(ac, "given", None) or getattr(ac, "when", None) or getattr(ac, "then", None):
                if getattr(ac, "given", None):
                    sections.append(f"    - **Given:** {ac.given}")
                if getattr(ac, "when", None):
                    sections.append(f"    - **When:** {ac.when}")
                if getattr(ac, "then", None):
                    sections.append(f"    - **Then:** {ac.then}")
            elif getattr(ac, "then", None):
                sections.append(f"    - **Outcome:** `{ac.then}`")

        if result.clarifying_question:
            sections.extend([
                "",
                "---",
                "## ⚠️ Clarification Needed",
                f"> {result.clarifying_question}",
            ])

        verified_count = sum(1 for e in result.evidence_items if e.label.value == "Verified")
        telemetry = getattr(result, "agent_telemetry", None)
        noise_note = f" · Anti-Noise: `{telemetry.noise_filtered_count} items quarantined`" if telemetry and telemetry.noise_filtered_count > 0 else ""
        sections.extend([
            "",
            "---",
            f"📌 **Source Thread**: [{thread_url or 'Slack Link'}]({thread_url or '#'})",
            f"🛡️ **3-Axis Provenance**: `{verified_count}/{len(result.evidence_items)} Claims Verified`{noise_note}",
        ])

        body = "\n".join(sections)
        seal = hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]
        return f"{body}\n\n`Integrity Seal: sha256:{seal}`"

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
            "markdown_content": description,
            "priority": priority,
            "tags": tags
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def update_task_markdown(self, task_id: str, markdown_content: str) -> Dict[str, Any]:
        """Update an existing task with parsed rich markdown formatting."""
        if not self.api_key:
            raise ValueError("ClickUp is not configured.")
        url = f"https://api.clickup.com/api/v2/task/{task_id}"
        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "description": markdown_content,
            "markdown_content": markdown_content
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.put(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    def _priority_to_clickup_int(self, p: str) -> int:
        mapping = {"urgent": 1, "high": 2, "normal": 3, "low": 4}
        return mapping.get(p.lower(), 3)

    async def create_simple_task(
        self,
        name: str,
        description: str = "",
        priority: str = "high",
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create a single task in ClickUp list with specified priority and tags."""
        if not self.api_key or not self.list_id:
            raise ValueError("ClickUp is not configured. Set CLICKUP_API_KEY and CLICKUP_LIST_ID.")
        
        priority_int = self._priority_to_clickup_int(priority)
        clean_tags = tags or ["agent-priority", "scribeba"]
        res = await self._create_task_live(
            title=name,
            description=description or f"Created via ScribeBA Task Prioritizer on {name}",
            priority=priority_int,
            tags=clean_tags,
            custom_fields={}
        )
        return {
            "id": res.get("id", ""),
            "name": res.get("name", name),
            "url": res.get("url", f"https://app.clickup.com/t/{res.get('id', '')}"),
            "status": "to do"
        }
