"""HTTP API behind the ScribeBA Web Studio.

The React studio used to render `frontend/src/data/mockData.ts`. These endpoints run the same
pipeline the CLI drives, so the studio shows real threads, real analyses and real ClickUp tasks.

Flask rather than FastAPI: the FastAPI installed on the build machine is incompatible with its
Starlette, and a hackathon is not the place to fight a dependency tree.
"""
import asyncio
import json
import time
from pathlib import Path

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
    return jsonify({
        "mode": settings.scribeba_mode,
        "analysis": "openrouter" if settings.openrouter_api_key else (
            "anthropic" if settings.anthropic_api_key else "local-deterministic"
        ),
        "tier": settings.fallback_tier,
        "slack": SlackAdapter().is_live,
        "clickup": bool(settings.clickup_api_key and settings.clickup_list_id),
        "exa": bool(settings.exa_api_key),
    })


@app.get("/api/ops/state")
def ops_state():
    from . import ops
    try:
        return jsonify(ops.cluster_state())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/api/ops/diagnose")
def ops_diagnose():
    from . import ops
    try:
        return jsonify(ops.diagnose())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/ops/apply")
def ops_apply():
    from . import ops
    body = request.get_json(force=True)
    try:
        return jsonify(ops.apply_action(body["action_id"], body.get("approver", "operator")))
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/ops/verify")
def ops_verify():
    from . import ops
    try:
        return jsonify(ops.verify())
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
            "name": s.name,
            "version": s.version,
            "team_type": s.team_type,
            "description": s.description,
            "required_fields": s.required_fields,
        })
    return jsonify(out)


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
    body = request.get_json(force=True)
    channel, ts = body["channel"], body["ts"]
    skill_name = body.get("skill", "startup_lean")
    slack = SlackAdapter()
    if not slack.is_live:
        return jsonify({"error": "No Slack token configured"}), 400

    async def run():
        thread = await slack.fetch_thread(channel, ts)
        permalink = await slack.get_permalink(channel, ts)
        result = await analyzer.analyze_thread(thread, skill_name=skill_name)
        await slack.post_analysis_summary(channel, ts, result)
        if result.clarifying_question:
            await slack.post_clarification_question(channel, ts, result.clarifying_question)

        payload = {"permalink": permalink, "messages_read": len(thread.messages), **_serialize(result)}

        if body.get("create_ticket", True):
            ticket = await ClickUpClient().create_task_from_analysis(
                result, skill_manager.get_skill(skill_name), thread_url=permalink
            )
            await slack.post_ticket_confirmation(channel, ts, ticket)
            payload["ticket"] = {"id": ticket.created_task_id, "url": ticket.clickup_url, "title": ticket.title}

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

    return jsonify(asyncio.run(run()))
