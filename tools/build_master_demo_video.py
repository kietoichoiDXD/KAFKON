import os
import sys
import math
import subprocess
import wave
import struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Video Dimensions & Configuration
# ---------------------------------------------------------------------------
WIDTH = 1920
HEIGHT = 1080
FPS = 30
SAMPLE_RATE = 44100

OUTPUT_DIR = os.path.abspath("demo_assets")
MASTER_MP4 = os.path.join(OUTPUT_DIR, "ScribeBA_Master_Demo_1080p.mp4")
WEB_MP4 = os.path.join(OUTPUT_DIR, "ScribeBA_Master_Demo_Web.mp4")
PREVIEW_GIF = os.path.join(OUTPUT_DIR, "ScribeBA_Feature_Highlight.gif")

# Load Fonts
def get_font(size, bold=False):
    font_name = "segoeuib.ttf" if bold else "segoeui.ttf"
    font_path = os.path.join("C:/Windows/Fonts", font_name)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    alt_name = "arialbd.ttf" if bold else "arial.ttf"
    alt_path = os.path.join("C:/Windows/Fonts", alt_name)
    if os.path.exists(alt_path):
        return ImageFont.truetype(alt_path, size)
    return ImageFont.load_default()

# ---------------------------------------------------------------------------
# Complete 15-Scene Master Storyboard (Covering ALL Live Product Features)
# ---------------------------------------------------------------------------
SCENES = [
    {
        "id": "scene_01_intro",
        "type": "title_card",
        "chapter": "01 / 15",
        "title_vn": "ScribeBA Studio — Nền Tảng Agile PM Đa Kênh Tự Chủ",
        "subtitle_vn": "Giải quyết bài toán phân mảnh yêu cầu, chặn ảo giác và quản trị sprint tự động",
        "title_en": "Autonomous Agile PM Platform & Multi-Channel Engineering Mesh",
        "category": "PRODUCT OVERVIEW",
        "voice_text": "Welcome to ScribeBA Studio. The comprehensive autonomous Agile platform unifying multi-channel engineering chat into verified, zero-blocker production deliverables.",
        "duration_sec": 5.0,
    },
    {
        "id": "scene_02_spec_studio",
        "type": "screen",
        "chapter": "02 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_01_spec_studio.png"),
        "title_vn": "Spec Studio: Tiếp Nhận & Phân Rã Yêu Cầu Tự Động",
        "subtitle_vn": "Phân tích prompt tự nhiên, trích xuất claim và gán nhãn kiểm toán 3 trục",
        "title_en": "Spec Studio: Natural Language Ingestion & INVEST Claim Extraction",
        "category": "AGILE SPEC ENGINE",
        "voice_text": "Spec Studio ingests team chat threads and natural language specifications, extracting verifiable requirement claims with zero AI hallucination.",
        "zoom_start": 1.0,
        "zoom_end": 1.10,
        "pan_focus": (960, 420),
        "duration_sec": 5.5,
    },
    {
        "id": "scene_03_live_telemetry",
        "type": "screen",
        "chapter": "03 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_02_live_telemetry.png"),
        "title_vn": "Live Telemetry: Giám Sát Thời Gian Thực & Exa Grounding",
        "subtitle_vn": "Đồng bộ socket trực tiếp với Slack và ClickUp kèm lá chắn Hallucination Guard",
        "title_en": "Live Execution Telemetry & Cross-Platform Ingestion Guardrails",
        "category": "TELEMETRY & GUARDRAILS",
        "voice_text": "Live Execution Telemetry streams active Slack discussions with instant Exa grounding and real-time hallucination prevention guardrails.",
        "zoom_start": 1.0,
        "zoom_end": 1.08,
        "pan_focus": (960, 450),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_04_aiops",
        "type": "screen",
        "chapter": "04 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_03_aiops.png"),
        "title_vn": "AIOps Incident Command: Xử Lý Sự Cố Kubernetes Tự Động",
        "subtitle_vn": "Gắn alert Prometheus, chẩn đoán CrashLoop và khóa an toàn resourceVersion",
        "title_en": "AIOps Incident Command: Kubernetes Triage & Concurrency Locks",
        "category": "DEVOPS SRE TRIAGE",
        "voice_text": "The AIOps Incident Command diagnoses Kubernetes crash loops, maps Prometheus telemetry alerts, and enforces optimistic resourceVersion locks before applying patches.",
        "zoom_start": 1.0,
        "zoom_end": 1.14,
        "pan_focus": (960, 680),  # Focus on the remediation patch diff
        "duration_sec": 6.0,
    },
    {
        "id": "scene_05_evidence_audit",
        "type": "screen",
        "chapter": "05 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_04_evidence_audit.png"),
        "title_vn": "Evidence Audit: Kiểm Toán Bằng Chứng & Nguồn Phát Ngôn",
        "subtitle_vn": "Xác thực 3 trục: Verified, Inferred, Blocked — Ngăn chặn mã giả lập",
        "title_en": "Evidence Audit Docket: 3-Axis Verification & Speaker Provenance",
        "category": "ZERO-BLOCKER GOVERNANCE",
        "voice_text": "Evidence Audit verifies every statement against its speaker quote. Any unconfirmed requirement is mathematically blocked to ensure complete enterprise compliance.",
        "zoom_start": 1.0,
        "zoom_end": 1.12,
        "pan_focus": (960, 480),
        "duration_sec": 5.5,
    },
    {
        "id": "scene_06_rooms_overview",
        "type": "screen",
        "chapter": "06 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_02_overview.png"),
        "title_vn": "Room Studio Hub: Quản Trị Squad Phân Tán",
        "subtitle_vn": "Giám sát toàn bộ các squad kỹ thuật, kênh chat liên kết và task đang chạy",
        "title_en": "PM Autonomous Room Hub & Multi-Squad Operations Mesh",
        "category": "ROOM STUDIO HUB",
        "voice_text": "The PM Autonomous Room Studio enables Project Managers to orchestrate multiple engineering squads, monitoring connected channels and active deliverables in one place.",
        "zoom_start": 1.0,
        "zoom_end": 1.07,
        "pan_focus": (960, 480),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_07_create_modal",
        "type": "screen",
        "chapter": "07 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_create_modal.png"),
        "title_vn": "Tạo Room & Liên Kết Song Song Slack, Discord, Telegram",
        "subtitle_vn": "Cấu hình channel name, webhooks, bot tokens và chỉ định Agent chuyên trách",
        "title_en": "Create Autonomous Room with Multi-Channel Social Mesh",
        "category": "MULTI-CHANNEL MESH",
        "voice_text": "Creating a room connects Slack, Discord, and Telegram channels simultaneously, assigning a specialized PM AI agent tailored to the squads technical domain.",
        "zoom_start": 1.0,
        "zoom_end": 1.10,
        "pan_focus": (960, 520),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_08_social_chat",
        "type": "screen",
        "chapter": "08 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_03_chat.png"),
        "title_vn": "Luồng Chat Đa Nền Tảng Hợp Nhất Thời Gian Thực",
        "subtitle_vn": "Thu nhận tin nhắn từ Slack, Discord, Telegram và tổng hợp yêu cầu kỹ thuật",
        "title_en": "Unified Social Stream: Real-Time Multi-Platform Chat Aggregation",
        "category": "SOCIAL CHAT BRIDGE",
        "voice_text": "The Social Chat Bridge aggregates real-time discussions across Slack, Discord, and Telegram. The assigned PM agent listens and structures tasks continuously.",
        "zoom_start": 1.0,
        "zoom_end": 1.08,
        "pan_focus": (820, 420),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_09_chat_tree",
        "type": "screen",
        "chapter": "09 / 15",
        "image": os.path.join(OUTPUT_DIR, "test_chat_shot.png"),
        "title_vn": "Lệnh /tree Trực Quan Hóa Cây Thư Mục Ngay Trong Chat",
        "subtitle_vn": "Gõ /tree trong chat, AI tự động quét repo và nhúng cây phân cấp tương tác",
        "title_en": "In-Chat /tree Command: Interactive Production Tree Visualization",
        "category": "CORE FEATURE: /tree",
        "voice_text": "With the slash tree command, team members can ask for architecture visibility right inside the chat. The AI agent immediately generates and embeds an interactive production codebase tree.",
        "zoom_start": 1.0,
        "zoom_end": 1.34,
        "pan_focus": (950, 780),  # Dramatic zoom into embedded tree inside chat!
        "duration_sec": 6.5,
    },
    {
        "id": "scene_10_tree_fullscreen",
        "type": "screen",
        "chapter": "10 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_05_tree_fullscreen.png"),
        "title_vn": "Bảng Điều Khiển Cây Thư Mục & File Inspector Chuyên Sâu",
        "subtitle_vn": "Bộ lọc đuôi file, thống kê dòng code, dung lượng và xuất cây ký tự ASCII",
        "title_en": "Production Tree Visualizer & Architectural File Inspector",
        "category": "CODEBASE MAPPING",
        "voice_text": "The dedicated tree view features a real-time File Inspector detailing file sizes, lines of code, and architectural responsibilities, with one-click ASCII export for chat channels.",
        "zoom_start": 1.0,
        "zoom_end": 1.15,
        "pan_focus": (1100, 480),
        "duration_sec": 5.5,
    },
    {
        "id": "scene_11_kanban_tasks",
        "type": "screen",
        "chapter": "11 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_06_tasks.png"),
        "title_vn": "Bảng Task Zero-Blocker Chuẩn INVEST & Xác Thực 3 Trục",
        "subtitle_vn": "4 cột trạng thái, nhãn Verified/Blocked và liên kết ngược nguồn tin nhắn",
        "title_en": "Zero-Blocker Kanban Board & INVEST User Stories",
        "category": "AGILE KANBAN",
        "voice_text": "Sprint tasks are managed on an interactive Kanban board with rigorous INVEST criteria, three-axis verification labels, and traceable source message anchors.",
        "zoom_start": 1.0,
        "zoom_end": 1.12,
        "pan_focus": (960, 480),
        "duration_sec": 5.5,
    },
    {
        "id": "scene_12_channels",
        "type": "screen",
        "chapter": "12 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_07_channels.png"),
        "title_vn": "Cấu Hình Kênh Kết Nối & Ping Test Thời Gian Thực",
        "subtitle_vn": "Hỗ trợ Slack Bolt Socket Mode, Discord Webhook và Telegram Bot API",
        "title_en": "Social Channel Bridges & Real-Time Connection Ping Test",
        "category": "INTEGRATION MESH",
        "voice_text": "Connect and test Slack, Discord, and Telegram integrations with real-time ping latency checks, ensuring uninterrupted team synchronization.",
        "zoom_start": 1.0,
        "zoom_end": 1.08,
        "pan_focus": (900, 500),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_13_agent_config",
        "type": "screen",
        "chapter": "13 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_08_agent.png"),
        "title_vn": "5 Agent PM Chuyên Dụng & Tùy Biến Chỉ Thị Hành Vi",
        "subtitle_vn": "Lựa chọn Qwen-30B, Claude 3.5 Sonnet, chỉnh mức độ tự chủ và kiểm toán",
        "title_en": "5 Specialized PM Agents: Model Tiers & Autonomy Modes",
        "category": "AI AGENT CONFIG",
        "voice_text": "Customize five specialized PM agents with tailored model tiers from Qwen to Claude 3.5 Sonnet, adjustable autonomy levels, and domain-specific behavioral directives.",
        "zoom_start": 1.0,
        "zoom_end": 1.12,
        "pan_focus": (950, 480),
        "duration_sec": 5.5,
    },
    {
        "id": "scene_14_curated_repos",
        "type": "screen",
        "chapter": "14 / 15",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_09_repos.png"),
        "title_vn": "Hệ Sinh Thái Open-Source Tuyển Chọn (40k+ Stars)",
        "subtitle_vn": "Tích hợp Nanobot, AgentChat, Bot On Anything, Repo Visualizer, LangGraph",
        "title_en": "Curated Open-Source Architecture Repositories & Adapters",
        "category": "OPEN-SOURCE ECOSYSTEM",
        "voice_text": "Built on top of proven open-source building blocks: Nanobot, AgentChat, Repo Visualizer, and LangGraph for robust multi-agent coordination.",
        "zoom_start": 1.0,
        "zoom_end": 1.08,
        "pan_focus": (960, 500),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_15_outro",
        "type": "outro_card",
        "chapter": "15 / 15",
        "title_vn": "ScribeBA Studio — Sẵn Sàng Triển Khai Production",
        "subtitle_vn": "Vận hành 100% Local · Bảo Mật Tuyệt Đối · Thiết Kế Đạt Chuẩn Impeccable",
        "title_en": "Enterprise Ready · 100% Local Execution · Zero Hallucination",
        "category": "PRODUCTION READY",
        "voice_text": "ScribeBA Studio. Empowering engineering squads with autonomous Agile intelligence, complete data privacy, and zero hallucination.",
        "duration_sec": 5.0,
    },
]

# ---------------------------------------------------------------------------
# Audio Generation (SAPI Voiceover + Layered Tech Soundtrack)
# ---------------------------------------------------------------------------
def generate_voiceover(scene_idx, text, target_duration):
    wav_path = os.path.join(OUTPUT_DIR, f"master_voice_{scene_idx:02d}.wav")
    try:
        import win32com.client
        speaker = win32com.client.Dispatch("SAPI.SpVoice")
        fs = win32com.client.Dispatch("SAPI.SpFileStream")
        fs.Open(wav_path, 3)
        speaker.AudioOutputStream = fs
        speaker.Rate = 0  # Standard natural tempo
        speaker.Speak(text)
        fs.Close()
    except Exception as e:
        print(f"SAPI voice error: {e}, writing silent buffer")
        with wave.open(wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(b"\x00\x00" * int(SAMPLE_RATE * target_duration))
    return wav_path

def generate_ambient_soundtrack(total_duration):
    """Generate subtle, atmospheric modern tech chords (minor 9th) with soft binaural pulse."""
    t = np.linspace(0, total_duration, int(SAMPLE_RATE * total_duration), endpoint=False)
    # Fundamental frequencies: F (87.3 Hz), C (130.8 Hz), Eb (155.6 Hz), G (196 Hz), Bb (233.1 Hz)
    f0 = 87.3
    chord = (
        0.040 * np.sin(2 * np.pi * f0 * t) +
        0.030 * np.sin(2 * np.pi * f0 * 1.5 * t + 0.2) +
        0.025 * np.sin(2 * np.pi * f0 * 1.78 * t + 0.4) +
        0.020 * np.sin(2 * np.pi * f0 * 2.25 * t + 0.6) +
        0.015 * np.sin(2 * np.pi * f0 * 2.67 * t + 0.8)
    )
    # Slow LFO filter sweep (0.12 Hz)
    lfo = 0.65 + 0.35 * np.sin(2 * np.pi * 0.12 * t)
    chord = chord * lfo

    # Gentle rhythmic pulse (120 BPM = 0.5s period)
    pulse = (np.sin(2 * np.pi * 2.0 * t) ** 8) * 0.016
    music = chord + pulse

    # Smooth fade-in (2.0s) and fade-out (2.5s)
    fade_in_len = int(2.0 * SAMPLE_RATE)
    fade_out_len = int(2.5 * SAMPLE_RATE)
    music[:fade_in_len] *= np.linspace(0, 1, fade_in_len)
    music[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)

    # Scale to 16-bit PCM
    pcm_data = np.int16(np.clip(music, -1.0, 1.0) * 32767)
    music_path = os.path.join(OUTPUT_DIR, "master_ambient_soundtrack.wav")
    with wave.open(music_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm_data.tobytes())
    return music_path

# ---------------------------------------------------------------------------
# Visual Composition & Graphics Rendering
# ---------------------------------------------------------------------------
def draw_rounded_rect(draw, bbox, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = bbox
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def render_title_card(title_vn, subtitle_vn, title_en, progress, is_outro=False):
    """Render a premium dark tech title card with glowing grid, logo, and badges."""
    img = Image.new("RGB", (WIDTH, HEIGHT), color=(10, 15, 26))
    draw = ImageDraw.Draw(img, "RGBA")

    # Background subtle tech grid
    for x in range(0, WIDTH, 80):
        draw.line([(x, 0), (x, HEIGHT)], fill=(20, 30, 48, 60), width=1)
    for y in range(0, HEIGHT, 80):
        draw.line([(0, y), (WIDTH, y)], fill=(20, 30, 48, 60), width=1)

    # Central ambient glow
    cx, cy = WIDTH // 2, HEIGHT // 2 - 30
    glow_radius = int(280 + 30 * math.sin(progress * math.pi * 2))
    for r in range(glow_radius, 40, -20):
        alpha = int(18 * (1.0 - r / glow_radius))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(13, 148, 136, alpha))

    # Center Brand Icon (Hexagon / Hub)
    icon_box = [cx - 44, cy - 140, cx + 44, cy - 52]
    draw_rounded_rect(draw, icon_box, radius=16, fill=(15, 23, 42, 220), outline=(45, 212, 191, 200), width=2)
    f_icon = get_font(36, bold=True)
    draw.text((cx - 16, cy - 124), "⚡", fill=(45, 212, 191), font=f_icon)

    # Top Brand Header Tag
    f_tag = get_font(13, bold=True)
    tag_text = "ENTERPRISE READY SQUAD ENGINE" if is_outro else "AUTONOMOUS AGILE PM PLATFORM"
    tag_w = draw.textlength(tag_text, font=f_tag)
    draw_rounded_rect(draw, [cx - tag_w/2 - 14, cy - 36, cx + tag_w/2 + 14, cy - 10], radius=8,
                      fill=(13, 148, 136, 40), outline=(45, 212, 191, 140), width=1)
    draw.text((cx - tag_w/2, cy - 32), tag_text, fill=(45, 212, 191), font=f_tag)

    # Main Headline
    f_main = get_font(38, bold=True)
    main_w = draw.textlength(title_vn, font=f_main)
    draw.text((cx - main_w / 2, cy + 10), title_vn, fill=(255, 255, 255), font=f_main)

    # Subtitle VN
    f_sub = get_font(20, bold=False)
    sub_w = draw.textlength(subtitle_vn, font=f_sub)
    draw.text((cx - sub_w / 2, cy + 70), subtitle_vn, fill=(203, 213, 225), font=f_sub)

    # English Tagline
    f_en = get_font(16, bold=False)
    en_w = draw.textlength(title_en, font=f_en)
    draw.text((cx - en_w / 2, cy + 110), title_en, fill=(148, 163, 184), font=f_en)

    # Feature Chips row
    chips = [
        "Spec Studio & Claim Ingestion",
        "AIOps Kubernetes Concurrency Lock",
        "3-Axis Evidence Audit",
        "Slack/Discord/Telegram Mesh",
        "In-Chat /tree Codebase Visualizer",
        "Zero-Blocker INVEST Kanban"
    ] if not is_outro else [
        "100% Local Execution",
        "Zero Hallucination Guaranteed",
        "Impeccable Design Standard",
        "Production Ready for Teams"
    ]

    total_chips_w = len(chips) * 175
    start_x = cx - total_chips_w // 2
    f_chip = get_font(12, bold=True)
    for i, chip in enumerate(chips):
        bx = start_x + i * 175
        by = cy + 170
        draw_rounded_rect(draw, [bx, by, bx + 165, by + 28], radius=6, fill=(30, 41, 59, 180), outline=(71, 85, 105, 160), width=1)
        draw.text((bx + 10, by + 6), chip, fill=(226, 232, 240), font=f_chip)

    return img

def render_screen_scene(img_base, scene, t_norm, global_progress):
    """Render a live app scene with smooth Ken Burns zoom, pan, lower-third glass card, and progress."""
    w, h = img_base.size

    # Ken Burns Zoom & Pan calculation
    z_start = scene.get("zoom_start", 1.0)
    z_end = scene.get("zoom_end", 1.08)
    zoom = z_start + (z_end - z_start) * (1.0 - math.cos(t_norm * math.pi)) / 2.0

    fx, fy = scene.get("pan_focus", (w // 2, h // 2))
    cx = (w // 2) + (fx - (w // 2)) * t_norm * 0.75
    cy = (h // 2) + (fy - (h // 2)) * t_norm * 0.75

    crop_w = int(w / zoom)
    crop_h = int(h / zoom)
    x0 = int(max(0, min(w - crop_w, cx - crop_w // 2)))
    y0 = int(max(0, min(h - crop_h, cy - crop_h // 2)))
    x1 = x0 + crop_w
    y1 = y0 + crop_h

    cropped = img_base.crop((x0, y0, x1, y1))
    frame = cropped.resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR)

    # Add overlay elements
    draw = ImageDraw.Draw(frame, "RGBA")

    # 1. Top banner (App Watermark & Chapter indicator)
    draw_rounded_rect(draw, [24, 20, 310, 52], radius=8, fill=(15, 23, 42, 220), outline=(45, 212, 191, 140), width=1)
    f_wm = get_font(12, bold=True)
    draw.ellipse([36, 32, 44, 40], fill=(45, 212, 191))
    draw.text((52, 28), f"ScribeBA Studio · {scene.get('chapter', 'LIVE')}", fill=(241, 245, 249), font=f_wm)

    # 2. Modern Glassmorphic Lower-Third Card
    card_w = 860
    card_h = 122
    card_x = 48
    card_y = HEIGHT - card_h - 40

    draw_rounded_rect(
        draw,
        [card_x, card_y, card_x + card_w, card_y + card_h],
        radius=14,
        fill=(15, 23, 42, 238),
        outline=(45, 212, 191, 170),
        width=1
    )

    # Accent color pill top line
    draw_rounded_rect(
        draw,
        [card_x + 16, card_y + 14, card_x + 300, card_y + 34],
        radius=6,
        fill=(13, 148, 136, 90),
        outline=(45, 212, 191, 220),
        width=1
    )
    f_cat = get_font(11, bold=True)
    draw.ellipse([card_x + 24, card_y + 21, card_x + 30, card_y + 27], fill=(45, 212, 191))
    draw.text((card_x + 36, card_y + 16), f"● {scene.get('category', 'FEATURE')}", fill=(45, 212, 191), font=f_cat)

    # Title VN
    f_t = get_font(21, bold=True)
    draw.text((card_x + 18, card_y + 44), scene["title_vn"], fill=(255, 255, 255), font=f_t)

    # Subtitle VN
    f_s = get_font(14, bold=False)
    draw.text((card_x + 18, card_y + 75), scene["subtitle_vn"], fill=(203, 213, 225), font=f_s)

    # English Subtitle
    f_e = get_font(12, bold=False)
    draw.text((card_x + 18, card_y + 98), scene["title_en"], fill=(148, 163, 184), font=f_e)

    # 3. Bottom Neon Progress Bar
    bar_w = int(WIDTH * global_progress)
    draw.rectangle([0, HEIGHT - 5, WIDTH, HEIGHT], fill=(15, 23, 42, 255))
    draw.rectangle([0, HEIGHT - 5, bar_w, HEIGHT], fill=(45, 212, 191, 255))

    return frame

# ---------------------------------------------------------------------------
# Main Orchestration Engine
# ---------------------------------------------------------------------------
def main():
    print("=" * 70)
    print(" ScribeBA Studio — Master 15-Scene Comprehensive Demo Video (1080p)")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Step 1: Pre-load scene images
    loaded_images = {}
    for sc in SCENES:
        if sc["type"] == "screen":
            img_path = sc["image"]
            if os.path.exists(img_path):
                print(f"Loaded image: {os.path.basename(img_path)}")
                loaded_images[sc["id"]] = Image.open(img_path).convert("RGB")
            else:
                print(f"Warning: Image missing {img_path}")

    # Step 2: Generate Voiceover Tracks for each scene
    print("\n[Step 2/5] Synthesizing Voiceover Audio Tracks (SAPI)...")
    voice_files = []
    total_duration = 0.0
    for idx, sc in enumerate(SCENES):
        duration = sc["duration_sec"]
        total_duration += duration
        v_file = generate_voiceover(idx, sc["voice_text"], duration)
        voice_files.append((v_file, duration))
        print(f"  Scene {idx+1:02d}: {sc['id']} ({duration:.1f}s) -> {os.path.basename(v_file)}")

    print(f"Total video duration: {total_duration:.1f} seconds ({int(total_duration * FPS)} frames @ {FPS}fps)")

    # Step 3: Generate Ambient Music & Composite Audio
    print("\n[Step 3/5] Generating Ambient Tech Soundtrack & Mixing...")
    soundtrack_file = generate_ambient_soundtrack(total_duration + 1.0)

    # Merge audio segments into master audio track
    master_audio = np.zeros(int(SAMPLE_RATE * (total_duration + 1.0)), dtype=np.float32)
    cur_sample = 0
    for idx, (v_path, dur) in enumerate(voice_files):
        try:
            with wave.open(v_path, "rb") as wf:
                n_frames = wf.getnframes()
                data = wf.readframes(n_frames)
                audio_arr = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                end_sample = min(len(master_audio), cur_sample + len(audio_arr))
                master_audio[cur_sample:end_sample] += audio_arr[:end_sample - cur_sample]
        except Exception as e:
            print(f"Audio read warning: {e}")
        cur_sample += int(dur * SAMPLE_RATE)

    # Add background music at -18dB
    try:
        with wave.open(soundtrack_file, "rb") as wf:
            music_data = wf.readframes(wf.getnframes())
            music_arr = np.frombuffer(music_data, dtype=np.int16).astype(np.float32) / 32768.0
            n_mix = min(len(master_audio), len(music_arr))
            master_audio[:n_mix] += music_arr[:n_mix] * 0.42
    except Exception as e:
        print(f"Music mix warning: {e}")

    # Export master audio WAV
    master_wav_path = os.path.join(OUTPUT_DIR, "master_full_audio.wav")
    master_pcm = np.int16(np.clip(master_audio, -1.0, 1.0) * 32767)
    with wave.open(master_wav_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(master_pcm.tobytes())
    print(f"Master audio track exported: {master_wav_path}")

    # Step 4: Stream Render Frames into FFmpeg
    print("\n[Step 4/5] Rendering High-Definition 1080p Video Frames...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "bgr24",
        "-r", str(FPS),
        "-i", "-",  # Video from stdin pipe
        "-i", master_wav_path,  # Audio from master wav
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",  # Broadcast quality
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        MASTER_MP4
    ]

    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    total_frames = int(total_duration * FPS)
    global_frame = 0

    preview_gif_frames = []

    for s_idx, scene in enumerate(SCENES):
        dur = scene["duration_sec"]
        scene_frames = int(dur * FPS)
        s_id = scene["id"]
        s_type = scene["type"]

        base_img = loaded_images.get(s_id)
        if base_img is None and s_type == "screen":
            base_img = Image.new("RGB", (WIDTH, HEIGHT), color=(15, 23, 42))

        for f in range(scene_frames):
            t_norm = f / max(1, scene_frames - 1)
            global_prog = global_frame / max(1, total_frames - 1)

            if s_type == "title_card":
                frame_pil = render_title_card(scene["title_vn"], scene["subtitle_vn"], scene["title_en"], t_norm, False)
            elif s_type == "outro_card":
                frame_pil = render_title_card(scene["title_vn"], scene["subtitle_vn"], scene["title_en"], t_norm, True)
            else:
                frame_pil = render_screen_scene(base_img, scene, t_norm, global_prog)

            # Convert PIL RGB to BGR NumPy array for FFmpeg
            bgr_arr = np.array(frame_pil)[:, :, ::-1]
            proc.stdin.write(bgr_arr.tobytes())

            # Capture a few frames for GIF preview of the tree scene
            if s_id == "scene_09_chat_tree" and f % 6 == 0:
                small = frame_pil.resize((640, 360), Image.Resampling.BILINEAR)
                preview_gif_frames.append(small)

            global_frame += 1

            if global_frame % 60 == 0 or global_frame == total_frames:
                pct = (global_frame / total_frames) * 100
                sys.stdout.write(f"\r  Encoding: [{global_frame}/{total_frames} frames] {pct:.1f}%")
                sys.stdout.flush()

    proc.stdin.close()
    proc.wait()
    print("\n  FFmpeg rendering completed successfully!")

    # Step 5: Export Web-Optimized MP4 and Animated GIF
    print("\n[Step 5/5] Exporting Web MP4 and Preview GIF...")
    if os.path.exists(MASTER_MP4):
        file_size_mb = os.path.getsize(MASTER_MP4) / (1024 * 1024)
        print(f"  Master 1080p Video: {MASTER_MP4} ({file_size_mb:.2f} MB)")

        # Create web-optimized version (<15MB)
        web_cmd = [
            "ffmpeg", "-y",
            "-i", MASTER_MP4,
            "-vf", "scale=1280:720",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "24",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            WEB_MP4
        ]
        subprocess.run(web_cmd, check=True, stderr=subprocess.DEVNULL)
        web_size_mb = os.path.getsize(WEB_MP4) / (1024 * 1024)
        print(f"  Web-Optimized Video (720p): {WEB_MP4} ({web_size_mb:.2f} MB)")

    if preview_gif_frames:
        preview_gif_frames[0].save(
            PREVIEW_GIF,
            save_all=True,
            append_images=preview_gif_frames[1:],
            duration=200,
            loop=0
        )
        print(f"  Interactive Tree Preview GIF: {PREVIEW_GIF}")

    print("\n" + "=" * 70)
    print(" ALL DEMO ASSETS GENERATED SUCCESSFULLY!")
    print(f" Master Video: file:///{MASTER_MP4.replace(chr(92), '/')}")
    print(f" Web Video:    file:///{WEB_MP4.replace(chr(92), '/')}")
    print("=" * 70)

if __name__ == "__main__":
    main()
