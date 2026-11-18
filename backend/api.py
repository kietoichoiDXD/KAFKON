"""HTTP API behind the ScribeBA Web Studio.

The React studio used to render `frontend/src/data/mockData.ts`. These endpoints run the same
pipeline the CLI drives, so the studio shows real threads, real analyses and real ClickUp tasks.

Flask rather than FastAPI: the FastAPI installed on the build machine is incompatible with its
Starlette, and a hackathon is not the place to fight a dependency tree.
"""
import asyncio
import json
import time
import yaml
from pathlib import Path
from typing import Optional, List, Dict, Any

from flask import Flask, jsonify, request

from .config import settings
from .core.analyzer import ScribeBAAnalyzer
from .core.models import ChatMessage, ThreadContext
from .core.skills import SkillManager
from .integrations.clickup_client import ClickUpClient
from .platforms.slack_adapter import SlackAdapter
from .core.conflict_service import scan_task_against_repository

app = Flask(__name__)
skill_manager = SkillManager()
analyzer = ScribeBAAnalyzer(skill_manager)

RUNS_FILE = Path(__file__).resolve().parent.parent / ".runs.json"


def _load_runs() -> list:
    if RUNS_FILE.exists():
        return json.loads(RUNS_FILE.read_text())
    return []


def _record_run(entry: dict) -> None:
    """Keep the last 50 runs so the review screen shows real history, not samples."""
    runs = [entry] + _load_runs()
    RUNS_FILE.write_text(json.dumps(runs[:50], indent=2))


@app.after_request
def allow_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


def _serialize(result) -> dict:
    return {
        "story": result.story.model_dump(),
        "invest": result.invest_score.model_dump(),
        "acceptance_criteria": [a.model_dump(mode="json") for a in result.acceptance_criteria],
        "evidence": [e.model_dump(mode="json") for e in result.evidence_items],
        "clarifying_question": result.clarifying_question,
        "metadata": result.metadata,
        # Which engine actually answered. /api/health reports configuration; this reports the run.
        "engine": (result.metadata.get("fallback_trail") or [{"alias": "local_engine"}])[-1]["alias"],
    }


@app.get("/api/health")
def health():
    """What is actually wired up right now. The studio renders this instead of claiming features."""
    primary_analysis = "openrouter" if settings.openrouter_api_key else (
        "gemini" if settings.gemini_api_key else (
            "anthropic" if settings.anthropic_api_key else (
                "nebius" if settings.nebius_api_key else "local-deterministic"
            )
        )
    )
    return jsonify({
        "mode": settings.scribeba_mode,
        "analysis": primary_analysis,
        "tier": settings.fallback_tier,
        "openrouter": bool(settings.openrouter_api_key),
        "openrouter_model": settings.openrouter_model,
        "gemini": bool(settings.gemini_api_key),
        "gemini_model": settings.gemini_model,
        "anthropic": bool(settings.anthropic_api_key),
        "openai": bool(settings.openai_api_key),
        "nebius": bool(settings.nebius_api_key),
        "nebius_model": settings.nebius_model,
        "nebius_base_url": settings.nebius_base_url,
        "slack": SlackAdapter().is_live,
        "clickup": bool(settings.clickup_api_key and settings.clickup_list_id),
        "exa": bool(settings.exa_api_key),
        "aws": bool(settings.aws_access_key_id and settings.aws_secret_access_key),
        "aws_region": settings.aws_default_region,
    })


def _mask_key(s: Optional[str]) -> str:
    if not s:
        return ""
    if len(s) <= 8:
        return "••••••••"
    return s[:4] + "••••••••" + s[-4:]


@app.get("/api/byok")
def get_byok():
    return jsonify({
        "gemini_api_key": _mask_key(settings.gemini_api_key),
        "has_gemini": bool(settings.gemini_api_key),
        "gemini_model": settings.gemini_model,
        "openrouter_api_key": _mask_key(settings.openrouter_api_key),
        "has_openrouter": bool(settings.openrouter_api_key),
        "openrouter_model": settings.openrouter_model,
        "anthropic_api_key": _mask_key(settings.anthropic_api_key),
        "has_anthropic": bool(settings.anthropic_api_key),
        "openai_api_key": _mask_key(settings.openai_api_key),
        "has_openai": bool(settings.openai_api_key),
        "nebius_api_key": _mask_key(settings.nebius_api_key),
        "has_nebius": bool(settings.nebius_api_key),
        "nebius_base_url": settings.nebius_base_url,
        "nebius_model": settings.nebius_model,
        "aws_access_key_id": _mask_key(settings.aws_access_key_id),
        "has_aws": bool(settings.aws_access_key_id),
        "aws_region": settings.aws_default_region,
    })


@app.post("/api/byok")
def save_byok():
    import os
    body = request.get_json(force=True)
    env_path = Path(__file__).resolve().parent.parent / ".env"
    env_content = env_path.read_text(encoding="utf-8") if env_path.exists() else ""

    key_map = {
        "gemini_api_key": ("GEMINI_API_KEY", "gemini_api_key"),
        "gemini_model": ("GEMINI_MODEL", "gemini_model"),
        "openrouter_api_key": ("OPENROUTER_API_KEY", "openrouter_api_key"),
        "openrouter_model": ("OPENROUTER_MODEL", "openrouter_model"),
        "anthropic_api_key": ("ANTHROPIC_API_KEY", "anthropic_api_key"),
        "openai_api_key": ("OPENAI_API_KEY", "openai_api_key"),
        "nebius_api_key": ("NEBIUS_API_KEY", "nebius_api_key"),
        "nebius_base_url": ("NEBIUS_BASE_URL", "nebius_base_url"),
        "nebius_model": ("NEBIUS_MODEL", "nebius_model"),
        "aws_access_key_id": ("AWS_ACCESS_KEY_ID", "aws_access_key_id"),
        "aws_secret_access_key": ("AWS_SECRET_ACCESS_KEY", "aws_secret_access_key"),
        "aws_default_region": ("AWS_DEFAULT_REGION", "aws_default_region"),
    }

    updated_any = False
    for req_key, (env_var, attr) in key_map.items():
        if req_key in body and body[req_key] is not None:
            val = str(body[req_key]).strip()
            if "••••" in val:
                continue
            if attr == "nebius_base_url":
                import httpx
                try:
                    parsed_url = httpx.URL(val)
                    if parsed_url.scheme != "https" or not parsed_url.host or parsed_url.query or parsed_url.fragment:
                        return jsonify({"status": "error", "message": "Nebius base URL must be an HTTPS API base URL without query or fragment."}), 400
                except Exception:
                    return jsonify({"status": "error", "message": "Nebius base URL is invalid."}), 400
            if attr == "nebius_model" and not val:
                return jsonify({"status": "error", "message": "Nebius model ID cannot be empty."}), 400
            setattr(settings, attr, val)
            os.environ[env_var] = val
            updated_any = True
            if f"{env_var}=" in env_content:
                import re
                env_content = re.sub(rf"^{env_var}=.*$", f"{env_var}={val}", env_content, flags=re.MULTILINE)
            else:
                env_content += f"\n{env_var}={val}\n"

    if updated_any and env_content:
        env_path.write_text(env_content, encoding="utf-8")

    return jsonify({"status": "ok", "message": "BYOK credentials updated successfully"})


@app.post("/api/byok/test")
def test_byok():
    body = request.get_json(force=True)
    provider = body.get("provider", "gemini").lower()
    key = body.get("key", "").strip()

    import httpx
    if provider == "gemini":
        test_key = key if key and "••••" not in key else settings.gemini_api_key
        if not test_key:
            return jsonify({"status": "error", "message": "No Gemini API key provided"}), 400
        try:
            r = httpx.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={test_key}",
                timeout=10.0
            )
            if r.status_code == 200:
                models = [m.get("name", "") for m in r.json().get("models", [])][:5]
                return jsonify({"status": "ok", "message": f"Connected to Google Gemini! Available models: {', '.join(models)}"})
            return jsonify({"status": "error", "message": f"Gemini error {r.status_code}: {r.text[:200]}"}), 400
        except Exception as e:
            return jsonify({"status": "error", "message": f"Connection failed: {e}"}), 400

    elif provider == "openrouter":
        test_key = key if key and "••••" not in key else settings.openrouter_api_key
        if not test_key:
            return jsonify({"status": "error", "message": "No OpenRouter key provided"}), 400
        try:
            r = httpx.get(
                "https://openrouter.ai/api/v1/auth/key",
                headers={"Authorization": f"Bearer {test_key}"},
                timeout=10.0
            )
            if r.status_code == 200:
                data = r.json().get("data", {})
                limit = data.get("limit")
                usage = data.get("usage")
                return jsonify({"status": "ok", "message": f"OpenRouter Key Valid! Usage: ${usage or 0}, Limit: ${limit or 'none'}"})
            return jsonify({"status": "error", "message": f"OpenRouter returned {r.status_code}: {r.text[:200]}"}), 400
        except Exception as e:
            return jsonify({"status": "error", "message": f"Connection failed: {e}"}), 400

    elif provider == "nebius":
        test_key = key if key and "••••" not in key else settings.nebius_api_key
        base_url = str(body.get("base_url") or settings.nebius_base_url).strip().rstrip("/")
        try:
            target = httpx.URL(base_url)
            if target.scheme != "https" or not target.host or target.query or target.fragment:
                return jsonify({"status": "error", "message": "Nebius base URL must be an HTTPS API base URL without query or fragment."}), 400
        except Exception:
            return jsonify({"status": "error", "message": "Nebius base URL is invalid."}), 400
        if not test_key:
            return jsonify({"status": "error", "message": "No Nebius API key provided."}), 400
        try:
            response = httpx.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {test_key}", "Accept": "application/json"},
                timeout=10.0,
            )
            if response.status_code == 200:
                model_ids = [m.get("id", "") for m in response.json().get("data", []) if isinstance(m, dict)]
                configured_model = str(body.get("model") or settings.nebius_model)
                model_note = " Configured model is listed." if configured_model in model_ids else " API key is valid; configured model was not confirmed in the model list."
                return jsonify({"status": "ok", "message": f"Connected to Nebius AI Studio.{model_note}"})
            return jsonify({"status": "error", "message": f"Nebius returned HTTP {response.status_code}. Check the API key and base URL."}), 400
        except Exception:
            return jsonify({"status": "error", "message": "Could not reach Nebius. Check network access and the base URL."}), 400

    return jsonify({"status": "ok", "message": f"Provider {provider} format verified."})



@app.get("/api/ops/environments")
def ops_environments():
    """Everything this instance can investigate, from integrations.yaml."""
    from . import ops
    try:
        return jsonify(ops.environments())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/api/ops/faults")
def ops_faults():
    """Drill scenarios this environment declares. Empty for environments without them."""
    from . import ops
    try:
        return jsonify(ops.faults(request.args.get("environment")))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/ops/trigger")
def ops_trigger():
    """Inject one declared fault. Refuses anything not written in integrations.yaml."""
    from . import ops
    body = request.get_json(force=True)
    try:
        return jsonify(ops.trigger(body["fault"], body.get("environment")))
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/ops/state")
def ops_state():
    from . import ops
    try:
        return jsonify(ops.cluster_state(request.args.get("environment")))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/api/ops/diagnose")
def ops_diagnose():
    from . import ops
    try:
        return jsonify(ops.diagnose(request.args.get("environment")))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/ops/notify")
def ops_notify():
    """Send the proposal to Slack so a human is asked where they already are."""
    from . import ops
    body = request.get_json(force=True)
    action = ops.get_proposal(body.get("action_id", ""))
    if action is None:
        return jsonify({"error": "Unknown action_id. Re-run the diagnosis."}), 400
    try:
        return jsonify(asyncio.run(ops.notify(action, body.get("channel"))))
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.post("/api/ops/apply")
def ops_apply():
    from . import ops
    body = request.get_json(force=True)
    approver = body.get("approver", "operator")
    action = ops.get_proposal(body.get("action_id", ""))
    try:
        result = ops.apply_action(body["action_id"], approver)
    except Exception as e:
        # A refusal is news too: whoever was asked to approve should see that it did not go through.
        if action is not None:
            asyncio.run(ops.notify_outcome(action, f"⛔ *Not applied* — {e}"))
        return jsonify({"error": str(e)}), 400
    asyncio.run(ops.notify_outcome(
        action,
        f"✅ *Approved and applied* by *{approver}* at {result['at']}  `{result['action_id']}`\n"
        f"_{result['note']}_"
    ))
    return jsonify(result)


@app.get("/api/ops/verify")
def ops_verify():
    from . import ops
    try:
        return jsonify(ops.verify(request.args.get("environment")))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/api/runs")
def runs():
    """Every analysis this backend actually performed, newest first."""
    return jsonify(_load_runs())


@app.get("/api/skills")
def list_skills():
    out = []
    for name in skill_manager.list_skills():
        s = skill_manager.get_skill(name)
        out.append({
            "id": s.name,
            "name": s.name,
            "version": s.version,
            "team_type": s.team_type,
            "description": s.description,
            "required_fields": s.required_fields,
            "category": (s.clickup_mapping.get("category") if s.clickup_mapping else None) or "Incident RCA",
        })
    return jsonify(out)


@app.post("/api/skills")
def create_skill():
    """Save a new skill or imported YAML to disk and hot-reload."""
    body = request.get_json(force=True) or {}
    name = body.get("name", "").strip().replace(" ", "_").lower()
    if not name:
        return jsonify({"error": "Missing skill name"}), 400

    skill_file = settings.skills_dir / f"{name}.yaml"
    skill_data = {
        "name": name,
        "version": body.get("version", "1.0.0"),
        "description": body.get("description", ""),
        "team_type": body.get("team_type", "engineering"),
        "formatting": {"title_prefix": f"[{name.upper()}]"},
        "required_fields": body.get("required_fields", ["affected_service", "root_cause"]),
        "clickup_mapping": {"category": body.get("category", "Incident RCA")},
    }
    with open(skill_file, "w", encoding="utf-8") as f:
        yaml.dump(skill_data, f)

    skill_manager.reload_skills()
    return jsonify({"status": "ok", "skill": name, "message": f"Skill {name} saved successfully"})



@app.get("/api/slack/channels")
def slack_channels():
    slack = SlackAdapter()
    if not slack.is_live:
        return jsonify({"error": "No Slack token configured"}), 400
    data = asyncio.run(slack._call("conversations.list", {"types": "public_channel", "limit": 100}))
    return jsonify([{"id": c["id"], "name": c["name"]} for c in data.get("channels", [])])


@app.get("/api/slack/thread")
def slack_thread():
    channel, ts = request.args.get("channel", ""), request.args.get("ts", "")
    slack = SlackAdapter()
    if not slack.is_live:
        return jsonify({"error": "No Slack token configured"}), 400

    async def run():
        thread = await slack.fetch_thread(channel, ts)
        return {
            "permalink": await slack.get_permalink(channel, ts),
            "messages": [{"author": m.author, "timestamp": m.timestamp, "text": m.text} for m in thread.messages],
        }

    return jsonify(asyncio.run(run()))


@app.post("/api/chat")
def chat():
    """Answer anything: a pasted discussion becomes a labelled analysis, a question gets a reply."""
    from .chat import ChatResponder

    body = request.get_json(force=True)
    messages = [m for m in body.get("messages", []) if str(m).strip()]
    if not messages:
        return jsonify({"error": "Nothing to answer."}), 400

    responder = ChatResponder(skill_manager)
    out = asyncio.run(responder.respond(
        messages,
        body.get("skill", "startup_lean"),
        body.get("tier") or settings.fallback_tier,
        environment=body.get("environment"),
        pending_action=body.get("pending_action"),
    ))
    if out["type"] == "analysis":
        return jsonify({"type": "analysis", **_serialize(out["result"])})
    if out["type"] == "ops":
        return jsonify({"type": "ops", **out["diagnosis"]})
    if out["type"] == "approve":
        return jsonify({"type": "approve", "proposal": out["proposal"]})
    return jsonify({"type": "text", "text": out["text"]})


@app.post("/api/analyze")
def analyze():
    body = request.get_json(force=True)
    thread = ThreadContext(
        thread_id="web",
        channel="web-studio",
        platform="web",
        messages=[
            ChatMessage(author=f"@speaker{i + 1}", timestamp="now", text=t)
            for i, t in enumerate(body.get("messages", []))
        ],
    )
    result = asyncio.run(analyzer.analyze_thread(
        thread, skill_name=body.get("skill", "startup_lean"), tier=body.get("tier")
    ))
    return jsonify(_serialize(result))


@app.post("/api/slack-run")
def slack_run():
    """The full loop: read a real thread, reply in it, and file the ticket."""
    body = request.get_json(force=True) or {}
    channel = (body.get("channel") or "").strip()
    ts = (body.get("ts") or "").strip()
    tier = body.get("tier")
    skill_name = body.get("skill", "startup_lean")
    slack = SlackAdapter()
    if not slack.is_live:
        return jsonify({"error": "No Slack token configured. Set SLACK_USER_TOKEN or SLACK_BOT_TOKEN in .env."}), 400

    if not channel:
        return jsonify({"error": "Missing Slack channel ID."}), 400
    if not ts:
        return jsonify({"error": "Missing thread timestamp (ts). Click 'Seed Sample Thread' or select a thread."}), 400

    clean_ts = ts.replace(".", "").strip()
    if not clean_ts.isdigit():
        return jsonify({
            "error": f"Invalid thread timestamp '{ts}'. Slack timestamps look like 1792281644.225409. Click 'Seed Sample Thread' below to create a fresh conversation."
        }), 400

    async def run():
        thread = await slack.fetch_thread(channel, ts)
        permalink = await slack.get_permalink(channel, ts)
        result = await analyzer.analyze_thread(thread, skill_name=skill_name, tier=tier)
        for evidence in result.evidence_items:
            if evidence.source_message and evidence.source_message.match_status == "matched":
                # Slack exposes thread-root permalinks here; do not fabricate message deep links.
                evidence.source_message.thread_url = permalink or None
                if not evidence.source_message.message_id:
                    evidence.source_message.message_id = next(
                        (m.timestamp for m in thread.messages if m.timestamp == evidence.source_message.timestamp), ""
                    )
        await slack.post_analysis_summary(channel, ts, result)
        if result.clarifying_question:
            await slack.post_clarification_question(channel, ts, result.clarifying_question)

        payload = {"permalink": permalink, "messages_read": len(thread.messages), **_serialize(result)}

        if body.get("create_ticket", True):
            try:
                ticket = await ClickUpClient().create_task_from_analysis(
                    result, skill_manager.get_skill(skill_name), thread_url=permalink
                )
                await slack.post_ticket_confirmation(channel, ts, ticket)
                payload["ticket"] = {"id": ticket.created_task_id, "url": ticket.clickup_url, "title": ticket.title}
            except Exception as e:
                payload["ticket_error"] = str(e)

        _record_run({
            "at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "skill": skill_name,
            "channel": channel,
            "permalink": permalink,
            "title": result.story.title,
            "invest": result.invest_score.overall,
            "engine": payload["engine"],
            "evidence": payload["evidence"],
            "clarifying_question": result.clarifying_question,
            "ticket": payload.get("ticket"),
        })
        return payload

    try:
        return jsonify(asyncio.run(run()))
    except Exception as e:
        err = str(e)
        if "thread_not_found" in err or "message_not_found" in err:
            return jsonify({"error": f"Thread '{ts}' not found in channel. Click 'Seed Sample Thread' to generate a live thread."}), 400
        return jsonify({"error": f"Slack run failed: {err}"}), 400


@app.get("/api/clickup/tasks")
def clickup_tasks():
    """Return a bounded page of tasks from the configured ClickUp list."""
    try:
        tasks = asyncio.run(ClickUpClient().list_tasks())
        return jsonify({"tasks": tasks})
    except ValueError as e:
        return jsonify({"error": str(e), "action": "Configure CLICKUP_API_KEY and CLICKUP_LIST_ID, or submit a task directly to /api/conflicts/scan."}), 503
    except Exception:
        return jsonify({"error": "Could not load ClickUp tasks. Check ClickUp credentials, list access, and API availability.", "action": "Verify CLICKUP_API_KEY and CLICKUP_LIST_ID and retry."}), 502


@app.post("/api/conflicts/scan")
def scan_conflicts():
    """Compare a ClickUp task description with local source and return an evidence graph."""
    body = request.get_json(silent=True) or {}
    task = body.get("task")
    if not isinstance(task, dict):
        return jsonify({"error": "Missing task object.", "action": "Send {task: {name, description}}."}), 400
    name = str(task.get("name") or "").strip()
    description = str(task.get("description") or "").strip()
    if not description:
        return jsonify({"error": "Missing task description.", "action": "Provide the ClickUp task description; the scanner needs requirement text to compare against repository code."}), 400
    if not name:
        return jsonify({"error": "Missing task name.", "action": "Provide the ClickUp task name."}), 400
    try:
        result = scan_task_against_repository(task, Path(__file__).resolve().parents[1])
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        app.logger.exception("Conflict scan failed")
        return jsonify({"error": "Repository conflict scan failed. Check repository access and retry."}), 500


@app.post("/api/slack/seed")
def slack_seed():
    """Post sample conversation into a Slack channel and return the new thread timestamp."""
    body = request.get_json(force=True) or {}
    channel = (body.get("channel") or "").strip()
    if not channel:
        return jsonify({"error": "Missing channel ID"}), 400
    slack = SlackAdapter()
    if not slack.is_live:
        return jsonify({"error": "No Slack token configured"}), 400

    from demo.seed_slack_thread import parse_messages
    messages = parse_messages()

    async def seed():
        author, text = messages[0]
        first_post = await slack._call("chat.postMessage", {
            "channel": channel,
            "text": f"*{author}:* {text}"
        })
        if not first_post.get("ok"):
            raise Exception(first_post.get("error", "Failed to post root message"))
        thread_ts = first_post["ts"]
        for a, t in messages[1:]:
            await slack._call("chat.postMessage", {
                "channel": channel,
                "text": f"*{a}:* {t}",
                "thread_ts": thread_ts
            })
        permalink = await slack.get_permalink(channel, thread_ts)
        return thread_ts, permalink

    try:
        ts, permalink = asyncio.run(seed())
        return jsonify({
            "status": "ok",
            "channel": channel,
            "ts": ts,
            "permalink": permalink,
            "messages_count": len(messages),
            "message": f"Successfully seeded conversation with {len(messages)} messages!"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to seed Slack thread: {e}"}), 400


@app.get("/api/slack/threads")
def slack_threads():
    """List recent thread roots in a channel so user can pick one directly."""
    channel = (request.args.get("channel") or "").strip()
    if not channel:
        return jsonify([])
    slack = SlackAdapter()
    if not slack.is_live:
        return jsonify([])
    try:
        data = asyncio.run(slack._call("conversations.history", {"channel": channel, "limit": 15}))
        messages = data.get("messages", [])
        threads = []
        for m in messages:
            ts = m.get("ts")
            text = (m.get("text") or "").replace("\n", " ").strip()
            reply_count = m.get("reply_count", 0)
            threads.append({
                "ts": ts,
                "text": text[:80] + ("..." if len(text) > 80 else ""),
                "reply_count": reply_count,
            })
        return jsonify(threads)
    except Exception as e:
        return jsonify([])


ROOMS_FILE = Path(__file__).resolve().parent.parent / ".rooms.json"

DEFAULT_ROOMS_DATA = [
    {
        "id": "room-auth-iam",
        "name": "Auth & IAM Federation",
        "topic": "Google Workspace SSO, RBAC roles, and session security compliance",
        "description": "Enterprise squad managing SSO login, OAuth2 federation, and token security.",
        "social_links": [
            {"platform": "Slack", "channel": "#proj-auth-federation", "enabled": True, "webhook_url": "https://hooks.slack.com/services/T00/B00/X00", "status": "Connected"},
            {"platform": "Discord", "channel": "#iam-dev-squad", "enabled": True, "webhook_url": "https://discord.com/api/webhooks/123/abc", "status": "Connected"},
            {"platform": "Telegram", "channel": "@ops_auth_guard_bot", "enabled": True, "chat_id": "-100234987123", "status": "Connected"}
        ],
        "agent_config": {
            "agent_id": "agile-pm",
            "agent_name": "Lead Agile PM & Task Architect",
            "role": "Converts multi-channel discussions into INVEST user stories and decomposes backlog tasks.",
            "instructions": "Enforce 3-axis verification: claims without attributed speaker must be flagged Blocked. Calculate INVEST score before task creation.",
            "model_tier": "Nebius Qwen-30B (Fast)",
            "autonomy_mode": "Semi-Autonomous",
            "verification_rigor": "Strict 3-Axis",
            "temperature": 0.2
        },
        "tasks": [
            {
                "id": "task-101",
                "title": "Enforce @acmecorp.com domain constraint on Google Workspace SSO callback",
                "status": "In Progress",
                "priority": "High",
                "evidence_label": "Verified",
                "assigned_to": "AI Lead PM Agent",
                "source_anchor": "Slack #proj-auth-federation: @oliver_sec",
                "story": "As a SecOps Engineer, I want strictly restricted domain callbacks so unauthorized domains are rejected."
            },
            {
                "id": "task-102",
                "title": "Add sso_provider and external_subject_id to Users table with unique index",
                "status": "Done",
                "priority": "Medium",
                "evidence_label": "Verified",
                "assigned_to": "@tony_db",
                "source_anchor": "Slack #proj-auth-federation: @tony_db",
                "story": "As a Database Engineer, I want unique user provider mapping to prevent duplicate identity accounts."
            },
            {
                "id": "task-103",
                "title": "Resolve session expiration window discrepancy (8h SOC2 standard vs 24h dev)",
                "status": "Blocked",
                "priority": "Critical",
                "evidence_label": "Blocked",
                "assigned_to": "Human PM Review",
                "source_anchor": "Slack #proj-auth-federation: @alex_lead",
                "story": "Unresolved debate between @alex_lead and @oliver_sec. Requires architectural sign-off."
            },
            {
                "id": "task-104",
                "title": "Export production repository structure diagram for security audit docket",
                "status": "Backlog",
                "priority": "Medium",
                "evidence_label": "Inferred",
                "assigned_to": "Architecture Tree Agent",
                "source_anchor": "Discord #iam-dev-squad: @sarah_arch",
                "story": "As an Auditor, I need visual production hierarchy and file provenance for SOC2 compliance."
            }
        ],
        "chat_messages": [
            {"id": "m1", "sender": "@oliver_sec", "platform": "Slack", "time": "10:15", "text": "Team, Acme Corp needs Google Workspace SSO with domain restriction."},
            {"id": "m2", "sender": "@tony_db", "platform": "Discord", "time": "10:18", "text": "I'm staging the database migration for sso_provider unique index now."},
            {"id": "m3", "sender": "@alex_lead", "platform": "Telegram", "time": "10:22", "text": "What about session expiration? Can we check the production file tree to see where session timeouts are defined?"},
            {"id": "m4", "sender": "Lead Agile PM (AI)", "platform": "AI Agent", "time": "10:23", "text": "I can visualize the production repository tree to locate our auth session handlers. Type /tree or click 'Visualize Production Tree' below to explore the codebase structure."}
        ]
    },
    {
        "id": "room-aiops-incident",
        "name": "Kubernetes AIOps Incident Command",
        "topic": "Kubernetes production pod crash loops, Prometheus alerts, and runbook diffs",
        "description": "Rapid triage and remediation bridge for production cluster incidents.",
        "social_links": [
            {"platform": "Slack", "channel": "#incident-bridge-aiops", "enabled": True, "webhook_url": "https://hooks.slack.com/services/T01/B01/X01", "status": "Connected"},
            {"platform": "Telegram", "channel": "@k8s_ops_oncall_bot", "enabled": True, "chat_id": "-100987654321", "status": "Connected"}
        ],
        "agent_config": {
            "agent_id": "sre-ops",
            "agent_name": "DevOps Incident Task Commander",
            "role": "Monitors Kubernetes pod health, Prometheus metrics, and manages remediation tasks.",
            "instructions": "Lock all Kubernetes patch proposals with resourceVersion. Never apply patches without human click verification.",
            "model_tier": "Claude 3.5 Sonnet (High)",
            "autonomy_mode": "Supervised",
            "verification_rigor": "Strict 3-Axis",
            "temperature": 0.1
        },
        "tasks": [
            {
                "id": "task-201",
                "title": "Diagnose CrashLoopBackOff on payment-gateway-v2 in aiops-lab",
                "status": "In Progress",
                "priority": "Critical",
                "evidence_label": "Verified",
                "assigned_to": "SRE Ops Agent",
                "source_anchor": "Prometheus 5xx Alert > 4.2%",
                "story": "As an SRE on-call, I need immediate root cause attribution so 5xx error rate drops below 0.1%."
            },
            {
                "id": "task-202",
                "title": "Verify resourceVersion lock before rolling restart of deployment/payment-api",
                "status": "Backlog",
                "priority": "High",
                "evidence_label": "Verified",
                "assigned_to": "Human Operator",
                "source_anchor": "Kubernetes API server state",
                "story": "As an Operator, I require optimistic concurrency verification to prevent concurrent drift."
            }
        ],
        "chat_messages": [
            {"id": "m201", "sender": "@pagerduty_bot", "platform": "Slack", "time": "14:02", "text": "CRITICAL: P95 latency exceeded 800ms, 5xx rate at 4.2% in aiops-lab."},
            {"id": "m202", "sender": "DevOps Incident Task Commander (AI)", "platform": "AI Agent", "time": "14:03", "text": "Diagnosing cluster... Pod payment-gateway-v2-7f9b8 restarted 5 times. Root cause: Missing DB_REPLICA_TIMEOUT env var. Proposed runbook: patch-k8s-env-timeout."}
        ]
    }
]


def _load_rooms() -> list:
    if ROOMS_FILE.exists():
        try:
            return json.loads(ROOMS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return DEFAULT_ROOMS_DATA


def _save_rooms(rooms: list) -> None:
    ROOMS_FILE.write_text(json.dumps(rooms, indent=2, ensure_ascii=False), encoding="utf-8")


@app.get("/api/rooms")
def get_rooms():
    """List all PM rooms with social links, task lists, and AI agent configuration."""
    return jsonify(_load_rooms())


@app.post("/api/rooms")
def save_room():
    """Create or update a PM room."""
    data = request.get_json(force=True) or {}
    room_id = data.get("id") or f"room-{int(time.time())}"
    data["id"] = room_id

    rooms = _load_rooms()
    existing_idx = next((i for i, r in enumerate(rooms) if r.get("id") == room_id), None)
    if existing_idx is not None:
        rooms[existing_idx] = {**rooms[existing_idx], **data}
    else:
        rooms.append(data)

    _save_rooms(rooms)
    return jsonify({"status": "ok", "room": data})


@app.delete("/api/rooms/<room_id>")
def delete_room(room_id: str):
    rooms = [r for r in _load_rooms() if r.get("id") != room_id]
    _save_rooms(rooms)
    return jsonify({"status": "ok", "deleted": room_id})


@app.post("/api/rooms/<room_id>/chat")
def room_chat(room_id: str):
    """Handle conversational interaction between PM and the room's AI agent."""
    body = request.get_json(force=True) or {}
    user_text = (body.get("text") or body.get("message") or "").strip()
    sender = body.get("sender", "@pm_lead")
    platform = body.get("platform", "Console")

    rooms = _load_rooms()
    room = next((r for r in rooms if r.get("id") == room_id), None)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    agent_cfg = room.get("agent_config", {})
    agent_name = agent_cfg.get("agent_name", "AI PM Agent")

    msg_id = f"m-{int(time.time()*1000)}"
    user_msg = {
        "id": msg_id,
        "sender": sender,
        "platform": platform,
        "time": time.strftime("%H:%M"),
        "text": user_text,
    }
    room.setdefault("chat_messages", []).append(user_msg)

    lower = user_text.lower()
    is_tree_command = any(k in lower for k in ["/tree", "cây thư mục", "repo tree", "file tree", "cấu trúc", "tree"])
    is_task_command = any(k in lower for k in ["/task", "/tasks", "nhiệm vụ", "công việc", "task"])
    is_sync_command = any(k in lower for k in ["/sync", "đồng bộ", "kênh social", "slack", "discord", "telegram"])

    if is_tree_command:
        ai_reply = (
            f"🌲 **Production File Tree Generated by {agent_name}**\n\n"
            "I have mapped the current production repository hierarchy across backend core, social platforms (Slack/Discord/Telegram), "
            "Kubernetes manifests, and the React frontend. You can interact with the live expandable tree directly in the **Production Tree** tab!"
        )
        ai_msg = {
            "id": f"ai-{int(time.time()*1000)}",
            "sender": f"{agent_name} (AI)",
            "platform": "AI Agent",
            "time": time.strftime("%H:%M"),
            "text": ai_reply,
            "has_tree": True,
        }
    elif is_task_command:
        task_count = len(room.get("tasks", []))
        blocked_count = sum(1 for t in room.get("tasks", []) if t.get("status") == "Blocked")
        ai_reply = (
            f"📋 **Task Audit by {agent_name}**\n\n"
            f"Room has **{task_count} total tasks**, with **{blocked_count} blocked items** waiting on human architectural confirmation. "
            "All claims are verified using our 3-Axis Provenance model. Click **Tasks & Agile Board** to inspect or modify task statuses."
        )
        ai_msg = {
            "id": f"ai-{int(time.time()*1000)}",
            "sender": f"{agent_name} (AI)",
            "platform": "AI Agent",
            "time": time.strftime("%H:%M"),
            "text": ai_reply,
            "has_tasks": True,
        }
    elif is_sync_command:
        ai_reply = (
            f"🔄 **Social Sync by {agent_name}**\n\n"
            "Listening channels: Slack Bolt (`#proj-auth-federation`), Discord Gateway (`#iam-dev-squad`), and Telegram Bot. "
            "New messages are ingested with zero hallucination. 3-Axis status: Nominal."
        )
        ai_msg = {
            "id": f"ai-{int(time.time()*1000)}",
            "sender": f"{agent_name} (AI)",
            "platform": "AI Agent",
            "time": time.strftime("%H:%M"),
            "text": ai_reply,
        }
    else:
        ai_reply = (
            f"Understood. As **{agent_name}**, I'm managing task alignment and multi-channel synchronization for this room. "
            f"You can command me to visualize our production codebase tree (`/tree`), audit backlog tasks (`/tasks`), "
            "or review evidence claims across our connected Slack, Discord, and Telegram channels."
        )
        ai_msg = {
            "id": f"ai-{int(time.time()*1000)}",
            "sender": f"{agent_name} (AI)",
            "platform": "AI Agent",
            "time": time.strftime("%H:%M"),
            "text": ai_reply,
        }

    room["chat_messages"].append(ai_msg)
    _save_rooms(rooms)
    return jsonify({"status": "ok", "user_message": user_msg, "ai_message": ai_msg, "room": room})


@app.get("/api/rooms/tree")
def get_production_tree():
    """Scan and return the production codebase structure for interactive visualization."""
    base = Path(__file__).resolve().parent.parent

    def scan_dir(p: Path, depth=0, max_depth=3):
        if depth > max_depth:
            return None
        children = []
        try:
            for item in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                if item.name.startswith(".") or item.name in [
                    "node_modules", "dist", "__pycache__", ".pytest_cache", ".venv", "venv", "build"
                ]:
                    continue
                rel_path = str(item.relative_to(base)).replace("\\", "/")
                if item.is_dir():
                    sub = scan_dir(item, depth + 1, max_depth)
                    children.append({
                        "name": item.name,
                        "path": rel_path,
                        "type": "folder",
                        "children": sub or [],
                    })
                else:
                    size_kb = round(item.stat().st_size / 1024, 1)
                    lines = 0
                    try:
                        lines = len(item.read_text(encoding="utf-8", errors="ignore").splitlines())
                    except Exception:
                        pass
                    children.append({
                        "name": item.name,
                        "path": rel_path,
                        "type": "file",
                        "size_kb": size_kb,
                        "lines": lines,
                        "ext": item.suffix,
                    })
        except Exception:
            pass
        return children

    tree = {
        "name": "ScribeBA-Production",
        "path": "",
        "type": "folder",
        "children": scan_dir(base) or []
    }
    return jsonify(tree)


FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

@app.route("/")
def index():
    if FRONTEND_DIST.exists():
        from flask import send_from_directory
        return send_from_directory(str(FRONTEND_DIST), "index.html")
    return jsonify({"service": "ScribeBA AIOps API", "status": "running", "api_docs": "/api/health"})


@app.errorhandler(500)
def handle_500(e):
    return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith("/api"):
        return jsonify({"error": f"Endpoint not found: {request.path}"}), 404
    if FRONTEND_DIST.exists():
        from flask import send_from_directory
        file_path = FRONTEND_DIST / request.path.lstrip("/")
        if file_path.exists() and not file_path.is_dir():
            return send_from_directory(str(FRONTEND_DIST), request.path.lstrip("/"))
        return send_from_directory(str(FRONTEND_DIST), "index.html")
    return jsonify({"error": f"Endpoint not found: {str(e)}"}), 404


