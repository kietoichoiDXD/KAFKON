import os
import time
import json
import uuid
import logging
import sqlite3
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager

from ..config import settings
from .redaction import redact

logger = logging.getLogger("scribeba.db")

_POSTGRES_AVAILABLE = False
try:
    import psycopg
    from psycopg.rows import dict_row
    _POSTGRES_AVAILABLE = True
except ImportError:
    pass


class PgConnectionWrapper:
    """Wraps psycopg connection to provide SQLite-compatible conn.execute('... ? ...') interface."""

    def __init__(self, pg_conn):
        self._conn = pg_conn

    def execute(self, query: str, params: tuple = ()):
        cur = self._conn.cursor()
        pg_query = query.replace("?", "%s")
        cur.execute(pg_query, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


class CloudDatabaseManager:
    """Unified Database Layer supporting Cloud PostgreSQL (Supabase/Neon) with SQLite fallback."""

    def __init__(self):
        self._cloud_tested = False
        self._cloud_active = False

    @property
    def connection_url(self) -> Optional[str]:
        raw = settings.supabase_database_url or settings.database_url or os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")
        if raw and raw.strip():
            url = raw.strip()
            if url.startswith("postgres://"):
                url = "postgresql://" + url[len("postgres://"):]
            return url
        return None

    def is_cloud_configured(self) -> bool:
        return bool(self.connection_url and _POSTGRES_AVAILABLE)

    def _test_cloud_connection(self) -> bool:
        if self._cloud_tested:
            return self._cloud_active
        url = self.connection_url
        if not url or not _POSTGRES_AVAILABLE:
            self._cloud_active = False
            self._cloud_tested = True
            return False
        try:
            with psycopg.connect(url, connect_timeout=5, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            logger.info("Successfully connected to Supabase / Cloud PostgreSQL")
            self._cloud_active = True
            self._init_postgres()
        except Exception as exc:
            logger.warning(f"Could not connect to Supabase/PostgreSQL ({exc}). Falling back to local SQLite.")
            self._cloud_active = False
        self._cloud_tested = True
        return self._cloud_active

    def _init_postgres(self) -> None:
        url = self.connection_url
        if not url:
            return
        with psycopg.connect(url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS chat_sessions (
                        id TEXT PRIMARY KEY,
                        owner_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL,
                        updated_at DOUBLE PRECISION NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS chat_turns (
                        id BIGSERIAL PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        owner_id TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS product_tasks (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'to do',
                        url TEXT DEFAULT '',
                        source TEXT DEFAULT 'analysis',
                        created_at DOUBLE PRECISION NOT NULL,
                        updated_at DOUBLE PRECISION NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS telemetry_runs (
                        id TEXT PRIMARY KEY,
                        channel TEXT DEFAULT '',
                        thread_ts TEXT DEFAULT '',
                        title TEXT DEFAULT '',
                        invest_score INTEGER DEFAULT 0,
                        payload_json TEXT NOT NULL,
                        created_at DOUBLE PRECISION NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner ON chat_sessions(owner_id, updated_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_chat_turns_session ON chat_turns(owner_id, session_id, id);
                    CREATE INDEX IF NOT EXISTS idx_product_tasks_updated ON product_tasks(updated_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_telemetry_runs_created ON telemetry_runs(created_at DESC);
                """)

    @contextmanager
    def get_connection(self):
        """Yield an active DB connection (PostgreSQL if cloud configured, else SQLite)."""
        if self._test_cloud_connection():
            url = self.connection_url
            conn = psycopg.connect(url, row_factory=dict_row, connect_timeout=10)
            wrapped = PgConnectionWrapper(conn)
            try:
                yield wrapped
                wrapped.commit()
            except Exception:
                wrapped.rollback()
                raise
            finally:
                wrapped.close()
        else:
            from ..api import CHAT_HISTORY_DB
            CHAT_HISTORY_DB.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(str(CHAT_HISTORY_DB), timeout=10)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("""CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL,
                created_at REAL NOT NULL, updated_at REAL NOT NULL
            )""")
            conn.execute("""CREATE TABLE IF NOT EXISTS chat_turns (
                id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
                owner_id TEXT NOT NULL, payload TEXT NOT NULL, created_at REAL NOT NULL
            )""")
            conn.execute("""CREATE TABLE IF NOT EXISTS product_tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'to do',
                url TEXT DEFAULT '',
                source TEXT DEFAULT 'analysis',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )""")
            conn.execute("""CREATE TABLE IF NOT EXISTS telemetry_runs (
                id TEXT PRIMARY KEY,
                channel TEXT DEFAULT '',
                thread_ts TEXT DEFAULT '',
                title TEXT DEFAULT '',
                invest_score INTEGER DEFAULT 0,
                payload_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )""")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner ON chat_sessions(owner_id, updated_at DESC)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_turns_session ON chat_turns(owner_id, session_id, id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_product_tasks_updated ON product_tasks(updated_at DESC)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_runs_created ON telemetry_runs(created_at DESC)")
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def get_status(self) -> Dict[str, Any]:
        """Return provider status and basic counts."""
        is_cloud = self._test_cloud_connection()
        provider = "Supabase PostgreSQL" if is_cloud else "Local SQLite"
        sessions_count = 0
        tasks_count = 0
        try:
            with self.get_connection() as conn:
                cur = conn.cursor() if hasattr(conn, "cursor") else conn
                cur.execute("SELECT COUNT(*) FROM chat_sessions")
                r = cur.fetchone()
                sessions_count = r[0] if hasattr(r, "__getitem__") else 0

                cur.execute("SELECT COUNT(*) FROM product_tasks")
                r2 = cur.fetchone()
                tasks_count = r2[0] if hasattr(r2, "__getitem__") else 0
        except Exception as e:
            logger.warning(f"Error checking DB counts: {e}")

        return {
            "mode": "cloud_postgres" if is_cloud else "local_sqlite",
            "provider": provider,
            "connected": True,
            "cloud_configured": bool(self.connection_url),
            "sessions_count": sessions_count,
            "tasks_count": tasks_count,
        }


# Global instance
cloud_db = CloudDatabaseManager()
