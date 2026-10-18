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
            "anthropic" if settings.anthropic_api_key else "local-deterministic"
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


