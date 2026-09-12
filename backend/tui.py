"""ScribeBA in the terminal: a conversation, not a menu tree.

You type, it answers, and the conversation carries forward — a follow-up like "8h or 24h?" is
read against everything said before it. Slash commands do the things a sentence cannot:
run against a real Slack thread, work an incident, list what has been filed.
"""
import asyncio
import shlex
import sys
from typing import List, Optional

from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .config import settings
from .chat import ChatResponder
from .core.analyzer import ScribeBAAnalyzer
from .core.models import ChatMessage, ThreadContext
from .core.skills import SkillManager
from .integrations.clickup_client import ClickUpClient

console = Console()

LABEL_STYLE = {
    "Verified": "bold green",
    "Inferred": "bold yellow",
    "Assumed": "bold magenta",
    "Blocked": "bold red",
}

HELP = """\
[bold]Type anything[/bold] to have it read as a conversation — paste a thread, or argue one line at
a time. Everything you have said is sent each turn, so follow-ups make sense.

[bold cyan]/skill[/bold cyan] [dim][name][/dim]        show or switch the Skill file (startup_lean, agency_detailed, default)
[bold cyan]/tier[/bold cyan] [dim][low|medium|high][/dim]   show or switch the model tier
[bold cyan]/slack[/bold cyan] [dim]<channel> <ts>[/dim]  read a real thread, reply in it, file the ticket
[bold cyan]/ops[/bold cyan]                 diagnose the cluster and approve the fix
[bold cyan]/ticket[/bold cyan]              file the last analysis in ClickUp
[bold cyan]/status[/bold cyan]              what is connected
[bold cyan]/clear[/bold cyan]               start a new conversation
[bold cyan]/help[/bold cyan]  [bold cyan]/exit[/bold cyan]         this, and out\
"""


class Session:
    def __init__(self) -> None:
        self.skills = SkillManager()
        self.analyzer = ScribeBAAnalyzer(self.skills)
        self.responder = ChatResponder(self.skills)
        self.skill = settings.default_skill
        self.tier = settings.fallback_tier
        self.history: List[str] = []
        self.last_result = None

    # ---------- rendering ----------

    def banner(self) -> None:
        engine = ("OpenRouter" if settings.openrouter_api_key
                  else "Anthropic" if settings.anthropic_api_key
                  else "local engine (no model key)")
        bits = [
            f"[bold]ScribeBA[/bold] [dim]· KAFKON[/dim]",
            "",
            f"model    [cyan]{engine}[/cyan]  ·  tier [cyan]{self.tier}[/cyan]",
            f"skill    [cyan]{self.skill}[/cyan]",
            f"slack    {'[green]connected[/green]' if (settings.slack_user_token or settings.slack_bot_token) else '[dim]no token[/dim]'}"
            f"   clickup {'[green]connected[/green]' if settings.clickup_api_key else '[dim]not configured[/dim]'}",
            "",
            "[dim]/help for commands · Ctrl-D to leave[/dim]",
        ]
        console.print(Panel("\n".join(bits), border_style="magenta", padding=(1, 3)))

    def show_result(self, result) -> None:
        story = result.story
        head = Text()
        head.append(story.title, style="bold")
        head.append(f"   INVEST {result.invest_score.overall}/100", style="cyan")

        body = [head, ""]
        if story.as_a:
            body.append(Text.from_markup(
                f"[dim]As a[/dim] {story.as_a}  [dim]I want[/dim] {story.i_want}  "
                f"[dim]So that[/dim] {story.so_that}"
            ))
            body.append(Text(""))

        table = Table(show_header=False, box=None, padding=(0, 1))
        table.add_column(width=9)
        table.add_column(overflow="fold")
        for e in result.evidence_items:
            label = e.label.value
            claim = Text.from_markup(f"[bold]{e.field}[/bold]: {e.value}")
            if e.quote_source:
                claim.append(f"\n{e.quote_source}", style="dim italic")
            table.add_row(Text(label, style=LABEL_STYLE.get(label, "white")), claim)
        body.append(table)

        if result.clarifying_question:
            body.append(Text(""))
            body.append(Text.from_markup(
                f"[yellow]ScribeBA would ask:[/yellow] {result.clarifying_question}"
            ))

        trail = (result.metadata or {}).get("fallback_trail") or [{"alias": "local_engine"}]
        engine = trail[-1].get("alias", "local_engine")
        console.print(Panel(Group(*body), border_style="cyan",
                            subtitle=f"[dim]{self.skill} · tier {self.tier} · {engine}[/dim]",
                            padding=(1, 2)))

    # ---------- work ----------

    async def analyse(self, text: str) -> None:
        """A pasted discussion becomes a labelled analysis; a question gets an answer."""
        self.history.append(text)
        lines = [l for m in self.history for l in m.split("\n") if l.strip()]
        with console.status("[dim]thinking…[/dim]", spinner="dots"):
            out = await self.responder.respond(lines, self.skill, self.tier)
        if out["type"] == "analysis":
            self.last_result = out["result"]
            self.show_result(out["result"])
        elif out["type"] == "ops":
            # Asking in a sentence gets the same answer as typing /ops.
            self.show_diagnosis(out["diagnosis"])
            console.print("[dim]Run /ops to approve the fix.[/dim]")
        else:
            console.print(Panel(Text(out["text"]), border_style="cyan", padding=(1, 2)))

    async def slack_run(self, channel: str, ts: str) -> None:
        from .platforms.slack_adapter import SlackAdapter

        slack = SlackAdapter()
        if not slack.is_live:
            console.print("[red]No Slack token in .env.[/red]")
            return
        with console.status("[dim]reading the thread…[/dim]", spinner="dots"):
            thread = await slack.fetch_thread(channel, ts)
            permalink = await slack.get_permalink(channel, ts)
            result = await self.analyzer.analyze_thread(thread, skill_name=self.skill, tier=self.tier)
        console.print(f"[dim]read {len(thread.messages)} messages · {permalink}[/dim]")
        self.last_result = result
        self.show_result(result)

        await slack.post_analysis_summary(channel, ts, result)
        console.print("[green]posted the analysis in-thread[/green]")
        if result.clarifying_question:
            await slack.post_clarification_question(channel, ts, result.clarifying_question)
            console.print("[green]asked the clarifying question in-thread[/green]")

        ticket = await ClickUpClient().create_task_from_analysis(
            result, self.skills.get_skill(self.skill), thread_url=permalink)
        if ticket.clickup_url:
            await slack.post_ticket_confirmation(channel, ts, ticket)
            console.print(f"[green]ClickUp {ticket.created_task_id}[/green] {ticket.clickup_url}")
        else:
            console.print("[yellow]no ClickUp task was created[/yellow]")

    async def ticket(self) -> None:
        if self.last_result is None:
            console.print("[yellow]Nothing analysed yet.[/yellow]")
            return
        ticket = await ClickUpClient().create_task_from_analysis(
            self.last_result, self.skills.get_skill(self.skill), thread_url="terminal://scribeba")
        if ticket.clickup_url:
            console.print(f"[green]ClickUp {ticket.created_task_id}[/green] {ticket.clickup_url}")
        else:
            console.print("[yellow]Not filed — check CLICKUP_API_KEY and CLICKUP_LIST_ID.[/yellow]")

    def show_diagnosis(self, d) -> None:
        m = d["state"]["metrics"]
        rate = "—" if m["error_rate"] is None else f"{m['error_rate'] * 100:.2f}%"
        console.print(f"[dim]{d['state']['namespace']} · error rate[/dim] "
                      f"[{'red' if (m['error_rate'] or 0) > 0.02 else 'green'}]{rate}[/]")

        table = Table(show_header=False, box=None, padding=(0, 1))
        table.add_column(width=9)
        table.add_column(overflow="fold")
        for e in d["evidence"]:
            claim = Text.from_markup(f"[bold]{e['field']}[/bold]: {e['value']}")
            claim.append(f"\n{e['source']}", style="dim")
            table.add_row(Text(e["label"], style=LABEL_STYLE.get(e["label"], "white")), claim)
        console.print(Panel(table, border_style="cyan", title="[dim]evidence[/dim]", padding=(1, 2)))

    async def ops(self) -> None:
        from . import ops as opsmod

        with console.status("[dim]reading the cluster…[/dim]", spinner="dots"):
            try:
                d = opsmod.diagnose()
            except Exception as e:
                console.print(f"[red]Could not read the cluster: {e}[/red]")
                return
        self.show_diagnosis(d)

        p = d["proposal"]
        if not p:
            console.print("[green]Configuration matches the baseline. Nothing to propose.[/green]")
            return

        change = Text()
        change.append(f"- {p['parameters']['name']}={p['observed']}\n", style="red")
        change.append(f"+ {p['parameters']['name']}={p['parameters']['value']}", style="green")
        console.print(Panel(
            Group(Text.from_markup(f"[bold]{p['summary']}[/bold]"), Text(""),
                  Text.from_markup(f"runbook [cyan]{p['runbook']}[/cyan]   target [cyan]{p['target']}[/cyan]"),
                  Text(""), change, Text(""),
                  Text(f"pinned to resourceVersion {p['resource_version']}", style="dim")),
            border_style="magenta", title=f"[dim]{p['action_id']}[/dim]", padding=(1, 2)))

        answer = console.input("[bold]Approve and apply?[/bold] [dim](y/N)[/dim] ").strip().lower()
        if answer != "y":
            console.print("[dim]Not applied.[/dim]")
            return
        try:
            r = opsmod.apply_action(p["action_id"], "operator")
        except Exception as e:
            console.print(f"[red]{e}[/red]")
            return
        console.print(f"[green]applied[/green] {r['action_id']} at {r['at']}")
        console.print(f"[dim]{r['note']}[/dim]")

    def status(self) -> None:
        table = Table(show_header=False, box=None, padding=(0, 2))
        rows = [
            ("model", "OpenRouter" if settings.openrouter_api_key
                      else "Anthropic" if settings.anthropic_api_key else "local engine"),
            ("tier", self.tier),
            ("skill", self.skill),
            ("slack", "connected" if (settings.slack_user_token or settings.slack_bot_token) else "no token"),
            ("clickup", "connected" if settings.clickup_api_key else "not configured"),
            ("exa", "connected" if settings.exa_api_key else "no key"),
            ("turns", str(len(self.history))),
        ]
        for k, v in rows:
            table.add_row(Text(k, style="dim"), Text(v))
        console.print(table)


async def handle(s: Session, line: str) -> bool:
    """Run one line. Returns False to quit."""
    if not line.startswith("/"):
        await s.analyse(line)
        return True

    parts = shlex.split(line)
    cmd, args = parts[0], parts[1:]

    if cmd in ("/exit", "/quit"):
        return False
    if cmd == "/help":
        console.print(Panel(HELP, border_style="dim", padding=(1, 2)))
    elif cmd == "/clear":
        s.history.clear()
        s.last_result = None
        console.print("[dim]new conversation[/dim]")
    elif cmd == "/skill":
        available = s.skills.list_skills()
        if not args:
            console.print(f"[dim]skill[/dim] {s.skill}   [dim]available:[/dim] {', '.join(available)}")
        elif args[0] in available:
            s.skill = args[0]
            console.print(f"[dim]skill →[/dim] {s.skill}")
        else:
            console.print(f"[red]No such skill.[/red] [dim]{', '.join(available)}[/dim]")
    elif cmd == "/tier":
        if not args:
            console.print(f"[dim]tier[/dim] {s.tier}   [dim]low · medium · high[/dim]")
        elif args[0] in ("low", "medium", "high"):
            s.tier = args[0]
            console.print(f"[dim]tier →[/dim] {s.tier}")
        else:
            console.print("[red]Use low, medium or high.[/red]")
    elif cmd == "/slack":
        if len(args) != 2:
            console.print("[yellow]/slack <channel-id> <thread-ts>[/yellow]")
        else:
            await s.slack_run(args[0], args[1])
    elif cmd == "/ops":
        await s.ops()
    elif cmd == "/ticket":
        await s.ticket()
    elif cmd == "/status":
        s.status()
    else:
        console.print(f"[yellow]Unknown command {cmd}. /help for the list.[/yellow]")
    return True


def start() -> None:
    s = Session()
    console.print()
    s.banner()
    while True:
        try:
            line = console.input("\n[bold magenta]›[/bold magenta] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]bye[/dim]")
            return
        if not line:
            continue
        try:
            if not asyncio.run(handle(s, line)):
                console.print("[dim]bye[/dim]")
                return
        except Exception as e:  # one bad turn should not end the session
            console.print(f"[red]{type(e).__name__}:[/red] {e}")


if __name__ == "__main__":
    sys.exit(start())
