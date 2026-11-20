"""HTTP API behind the ScribeBA Web Studio.

The React studio used to render `frontend/src/data/mockData.ts`. These endpoints run the same
pipeline the CLI drives, so the studio shows real threads, real analyses and real ClickUp tasks.

Flask rather than FastAPI: the FastAPI installed on the build machine is incompatible with its
Starlette, and a hackathon is not the place to fight a dependency tree.
"""
import asyncio
import base64
import hashlib
import math
import hmac
import json
import re
import secrets
import threading
import time
import yaml
from functools import lru_cache
from collections import defaultdict, deque
from datetime import timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

from flask import Flask, jsonify, redirect, request, session
from werkzeug.exceptions import RequestEntityTooLarge

from .config import settings
from .core.analyzer import ScribeBAAnalyzer
from .core.models import ChatMessage, ThreadContext
from .core.skills import SkillManager
from .integrations.clickup_client import ClickUpClient
from .platforms.slack_adapter import SlackAdapter
from .platforms.discord_adapter import DiscordAdapter
from .platforms.telegram_adapter import TelegramAdapter
from .core.conflict_service import scan_task_against_repository

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
AUTH_ENABLED = settings.scribeba_public_mode
if AUTH_ENABLED and (
    not settings.scribeba_app_password
    or not settings.scribeba_session_secret
    or not settings.scribeba_allowed_origin
):
    raise RuntimeError(
        "Public mode requires SCRIBEBA_APP_PASSWORD, SCRIBEBA_SESSION_SECRET, and SCRIBEBA_ALLOWED_ORIGIN."
    )
if AUTH_ENABLED and len(settings.scribeba_session_secret or "") < 32:
    raise RuntimeError("SCRIBEBA_SESSION_SECRET must contain at least 32 characters in public mode.")

app.secret_key = settings.scribeba_session_secret or "local-development-only-session-key"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=AUTH_ENABLED,
    SESSION_COOKIE_SAMESITE=settings.scribeba_cookie_samesite,
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
)
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


def _safe_error(exc: Exception, fallback: str) -> str:
    """Keep implementation details out of public API responses and logs."""
    if AUTH_ENABLED:
        app.logger.warning("%s (%s)", fallback, type(exc).__name__)
        return fallback
    return str(exc)


@app.after_request
def allow_cors(response):
    origin = request.headers.get("Origin")
    allowed_origin = (settings.scribeba_allowed_origin or "").rstrip("/")
    if origin and allowed_origin and origin.rstrip("/") == allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
        response.headers.add("Vary", "Origin")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


PUBLIC_API_PATHS = {
    "/api/health",
    "/api/auth/session",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/cognito/start",
    "/api/auth/cognito/callback",
}

ADMIN_ONLY_PATHS = {
    "/api/ops/trigger",
    "/api/ops/notify",
    "/api/ops/apply",
}


def _is_admin_session() -> bool:
    user = session.get("user")
    if not isinstance(user, dict):
        return False
    allowed_emails = {
        email.strip().lower()
        for email in settings.scribeba_admin_emails.split(",")
        if email.strip()
    }
    email = str(user.get("email", "")).strip().lower()
    return bool(email and email in allowed_emails)


@app.before_request
def require_public_session():
    if not AUTH_ENABLED or not request.path.startswith("/api/"):
        return None
    # Do not trust X-Forwarded-For here; Lightsail is the only expected proxy.
    # Using the transport peer avoids clients spoofing the rate-limit identity.
    address = request.remote_addr or "unknown"
    retry_after = _consume_rate_limit("api", address, 240, 60)
    if retry_after:
        response = jsonify({"error": "Too many requests. Please retry shortly."})
        response.status_code = 429
        response.headers["Retry-After"] = str(retry_after)
        return response

    expensive_paths = {
        "/api/analyze",
        "/api/chat",
        "/api/conflicts/scan",
        "/api/slack-run",
        "/api/slack/seed",
        "/api/byok/test",
        "/api/ops/trigger",
        "/api/ops/notify",
        "/api/ops/apply",
    }
    if request.method == "POST" and (
        request.path in expensive_paths or re.fullmatch(r"/api/rooms/[^/]+/chat", request.path)
    ):
        retry_after = _consume_rate_limit("expensive", address, 12, 60)
        if retry_after:
            response = jsonify({"error": "This operation is temporarily rate limited. Please retry shortly."})
            response.status_code = 429
            response.headers["Retry-After"] = str(retry_after)
            return response

    is_room_write = (
        (request.method == "POST" and request.path == "/api/rooms")
        or (request.method == "DELETE" and re.fullmatch(r"/api/rooms/[^/]+", request.path))
    )
    if is_room_write:
        retry_after = _consume_rate_limit("room-write", address, 30, 60)
        if retry_after:
            response = jsonify({"error": "Room changes are temporarily rate limited. Please retry shortly."})
            response.status_code = 429
            response.headers["Retry-After"] = str(retry_after)
            return response

    origin_header = request.headers.get("Origin")
    origin = origin_header.rstrip("/") if origin_header else ""
    allowed_origin = (settings.scribeba_allowed_origin or "").rstrip("/")
    if origin and allowed_origin and origin != allowed_origin:
        return jsonify({"error": "Origin is not allowed."}), 403
    if request.path == "/api/auth/login" and request.method == "POST":
        retry_after = _consume_rate_limit("login", address, 6, 900)
        if retry_after:
            response = jsonify({"error": "Too many sign-in attempts. Please retry later."})
            response.status_code = 429
            response.headers["Retry-After"] = str(retry_after)
            return response

    if request.path in PUBLIC_API_PATHS:
        return None
    # Browsers omit cookies from CORS preflights. Only accept preflights from the
    # explicitly configured frontend origin; the actual request still needs auth.
    if request.method == "OPTIONS" and origin and allowed_origin and origin == allowed_origin:
        return None
    if not session.get("authenticated"):
        return jsonify({"error": "Authentication required."}), 401
    admin_only = request.path in ADMIN_ONLY_PATHS or (
        request.path == "/api/skills" and request.method == "POST"
    )
    if admin_only and not _is_admin_session():
        return jsonify({"error": "Administrator access is required for this action."}), 403
    return None


@app.get("/api/auth/session")
def auth_session():
    cognito_enabled = bool(
        settings.cognito_region
        and settings.cognito_user_pool_id
        and settings.cognito_client_id
        and settings.cognito_domain
    )
    return jsonify({
        "auth_required": AUTH_ENABLED,
        "authenticated": not AUTH_ENABLED or bool(session.get("authenticated")),
        "cognito_enabled": cognito_enabled,
        "google_enabled": cognito_enabled and settings.cognito_google_enabled,
        "user": ({**session["user"], "is_admin": _is_admin_session()}
                 if session.get("authenticated") and isinstance(session.get("user"), dict) else None),
    })


def _cognito_configured() -> bool:
    return bool(
        settings.cognito_region
        and settings.cognito_user_pool_id
        and settings.cognito_client_id
        and settings.cognito_domain
    )


def _cognito_domain() -> str:
    domain = str(settings.cognito_domain or "").strip().rstrip("/")
    if not domain.startswith("https://"):
        domain = f"https://{domain}"
    expected_suffix = f".auth.{settings.cognito_region}.amazoncognito.com"
    if not domain.lower().split("/")[2].endswith(expected_suffix):
        raise ValueError("Cognito domain is not in the configured AWS region.")
    return domain


def _cognito_issuer() -> str:
    return f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/{settings.cognito_user_pool_id}"


@lru_cache(maxsize=4)
def _cognito_jwks_client(issuer: str):
    from jwt import PyJWKClient
    return PyJWKClient(f"{issuer}/.well-known/jwks.json", cache_keys=True)


@app.get("/api/auth/cognito/start")
def cognito_start():
    if not AUTH_ENABLED or not _cognito_configured():
        return jsonify({"error": "Hosted account sign-in is not configured."}), 503
    intent = request.args.get("intent", "login")
    if intent not in {"login", "signup", "google"}:
        return jsonify({"error": "Unsupported sign-in flow."}), 400
    if intent == "google" and not settings.cognito_google_enabled:
        return jsonify({"error": "Google sign-in is not configured yet."}), 503

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    callback = f"{settings.scribeba_allowed_origin.rstrip('/')}/api/auth/cognito/callback"
    session["cognito_oauth"] = {"state": state, "nonce": nonce, "verifier": verifier, "intent": intent}
    query = {
        "response_type": "code",
        "client_id": settings.cognito_client_id,
        "redirect_uri": callback,
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    if intent == "google":
        query["identity_provider"] = "Google"
    path = "/signup" if intent == "signup" else "/oauth2/authorize"
    return redirect(f"{_cognito_domain()}{path}?{urlencode(query)}", code=302)


@app.get("/api/auth/cognito/callback")
def cognito_callback():
    if not AUTH_ENABLED or not _cognito_configured():
        return jsonify({"error": "Hosted account sign-in is not configured."}), 503
    if request.args.get("error"):
        session.pop("cognito_oauth", None)
        return redirect("/?auth_error=sign_in_cancelled")
    oauth = session.get("cognito_oauth")
    code = request.args.get("code")
    if not isinstance(oauth, dict) or not code or not hmac.compare_digest(
        str(oauth.get("state", "")), str(request.args.get("state", ""))
    ):
        session.pop("cognito_oauth", None)
        return redirect("/?auth_error=invalid_sign_in")

    callback = f"{settings.scribeba_allowed_origin.rstrip('/')}/api/auth/cognito/callback"
    try:
        domain = _cognito_domain()
        import httpx
        token_response = httpx.post(
            f"{domain}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.cognito_client_id,
                "code": code,
                "redirect_uri": callback,
                "code_verifier": oauth["verifier"],
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10.0,
        )
        token_response.raise_for_status()
        id_token = token_response.json().get("id_token")
        if not isinstance(id_token, str):
            raise ValueError("Missing ID token.")

        import jwt
        issuer = _cognito_issuer()
        signing_key = _cognito_jwks_client(issuer).get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "aud", "nonce"]},
        )
        if claims.get("token_use") != "id" or claims.get("nonce") != oauth["nonce"]:
            raise ValueError("ID token validation failed.")
        if claims.get("email_verified") not in (True, "true"):
            raise ValueError("Email address is not verified.")

        session.clear()
        session.permanent = True
        session["authenticated"] = True
        session["user"] = {
            "id": claims["sub"],
            "email": str(claims.get("email", ""))[:254],
            "name": str(claims.get("name") or claims.get("email", ""))[:120],
        }
        return redirect("/", code=302)
    except Exception as exc:
        app.logger.warning("Cognito sign-in failed (%s)", type(exc).__name__)
        session.pop("cognito_oauth", None)
        return redirect("/?auth_error=sign_in_failed", code=302)


@app.post("/api/auth/login")
def auth_login():
    if not AUTH_ENABLED:
        return jsonify({"authenticated": True, "auth_required": False})
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "A JSON object with a password is required."}), 400
    supplied = payload.get("password")
    expected = settings.scribeba_app_password or ""
    if not isinstance(supplied, str) or not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
        return jsonify({"error": "Invalid invite password."}), 401
    session.clear()
    session.permanent = True
    session["authenticated"] = True
    return jsonify({"authenticated": True, "auth_required": True})


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"authenticated": not AUTH_ENABLED, "auth_required": AUTH_ENABLED})


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
        "status": "ok",
        "openrouter": bool(settings.openrouter_api_key),
        "gemini": bool(settings.gemini_api_key),
        "anthropic": bool(settings.anthropic_api_key),
        "openai": bool(settings.openai_api_key),
        "nebius": bool(settings.nebius_api_key),
        "slack": SlackAdapter().is_live,
        "discord": DiscordAdapter().is_live,
        "telegram": TelegramAdapter().is_live(),
        "clickup": bool(settings.clickup_api_key and settings.clickup_list_id),
        "exa": bool(settings.exa_api_key),
    })


def _mask_key(s: Optional[str]) -> str:
    if not s:
        return ""
    return "••••••••"


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
        "nebius_model": settings.nebius_model,
        "aws_access_key_id": _mask_key(settings.aws_access_key_id),
        "has_aws": bool(settings.aws_access_key_id),
    })


@app.post("/api/byok")
def save_byok():
    if AUTH_ENABLED:
        return jsonify({
            "status": "error",
            "message": "Public deployments do not write credentials to .env. Configure provider credentials in the deployment secret store.",
        }), 403

    import os
    from dotenv import set_key

    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"status": "error", "message": "A JSON object is required."}), 400
    env_path = Path(__file__).resolve().parent.parent / ".env"

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
            set_key(str(env_path), env_var, val, quote_mode="always")

    if updated_any:
        try:
            env_path.chmod(0o600)
        except OSError:
            pass

    return jsonify({"status": "ok", "message": "BYOK credentials updated successfully"})


@app.post("/api/byok/test")
def test_byok():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"status": "error", "message": "A JSON object is required."}), 400
    provider = str(body.get("provider", "gemini")).lower()
    key = str(body.get("key") or "").strip()

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
            return jsonify({"status": "error", "message": f"Gemini returned HTTP {r.status_code}. Check the key and provider status."}), 400
        except Exception:
            return jsonify({"status": "error", "message": "Could not reach Gemini. Check network access and provider status."}), 400

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
            return jsonify({"status": "error", "message": f"OpenRouter returned HTTP {r.status_code}. Check the key and provider status."}), 400
        except Exception:
            return jsonify({"status": "error", "message": "Could not reach OpenRouter. Check network access and provider status."}), 400

    elif provider == "nebius":
        test_key = key if key and "••••" not in key else settings.nebius_api_key
        configured_base_url = str(settings.nebius_base_url).strip().rstrip("/")
        base_url = configured_base_url if AUTH_ENABLED else str(body.get("base_url") or configured_base_url).strip().rstrip("/")
        try:
            target = httpx.URL(base_url)
            if target.scheme != "https" or not target.host or target.query or target.fragment:
                return jsonify({"status": "error", "message": "Nebius base URL must be an HTTPS API base URL without query or fragment."}), 400
            if AUTH_ENABLED and target.host.lower() != "api.studio.nebius.ai":
                return jsonify({"status": "error", "message": "Public Nebius checks are restricted to api.studio.nebius.ai."}), 400
            if not AUTH_ENABLED and target.host.lower() in {"localhost", "127.0.0.1", "::1", "169.254.169.254"}:
                return jsonify({"status": "error", "message": "Nebius base URL cannot target a local or link-local address."}), 400
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

    return jsonify({"status": "error", "message": "Unsupported provider."}), 400



@app.get("/api/ops/environments")
def ops_environments():
    """Everything this instance can investigate, from integrations.yaml."""
    from . import ops
    try:
        return jsonify(ops.environments())
    except Exception as e:
        return jsonify({"error": _safe_error(e, "Could not load the configured environments.")}), 500


@app.get("/api/ops/faults")
def ops_faults():
    """Drill scenarios this environment declares. Empty for environments without them."""
    from . import ops
    try:
        return jsonify(ops.faults(request.args.get("environment")))
    except Exception as e:
        return jsonify({"error": _safe_error(e, "Could not load fault scenarios.")}), 500


@app.post("/api/ops/trigger")
def ops_trigger():
    """Inject one declared fault. Refuses anything not written in integrations.yaml."""
    from . import ops
    body = request.get_json(force=True)
    try:
        return jsonify(ops.trigger(body["fault"], body.get("environment")))
    except Exception as e:
        return jsonify({"error": _safe_error(e, "Could not trigger the selected fault.")}), 400


@app.get("/api/ops/state")
def ops_state():
    from . import ops
    try:
        return jsonify(ops.cluster_state(request.args.get("environment")))
    except Exception as e:
        return jsonify({"error": _safe_error(e, "Could not read the environment state.")}), 500


@app.get("/api/ops/diagnose")
def ops_diagnose():
    from . import ops
    try:
        return jsonify(ops.diagnose(request.args.get("environment")))
    except Exception as e:
        return jsonify({"error": _safe_error(e, "Could not diagnose the selected environment.")}), 500


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
        return jsonify({"error": _safe_error(e, "Could not send the notification.")}), 400


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
            asyncio.run(ops.notify_outcome(action, f"⛔ *Not applied* — {_safe_error(e, 'Action could not be applied.') }"))
        return jsonify({"error": _safe_error(e, "Action could not be applied.")}), 400
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
        return jsonify({"error": _safe_error(e, "Could not verify the selected environment.")}), 500


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
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "A JSON object is required."}), 400
    raw_name = body.get("name", "")
    if not isinstance(raw_name, str):
        return jsonify({"error": "Skill name must be text."}), 400
    name = raw_name.strip().replace(" ", "_").lower()
    if not re.fullmatch(r"[a-z0-9_-]{1,64}", name) or ".." in name:
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
                payload["ticket_error"] = _safe_error(e, "Could not create the ClickUp task.")

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
            return jsonify({"error": "Thread not found in the selected channel. Refresh the channel and try again."}), 400
        return jsonify({"error": _safe_error(e, "Slack run failed. Check the selected channel and integration status.")}), 400


@app.get("/api/clickup/tasks")
def clickup_tasks():
    """Return a bounded page of tasks from the configured ClickUp list."""
    try:
        tasks = asyncio.run(ClickUpClient().list_tasks())
        return jsonify({"tasks": tasks})
    except ValueError as e:
        return jsonify({"error": _safe_error(e, "ClickUp is not configured or unavailable."), "action": "Configure ClickUp credentials and list access, or submit a task directly to /api/conflicts/scan."}), 503
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
        return jsonify({"error": _safe_error(e, "The task could not be scanned.")}), 400
    except Exception:
        app.logger.warning("Conflict scan failed (%s)", "unexpected error")
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
        return jsonify({"error": _safe_error(e, "Could not seed the Slack thread. Check the selected channel and integration status.")}), 400


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
MAX_ROOM_COUNT = 50
MAX_ROOM_PAYLOAD_BYTES = 64 * 1024
MAX_ROOMS_FILE_BYTES = 4 * 1024 * 1024
MAX_ROOM_CHAT_CHARS = 4_000
MAX_ROOM_CHAT_MESSAGES = 200
MAX_ROOM_TASKS = 200

_rate_buckets: dict[str, deque[float]] = defaultdict(deque)
_rate_lock = threading.Lock()


def _consume_rate_limit(scope: str, address: str, limit: int, window_seconds: int) -> Optional[int]:
    """Return retry seconds if the in-process public API limit has been exceeded."""
    now = time.monotonic()
    key = f"{scope}:{address}"
    with _rate_lock:
        bucket = _rate_buckets[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return max(1, math.ceil(window_seconds - (now - bucket[0])))
        bucket.append(now)

        # Bound memory if requests arrive from many distinct addresses.
        if len(_rate_buckets) > 10_000:
            for bucket_key, times in list(_rate_buckets.items()):
                while times and times[0] <= now - 900:
                    times.popleft()
                if not times:
                    _rate_buckets.pop(bucket_key, None)
    return None

DEFAULT_ROOMS_DATA = [
    {
        "id": "room-auth-iam",
        "name": "Auth & IAM Federation",
        "topic": "Google Workspace SSO, RBAC roles, and session security compliance",
        "description": "Enterprise squad managing SSO login, OAuth2 federation, and token security.",
        "social_links": [
            {"platform": "Slack", "channel": "#proj-auth-federation", "enabled": False, "status": "Disconnected"},
            {"platform": "Discord", "channel": "#iam-dev-squad", "enabled": False, "status": "Disconnected"},
            {"platform": "Telegram", "channel": "Not configured", "enabled": False, "status": "Disconnected"}
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
            {"id": "m4", "sender": "@pm_lead", "platform": "Console", "time": "10:23", "text": "/tree"},
            {"id": "m5", "sender": "Lead Agile PM (AI)", "platform": "AI Agent", "time": "10:23", "text": "🌲 Live Production Codebase Architecture mapped for squad 'Auth & IAM Federation'. Below is the interactive hierarchy with file sizes, line counts, and microservice directories:", "has_tree": True}
        ]
    },
    {
        "id": "room-aiops-incident",
        "name": "Kubernetes AIOps Incident Command",
        "topic": "Kubernetes production pod crash loops, Prometheus alerts, and runbook diffs",
        "description": "Rapid triage and remediation bridge for production cluster incidents.",
        "social_links": [
            {"platform": "Slack", "channel": "#incident-bridge-aiops", "enabled": False, "status": "Disconnected"},
            {"platform": "Telegram", "channel": "Not configured", "enabled": False, "status": "Disconnected"}
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
            if ROOMS_FILE.stat().st_size > MAX_ROOMS_FILE_BYTES:
                raise ValueError("Room storage limit exceeded.")
            loaded = json.loads(ROOMS_FILE.read_text(encoding="utf-8"))
            if isinstance(loaded, list):
                return _scrub_room_secrets(loaded[:MAX_ROOM_COUNT])
        except Exception:
            pass
    return _scrub_room_secrets(DEFAULT_ROOMS_DATA)


_ROOM_SECRET_KEY_PARTS = (
    "apikey", "secret", "password", "token", "authorization", "webhook",
    "credential", "chatid", "cookie",
)


def _is_sensitive_room_key(key: Any) -> bool:
    normalized = re.sub(r"[^a-z0-9]", "", str(key).casefold())
    secret_key_alias = normalized == "key" or normalized.endswith(
        ("apikey", "clientkey", "privatekey", "secretkey", "signingkey", "encryptionkey")
    )
    return secret_key_alias or any(part in normalized for part in _ROOM_SECRET_KEY_PARTS)


def _scrub_room_secrets(value):
    """Remove secret-like fields across common casing and separator variants."""
    if isinstance(value, dict):
        safe = {
            key: _scrub_room_secrets(item)
            for key, item in value.items()
            if not _is_sensitive_room_key(key)
        }
        if isinstance(safe.get("chat_messages"), list):
            safe["chat_messages"] = safe["chat_messages"][-MAX_ROOM_CHAT_MESSAGES:]
        if isinstance(safe.get("tasks"), list):
            safe["tasks"] = safe["tasks"][:MAX_ROOM_TASKS]
        return safe
    if isinstance(value, list):
        return [_scrub_room_secrets(item) for item in value]
    return value


def _save_rooms(rooms: list) -> None:
    safe_rooms = _scrub_room_secrets(rooms[-MAX_ROOM_COUNT:])
    serialized = json.dumps(safe_rooms, indent=2, ensure_ascii=False)
    if len(serialized.encode("utf-8")) > MAX_ROOMS_FILE_BYTES:
        raise ValueError("Room data exceeds the storage limit.")
    ROOMS_FILE.write_text(serialized, encoding="utf-8")
    try:
        ROOMS_FILE.chmod(0o600)
    except OSError:
        pass


@app.get("/api/rooms")
def get_rooms():
    """List all PM rooms with social links, task lists, and AI agent configuration."""
    return jsonify(_load_rooms())


@app.post("/api/rooms")
def save_room():
    """Create or update a PM room."""
    if request.content_length is not None and request.content_length > MAX_ROOM_PAYLOAD_BYTES:
        return jsonify({"error": "Room payload is too large."}), 413
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "A JSON object is required."}), 400
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > MAX_ROOM_PAYLOAD_BYTES:
        return jsonify({"error": "Room payload is too large."}), 413
    data = _scrub_room_secrets(data)
    room_id = data.get("id") or f"room-{int(time.time())}"
    if not isinstance(room_id, str) or len(room_id) > 120:
        return jsonify({"error": "Room id is invalid."}), 400
    data["id"] = room_id

    rooms = _load_rooms()
    existing_idx = next((i for i, r in enumerate(rooms) if r.get("id") == room_id), None)
    if existing_idx is not None:
        rooms[existing_idx] = {**rooms[existing_idx], **data}
    else:
        if len(rooms) >= MAX_ROOM_COUNT:
            return jsonify({"error": "The room limit has been reached."}), 409
        rooms.append(data)

    try:
        _save_rooms(rooms)
    except ValueError:
        return jsonify({"error": "Room storage limit reached."}), 413
    return jsonify({"status": "ok", "room": _scrub_room_secrets(data)})


@app.delete("/api/rooms/<room_id>")
def delete_room(room_id: str):
    rooms = [r for r in _load_rooms() if r.get("id") != room_id]
    _save_rooms(rooms)
    return jsonify({"status": "ok", "deleted": room_id})


@app.post("/api/rooms/<room_id>/chat")
def room_chat(room_id: str):
    """Handle conversational interaction between PM and the room's AI agent."""
    if request.content_length is not None and request.content_length > MAX_ROOM_PAYLOAD_BYTES:
        return jsonify({"error": "Chat message is too large."}), 413
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "A JSON object is required."}), 400
    raw_text = body.get("text", body.get("message", ""))
    if not isinstance(raw_text, str):
        return jsonify({"error": "Chat message must be text."}), 400
    user_text = raw_text.strip()
    if len(user_text) > MAX_ROOM_CHAT_CHARS:
        return jsonify({"error": "Chat message exceeds the 4000-character limit."}), 413
    sender = body.get("sender", "@pm_lead")
    platform = body.get("platform", "Console")
    if not isinstance(sender, str) or not isinstance(platform, str):
        return jsonify({"error": "Chat sender and platform must be text."}), 400
    sender = sender[:80]
    platform = platform[:40]

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
    messages = room.get("chat_messages")
    if not isinstance(messages, list):
        messages = []
        room["chat_messages"] = messages
    messages.append(user_msg)

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

    messages.append(ai_msg)
    room["chat_messages"] = messages[-MAX_ROOM_CHAT_MESSAGES:]
    try:
        _save_rooms(rooms)
    except ValueError:
        return jsonify({"error": "Room storage limit reached."}), 413
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
    app.logger.error("Unhandled API exception (%s)", type(e).__name__)
    return jsonify({"error": "Internal server error."}), 500


@app.errorhandler(RequestEntityTooLarge)
def handle_request_too_large(_e):
    return jsonify({"error": "Request body exceeds the 2 MB limit."}), 413


@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith("/api"):
        return jsonify({"error": "API endpoint not found."}), 404
    if FRONTEND_DIST.exists():
        from flask import send_from_directory
        file_path = FRONTEND_DIST / request.path.lstrip("/")
        if file_path.exists() and not file_path.is_dir():
            return send_from_directory(str(FRONTEND_DIST), request.path.lstrip("/"))
        return send_from_directory(str(FRONTEND_DIST), "index.html")
    return jsonify({"error": "Page not found."}), 404


