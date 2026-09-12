import os
from pathlib import Path
from typing import Dict, List, Optional
import yaml
from .models import SkillConfig
from ..config import settings

class SkillManager:
    """Manages loading, parsing, and applying team-specific ScribeBA Skills."""

    def __init__(self, skills_dir: Optional[Path] = None):
        self.skills_dir = skills_dir or settings.skills_dir
        self._skills_cache: Dict[str, SkillConfig] = {}
        self.reload_skills()

    def reload_skills(self) -> None:
        """Scan skills directory and cache valid yaml skills."""
        self._skills_cache.clear()
        if not self.skills_dir.exists():
            return

        for file_path in self.skills_dir.glob("*.yaml"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                if data and "name" in data:
                    skill = SkillConfig(**data)
                    self._skills_cache[skill.name] = skill
            except Exception as e:
                print(f"[Warning] Failed to load skill {file_path.name}: {e}")

    def list_skills(self) -> List[str]:
        """Return names of all available skills."""
        return sorted(list(self._skills_cache.keys()))

    def get_skill(self, name: str) -> SkillConfig:
        """Fetch a skill by name, falling back to default or startup_lean."""
        if name in self._skills_cache:
            return self._skills_cache[name]
        
        default_name = settings.default_skill
        if default_name in self._skills_cache:
            return self._skills_cache[default_name]
        
        # Fallback minimal default
        return SkillConfig(
            name="fallback",
            description="Minimal fallback skill",
            formatting={"title_prefix": "[Story]"}
        )

    def format_prompt_guidelines(self, skill: SkillConfig) -> str:
        """Generate LLM system instructions tailored to this specific skill."""
        return f"""### Active Team Skill: {skill.name} (v{skill.version})
Team Classification: {skill.team_type}
Description: {skill.description}

#### Formatting Requirements:
- Title Prefix: {skill.formatting.get('title_prefix', '[Story]')}
- User Story Format: {skill.formatting.get('user_story_format', 'As a..., I want..., So that...')}
- Acceptance Criteria Style: {skill.formatting.get('acceptance_criteria_format', 'Given/When/Then')}

#### Required Fields:
{', '.join(skill.required_fields)}

#### Clarification Rules:
- Ask question when fields are Assumed: {skill.clarification_policy.get('ask_on_assumed', True)}
- Ask question when fields are Blocked: {skill.clarification_policy.get('ask_on_blocked', True)}
- Max Clarifying Questions: {skill.clarification_policy.get('max_questions_per_round', 1)}
"""
