import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Runtime mode: 'local' (offline demo) or 'live' (real MCP/APIs)
    scribeba_mode: str = Field(default="local", alias="SCRIBEBA_MODE")

    # Anthropic
    anthropic_api_key: Optional[str] = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_routing_model: str = Field(default="claude-3-5-haiku-20241022", alias="ANTHROPIC_ROUTING_MODEL")
    anthropic_reasoning_model: str = Field(default="claude-3-7-sonnet-20250219", alias="ANTHROPIC_REASONING_MODEL")

    # ClickUp
    clickup_api_key: Optional[str] = Field(default=None, alias="CLICKUP_API_KEY")
    clickup_team_id: Optional[str] = Field(default=None, alias="CLICKUP_TEAM_ID")
    clickup_space_id: Optional[str] = Field(default=None, alias="CLICKUP_SPACE_ID")
    clickup_list_id: Optional[str] = Field(default=None, alias="CLICKUP_LIST_ID")

    # Slack
    slack_bot_token: Optional[str] = Field(default=None, alias="SLACK_BOT_TOKEN")
    slack_app_token: Optional[str] = Field(default=None, alias="SLACK_APP_TOKEN")
    slack_signing_secret: Optional[str] = Field(default=None, alias="SLACK_SIGNING_SECRET")

    # Discord
    discord_bot_token: Optional[str] = Field(default=None, alias="DISCORD_BOT_TOKEN")

    # Skills
    default_skill: str = Field(default="startup_lean", alias="DEFAULT_SKILL")
    skills_dir: Path = Field(default_factory=lambda: BASE_DIR / "skills")

settings = Settings()
