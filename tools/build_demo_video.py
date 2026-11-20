import os
import sys
import math
import subprocess
import wave
import struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ---------------------------------------------------------------------------
# Video Dimensions & Configuration
# ---------------------------------------------------------------------------
WIDTH = 1920
HEIGHT = 1080
FPS = 30
SAMPLE_RATE = 44100

OUTPUT_DIR = os.path.abspath("demo_assets")
FINAL_MP4 = os.path.join(OUTPUT_DIR, "ScribeBA_Room_Demo_1080p.mp4")
WEB_MP4 = os.path.join(OUTPUT_DIR, "ScribeBA_Room_Demo_Web.mp4")
PREVIEW_GIF = os.path.join(OUTPUT_DIR, "ScribeBA_Tree_Demo.gif")

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
# Scene Storyboard Definitions (11 Scenes)
# ---------------------------------------------------------------------------
SCENES = [
    {
        "id": "scene_01_intro",
        "type": "title_card",
        "title_vn": "ScribeBA Studio — PM Autonomous Room & Channel Studio",
        "subtitle_vn": "Nền tảng quản trị Agile tự động liên kết đa kênh Social và AI chuyên dụng",
        "title_en": "Autonomous Agile PM Studio & Multi-Channel Engineering Mesh",
        "category": "PRODUCT LAUNCH",
        "voice_text": "Welcome to ScribeBA Studio. The autonomous Agile governance platform linking multi-channel engineering chat to specialized PM agents.",
        "duration_sec": 4.5,
    },
    {
        "id": "scene_02_overview",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_02_overview.png"),
        "title_vn": "Tổng Quan Squad Rooms & Chỉ Số Quản Trị",
        "subtitle_vn": "Giám sát toàn bộ các phòng ban kỹ thuật, kênh chat liên kết và task 3 trục",
        "title_en": "Autonomous Squad Rooms & Multi-Channel Governance Mesh",
        "category": "ROOM STUDIO HUB",
        "voice_text": "Project Managers can oversee all autonomous squads, monitor linked social channels, and track zero-blocker deliverables.",
        "zoom_start": 1.0,
        "zoom_end": 1.06,
        "pan_focus": (960, 500),
        "duration_sec": 4.5,
    },
    {
        "id": "scene_03_create_modal",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_create_modal.png"),
        "title_vn": "Tạo Room & Liên Kết Đồng Thời Slack, Discord, Telegram",
        "subtitle_vn": "Cấu hình channel name, webhooks, bot tokens và gán Agent chuyên dụng",
        "title_en": "Create Autonomous Room with Multi-Channel Social Mesh",
        "category": "CHANNEL LINKING",
        "voice_text": "Creating a room instantly links Slack, Discord, and Telegram channels, with custom PM agent assignment.",
        "zoom_start": 1.0,
        "zoom_end": 1.10,
        "pan_focus": (960, 520),
        "duration_sec": 4.5,
    },
    {
        "id": "scene_04_chat",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_03_chat.png"),
        "title_vn": "Luồng Chat Hợp Nhất Đa Kênh (Slack + Discord + Telegram)",
        "subtitle_vn": "AI Agent lắng nghe, tổng hợp thảo luận và giải quyết tranh luận kỹ thuật",
        "title_en": "Unified Multi-Channel Stream & Real-Time AI Ingestion",
        "category": "SOCIAL CHAT BRIDGE",
        "voice_text": "The unified social stream aggregates messages across Slack, Discord, and Telegram. Requirements are continuously parsed.",
        "zoom_start": 1.0,
        "zoom_end": 1.07,
        "pan_focus": (800, 420),
        "duration_sec": 4.5,
    },
    {
        "id": "scene_05_chat_tree",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "test_chat_shot.png"),
        "title_vn": "Lệnh /tree Trực Quan Hóa Cây Thư Mục Ngay Trong Chat",
        "subtitle_vn": "Gõ /tree trong chat, AI tự động quét repo và nhúng cây phân cấp tương tác",
        "title_en": "In-Chat /tree Command Embeds Live Production Architecture Tree",
        "category": "CORE FEATURE: /tree",
        "voice_text": "Typing slash tree commands the AI agent to map and embed the live production architecture tree directly inside the chat conversation.",
        "zoom_start": 1.0,
        "zoom_end": 1.32,
        "pan_focus": (940, 780),  # Focus on the embedded tree in chat!
        "duration_sec": 6.5,
    },
    {
        "id": "scene_06_tree_fullscreen",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_05_tree_fullscreen.png"),
        "title_vn": "Khám Phá Cây Thư Mục Production & File Inspector",
        "subtitle_vn": "Phân tích số dòng code, dung lượng file, vai trò kiến trúc và xuất ASCII",
        "title_en": "Fullscreen Production Tree Visualizer & Architectural File Inspector",
        "category": "CODEBASE MAPPING",
        "voice_text": "The dedicated tree view provides an interactive explorer with live file filtering, code stats, and a real-time architectural File Inspector.",
        "zoom_start": 1.0,
        "zoom_end": 1.15,
        "pan_focus": (1100, 480),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_07_tasks",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_06_tasks.png"),
        "title_vn": "Bảng Task Zero-Blocker (Kanban & Tiêu Chí INVEST)",
        "subtitle_vn": "Kiểm toán 3 trục (Verified, Blocked, Inferred) và truy nguyên nguồn tin nhắn",
        "title_en": "Zero-Blocker Kanban Task Board & INVEST User Stories",
        "category": "AGILE GOVERNANCE",
        "voice_text": "Tasks are managed under a strict zero-blocker rule with INVEST criteria, three-axis verification status, and direct message provenance.",
        "zoom_start": 1.0,
        "zoom_end": 1.12,
        "pan_focus": (960, 480),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_08_channels",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_07_channels.png"),
        "title_vn": "Cấu Hình Kênh Kết Nối & Ping Test Thời Gian Thực",
        "subtitle_vn": "Hỗ trợ Slack Bolt Socket Mode, Discord Webhook và Telegram Bot API",
        "title_en": "Social Channel Bridge Ingestion & Real-Time Ping Latency",
        "category": "INFRASTRUCTURE MESH",
        "voice_text": "Easily configure Slack Bolt, Discord webhooks, and Telegram bots with integrated ping latency testing.",
        "zoom_start": 1.0,
        "zoom_end": 1.08,
        "pan_focus": (900, 500),
        "duration_sec": 4.5,
    },
    {
        "id": "scene_09_agent",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_08_agent.png"),
        "title_vn": "Cấu Hình 5 Agent Chuyên Dụng Quản Lý Dự Án",
        "subtitle_vn": "Tùy biến Model Tier (Qwen, Claude 3.5), Autonomy Mode và System Directives",
        "title_en": "Specialized PM Agent Tuning, Model Tiers & Autonomy Rigor",
        "category": "AI AGENT CONFIG",
        "voice_text": "Fine-tune five specialized agents with custom model tiers, autonomy levels, three-axis verification rigor, and directives.",
        "zoom_start": 1.0,
        "zoom_end": 1.12,
        "pan_focus": (950, 480),
        "duration_sec": 5.0,
    },
    {
        "id": "scene_10_repos",
        "type": "screen",
        "image": os.path.join(OUTPUT_DIR, "raw_scene_09_repos.png"),
        "title_vn": "Bộ Thư Viện Open-Source Tuyển Chọn Hàng Đầu",
        "subtitle_vn": "Tích hợp Nanobot, AgentChat, Repo Visualizer, GitHubTree, LangGraph",
        "title_en": "Curated Open-Source Architecture Repositories (40k+ Stars)",
        "category": "OPEN-SOURCE ECOSYSTEM",
        "voice_text": "Backed by industry-standard open source repositories: Nanobot, AgentChat, Repo Visualizer, and LangGraph.",
        "zoom_start": 1.0,
        "zoom_end": 1.08,
        "pan_focus": (960, 500),
        "duration_sec": 4.5,
    },
    {
        "id": "scene_11_outro",
        "type": "outro_card",
        "title_vn": "ScribeBA Studio — Sẵn Sàng Vận Hành Production",
        "subtitle_vn": "Quản trị dự án thông minh với AI chuyên biệt · 100% Local · Impeccable Design",
        "title_en": "Intelligent Autonomous Project Governance for Modern Engineering",
        "category": "PRODUCTION READY",
        "voice_text": "ScribeBA Studio. Intelligent Agile governance for high-velocity software engineering.",
        "duration_sec": 4.5,
    },
]

# ---------------------------------------------------------------------------
# Audio Synthesis (SAPI Voiceover + Ambient Tech Chords)
# ---------------------------------------------------------------------------
def generate_voiceover(scene_idx, text, target_duration):
    wav_path = os.path.join(OUTPUT_DIR, f"voice_{scene_idx:02d}.wav")
    try:
        import win32com.client
        speaker = win32com.client.Dispatch("SAPI.SpVoice")
        fs = win32com.client.Dispatch("SAPI.SpFileStream")
        fs.Open(wav_path, 3)
        speaker.AudioOutputStream = fs
        speaker.Rate = 0  # Natural conversational rate
        speaker.Speak(text)
        fs.Close()
    except Exception as e:
        print(f"SAPI voice error: {e}, generating silent track")
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
        0.04 * np.sin(2 * np.pi * f0 * t) +
        0.03 * np.sin(2 * np.pi * f0 * 1.5 * t + 0.2) +
        0.025 * np.sin(2 * np.pi * f0 * 1.78 * t + 0.4) +
        0.02 * np.sin(2 * np.pi * f0 * 2.25 * t + 0.6) +
        0.015 * np.sin(2 * np.pi * f0 * 2.67 * t + 0.8)
    )
    # Slow LFO filter sweep (0.15 Hz)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.15 * t)
    chord = chord * lfo

    # Gentle rhythmic pulse (120 BPM = 0.5s period)
    pulse = (np.sin(2 * np.pi * 2.0 * t) ** 8) * 0.015
    music = chord + pulse

    # Smooth fade-in (1.5s) and fade-out (2.0s)
    fade_in_len = int(1.5 * SAMPLE_RATE)
    fade_out_len = int(2.0 * SAMPLE_RATE)
    music[:fade_in_len] *= np.linspace(0, 1, fade_in_len)
    music[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)

    # Scale to 16-bit PCM
    pcm_data = np.int16(np.clip(music, -1.0, 1.0) * 32767)
    music_path = os.path.join(OUTPUT_DIR, "ambient_soundtrack.wav")
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
    tag_text = "PRODUCTION READY SQUAD ENGINE" if is_outro else "AUTONOMOUS PROJECT MANAGEMENT PLATFORM"
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
        "Slack Bolt Socket Mode",
        "Discord Webhook Relay",
        "Telegram Bot API",
        "In-Chat /tree Codebase Map",
        "Zero-Blocker 3-Axis Audit",
        "5 Specialized PM Agents"
    ] if not is_outro else [
        "100% Local Execution",
        "Zero Cloud Dependencies",
        "Impeccable Design Craft",
        "Ready for Production"
    ]

    total_chips_w = len(chips) * 170
    start_x = cx - total_chips_w // 2
    f_chip = get_font(12, bold=True)
    for i, chip in enumerate(chips):
        bx = start_x + i * 175
        by = cy + 170
        draw_rounded_rect(draw, [bx, by, bx + 165, by + 28], radius=6, fill=(30, 41, 59, 180), outline=(71, 85, 105, 160), width=1)
        draw.text((bx + 12, by + 6), chip, fill=(226, 232, 240), font=f_chip)

    return img

def render_screen_scene(img_base, scene, t_norm, global_progress):
    """Render a live app scene with smooth Ken Burns zoom, pan, lower-third glass card, and progress."""
    w, h = img_base.size

    # Ken Burns Zoom & Pan calculation
    z_start = scene.get("zoom_start", 1.0)
    z_end = scene.get("zoom_end", 1.08)
    zoom = z_start + (z_end - z_start) * (1.0 - math.cos(t_norm * math.pi)) / 2.0

    fx, fy = scene.get("pan_focus", (w // 2, h // 2))
    # Interpolate center towards focus
    cx = (w // 2) + (fx - (w // 2)) * t_norm * 0.7
    cy = (h // 2) + (fy - (h // 2)) * t_norm * 0.7

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

    # 1. Subtle top banner (App Watermark)
    draw_rounded_rect(draw, [24, 20, 290, 52], radius=8, fill=(15, 23, 42, 220), outline=(45, 212, 191, 140), width=1)
    f_wm = get_font(12, bold=True)
    draw.ellipse([36, 32, 44, 40], fill=(45, 212, 191))
    draw.text((52, 28), "ScribeBA Studio · Local Run", fill=(241, 245, 249), font=f_wm)

    # 2. Modern Glassmorphic Lower-Third Card
    card_w = 840
    card_h = 118
    card_x = 48
    card_y = HEIGHT - card_h - 42

    # Draw dark translucent glass card
    draw_rounded_rect(
        draw,
        [card_x, card_y, card_x + card_w, card_y + card_h],
        radius=14,
        fill=(15, 23, 42, 235),
        outline=(45, 212, 191, 160),
        width=1
    )

    # Accent color pill top line
    draw_rounded_rect(
        draw,
        [card_x + 16, card_y + 14, card_x + 280, card_y + 34],
        radius=6,
        fill=(13, 148, 136, 80),
        outline=(45, 212, 191, 200),
        width=1
    )
    f_cat = get_font(11, bold=True)
    draw.ellipse([card_x + 24, card_y + 21, card_x + 30, card_y + 27], fill=(45, 212, 191))
    draw.text((card_x + 36, card_y + 16), scene.get("category", "FEATURE HIGHLIGHT"), fill=(45, 212, 191), font=f_cat)

    # Title VN
    f_t = get_font(20, bold=True)
    draw.text((card_x + 18, card_y + 44), scene["title_vn"], fill=(255, 255, 255), font=f_t)

    # Subtitle VN
    f_s = get_font(14, bold=False)
    draw.text((card_x + 18, card_y + 74), scene["subtitle_vn"], fill=(203, 213, 225), font=f_s)

    # English Subtitle
    f_e = get_font(12, bold=False)
    draw.text((card_x + 18, card_y + 96), scene["title_en"], fill=(148, 163, 184), font=f_e)

    # 3. Bottom Neon Progress Bar
    bar_w = int(WIDTH * global_progress)
    draw.rectangle([0, HEIGHT - 5, WIDTH, HEIGHT], fill=(15, 23, 42, 255))
    draw.rectangle([0, HEIGHT - 5, bar_w, HEIGHT], fill=(45, 212, 191, 255))

    return frame

# ---------------------------------------------------------------------------
# Main Orchestration Engine
# ---------------------------------------------------------------------------
def main():
    print("=" * 65)
    print(" ScribeBA Studio — Professional Demo Video Generator (1080p)")
    print("=" * 65)

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
                print(f"Warning: Image missing {img_path}, will generate fallback card.")

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
            master_audio[:n_mix] += music_arr[:n_mix] * 0.45
    except Exception as e:
        print(f"Music mix warning: {e}")

    # Export master audio WAV
    master_wav_path = os.path.join(OUTPUT_DIR, "master_audio.wav")
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
        FINAL_MP4
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
            if s_id == "scene_05_chat_tree" and f % 6 == 0:
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
    if os.path.exists(FINAL_MP4):
        file_size_mb = os.path.getsize(FINAL_MP4) / (1024 * 1024)
        print(f"  Master 1080p Video: {FINAL_MP4} ({file_size_mb:.2f} MB)")

        # Create web-optimized version (<10MB)
        web_cmd = [
            "ffmpeg", "-y",
            "-i", FINAL_MP4,
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

    print("\n" + "=" * 65)
    print(" ALL DEMO ASSETS GENERATED SUCCESSFULLY!")
    print(f" Master Video: file:///{FINAL_MP4.replace(chr(92), '/')}")
    print(f" Web Video:    file:///{WEB_MP4.replace(chr(92), '/')}")
    print("=" * 65)

if __name__ == "__main__":
    main()
