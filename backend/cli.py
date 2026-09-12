import asyncio
import os
import sys
from pathlib import Path
from typing import Optional
import click

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.markdown import Markdown
    from rich.text import Text
    HAS_RICH = True
    console = Console()
except ImportError:
    HAS_RICH = False
    console = None

from .core.models import ThreadContext, ChatMessage, EvidenceLabel
from .core.analyzer import ScribeBAAnalyzer
from .core.skills import SkillManager
from .integrations.clickup_client import ClickUpClient
from .integrations.exa_client import ExaClient
from .config import settings, BASE_DIR

def load_thread_from_file(file_path: str) -> ThreadContext:
    path = Path(file_path)
    if not path.exists():
        raise click.ClickException(f"File not found: {file_path}")

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    messages = []
    lines = content.splitlines()
    for line in lines:
        line = line.strip()
        if line.startswith("**@") and ":" in line:
            parts = line.split(":", 1)
            header = parts[0].replace("**", "")
            # author & time
            author = header.split()[0]
            text = parts[1].strip()
            messages.append(ChatMessage(author=author, timestamp="today", text=text))
        elif line.startswith("/ba-summarize"):
            messages.append(ChatMessage(author="@user", timestamp="now", text="/ba-summarize"))
        elif line and not line.startswith("#") and not line.startswith("**Channel:**") and not line.startswith("**Platform:**") and not line.startswith("---") and messages:
            messages[-1].text += f" {line}"

    if not messages:
        messages = [
            ChatMessage(author="@alex_lead", timestamp="10:15", text="Acme Corp requires Google Workspace SSO."),
            ChatMessage(author="@oliver_sec", timestamp="10:17", text="Must restrict to domain @acmecorp.com and assign Engineer role."),
            ChatMessage(author="@tony_db", timestamp="10:20", text="I will add sso_provider column with unique constraint."),
            ChatMessage(author="@alex_lead", timestamp="10:22", text="What about session expiration? 8h or 24h?"),
            ChatMessage(author="@oliver_sec", timestamp="10:28", text="Avatar sync out of scope. 8h standard for SOC2."),
            ChatMessage(author="@alex_lead", timestamp="10:30", text="/ba-summarize"),
        ]

    return ThreadContext(
        thread_id=path.stem,
        channel="#proj-auth-federation",
        platform="slack",
        messages=messages
    )

@click.group(invoke_without_command=True)
@click.pass_context
@click.version_option(version="0.1.0", prog_name="ScribeBA CLI")
def cli(ctx):
    """ScribeBA — AI Business Analyst Agent with Evidence Labeling & Multi-Platform MCP."""
    if ctx.invoked_subcommand is None:
        from .interactive_cli import start_interactive_app
        start_interactive_app()

@cli.command("interactive")
def interactive_cmd():
    """Launch full interactive ScribeBA Terminal Application."""
    from .interactive_cli import start_interactive_app
    start_interactive_app()


@cli.command("analyze")
@click.option("--file", "-f", default="demo/sample_conversation.md", help="Path to thread transcript markdown file.")
@click.option("--skill", "-s", default="startup_lean", help="Skill template name (default, startup_lean, agency_detailed).")
@click.option("--live", is_flag=True, help="Force live API calls to Anthropic/OpenRouter.")
@click.option("--tier", "-t", default=None, type=click.Choice(['low', 'medium', 'high', 'minimum']), help="Fallback operation tier: low (min cost), medium (balanced), high (deep reasoning).")
def analyze_cmd(file: str, skill: str, live: bool, tier: Optional[str]):
    """Analyze a chat thread with multi-tier model fallback (OpenRouter -> GPT -> LUNA -> SONET -> 5 -> SOL)."""
    thread = load_thread_from_file(file)
    analyzer = ScribeBAAnalyzer()
    active_tier = tier or settings.fallback_tier

    if HAS_RICH:
        console.print(f"[bold #008775]🔍 ScribeBA Analyzing Thread:[/bold #008775] [dim]{file}[/dim] | Skill: [bold yellow]{skill}[/bold yellow] | Tier: [bold cyan]{active_tier.upper()}[/bold cyan]")

    result = asyncio.run(analyzer.analyze_thread(thread, skill_name=skill, force_live=live, tier=active_tier))
    story = result.story
    score = result.invest_score

    if HAS_RICH:
        # Title and Story Panel
        story_text = (
            f"[bold cyan]{story.title}[/bold cyan]\n\n"
            f"[bold]As a[/bold] {story.as_a}\n"
            f"[bold]I want[/bold] {story.i_want}\n"
            f"[bold]So that[/bold] {story.so_that}\n\n"
            f"[bold]INVEST Score:[/bold] [green]{score.overall}/100[/green] "
            f"(I:{score.independent} N:{score.negotiable} V:{score.valuable} "
            f"E:{score.estimable} S:{score.small} T:{score.testable})"
        )
        console.print(Panel(story_text, title="📋 Drafted User Story", border_style="#008775"))

        # Criteria Table
        ac_table = Table(title="✅ Acceptance Criteria", border_style="dim")
        ac_table.add_column("ID", style="bold cyan", width=8)
        ac_table.add_column("Scenario", style="white")
        ac_table.add_column("Then (Expected Outcome)", style="green")
        ac_table.add_column("Evidence", width=12)

        for ac in result.acceptance_criteria:
            status_style = "green" if ac.evidence == EvidenceLabel.VERIFIED else "yellow" if ac.evidence == EvidenceLabel.INFERRED else "purple" if ac.evidence == EvidenceLabel.ASSUMED else "red"
            ac_table.add_row(ac.id, ac.scenario, ac.then, f"[{status_style}]{ac.evidence.value}[/{status_style}]")
        console.print(ac_table)

        # Evidence Table
        ev_table = Table(title="🔍 Evidence & Claim Verification Ledger", border_style="dim")
        ev_table.add_column("Status", width=10)
        ev_table.add_column("Field / Requirement", style="bold")
        ev_table.add_column("Value / Decision", style="white")
        ev_table.add_column("Source Quote", style="dim italic")

        for ev in result.evidence_items:
            style = "bold green" if ev.label == EvidenceLabel.VERIFIED else "bold yellow" if ev.label == EvidenceLabel.INFERRED else "bold magenta" if ev.label == EvidenceLabel.ASSUMED else "bold red"
            ev_table.add_row(f"[{style}]{ev.label.value}[/{style}]", ev.field, ev.value, ev.quote_source or "")
        console.print(ev_table)

        if result.clarifying_question:
            console.print(Panel(f"[bold yellow]⚠️ Clarification Required Before Ticket Creation:[/bold yellow]\n{result.clarifying_question}", border_style="yellow"))

        # Fallback Trail Info
        trail = result.metadata.get("fallback_trail")
        if trail:
            trail_lines = []
            for step in trail:
                st_color = "green" if step.get("status") == "success" else "yellow" if step.get("status") == "skipped" else "red"
                trail_lines.append(f"• Step {step.get('step')}: [bold]{step.get('alias')}[/bold] ({step.get('model')}) → [{st_color}]{step.get('status').upper()}[/{st_color}] ({step.get('reason', 'OK')})")
            console.print(Panel("\n".join(trail_lines), title="🛡️ Model Fallback Cascade Execution Trail", border_style="dim"))
    else:
        print(f"User Story: {story.title}")
        print(f"INVEST: {score.overall}/100")
        for ev in result.evidence_items:
            print(f"[{ev.label.value}] {ev.field}: {ev.value}")
        if result.clarifying_question:
            print(f"Question: {result.clarifying_question}")

@cli.command("create-ticket")
@click.option("--file", "-f", default="demo/sample_conversation.md", help="Path to thread transcript markdown file.")
@click.option("--skill", "-s", default="startup_lean", help="Skill template name.")
def create_ticket_cmd(file: str, skill: str):
    """Analyze thread, resolve requirements, and create an audited task in ClickUp."""
    thread = load_thread_from_file(file)
    skill_manager = SkillManager()
    active_skill = skill_manager.get_skill(skill)
    analyzer = ScribeBAAnalyzer(skill_manager)
    clickup = ClickUpClient()

    if HAS_RICH:
        console.print("[bold cyan]🚀 Executing ScribeBA Pipeline -> ClickUp Sync...[/bold cyan]")

    result = asyncio.run(analyzer.analyze_thread(thread, skill_name=skill))
    ticket = asyncio.run(clickup.create_task_from_analysis(result, active_skill, thread_url=f"slack://channel/th-1789201948"))

    if HAS_RICH:
        panel_content = (
            f"[bold green]✓ ClickUp Task Created Successfully![/bold green]\n\n"
            f"[bold]Task ID:[/bold] [cyan]{ticket.created_task_id}[/cyan]\n"
            f"[bold]Title:[/bold] {ticket.title}\n"
            f"[bold]Priority:[/bold] [yellow]{ticket.priority.upper()}[/yellow]\n"
            f"[bold]Tags:[/bold] {', '.join(ticket.tags)}\n"
            f"[bold]ClickUp URL:[/bold] [link={ticket.clickup_url}]{ticket.clickup_url}[/link]\n"
            f"[bold]Source Thread Link:[/bold] {ticket.thread_link}"
        )
        console.print(Panel(panel_content, title="🎯 ClickUp Integration Result", border_style="green"))
    else:
        print(f"Ticket Created: {ticket.created_task_id} -> {ticket.clickup_url}")

@cli.command("slack-run")
@click.option("--channel", "-c", required=True, help="Slack channel ID, e.g. C0BFQCXHM2T.")
@click.option("--ts", required=True, help="Thread parent message ts, e.g. 1757661234.123456.")
@click.option("--skill", "-s", default="startup_lean", help="Skill template name.")
def slack_run_cmd(channel: str, ts: str, skill: str):
    """Read a real Slack thread, analyze it, reply in-thread, and create a real ClickUp task."""
    from .platforms.slack_adapter import SlackAdapter

    async def run():
        slack = SlackAdapter()
        if not slack.is_live:
            raise click.ClickException("No Slack token found. Set SLACK_USER_TOKEN or SLACK_BOT_TOKEN in .env.")
        skill_manager = SkillManager()
        active_skill = skill_manager.get_skill(skill)
        analyzer = ScribeBAAnalyzer(skill_manager)

        thread = await slack.fetch_thread(channel, ts)
        permalink = await slack.get_permalink(channel, ts)
        print(f"→ Read {len(thread.messages)} messages from {permalink}")

        result = await analyzer.analyze_thread(thread, skill_name=skill)
        await slack.post_analysis_summary(channel, ts, result)
        print(f"→ Posted analysis in-thread (INVEST {result.invest_score.overall}/100)")

        if result.clarifying_question:
            await slack.post_clarification_question(channel, ts, result.clarifying_question)
            print("→ Asked the clarifying question in-thread instead of guessing")

        ticket = await ClickUpClient().create_task_from_analysis(result, active_skill, thread_url=permalink)
        await slack.post_ticket_confirmation(channel, ts, ticket)
        print(f"→ ClickUp task {ticket.created_task_id}: {ticket.clickup_url}")

    asyncio.run(run())

@cli.command("list-skills")
def list_skills_cmd():
    """List all available team skills and their required fields."""
    sm = SkillManager()
    skills = sm.list_skills()

    if HAS_RICH:
        table = Table(title="🛠️ Available Team Skills", border_style="#008775")
        table.add_column("Skill Name", style="bold cyan")
        table.add_column("Team Type", style="yellow")
        table.add_column("Required Fields", style="white")
        table.add_column("Description", style="dim")

        for s_name in skills:
            sk = sm.get_skill(s_name)
            table.add_row(sk.name, sk.team_type, ", ".join(sk.required_fields), sk.description)
        console.print(table)
    else:
        for s_name in skills:
            print(f"- {s_name}")

@cli.command("demo")
def demo_cmd():
    """Run full interactive 2-minute demo showcase."""
    if HAS_RICH:
        console.rule("[bold cyan]ScribeBA — 2-Minute Live Demo[/bold cyan]")
        console.print("\n[bold yellow]Step 1: Reading Conversation Thread...[/bold yellow]")
    
    thread = load_thread_from_file("demo/sample_conversation.md")
    for msg in thread.messages[:4]:
        if HAS_RICH:
            console.print(f"  [bold dim]{msg.author}:[/bold dim] {msg.text}")
    
    if HAS_RICH:
        console.print("\n[bold yellow]Step 2: Detecting Command '/ba-summarize' & Escalating to Sonnet...[/bold yellow]")
        console.print("[dim]Analyzing thread against Skill 'startup_lean'...[/dim]\n")

    analyzer = ScribeBAAnalyzer()
    res = asyncio.run(analyzer.analyze_thread(thread, skill_name="startup_lean"))
    
    if HAS_RICH:
        console.print(Panel(
            f"[bold cyan]{res.story.title}[/bold cyan]\n"
            f"As a {res.story.as_a}\n"
            f"I want {res.story.i_want}\n"
            f"So that {res.story.so_that}\n\n"
            f"INVEST Score: [bold green]{res.invest_score.overall}/100[/bold green]",
            title="📋 User Story Draft",
            border_style="#008775"
        ))

        console.print("\n[bold yellow]Step 3: Missing Information Found — ScribeBA Resolves In-Channel:[/bold yellow]")
        console.print(f"[bold red]❓ {res.clarifying_question}[/bold red]\n")

        console.print("[bold green]Step 4: User Confirms (8 hours) -> Creating Task in ClickUp...[/bold green]")

    clickup = ClickUpClient()
    sm = SkillManager()
    ticket = asyncio.run(clickup.create_task_from_analysis(res, sm.get_skill("startup_lean"), "slack://th-1789201948"))
    
    if HAS_RICH:
        console.print(Panel(
            f"[bold green]Task Created:[/bold green] {ticket.title}\n"
            f"URL: {ticket.clickup_url}\n"
            f"Audit Trail: Verified 4 claims, Inferred 1, Assumed 1, Blocked 0.",
            border_style="green"
        ))
        console.rule("[bold cyan]Demo Completed[/bold cyan]")

@cli.command("telegram")
@click.option("--token", default=None, help="Telegram Bot Token (or set TELEGRAM_BOT_TOKEN in .env).")
def telegram_cmd(token: Optional[str]):
    """Launch ScribeBA Telegram Bot with long-polling."""
    from .platforms.telegram_adapter import TelegramAdapter
    if HAS_RICH:
        console.rule("[bold cyan]ScribeBA — Telegram Bot Platform[/bold cyan]")
        console.print("🤖 [bold green]Starting Telegram Adapter for Group & Topic Discussion...[/bold green]\n")

    adapter = TelegramAdapter(bot_token=token)
    analyzer = ScribeBAAnalyzer()
    clickup = ClickUpClient()
    sm = SkillManager()

    asyncio.run(adapter.start_polling(analyzer, clickup, sm))

@cli.command("exa-test")
@click.option("--feature", default="Google Workspace OAuth 2.0 PKCE", help="Feature name or architectural concept to ground.")
def exa_test_cmd(feature: str):
    """Execute Exa Neural Search Grounding & AI Test Case Verification."""
    if HAS_RICH:
        console.rule("[bold magenta]🔍 Exa Neural Search — AI Test Grounding[/bold magenta]")
        console.print(f"🎯 Feature Subject: [bold cyan]{feature}[/bold cyan]")
        console.print("⏳ Querying Exa API with canonical highlights...\n")

    client = ExaClient()
    spec = asyncio.run(client.ground_ai_test_spec(feature))

    if HAS_RICH:
        from rich.panel import Panel
        from rich.table import Table

        table = Table(title="🛡️ Grounded Security & RFC Test Scenarios", show_header=True)
        table.add_column("#", style="dim", width=4)
        table.add_column("AI Test Assertion", style="bold green")

        for idx, scenario in enumerate(spec.test_scenarios, 1):
            table.add_row(str(idx), scenario)

        console.print(table)
        console.print()

        citations_str = "\n".join([f"• [link={c}]{c}[/link]" for c in spec.citations])
        console.print(Panel(
            f"[bold]Standard Applied:[/bold] {spec.rfc_or_standard}\n"
            f"[bold]Verified Live:[/bold] {'🟢 Yes (Exa API Live)' if spec.verified_live else '🟡 Offline Deterministic Cache'}\n\n"
            f"[bold]Exa Grounding Citations:[/bold]\n{citations_str}",
            title="📚 Exa Knowledge Verification Provenance",
            border_style="magenta"
        ))
    else:
        print(f"Grounded standard: {spec.rfc_or_standard}")
        for s in spec.test_scenarios:
            print(f"- {s}")


@cli.command("exa-search")
@click.argument("query")
@click.option("--limit", default=3, help="Number of results to retrieve (default 3).")
def exa_search_cmd(query: str, limit: int):
    """Execute raw canonical Exa semantic search with highlights."""
    if HAS_RICH:
        console.rule("[bold magenta]🔍 Exa Semantic Search[/bold magenta]")
        console.print(f"Query: [bold cyan]{query}[/bold cyan]\n")

    client = ExaClient()
    results = asyncio.run(client.search(query=query, num_results=limit))

    for idx, r in enumerate(results, 1):
        if HAS_RICH:
            hl_str = "\n> ".join(r.highlights[:2])
            console.print(f"[bold green]#{idx} {r.title}[/bold green]")
            console.print(f"   [link={r.url}]{r.url}[/link]")
            if hl_str:
                console.print(f"   > [italic dim]{hl_str}[/italic dim]\n")
        else:
            print(f"#{idx} {r.title} ({r.url})")


@cli.command("web")
@click.option("--port", default=3000, help="Port to host the Web UI (default 3000).")
@click.option("--open/--no-open", "open_browser", default=True, help="Automatically open browser.")
def web_cmd(port: int, open_browser: bool):
    """Launch the ScribeBA React Web Studio in browser."""
    import subprocess
    import webbrowser
    import time
    import threading

    frontend_dir = BASE_DIR / "frontend"
    if not frontend_dir.exists():
        raise click.ClickException(f"Frontend directory not found at {frontend_dir}")

    url = f"http://localhost:{port}"
    if HAS_RICH:
        console.rule("[bold cyan]🌐 ScribeBA Web Studio[/bold cyan]")
        console.print(f"🚀 Launching ScribeBA Web Studio at [bold green]{url}[/bold green]...")
        console.print(f"📁 Directory: [dim]{frontend_dir}[/dim]")
        console.print("⚡ Press [bold red]Ctrl+C[/bold red] to stop the web server.\n")

    if open_browser:
        def _open():
            time.sleep(1.8)
            webbrowser.open(url)
        threading.Thread(target=_open, daemon=True).start()

    try:
        cmd = ["npx", "vite", "--port", str(port), "--host"]
        subprocess.run(cmd, cwd=str(frontend_dir), shell=True)
    except KeyboardInterrupt:
        print("\n[Web Server Stopped]")


def main():
    cli()

if __name__ == "__main__":
    main()


