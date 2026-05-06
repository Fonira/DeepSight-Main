"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Email DLQ (Sprint scalabilité — chantier B)                            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║  • persist_failed_email insère bien une row dans email_dlq                         ║
║  • EmailQueue persiste en DLQ sur 4xx non-recoverable                              ║
║  • EmailQueue persiste en DLQ sur 429 retries exhausted                            ║
║  • Queue full → DLQ                                                                ║
║  • Admin endpoints : list, stats, replay (resched), abandon                        ║
║                                                                                    ║
║  Tests unit avec SQLite in-memory (pas de Redis live, pas de Resend).              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Path setup (au cas où)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


# ─────────────────────────────────────────────────────────────────────────────
# DB fixture (SQLite in-memory + EmailDLQ table)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
async def sqlite_session(monkeypatch):
    """SQLite in-memory async session.

    Crée la table email_dlq via Base.metadata. Patch async_session_factory pour
    pointer sur cette DB éphémère afin que persist_failed_email écrive dedans.
    """
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

    from db import database as db_module
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Patch async_session_factory used by email_dlq_service.persist_failed_email
    monkeypatch.setattr(db_module, "async_session_factory", session_factory)

    async with session_factory() as session:
        yield session

    await engine.dispose()


# ─────────────────────────────────────────────────────────────────────────────
# Tests : persist_failed_email
# ─────────────────────────────────────────────────────────────────────────────


class TestPersistFailedEmail:
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_inserts_row(self, sqlite_session):
        """persist_failed_email crée bien une row pending."""
        from services.email_dlq_service import persist_failed_email
        from db.database import EmailDLQ
        from sqlalchemy import select

        new_id = await persist_failed_email(
            email_to="user@example.com",
            subject="Test subject",
            html="<p>hi</p>",
            text="hi",
            user_id=42,
            template_name="welcome.html",
            priority=False,
            error_message="Resend 429 exhausted",
            error_status_code=429,
            attempts=4,
        )
        assert new_id is not None and new_id > 0

        # Verify
        result = await sqlite_session.execute(select(EmailDLQ).where(EmailDLQ.id == new_id))
        row = result.scalar_one()
        assert row.email_to == "user@example.com"
        assert row.replay_status == "pending"
        assert row.attempts == 4
        assert row.error_status_code == 429
        assert row.template_name == "welcome.html"
        assert row.user_id == 42

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_truncates_long_subject(self, sqlite_session):
        """Subject > 500 chars est tronqué (pas une exception DB)."""
        from services.email_dlq_service import persist_failed_email
        from db.database import EmailDLQ
        from sqlalchemy import select

        long_subject = "x" * 600
        new_id = await persist_failed_email(
            email_to="a@b.com",
            subject=long_subject,
            html="ok",
            error_message="err",
        )
        assert new_id is not None

        result = await sqlite_session.execute(select(EmailDLQ).where(EmailDLQ.id == new_id))
        row = result.scalar_one()
        assert len(row.subject) <= 500


# ─────────────────────────────────────────────────────────────────────────────
# Tests : EmailQueue → DLQ scenarios
# ─────────────────────────────────────────────────────────────────────────────


class _MockHttpResponse:
    def __init__(self, status_code: int, text: str = ""):
        self.status_code = status_code
        self.text = text


class TestEmailQueueDLQ:
    @pytest.fixture(autouse=True)
    def _reset_email_singleton(self, monkeypatch):
        """Recreate the EmailQueue singleton with a clean state per test."""
        from services import email_queue as eq_module

        # Replace the module-level singleton with a fresh instance
        monkeypatch.setattr(eq_module, "email_queue", eq_module.EmailQueue())
        # Also enable email config for the queue path
        from core import config as cfg

        monkeypatch.setitem(cfg.EMAIL_CONFIG, "ENABLED", True)
        monkeypatch.setitem(cfg.EMAIL_CONFIG, "RESEND_API_KEY", "test-key")
        monkeypatch.setitem(cfg.EMAIL_CONFIG, "FROM_EMAIL", "noreply@test.com")
        monkeypatch.setitem(cfg.EMAIL_CONFIG, "FROM_NAME", "Test")
        yield

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_dlq_on_4xx_client_error(self, sqlite_session, monkeypatch):
        """422 (template invalide) → DLQ direct sans retry."""
        from services import email_queue as eq_module
        from db.database import EmailDLQ
        from sqlalchemy import select

        item = eq_module.EmailItem(
            to="bad@template.com",
            subject="bad subject",
            html="<p>bad</p>",
            text="bad",
            user_id=7,
            template_name="welcome.html",
        )

        # Patch send_with_rate_limit to return a 422
        async def fake_send(send_coro_factory, **kwargs):
            return _MockHttpResponse(422, "Unprocessable Entity")

        monkeypatch.setattr(eq_module, "send_with_rate_limit", fake_send)

        outcome = await eq_module.email_queue._send_email(item)
        assert outcome == "client_error"

        # DLQ row exists
        rows = (await sqlite_session.execute(select(EmailDLQ))).scalars().all()
        assert len(rows) == 1
        assert rows[0].error_status_code == 422
        assert rows[0].replay_status == "pending"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_dlq_on_429_exhausted(self, sqlite_session, monkeypatch):
        """ResendRateLimitError (429 retries exhausted) → DLQ + counter."""
        from services import email_queue as eq_module
        from core.email_rate_limiter import ResendRateLimitError
        from db.database import EmailDLQ
        from sqlalchemy import select

        item = eq_module.EmailItem(
            to="rate-limited@example.com",
            subject="hi",
            html="<p>hi</p>",
            user_id=11,
            template_name="welcome.html",
        )

        async def fake_send(*args, **kwargs):
            raise ResendRateLimitError("test exhausted")

        monkeypatch.setattr(eq_module, "send_with_rate_limit", fake_send)

        outcome = await eq_module.email_queue._send_email(item)
        assert outcome == "rate_limited_dlq"
        assert eq_module.email_queue.total_rate_limited == 1
        assert eq_module.email_queue.total_dlq == 1

        rows = (await sqlite_session.execute(select(EmailDLQ))).scalars().all()
        assert len(rows) == 1
        assert rows[0].error_status_code == 429

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_5xx_returns_transient_no_dlq(self, sqlite_session, monkeypatch):
        """5xx exhausted → outcome 'transient' (re-queue éligible), pas de DLQ immédiat."""
        from services import email_queue as eq_module
        from db.database import EmailDLQ
        from sqlalchemy import select

        item = eq_module.EmailItem(to="x@y.com", subject="s", html="h")

        async def fake_send(*args, **kwargs):
            return _MockHttpResponse(503, "Service Unavailable")

        monkeypatch.setattr(eq_module, "send_with_rate_limit", fake_send)

        outcome = await eq_module.email_queue._send_email(item)
        assert outcome == "transient"

        rows = (await sqlite_session.execute(select(EmailDLQ))).scalars().all()
        assert len(rows) == 0  # No DLQ at first 5xx — re-queue path takes over

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_2xx_no_dlq(self, sqlite_session, monkeypatch):
        """200 OK → pas de DLQ, compteur sent."""
        from services import email_queue as eq_module
        from db.database import EmailDLQ
        from sqlalchemy import select

        item = eq_module.EmailItem(to="ok@y.com", subject="s", html="h")

        async def fake_send(*args, **kwargs):
            return _MockHttpResponse(200)

        monkeypatch.setattr(eq_module, "send_with_rate_limit", fake_send)

        outcome = await eq_module.email_queue._send_email(item)
        assert outcome == "sent"

        rows = (await sqlite_session.execute(select(EmailDLQ))).scalars().all()
        assert len(rows) == 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_queue_full_dlq(self, sqlite_session, monkeypatch):
        """Queue saturée → DLQ + total_dropped++."""
        from services import email_queue as eq_module
        from db.database import EmailDLQ
        from sqlalchemy import select

        # Force the priority queue maxlen to 1 for fast test
        eq_module.email_queue._priority_queue = type(eq_module.email_queue._priority_queue)(maxlen=1)
        # Fill it
        eq_module.email_queue._priority_queue.append(
            eq_module.EmailItem(to="filler@x.com", subject="s", html="h", priority=1)
        )

        # Now enqueue another priority email → should DLQ + return False
        ok = await eq_module.email_queue.enqueue(
            to="dropped@x.com",
            subject="dropped",
            html="<p>x</p>",
            priority=True,
            user_id=99,
            template_name="reset.html",
        )
        assert ok is False
        assert eq_module.email_queue.total_dropped == 1

        # DLQ row exists
        rows = (await sqlite_session.execute(select(EmailDLQ))).scalars().all()
        assert any(r.email_to == "dropped@x.com" for r in rows)


# ─────────────────────────────────────────────────────────────────────────────
# Tests : Admin DLQ router (replay, list, stats)
# ─────────────────────────────────────────────────────────────────────────────


class TestAdminDLQRouter:
    @pytest.fixture
    async def admin_session_with_rows(self, sqlite_session):
        """Insert a few DLQ rows for query tests."""
        from db.database import EmailDLQ

        for i, status in enumerate(["pending", "pending", "replayed", "abandoned", "failed_again"]):
            sqlite_session.add(
                EmailDLQ(
                    email_to=f"u{i}@x.com",
                    subject=f"sub{i}",
                    body_html=f"<p>{i}</p>",
                    error_message=f"err{i}",
                    error_status_code=429 if i % 2 == 0 else 422,
                    attempts=i + 1,
                    replay_status=status,
                )
            )
        await sqlite_session.commit()
        yield sqlite_session

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_list_filter_by_status(self, admin_session_with_rows):
        """GET /email-dlq?status=pending → 2 rows."""
        from admin.email_dlq_router import list_email_dlq

        # Mock admin user
        admin = MagicMock()
        admin.id = 1

        result = await list_email_dlq(
            status="pending",
            email_to=None,
            limit=50,
            offset=0,
            admin=admin,
            session=admin_session_with_rows,
        )
        assert result.total == 2
        assert len(result.items) == 2
        assert all(it.replay_status == "pending" for it in result.items)

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_stats_counts(self, admin_session_with_rows):
        from admin.email_dlq_router import email_dlq_stats

        admin = MagicMock()
        admin.id = 1

        stats = await email_dlq_stats(admin=admin, session=admin_session_with_rows)
        assert stats.total == 5
        assert stats.pending == 2
        assert stats.replayed == 1
        assert stats.failed_again == 1
        assert stats.abandoned == 1

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_replay_marks_replayed(self, admin_session_with_rows, monkeypatch):
        """POST replay → enqueue + status 'replayed'."""
        from admin.email_dlq_router import replay_email_dlq
        from sqlalchemy import select
        from db.database import EmailDLQ

        # Pick one pending row
        rows = (
            await admin_session_with_rows.execute(
                select(EmailDLQ).where(EmailDLQ.replay_status == "pending").limit(1)
            )
        ).scalars().all()
        target = rows[0]

        # Mock the email queue to accept
        from services import email_queue as eq_module

        async def fake_enqueue(**kwargs):
            return True

        monkeypatch.setattr(eq_module.email_queue, "enqueue", fake_enqueue)

        admin = MagicMock()
        admin.id = 7

        resp = await replay_email_dlq(
            dlq_id=target.id,
            admin=admin,
            session=admin_session_with_rows,
        )
        assert resp.success is True
        assert resp.new_status == "replayed"

        # Verify status updated
        await admin_session_with_rows.refresh(target)
        assert target.replay_status == "replayed"
        assert target.replayed_by_admin_id == 7

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_abandon_marks_abandoned(self, admin_session_with_rows):
        from admin.email_dlq_router import abandon_email_dlq
        from sqlalchemy import select
        from db.database import EmailDLQ

        rows = (
            await admin_session_with_rows.execute(
                select(EmailDLQ).where(EmailDLQ.replay_status == "pending").limit(1)
            )
        ).scalars().all()
        target = rows[0]

        admin = MagicMock()
        admin.id = 7

        resp = await abandon_email_dlq(
            dlq_id=target.id,
            admin=admin,
            session=admin_session_with_rows,
        )
        assert resp.success is True
        assert resp.new_status == "abandoned"

        await admin_session_with_rows.refresh(target)
        assert target.replay_status == "abandoned"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_replay_404_unknown_id(self, admin_session_with_rows):
        from admin.email_dlq_router import replay_email_dlq
        from fastapi import HTTPException

        admin = MagicMock()
        admin.id = 1

        with pytest.raises(HTTPException) as exc_info:
            await replay_email_dlq(
                dlq_id=999999,
                admin=admin,
                session=admin_session_with_rows,
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_replay_409_already_replayed(self, admin_session_with_rows):
        """Tenter de replay une row déjà 'replayed' → 409."""
        from admin.email_dlq_router import replay_email_dlq
        from fastapi import HTTPException
        from sqlalchemy import select
        from db.database import EmailDLQ

        rows = (
            await admin_session_with_rows.execute(
                select(EmailDLQ).where(EmailDLQ.replay_status == "replayed").limit(1)
            )
        ).scalars().all()
        target = rows[0]

        admin = MagicMock()
        admin.id = 1

        with pytest.raises(HTTPException) as exc_info:
            await replay_email_dlq(
                dlq_id=target.id,
                admin=admin,
                session=admin_session_with_rows,
            )
        assert exc_info.value.status_code == 409
