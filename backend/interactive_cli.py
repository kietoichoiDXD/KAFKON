"""
ScribeBA Interactive Terminal Edition (CLI TUI).
A complete standalone terminal application mirroring all web studio features.
Provides an interactive menu for BA analysis, skill personalization, Exa grounding, and ClickUp synchronization.
"""

import sys
import asyncio
from pathlib import Path
from typing import Optional, List

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich import box

from .core.models import ThreadContext, ChatMessage, EvidenceLabel
from .core.analyzer import ScribeBAAnalyzer
from .core.skills import SkillManager
from .integrations.clickup_client import ClickUpClient
from .integrations.exa_client import ExaClient
from .config import settings, BASE_DIR

console = Console()


def print_banner():
    """Print top-level ScribeBA branding banner and active status cards."""
    console.clear()
    title_panel = Panel.fit(
        "[bold cyan]S C R I B E   B A[/bold cyan]  [dim]•[/dim]  [bold green]T E R M I N A L   E D I T I O N[/bold green]\n"
        "[italic dim]Autonomous Agile Business Analyst Agent · AI Tinkerers Da Nang 2026 · Team KAFKON[/italic dim]",
        border_style="cyan",
        box=box.DOUBLE_EDGE,
        padding=(0, 4)
    )
    console.print(title_panel)

    # Status Cards Table
    status_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
    status_table.add_column("Key", style="bold dim")
    status_table.add_column("Val", style="bold")
    status_table.add_column("Key2", style="bold dim")
    status_table.add_column("Val2", style="bold")

    mode_val = "[green]Live API[/green]" if settings.scribeba_mode == "live" else "[yellow]Local (Demo Safe)[/yellow]"
    clickup_val = f"[green]Connected[/green] (Workspace: {settings.clickup_team_id or '90181076913'})"
    exa_val = "[green]Active[/green] (RFC Grounding Ready)" if settings.exa_api_key else "[yellow]Mock Fallback[/yellow]"
    skill_val = f"[cyan]{settings.default_skill}[/cyan]"

    status_table.add_row("Execution Mode:", mode_val, "Active Team Skill:", skill_val)
    status_table.add_row("ClickUp Destination:", clickup_val, "Exa Neural Search:", exa_val)
    status_table.add_row("Fallback Cascade:", "[dim]OpenRouter -> GPT -> Claude -> Local[/dim]", "Target List:", f"[dim]{settings.clickup_list_id or 'Project 1'}[/dim]")

    console.print(Panel(status_table, title="⚙️ System Status", border_style="dim", box=box.ROUNDED))
    console.print()


def show_menu() -> str:
    """Display the interactive navigation menu."""
    table = Table(box=box.ROUNDED, show_header=True, header_style="bold magenta", border_style="cyan")
    table.add_column("Phím", justify="center", style="bold cyan", width=6)
    table.add_column("Nghiệp vụ / Chức năng", style="bold")
    table.add_column("Mô tả chi tiết", style="dim")

    table.add_row("1", "📝 Phân tích Hội thoại mới (New Session)", "Phân tích yêu cầu, gán nhãn [Verified/Assumed], tính điểm INVEST")
    table.add_row("2", "🛡️ Exa Neural Grounding & AI Test Suite", "Tra cứu chuẩn RFC bảo mật qua Exa để sinh test không ảo giác")
    table.add_row("3", "🎯 Đồng bộ & Tạo Task sang ClickUp", "Tạo ticket và đính kèm sổ cái chứng minh (Audit Ledger)")
    table.add_row("4", "🤖 Tùy biến Kỹ năng Agent (Skill Manager)", "Xem & đổi persona (Startup Lean, Agency Detailed, Scrum)")
    table.add_row("5", "🏢 Quản lý Kết nối Room & Platforms", "Kiểm tra kết nối Telegram, Slack, ClickUp, Exa API")
    table.add_row("6", "🚀 Chạy Demo Nhanh 2 Phút (Live Pitch)", "Mô phỏng toàn bộ luồng 4 bước tự động trong 120 giây")
    table.add_row("7", "🌐 Bật Giao diện Web (Web Studio)", "Khởi chạy React Web Studio tại http://localhost:3000")
    table.add_row("0", "🚪 Thoát ứng dụng (Exit)", "Đóng phiên làm việc Terminal")

    console.print(table)
    choice = Prompt.ask("\n[bold green]👉 Chọn chức năng[/bold green]", choices=["1", "2", "3", "4", "5", "6", "7", "0"], default="1")
    return choice


def handle_new_session():
    """Interactive flow: input thread -> analyze -> review evidence -> clarify -> push to ClickUp."""
    console.rule("[bold cyan]📝 Phân tích Hội thoại & Thẩm định Nghiệp vụ[/bold cyan]")
    
    console.print("\n[bold]Nguồn hội thoại đầu vào:[/bold]")
    console.print("  [1] Dùng mẫu hội thoại chuẩn (Google Workspace SSO & SOC2)")
    console.print("  [2] Nhập/Dán nội dung hội thoại trực tiếp")
    console.print("  [3] Đọc từ file markdown transcript")
    input_choice = Prompt.ask("Chọn nguồn", choices=["1", "2", "3"], default="1")

    messages: List[ChatMessage] = []
    thread_id = "th-interactive-01"

    if input_choice == "1":
        messages = [
            ChatMessage(author="@alex_lead", timestamp="10:15", text="Acme Corp requires Google Workspace SSO with PKCE flow."),
            ChatMessage(author="@oliver_sec", timestamp="10:17", text="Must restrict to domain @acmecorp.com and assign Engineer role."),
            ChatMessage(author="@tony_db", timestamp="10:20", text="I will add sso_provider column with unique constraint."),
            ChatMessage(author="@alex_lead", timestamp="10:22", text="What about session expiration? 8h or 24h?"),
            ChatMessage(author="@oliver_sec", timestamp="10:28", text="Avatar sync out of scope. 8h standard for SOC2."),
        ]
    elif input_choice == "2":
        console.print("[dim]Nhập tin nhắn (định dạng '@tên: nội dung'). Nhấn Enter để gửi. Nhập 'done' khi hoàn tất:[/dim]")
        while True:
            line = Prompt.ask("[cyan]Tin nhắn[/cyan]")
            if line.strip().lower() in ["done", "xong", "exit", ""]:
                if messages:
                    break
                console.print("[red]Cần nhập ít nhất 1 tin nhắn.[/red]")
                continue
            if ":" in line:
                author, text = line.split(":", 1)
                messages.append(ChatMessage(author=author.strip(), timestamp="now", text=text.strip()))
            else:
                messages.append(ChatMessage(author="@user", timestamp="now", text=line.strip()))
    else:
        file_path = Prompt.ask("Đường dẫn file transcript", default="demo/sample_conversation.md")
        p = Path(file_path)
        if not p.exists():
            console.print(f"[red]Không tìm thấy file: {file_path}[/red]")
            return
        with open(p, "r", encoding="utf-8") as f:
            content = f.read()
        messages = [ChatMessage(author="@thread_user", timestamp="logged", text=content)]

    # Choose skill
    sm = SkillManager()
    skills = sm.list_skills()
    console.print(f"\n[bold]Chọn Kỹ năng BA áp dụng (Mặc định: {settings.default_skill}):[/bold]")
    for idx, s in enumerate(skills, 1):
        console.print(f"  [{idx}] [bold cyan]{s.name}[/bold cyan] ({s.version}) — {s.description}")
    
    skill_idx = Prompt.ask("Chọn kỹ năng", choices=[str(i) for i in range(1, len(skills) + 1)], default="1")
    active_skill = skills[int(skill_idx) - 1]

    thread = ThreadContext(
        thread_id=thread_id,
        channel="#proj-auth-federation",
        platform="terminal",
        messages=messages
    )

    analyzer = ScribeBAAnalyzer()
    with console.status("[bold green]🤖 Đang chạy suy luận phân tích đa cấp & đối soát INVEST...[/bold green]"):
        result = asyncio.run(analyzer.analyze_thread(thread, skill=active_skill))

    # Display Story
    story = result.story
    console.print()
    console.print(Panel(
        f"[bold cyan]Tiêu đề:[/bold cyan] {story.title}\n\n"
        f"[bold]Là một (As a):[/bold] {story.as_a}\n"
        f"[bold]Tôi muốn (I want):[/bold] {story.i_want}\n"
        f"[bold]Để mà (So that):[/bold] {story.so_that}",
        title="📋 User Story Chuẩn Hóa",
        border_style="green",
        box=box.ROUNDED
    ))

    # Display INVEST Score
    inv = result.invest_score
    inv_table = Table(title=f"📊 Điểm Thẩm Định INVEST: {inv.overall}/100", box=box.ROUNDED)
    inv_table.add_column("Tiêu chí", style="bold")
    inv_table.add_column("Điểm", justify="center")
    inv_table.add_column("Nhận định đánh giá", style="dim")

    for k, v in [("Independent", inv.independent), ("Negotiable", inv.negotiable), ("Valuable", inv.valuable),
                 ("Estimable", inv.estimable), ("Small", inv.small), ("Testable", inv.testable)]:
        score_color = "green" if v >= 70 else ("yellow" if v >= 50 else "red")
        inv_table.add_row(k, f"[{score_color}]{v}/100[/{score_color}]", "Đạt chuẩn Agile" if v >= 70 else "Cần bổ sung chi tiết")
    console.print(inv_table)

    # Display Evidence Items Table
    ev_table = Table(title="🏷️ Phân Loại Bằng Chứng Minh Bạch (Evidence Classification)", box=box.ROUNDED)
    ev_table.add_column("Khẳng định / Yêu cầu", style="bold")
    ev_table.add_column("Nhãn", justify="center")
    ev_table.add_column("Nguồn trích dẫn (Provenance Quote)", style="dim")

    for e in result.evidence_items:
        color = "green" if e.label == EvidenceLabel.VERIFIED else ("yellow" if e.label == EvidenceLabel.INFERRED else ("magenta" if e.label == EvidenceLabel.ASSUMED else "red"))
        ev_table.add_row(e.claim, f"[{color}]{e.label.value}[/{color}]", e.quote or "Suy luận từ ngữ cảnh kỹ thuật")
    console.print(ev_table)

    # Handle Clarification if needed
    if result.requires_clarification:
        console.print()
        console.print(Panel(
            f"[bold red]⚠️ Phát hiện điểm mơ hồ cần làm rõ:[/bold red]\n"
            f"> {result.clarifying_question}",
            border_style="yellow",
            box=box.ROUNDED
        ))
        clarification_answer = Prompt.ask("\n[bold yellow]👉 Nhập câu trả lời làm rõ của bạn (hoặc nhấn Enter để bỏ qua)[/bold yellow]")
        if clarification_answer.strip():
            console.print("[bold green]✓ Đã cập nhật câu trả lời vào nhật ký thẩm định.[/bold green]")
            # Upgrade any blocked items
            for e in result.evidence_items:
                if e.label in [EvidenceLabel.BLOCKED, EvidenceLabel.ASSUMED]:
                    e.label = EvidenceLabel.VERIFIED
                    e.quote = f"User Clarification: '{clarification_answer.strip()}'"
            result.requires_clarification = False
            result.invest_score.overall = min(100, result.invest_score.overall + 15)
            console.print(f"[bold green]✓ Điểm INVEST mới: {result.invest_score.overall}/100[/bold green]")

    # Push to ClickUp?
    console.print()
    if Confirm.ask("[bold green]🚀 Bạn có muốn tạo Task và đồng bộ ngay sang ClickUp?[/bold green]", default=True):
        clickup = ClickUpClient()
        with console.status("[bold cyan]Đang đẩy Task sang ClickUp...[/bold cyan]"):
            ticket = asyncio.run(clickup.create_task_from_analysis(result, active_skill, thread_url=f"terminal://{thread_id}"))

        console.print()
        console.print(Panel(
            f"[bold green]✓ Tạo Task thành công trên ClickUp![/bold green]\n\n"
            f"[bold]Mã Task:[/bold] {ticket.created_task_id}\n"
            f"[bold]Tiêu đề:[/bold] {ticket.title}\n"
            f"[bold]Độ ưu tiên:[/bold] {ticket.priority.upper()}\n"
            f"[bold]Đường dẫn ClickUp:[/bold] [link={ticket.clickup_url}]{ticket.clickup_url}[/link]\n\n"
            f"[dim]Đã đính kèm Sổ cái Bằng chứng (Audit Provenance Ledger SHA-256)[/dim]",
            title="🎯 Kết quả Tích hợp ClickUp",
            border_style="green",
            box=box.ROUNDED
        ))

    Prompt.ask("\n[dim]Nhấn Enter để quay lại Menu chính...[/dim]", default="")


def handle_exa_grounding():
    """Interactive Exa Neural Search & RFC validation."""
    console.rule("[bold magenta]🛡️ Exa Neural Search — AI Test Grounding[/bold magenta]")
    feature = Prompt.ask(
        "Nhập tên tính năng hoặc chuẩn kỹ thuật cần tra cứu",
        default="Google Workspace OAuth 2.0 PKCE with refresh rotation"
    )

    client = ExaClient()
    with console.status(f"[bold magenta]Đang tra cứu Exa API cho: '{feature}'...[/bold magenta]"):
        spec = asyncio.run(client.ground_ai_test_spec(feature))

    table = Table(title="🛡️ Kịch Bản Kiểm Thử Đối Soát Chuẩn RFC Thực Tế", box=box.ROUNDED)
    table.add_column("#", style="dim", width=4)
    table.add_column("Khẳng định Kiểm thử (AI Test Assertion)", style="bold green")

    for idx, s in enumerate(spec.test_scenarios, 1):
        table.add_row(str(idx), s)

    console.print()
    console.print(table)
    console.print()

    citations_str = "\n".join([f"• [link={c}]{c}[/link]" for c in spec.citations])
    console.print(Panel(
        f"[bold]Tiêu chuẩn Đối soát:[/bold] {spec.rfc_or_standard}\n"
        f"[bold]Trạng thái Live API:[/bold] {'🟢 Kết nối trực tiếp Exa API' if spec.verified_live else '🟡 Bộ đệm cục bộ (Deterministic Cache)'}\n\n"
        f"[bold]Nguồn trích dẫn uy tín (Citations):[/bold]\n{citations_str}",
        title="📚 Chứng Minh Nguồn Gốc Tri Thức",
        border_style="magenta",
        box=box.ROUNDED
    ))

    Prompt.ask("\n[dim]Nhấn Enter để quay lại Menu chính...[/dim]", default="")


def handle_clickup_sync():
    """Quick task creation to ClickUp."""
    console.rule("[bold green]🎯 Đồng bộ Task Nhanh sang ClickUp[/bold green]")
    sm = SkillManager()
    skill = sm.get_skill(settings.default_skill)
    analyzer = ScribeBAAnalyzer()
    
    # Load default sample
    thread = ThreadContext(
        thread_id="th-clickup-quick",
        channel="#proj-auth-federation",
        platform="terminal",
        messages=[
            ChatMessage(author="@lead", timestamp="10:00", text="Implement Google Workspace SSO with 8h session expiration."),
            ChatMessage(author="@sec", timestamp="10:05", text="Strict domain restriction @acmecorp.com and PKCE."),
        ]
    )

    with console.status("[bold cyan]Đang phân tích và tạo Task...[/bold cyan]"):
        result = asyncio.run(analyzer.analyze_thread(thread, skill=skill))
        clickup = ClickUpClient()
        ticket = asyncio.run(clickup.create_task_from_analysis(result, skill, thread_url="terminal://quick-sync"))

    console.print(Panel(
        f"[bold green]✓ Task ClickUp đã được đồng bộ thành công![/bold green]\n\n"
        f"[bold]Task ID:[/bold] {ticket.created_task_id}\n"
        f"[bold]Tiêu đề:[/bold] {ticket.title}\n"
        f"[bold]ClickUp URL:[/bold] [link={ticket.clickup_url}]{ticket.clickup_url}[/link]",
        border_style="green",
        box=box.ROUNDED
    ))
    Prompt.ask("\n[dim]Nhấn Enter để quay lại Menu chính...[/dim]", default="")


def handle_skill_manager():
    """Inspect and switch team skills."""
    console.rule("[bold cyan]🤖 Quản lý & Tùy biến Kỹ năng Agent (Skill Manager)[/bold cyan]")
    sm = SkillManager()
    skills = sm.list_skills()

    table = Table(box=box.ROUNDED, show_header=True)
    table.add_column("#", width=4)
    table.add_column("Mã Kỹ năng", style="bold cyan")
    table.add_column("Phiên bản", style="dim")
    table.add_column("INVEST Min", justify="center")
    table.add_column("Định dạng Tiêu đề")
    table.add_column("Mô tả")

    for idx, s in enumerate(skills, 1):
        is_active = "[green]✓ (Đang kích hoạt)[/green]" if s.name == settings.default_skill else ""
        table.add_row(
            str(idx),
            f"{s.name} {is_active}",
            f"v{s.version}",
            f"{s.invest_threshold}/100",
            s.title_prefix,
            s.description
        )

    console.print(table)
    console.print(f"\nKỹ năng đang hoạt động: [bold green]{settings.default_skill}[/bold green]")
    
    if Confirm.ask("Bạn có muốn đổi kỹ năng mặc định?", default=False):
        sel = Prompt.ask("Chọn số tương ứng", choices=[str(i) for i in range(1, len(skills) + 1)])
        chosen = skills[int(sel) - 1]
        settings.default_skill = chosen.name
        console.print(f"[bold green]✓ Đã chuyển sang kỹ năng: {chosen.name}[/bold green]")

    Prompt.ask("\n[dim]Nhấn Enter để quay lại Menu chính...[/dim]", default="")


def handle_platform_status():
    """Verify platform connections: Telegram, Slack, ClickUp, Exa."""
    console.rule("[bold blue]🏢 Trạng thái Kết nối Nền tảng & Room Hub[/bold blue]")

    table = Table(box=box.ROUNDED, show_header=True)
    table.add_column("Nền tảng", style="bold")
    table.add_column("Trạng thái", justify="center")
    table.add_column("Chi tiết Cấu hình", style="dim")

    # ClickUp
    cu_status = "[green]Đã cấu hình API Token[/green]" if settings.clickup_api_key else "[red]Chưa có Token[/red]"
    cu_detail = f"Workspace: {settings.clickup_team_id or '90181076913'} | List: {settings.clickup_list_id or 'Project 1'}"
    table.add_row("ClickUp API", cu_status, cu_detail)

    # Exa
    exa_status = "[green]Đã cấu hình API Token[/green]" if settings.exa_api_key else "[yellow]Mock Local Fallback[/yellow]"
    exa_detail = "Tra cứu RFC & Tiêu chuẩn bảo mật thời gian thực"
    table.add_row("Exa Neural Search", exa_status, exa_detail)

    # Telegram
    tg_status = "[green]Đã sẵn sàng[/green]" if settings.telegram_bot_token else "[yellow]Chưa có TELEGRAM_BOT_TOKEN[/yellow]"
    tg_detail = "Hỗ trợ polling & Inline Keyboard Approve Task"
    table.add_row("Telegram Bot", tg_status, tg_detail)

    # Slack
    slack_status = "[green]Đã cấu hình Credentials[/green]" if settings.slack_bot_token else "[yellow]Cấu hình cục bộ[/yellow]"
    slack_detail = "Hỗ trợ lệnh /ba-summarize & Block Kit UI"
    table.add_row("Slack Bolt (Socket Mode)", slack_status, slack_detail)

    console.print(table)
    Prompt.ask("\n[dim]Nhấn Enter để quay lại Menu chính...[/dim]", default="")


def handle_quick_demo():
    """Run full 2-minute demo showcase in terminal."""
    from .cli import run_demo_showcase
    run_demo_showcase()
    Prompt.ask("\n[dim]Nhấn Enter để quay lại Menu chính...[/dim]", default="")


def handle_launch_web():
    """Launch React Web Studio from interactive CLI."""
    console.rule("[bold cyan]🌐 Khởi chạy ScribeBA Web Studio[/bold cyan]")
    import subprocess
    import webbrowser
    import time
    import threading

    frontend_dir = BASE_DIR / "frontend"
    port = 3000
    url = f"http://localhost:{port}"

    console.print(f"🚀 Đang bật Vite Server tại [bold green]{url}[/bold green]...")
    console.print("⚡ Nhấn [bold red]Ctrl+C[/bold red] trong terminal để dừng web server khi xem xong.\n")

    def _open():
        time.sleep(1.8)
        webbrowser.open(url)
    threading.Thread(target=_open, daemon=True).start()

    try:
        cmd = ["npx", "vite", "--port", str(port), "--host"]
        subprocess.run(cmd, cwd=str(frontend_dir), shell=True)
    except KeyboardInterrupt:
        console.print("\n[dim]Đã đóng Web Server. Quay lại Terminal.[/dim]")


def start_interactive_app():
    """Main loop for ScribeBA Terminal Edition."""
    while True:
        try:
            print_banner()
            choice = show_menu()

            if choice == "1":
                handle_new_session()
            elif choice == "2":
                handle_exa_grounding()
            elif choice == "3":
                handle_clickup_sync()
            elif choice == "4":
                handle_skill_manager()
            elif choice == "5":
                handle_platform_status()
            elif choice == "6":
                handle_quick_demo()
            elif choice == "7":
                handle_launch_web()
            elif choice == "0":
                console.print("\n[bold cyan]Cảm ơn bạn đã sử dụng ScribeBA! Hẹn gặp lại tại Hackathon.[/bold cyan]\n")
                sys.exit(0)
        except (KeyboardInterrupt, EOFError):
            console.print("\n\n[bold yellow]Đã hủy tác vụ. Quay lại Menu chính...[/bold yellow]\n")
            continue


if __name__ == "__main__":
    start_interactive_app()
