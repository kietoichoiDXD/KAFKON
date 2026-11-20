"""Answer whatever is asked.

ScribeBA's analysis pipeline turns a discussion into a labelled specification. That is the point
of the product, but it is not an answer to "what does this do?" — asked that, the pipeline used to
reply "routine chatter without architectural decisions", which reads as a broken assistant.

So: decide first. A pasted discussion goes to the analyser; a question gets a sentence, grounded
in what this instance can actually see.
"""
import re
from typing import Any, Dict, List

from .config import settings
from .core.analyzer import ScribeBAAnalyzer
from .core.fallback_router import ModelFallbackRouter
from .core.models import ChatMessage, ThreadContext
from .core.redaction import redact
from .core.skills import SkillManager
from .core.transcript_parser import parse_slack_transcript

SYSTEM = """You are ScribeBA, an AI Business Analyst built by team KAFKON.

What you are: an agent that lives in a Slack thread. You read the whole conversation, draft a user
story, score it against the INVEST rubric, and label every claim Verified (quoted from the thread),
Inferred (reasoned from a verified claim), Assumed (convention, not confirmed) or Blocked (nobody
answered). When a required field is only Assumed you ask the channel rather than inventing a value.
On confirmation you file a ClickUp ticket carrying a permalink back to the source message.

A team's Skill file (startup_lean, agency_detailed, default) sets the title convention, the INVEST
threshold and the required fields, so the same thread produces different tickets for different
teams. An incident console applies the same discipline to a Kubernetes namespace: labelled
findings, one named runbook, an exact patch, nothing written without human approval.

What you can do in this conversation, right now — never claim otherwise:
- Read the configured Kubernetes namespace and Prometheus, and report labelled findings with the
  command that produced each one. If someone asks you to check the infrastructure you do it; you
  do not say you lack access.
- Propose one named runbook with an exact patch, pinned to the deployment's resourceVersion, and
  wait for a human to approve it.
- Read a real Slack thread, reply in it, and file a ClickUp ticket, when those are connected.

Answer the user directly and briefly — a few sentences, plain language, no bullet-point padding and
no marketing words. If they ask about something you cannot see from the context given below, say so
rather than guessing. If they paste a discussion and want it specified, tell them to send it as the
message and you will label it."""

# Asking about the cluster should make it look, not describe itself. Anything here triggers a
# real diagnosis when a kubeconfig is configured.
INFRA_HINTS = re.compile(
    r"(?i)\b(infra|infrastructure|cluster|kubernetes|k8s|namespace|pod|pods|deployment|"
    r"incident|outage|error rate|5xx|latency|prometheus|health|hạ tầng|lỗi|sự cố)\b"
)
CHECK_HINTS = re.compile(
    r"(?i)\b(check|look|diagnose|investigate|what.s wrong|whats wrong|happening|happened|"
    r"status|debug|fix|kiểm tra|xem|chẩn đoán|đang lỗi|bị lỗi)\b"
)


APPLY_HINTS = re.compile(
    r"(?i)(\bfix (it|this|now)|\bapply\b|\bapprove\b|\bdo it\b|\bgo ahead\b|\bproceed\b|"
    r"sửa (đi|luôn|ngay)|áp dụng|duyệt|làm đi)"
)


def wants_to_apply(messages: List[str]) -> bool:
    return bool(APPLY_HINTS.search(messages[-1] if messages else ""))


def wants_an_infra_check(messages: List[str]) -> bool:
    latest = messages[-1] if messages else ""
    return bool(INFRA_HINTS.search(latest) and CHECK_HINTS.search(latest))


# A discussion has several speakers or several lines of requirement talk; a question does not.
DISCUSSION_HINTS = re.compile(
    r"(?im)^\s*[@*]|(\bmust\b|\brequire|\bwe need\b|\bshould\b|\bout of scope\b|/ba-summarize)"
)


def looks_like_a_discussion(messages: List[str]) -> bool:
    joined = "\n".join(messages)
    if len(messages) >= 3:
        return True
    speakers = len(re.findall(r"(?m)^\s*\*?@\w+", joined))
    if speakers >= 2:
        return True
    # One long paragraph stating requirements is still a specification job.
    return len(joined.split()) > 25 and bool(DISCUSSION_HINTS.search(joined))


def _environments_line() -> str:
    from . import ops
    try:
        envs = ops.environments()
    except Exception:
        return "No environments are configured for investigation."
    if not envs:
        return "No environments are configured for investigation."
    bits = ", ".join(
        f"{e['name']} ({e['kind']}, {e['target']}"
        f"{', can remediate' if e['can_remediate'] else ', read-only'})"
        for e in envs
    )
    return ("Environments you can investigate right now, without being told a namespace: "
            f"{bits}. If the user asks you to check their infrastructure, you already know where "
            "to look — never ask them for a namespace you have configured.")


def _context_line() -> str:
    return (
        f"This instance right now: model provider "
        f"{'OpenRouter' if settings.openrouter_api_key else 'Anthropic' if settings.anthropic_api_key else 'none (local deterministic engine)'}, "
        f"Slack {'connected' if (settings.slack_user_token or settings.slack_bot_token) else 'not connected'}, "
        f"ClickUp {'connected' if settings.clickup_api_key else 'not configured'}, "
        f"Exa {'connected' if settings.exa_api_key else 'not configured'}, "
        f"default skill {settings.default_skill}."
    )


class ChatResponder:
    def __init__(self, skill_manager: SkillManager = None) -> None:
        self.skills = skill_manager or SkillManager()
        self.analyzer = ScribeBAAnalyzer(self.skills)
        self.router = ModelFallbackRouter()

    async def respond(self, messages: List[str], skill: str, tier: str,
                      environment: str = None, pending_action: str = None) -> Dict[str, Any]:
        from . import ops

        # "fix it" after a diagnosis should show the patch and an approve button — not ask which
        # namespace, and not write anything off the back of a sentence.
        if pending_action and wants_to_apply(messages):
            action = ops.get_proposal(pending_action)
            if action:
                return {"type": "approve", "proposal": action}

        # Check if the user pasted a Slack link or channel
        latest_message = messages[-1] if messages else ""
        all_text = "\n".join(messages)
        from .platforms.slack_adapter import parse_slack_link, SlackAdapter
        slack_target = parse_slack_link(latest_message) or parse_slack_link(all_text)
        if slack_target:
            slack = SlackAdapter()
            if not slack.is_live:
                return {
                    "type": "text",
                    "text": "🔗 Đã phát hiện link Slack nhưng server chưa được kết nối Slack Token. Vui lòng kiểm tra lại cấu hình SLACK_USER_TOKEN hoặc SLACK_BOT_TOKEN trong .env."
                }
            
            channel_id = slack_target["channel"]
            ts = slack_target.get("ts")
            try:
                if not ts:
                    hist = await slack._call("conversations.history", {"channel": channel_id, "limit": 15})
                    hist_messages = hist.get("messages", [])
                    for m in hist_messages:
                        if m.get("reply_count", 0) > 0:
                            ts = m.get("ts")
                            break
                    if not ts and hist_messages:
                        ts = hist_messages[0].get("ts")

                if not ts:
                    return {
                        "type": "text",
                        "text": f"Không tìm thấy tin nhắn hoặc thread thảo luận nào trong kênh Slack `{channel_id}`."
                    }

                thread = await slack.fetch_thread(channel_id, ts)
                if not thread.messages:
                    return {
                        "type": "text",
                        "text": f"Kênh Slack `{channel_id}` (ts: `{ts}`) không có nội dung thảo luận để phân tích."
                    }

                permalink = await slack.get_permalink(channel_id, ts)

                # Post entry announcement in Slack thread
                try:
                    await slack._call("chat.postMessage", {
                        "channel": channel_id,
                        "thread_ts": ts,
                        "text": (
                            f"🤖 *[ScribeBA AI Agent]* Đã tham gia luồng thảo luận qua liên kết trực tiếp!\n"
                            f"• Đang phân tích hội thoại ({len(thread.messages)} tin nhắn), lọc nhiễu và trích xuất task vào ClickUp."
                        )
                    })
                except Exception:
                    pass

                result = await self.analyzer.analyze_thread(
                    thread, skill_name=skill, tier=tier, force_live=True
                )
                for evidence in result.evidence_items:
                    if evidence.source_message and evidence.source_message.match_status == "matched":
                        evidence.source_message.thread_url = permalink or None

                # Auto-connect channel to project in DB if not already linked
                try:
                    import json
                    import time
                    from .core.cloud_db import cloud_db
                    with cloud_db.get_connection() as db:
                        p_row = db.execute("SELECT id, name, social_channels_json FROM projects ORDER BY updated_at DESC LIMIT 1").fetchone()
                        if p_row:
                            p_id = p_row["id"]
                            raw_json = p_row["social_channels_json"] or "[]"
                            try:
                                ch_list = json.loads(raw_json)
                            except Exception:
                                ch_list = []
                            if not any(c.get("id") == channel_id for c in ch_list):
                                ch_list.append({
                                    "id": channel_id,
                                    "name": channel_id,
                                    "platform": "slack",
                                    "is_primary": False,
                                    "purpose": "Hội thoại kỹ thuật & Task extraction (Link paste)"
                                })
                                db.execute(
                                    "UPDATE projects SET social_channels_json=?, updated_at=? WHERE id=?",
                                    (json.dumps(ch_list, ensure_ascii=False), time.time(), p_id)
                                )
                except Exception:
                    pass

                return {
                    "type": "analysis",
                    "result": result,
                    "permalink": permalink,
                    "channel": channel_id,
                    "ts": ts,
                }
            except Exception as e:
                return {
                    "type": "text",
                    "text": f"❌ Lỗi khi đọc hội thoại từ Slack `{channel_id}`: {e}\nHãy đảm bảo Bot/User token đã có quyền truy cập kênh này."
                }

        if wants_an_infra_check(messages):
            try:
                return {"type": "ops", "diagnosis": ops.diagnose(environment)}
            except Exception as e:
                configured = ", ".join(e_["name"] for e_ in ops.environments()) or "none"
                return {"type": "text", "text": (
                    f"I tried to read the environment and could not: {e}\n\n"
                    f"Configured environments: {configured}. They are declared in "
                    f"integrations.yaml; check the entry is reachable, then ask again."
                )}

        if looks_like_a_discussion(messages):
            # Parse real Slack messages if present in the discussion
            joined_text = "\n".join(messages)
            parsed_msgs = parse_slack_transcript(joined_text)
            if not parsed_msgs:
                parsed_msgs = [ChatMessage(author=f"@speaker{i+1}", timestamp="now", text=m)
                               for i, m in enumerate(messages)]
            thread = ThreadContext(
                thread_id="chat", channel="chat", platform="chat",
                messages=parsed_msgs,
            )
            result = await self.analyzer.analyze_thread(thread, skill_name=skill, tier=tier)
            
            # If the result produced decomposed tasks or verified evidence, return analysis!
            if result.decomposed_tasks or result.evidence_items:
                return {"type": "analysis", "result": result}

            # If the conversation was filtered as routine chatter / administrative noise:
            telemetry = getattr(result, "agent_telemetry", None)
            if telemetry and telemetry.quarantined_noise:
                quarantine_lines = "\n".join(
                    f"• **{q.author}** ({q.timestamp}): *{q.text}* — `{q.reason}`"
                    for q in telemetry.quarantined_noise
                )
                return {
                    "type": "text",
                    "text": (
                        "🛡️ **Anti-Noise Gatekeeper: Hội thoại thường ngày (Không có yêu cầu kỹ thuật)**\n\n"
                        "Hệ thống đã phân tích các tin nhắn dán từ Slack và xác định đây là trao đổi nội bộ / sinh hoạt thường ngày:\n"
                        f"{quarantine_lines}\n\n"
                        "💡 **AI Guard**: Đã tự động kích hoạt bộ lọc chống nhiễu (Anti-Distraction). Hệ thống không tạo User Story hay Task giả định từ những nội dung này để tránh làm bẩn backlog dự án."
                    )
                }
            elif result.clarifying_question and "routine chatter" in result.clarifying_question.lower():
                return {
                    "type": "text",
                    "text": (
                        "🛡️ **Anti-Noise Gatekeeper: Không phát hiện yêu cầu sản phẩm**\n\n"
                        "Đoạn tin nhắn dán từ Slack không chứa yêu cầu chức năng, bug fix hoặc quyết định kỹ thuật nào để bóc tách thành task."
                    )
                }

        return {"type": "text", "text": await self._answer(messages, tier)}

    async def _answer(self, messages: List[str], tier: str) -> str:
        # The same egress rule as the analyser: nothing leaves unmasked.
        transcript, masked = redact("\n".join(messages))
        if masked:
            print(f"[Redaction] masked before egress: {masked}")

        reply = await self.router.complete_text(
            f"{SYSTEM}\n\n{_context_line()}\n{_environments_line()}", transcript, tier=tier
        )
        if reply:
            return reply.strip()
        return (
            "I cannot answer that right now: no model provider responded. "
            "Set OPENROUTER_API_KEY in .env and try again — the Slack, ClickUp and incident paths "
            "keep working either way, but a written answer needs a model."
        )
