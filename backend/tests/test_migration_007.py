"""
Tests for Alembic migration 007_unify_chat_voice_messages.

Strategy: invoke `upgrade()` / `downgrade()` from the migration module
inside an `op_context()` — this isolates 007 from the broken pre-existing
revision-id chain in 001-006 (revision='001' but down_revision='001_initial_schema').

We pre-bootstrap a minimal pre-007 chat_messages schema with raw SQL.

Verifies:
  - Migration adds the 4 new columns with correct types/defaults.
  - Migration creates the 2 new indexes.
  - Existing rows get source='text' via server_default.
  - downgrade() reverses everything cleanly (round-trip).
"""

import importlib.util
import os
import sys
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text


_BACKEND_DIR = Path(__file__).resolve().parents[1]
_MIGRATION_PATH = _BACKEND_DIR / "alembic" / "versions" / "007_unify_chat_voice_messages.py"


def _load_migration_module():
    """Import the 007 migration module by file path (bypasses package shadowing)."""
    spec = importlib.util.spec_from_file_location("mig_007", _MIGRATION_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── Pre-007 minimal schema (post-006 state) ─────────────────────────────────
_PRE_007_SCHEMA_SQL = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    is_admin INTEGER DEFAULT 0,
    voice_bonus_seconds INTEGER DEFAULT 0
);

CREATE TABLE summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    video_id TEXT,
    video_title TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE voice_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    summary_id INTEGER,
    started_at TIMESTAMP,
    status VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE
);

CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    summary_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    web_search_used BOOLEAN DEFAULT 0,
    fact_checked BOOLEAN DEFAULT 0,
    sources_json TEXT,
    enrichment_level VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (summary_id) REFERENCES summaries(id)
);
CREATE INDEX idx_chat_messages_summary ON chat_messages(summary_id);
"""


def _bootstrap_pre_007(db_url: str) -> None:
    sync_engine = create_engine(db_url)
    with sync_engine.begin() as conn:
        for stmt in _PRE_007_SCHEMA_SQL.strip().split(";\n"):
            stmt = stmt.strip()
            if stmt:
                conn.exec_driver_sql(stmt)
    sync_engine.dispose()


def _ensure_real_alembic():
    """Replace any shadowing alembic package in sys.modules with the real one."""
    backend_str = str(_BACKEND_DIR)
    backend_alt = backend_str.replace("\\", "/")

    # Drop any cached alembic.* modules whose __file__ is under backend/.
    for key in list(sys.modules):
        if key == "alembic" or key.startswith("alembic."):
            mod = sys.modules[key]
            f = (getattr(mod, "__file__", "") or "").replace("\\", "/")
            spath = (getattr(mod, "__spec__", None).origin if getattr(mod, "__spec__", None) else "") or ""
            spath = spath.replace("\\", "/")
            if (
                "site-packages" not in f
                and ("/backend/alembic" in f or "/backend/alembic" in spath or f == "")
            ):
                del sys.modules[key]

    # Move any path entry that points at backend/ off sys.path.
    sys.path[:] = [
        p for p in sys.path
        if p.replace("\\", "/").rstrip("/") not in (backend_alt.rstrip("/"),)
    ]
    # Also drop empty strings ('' = cwd) if cwd happens to be backend.
    if os.getcwd().replace("\\", "/").rstrip("/") == backend_alt.rstrip("/"):
        sys.path[:] = [p for p in sys.path if p not in ("", ".")]


def _run_migration(db_url: str, direction: str) -> None:
    """Run upgrade/downgrade of 007 against the given DB."""
    _ensure_real_alembic()

    from alembic.operations import Operations
    from alembic.runtime.migration import MigrationContext
    from alembic import op as _op_module

    sync_engine = create_engine(db_url)
    mig = _load_migration_module()

    with sync_engine.begin() as connection:
        ctx = MigrationContext.configure(connection)
        op_proxy = Operations(ctx)
        old_proxy = getattr(_op_module, "_proxy", None)
        _op_module._proxy = op_proxy
        try:
            if direction == "upgrade":
                mig.upgrade()
            elif direction == "downgrade":
                mig.downgrade()
            else:
                raise ValueError(direction)
        finally:
            _op_module._proxy = old_proxy

    sync_engine.dispose()


@pytest.fixture
def fresh_sqlite_db():
    tmpdir = tempfile.mkdtemp(prefix="ds_alembic_007_")
    db_path = os.path.join(tmpdir, "test.db")
    db_url = f"sqlite:///{db_path}"

    _bootstrap_pre_007(db_url)

    yield db_url

    try:
        os.remove(db_path)
    except OSError:
        pass


def test_007_upgrade_adds_columns(fresh_sqlite_db):
    """007 must add source, voice_session_id, voice_speaker, time_in_call_secs."""
    db_url = fresh_sqlite_db

    _run_migration(db_url, "upgrade")

    engine = create_engine(db_url)
    inspector = inspect(engine)
    columns = {c["name"]: c for c in inspector.get_columns("chat_messages")}

    assert "source" in columns
    assert "voice_session_id" in columns
    assert "voice_speaker" in columns
    assert "time_in_call_secs" in columns

    # source must be NOT NULL with default 'text'
    assert columns["source"]["nullable"] is False
    # voice_session_id is nullable
    assert columns["voice_session_id"]["nullable"] is True


def test_007_upgrade_creates_indexes(fresh_sqlite_db):
    """007 must create the unified-timeline + voice_session indexes."""
    db_url = fresh_sqlite_db

    _run_migration(db_url, "upgrade")

    engine = create_engine(db_url)
    inspector = inspect(engine)
    index_names = {ix["name"] for ix in inspector.get_indexes("chat_messages")}

    assert "ix_chat_messages_summary_created" in index_names
    assert "ix_chat_messages_voice_session" in index_names


def test_007_upgrade_existing_rows_get_text_source(fresh_sqlite_db):
    """Pre-existing rows should be filled with source='text' via server_default."""
    db_url = fresh_sqlite_db
    engine = create_engine(db_url)

    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO users (id, email, password_hash, plan) "
            "VALUES (1, 'a@b.c', 'x', 'free')"
        ))
        conn.execute(text(
            "INSERT INTO summaries (id, user_id, video_id, video_title) "
            "VALUES (10, 1, 'vid1', 'T')"
        ))
        conn.execute(text(
            "INSERT INTO chat_messages (id, user_id, summary_id, role, content) "
            "VALUES (100, 1, 10, 'user', 'pre-existing question')"
        ))
    engine.dispose()

    _run_migration(db_url, "upgrade")

    engine = create_engine(db_url)
    with engine.begin() as conn:
        row = conn.execute(text("SELECT source FROM chat_messages WHERE id = 100")).fetchone()
        assert row is not None
        assert row[0] == "text"


def test_007_round_trip(fresh_sqlite_db):
    """upgrade then downgrade should leave chat_messages without the new cols."""
    db_url = fresh_sqlite_db

    _run_migration(db_url, "upgrade")

    engine = create_engine(db_url)
    inspector = inspect(engine)
    cols_after_up = {c["name"] for c in inspector.get_columns("chat_messages")}
    assert "source" in cols_after_up
    assert "voice_session_id" in cols_after_up
    engine.dispose()

    _run_migration(db_url, "downgrade")

    engine = create_engine(db_url)
    inspector = inspect(engine)
    cols_after_down = {c["name"] for c in inspector.get_columns("chat_messages")}

    assert "source" not in cols_after_down
    assert "voice_session_id" not in cols_after_down
    assert "voice_speaker" not in cols_after_down
    assert "time_in_call_secs" not in cols_after_down

    index_names = {ix["name"] for ix in inspector.get_indexes("chat_messages")}
    assert "ix_chat_messages_summary_created" not in index_names
    assert "ix_chat_messages_voice_session" not in index_names
