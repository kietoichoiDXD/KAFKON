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
    anthropic_routing_model: str = Field(default="claude-haiku-4-5", alias="ANTHROPIC_ROUTING_MODEL")
    anthropic_reasoning_model: str = Field(default="claude-opus-5", alias="ANTHROPIC_REASONING_MODEL")

    # ClickUp
    clickup_api_key: Optional[str] = Field(default=None, alias="CLICKUP_API_KEY")
    clickup_team_id: Optional[str] = Field(default=None, alias="CLICKUP_TEAM_ID")
    clickup_space_id: Optional[str] = Field(default=None, alias="CLICKUP_SPACE_ID")
    clickup_list_id: Optional[str] = Field(default=None, alias="CLICKUP_LIST_ID")
    clickup_client_id: Optional[str] = Field(default=None, alias="CLICKUP_CLIENT_ID")
    clickup_client_secret: Optional[str] = Field(default=None, alias="CLICKUP_CLIENT_SECRET")

    # Slack
    slack_bot_token: Optional[str] = Field(default=None, alias="SLACK_BOT_TOKEN")
    slack_user_token: Optional[str] = Field(default=None, alias="SLACK_USER_TOKEN")
    slack_app_token: Optional[str] = Field(default=None, alias="SLACK_APP_TOKEN")
    slack_signing_secret: Optional[str] = Field(default=None, alias="SLACK_SIGNING_SECRET")

    # Discord
    discord_bot_token: Optional[str] = Field(default=None, alias="DISCORD_BOT_TOKEN")

    # Telegram Integration
    telegram_bot_token: Optional[str] = Field(default=None, alias="TELEGRAM_BOT_TOKEN")

    # Sponsor Integrations: OpenRouter & Fallback
    openrouter_api_key: Optional[str] = Field(default=None, alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="anthropic/claude-sonnet-5", alias="OPENROUTER_MODEL")
    openrouter_triage_model: str = Field(default="anthropic/claude-haiku-4.5", alias="OPENROUTER_TRIAGE_MODEL")

    # Sponsor Integrations: Nebius AI Studio (OpenAI-compatible endpoint)
    nebius_api_key: Optional[str] = Field(default=None, alias="NEBIUS_API_KEY")
    nebius_base_url: str = Field(default="https://api.studio.nebius.ai/v1/", alias="NEBIUS_BASE_URL")
    nebius_model: str = Field(default="Qwen/Qwen3-30B-A3B-Instruct-2507", alias="NEBIUS_MODEL")

    # Sponsor Integrations: Exa Neural Web Search
    exa_api_key: Optional[str] = Field(default=None, alias="EXA_API_KEY")

    # Sponsor Integrations: OpenAI Codex / E2E Test Generator
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    codex_model: str = Field(default="gpt-4o", alias="CODEX_MODEL")

    # Multi-Tier Fallback Mode: 'low', 'medium', 'high'
    fallback_tier: str = Field(default="medium", alias="FALLBACK_TIER")

    # Skills
    default_skill: str = Field(default="startup_lean", alias="DEFAULT_SKILL")
    skills_dir: Path = Field(default_factory=lambda: BASE_DIR / "skills")

settings = Settings()
