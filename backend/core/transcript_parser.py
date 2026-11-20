import re
from typing import List
from .models import ChatMessage

def parse_slack_transcript(text: str) -> List[ChatMessage]:
    """Parse messages copied from Slack in various desktop/web formats into ChatMessage objects.
    
    Supported formats:
    1. Line-by-line timestamp: [09:25] @Mai: Hôm nay trời nóng... or [09:25] Mai: ...
    2. Header style:
       Quang Minh Tran [3:21 PM]
       Hello @nguyen phuong thao...
    3. User prefix style: @user: message
    4. Plain lines
    """
    if not text or not text.strip():
        return []

    lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
    messages: List[ChatMessage] = []

    # Format 1: [09:25] @Mai: Message
    line_pattern = re.compile(
        r"^\[(\d{1,2}:\d{2}(?:\s*[AP]M)?)\]\s*@?([A-Za-z0-9_\.\s\u00C0-\u024F\u1EA0-\u1EF9]+?):\s*(.+)$",
        re.IGNORECASE
    )

    # Format 2: Quang Minh Tran [3:21 PM] (followed by message line)
    header_pattern = re.compile(
        r"^@?([A-Za-z0-9_\.\s\u00C0-\u024F\u1EA0-\u1EF9]+?)\s*\[(\d{1,2}:\d{2}(?:\s*[AP]M)?)\]$",
        re.IGNORECASE
    )

    # Format 3: @User: Message
    user_line_pattern = re.compile(
        r"^@([A-Za-z0-9_\.\s\u00C0-\u024F\u1EA0-\u1EF9]+?):\s*(.+)$",
        re.IGNORECASE
    )

    i = 0
    while i < len(lines):
        line = lines[i]

        m1 = line_pattern.match(line)
        if m1:
            ts, author, content = m1.groups()
            author_clean = author.strip()
            if not author_clean.startswith("@"):
                author_clean = f"@{author_clean}"
            messages.append(ChatMessage(author=author_clean, timestamp=ts, text=content))
            i += 1
            continue

        m2 = header_pattern.match(line)
        if m2 and i + 1 < len(lines):
            author, ts = m2.groups()
            content = lines[i + 1]
            author_clean = author.strip()
            if not author_clean.startswith("@"):
                author_clean = f"@{author_clean}"
            messages.append(ChatMessage(author=author_clean, timestamp=ts, text=content))
            i += 2
            continue

        m3 = user_line_pattern.match(line)
        if m3:
            author, content = m3.groups()
            messages.append(ChatMessage(author=f"@{author.strip()}", timestamp="now", text=content))
            i += 1
            continue

        # Plain generic line
        messages.append(ChatMessage(
            author=f"@speaker{len(messages) + 1}",
            timestamp="now",
            text=line
        ))
        i += 1

    return messages
