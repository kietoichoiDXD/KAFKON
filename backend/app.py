import asyncio
import os
import sys
from .config import settings
from .core.analyzer import ScribeBAAnalyzer
from .core.skills import SkillManager
from .platforms.slack_adapter import SlackAdapter
from .platforms.telegram_adapter import TelegramAdapter
from .integrations.clickup_client import ClickUpClient

def run_slack_bot():
    """Start the Slack Bolt application in Socket Mode if tokens are configured."""
    if not settings.slack_bot_token or not settings.slack_app_token:
        print("[ScribeBA] Slack tokens not detected. Running in CLI / Local Orchestrator mode.")
        print("Tip: Run 'python -m backend.cli demo' or 'python -m backend.cli analyze --help' to test.")
        return

    try:
        from slack_bolt.async_app import AsyncApp
        from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

        app = AsyncApp(token=settings.slack_bot_token)
        analyzer = ScribeBAAnalyzer()
        slack_adapter = SlackAdapter()
        clickup_client = ClickUpClient()
        skill_manager = SkillManager()

        @app.command("/ba-summarize")
        async def handle_ba_summarize(ack, body, client):
            await ack()
            channel_id = body["channel_id"]
            thread_ts = body.get("thread_ts") or body.get("message_ts") or body["trigger_id"]
            
            # Fetch thread and analyze
            thread = await slack_adapter.fetch_thread(channel_id, thread_ts)
            result = await analyzer.analyze_thread(thread)
            await slack_adapter.post_analysis_summary(channel_id, thread_ts, result)

        @app.action("approve_ticket")
        async def handle_approve(ack, body, client):
            await ack()
            channel_id = body["channel"]["id"]
            thread_ts = body["container"]["thread_ts"]
            
            thread = await slack_adapter.fetch_thread(channel_id, thread_ts)
            result = await analyzer.analyze_thread(thread)
            active_skill = skill_manager.get_skill(settings.default_skill)
            
            ticket = await clickup_client.create_task_from_analysis(result, active_skill, thread_url=f"slack://{channel_id}/{thread_ts}")
            await slack_adapter.post_ticket_confirmation(channel_id, thread_ts, ticket)

        async def start():
            handler = AsyncSocketModeHandler(app, settings.slack_app_token)
            print("[ScribeBA] Slack Socket Mode bot started listening...")
            await handler.start_async()

        asyncio.run(start())
    except ImportError:
        print("[ScribeBA] slack-bolt not installed. Install via 'pip install slack-bolt' for live mode.")

def run_telegram_bot():
    """Start ScribeBA Telegram Bot runner."""
    print("[ScribeBA] Starting Telegram Agent Engine...")
    telegram_adapter = TelegramAdapter()
    analyzer = ScribeBAAnalyzer()
    clickup_client = ClickUpClient()
    skill_manager = SkillManager()

    asyncio.run(telegram_adapter.start_polling(analyzer, clickup_client, skill_manager))

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "telegram":
        run_telegram_bot()
    elif len(sys.argv) > 1 and sys.argv[1] != "bot":
        # Delegate to CLI
        from .cli import cli
        cli()
    else:
        run_slack_bot()

if __name__ == "__main__":
    main()
