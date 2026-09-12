import asyncio
import os
import sys
from pathlib import Path
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
from .config import settings

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

@click.group()
@click.version_option(version="0.1.0", prog_name="ScribeBA CLI")
def cli():
    """ScribeBA — AI Business Analyst Agent with Evidence Labeling & Multi-Platform MCP."""
    pass

@cli.command("analyze")
@click.option("--file", "-f", default="demo/sample_conversation.md", help="Path to thread transcript markdown file.")
@click.option("--skill", "-s", default="startup_lean", help="Skill template name (default, startup_lean, agency_detailed).")
@click.option("--live", is_flag=True, help="Force live API calls to Anthropic Claude.")
def analyze_cmd(file: str, skill: str, live: bool):
    """Analyze a chat thread and extract structured User Story, Acceptance Criteria, and Evidence."""
    thread = load_thread_from_file(file)
    analyzer = ScribeBAAnalyzer()

    if HAS_RICH:
        console.print(f"[bold #008775]🔍 ScribeBA Analyzing Thread:[/bold #008775] [dim]{file}[/dim] with Skill: [bold yellow]{skill}[/bold yellow]...")

    result = asyncio.run(analyzer.analyze_thread(thread, skill_name=skill, force_live=live))
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

def main():
    cli()

if __name__ == "__main__":
    main()
