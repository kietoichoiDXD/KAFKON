"""Server-side Slack OAuth installation storage and helpers.

Bot tokens are encrypted at rest with a deployment-provided Fernet key. The
browser only receives workspace metadata; its signed session tracks which
installations that browser has authorized and which one it currently uses.
"""
from __future__ import annotations

import re
import sqlite3
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app, request, session

from .config import settings

SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize"
SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access"
SLACK_BOT_SCOPES = "channels:read,channels:history,groups:read,groups:history,chat:write,users:read"
TEAM_RE = re.compile(r"^(?:T|E)[A-Z0-9]{2,}$")


def oauth_enabled() -> bool:
    if not all((settings.slack_client_id, settings.slack_client_secret,
                settings.slack_redirect_uri, settings.slack_installation_encryption_key)):
        return False
    try:
        Fernet(settings.slack_installation_encryption_key.encode())
    except (ValueError, TypeError, AttributeError):
        return False
    callback = urlsplit(settings.slack_redirect_uri)
    if settings.scribeba_public_mode and callback.scheme != "https":
        return False
    return bool(callback.scheme in {"https", "http"} and callback.netloc
                and (settings.scribeba_session_secret or not settings.scribeba_public_mode))


def _cipher() -> Fernet:
    if not oauth_enabled():
        raise RuntimeError("Slack OAuth is not configured.")
    return Fernet(settings.slack_installation_encryption_key.encode())


def _db_path() -> Path:
    path = settings.slack_installation_db_path or (Path(__file__).resolve().parents[1] / ".scribeba" / "slack-installations.sqlite3")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _connect():
    db = sqlite3.connect(str(_db_path()), timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS slack_installations (
        team_id TEXT PRIMARY KEY,
        team_name TEXT NOT NULL,
        account TEXT NOT NULL DEFAULT '',
        bot_user_id TEXT NOT NULL DEFAULT '',
        scopes TEXT NOT NULL DEFAULT '',
        encrypted_token BLOB NOT NULL,
        installed_at INTEGER NOT NULL
    )""")
    return db


def save_installation(payload: dict) -> dict:
    team = payload.get("team") or {}
    team_id = str(team.get("id") or "")
    token = payload.get("access_token")
    if not TEAM_RE.fullmatch(team_id) or not isinstance(token, str) or not token.startswith("xoxb-"):
        raise ValueError("Slack returned an invalid bot installation.")
    encrypted = _cipher().encrypt(token.encode())
    account = str(((payload.get("authed_user") or {}).get("id")) or "")
    values = (team_id, str(team.get("name") or team_id), account,
              str(payload.get("bot_user_id") or ""), str(payload.get("scope") or ""), encrypted, int(time.time()))
    with _connect() as db:
        db.execute("""INSERT INTO slack_installations
            (team_id,team_name,account,bot_user_id,scopes,encrypted_token,installed_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT(team_id) DO UPDATE SET
            team_name=excluded.team_name, account=excluded.account,
            bot_user_id=excluded.bot_user_id, scopes=excluded.scopes,
            encrypted_token=excluded.encrypted_token, installed_at=excluded.installed_at""", values)
    return {"team_id": team_id, "team": values[1], "account": account}


def installation(team_id: str) -> Optional[dict]:
    if not TEAM_RE.fullmatch(team_id or "") or not settings.slack_installation_encryption_key:
        return None
    try:
        with _connect() as db:
            row = db.execute("SELECT * FROM slack_installations WHERE team_id=?", (team_id,)).fetchone()
        if row is None:
            return None
        token = _cipher().decrypt(bytes(row["encrypted_token"])).decode()
        return {"team_id": row["team_id"], "team": row["team_name"], "account": row["account"],
                "token": token, "scopes": row["scopes"], "installed_at": row["installed_at"]}
    except (sqlite3.Error, InvalidToken, ValueError, OSError):
        current_app.logger.exception("Unable to load encrypted Slack installation.")
        return None


def session_team_ids() -> list[str]:
    ids = session.get("slack_authorized_teams", [])
    return [item for item in ids if isinstance(item, str) and TEAM_RE.fullmatch(item)] if isinstance(ids, list) else []


def authorized_installations() -> list[dict]:
    result = []
    for team_id in session_team_ids():
        item = installation(team_id)
        if item:
            result.append({key: item[key] for key in ("team_id", "team", "account")})
    return result


def requested_team_id() -> Optional[str]:
    requested = request.args.get("team_id")
    if not requested and request.is_json:
        body = request.get_json(silent=True) or {}
        requested = body.get("team_id")
    if requested:
        if requested not in session_team_ids():
            return "!unauthorized"
        return requested
    active = session.get("slack_active_team_id")
    return active if active in session_team_ids() else None


def selected_installation() -> Optional[dict]:
    team_id = requested_team_id()
    if team_id == "!unauthorized":
        raise PermissionError("This Slack workspace has not been authorized in this browser session.")
    if team_id:
        item = installation(team_id)
        if not item:
            raise PermissionError("The selected Slack workspace installation is unavailable. Reconnect the workspace.")
        return item
    return None


def safe_return_to(value: str | None) -> str:
    if not value:
        return "/"
    parsed = urlsplit(value)
    if "\\" in value or parsed.username or parsed.password:
        return "/"
    if parsed.scheme or parsed.netloc:
        allowed_origin = (settings.scribeba_allowed_origin or "").rstrip("/")
        candidate_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""
        if not allowed_origin or candidate_origin != allowed_origin or not parsed.path.startswith("/"):
            return "/"
        return value
    if not value.startswith("/") or value.startswith("//"):
        return "/"
    return value

