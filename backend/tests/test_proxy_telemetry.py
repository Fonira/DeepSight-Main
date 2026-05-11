"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Proxy Telemetry (Sprint Proxy Observability)                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║  • record_proxy_usage : UPSERT correct sur proxy_usage_daily (bytes + provider)   ║
║  • ProxyByteCounter : compte bytes streaming via add() + flush()                  ║
║  • PostHog flush : event émis à 100 MB cumulés (mock capture_event)               ║
║  • Hard-stop : should_bypass_proxy retourne True quand PROXY_DISABLED=true        ║
║  • Hard-stop : should_bypass_proxy retourne True quand MTD > 950 MB               ║
║  • is_proxy_configured / log_boot_state non-bloquant                              ║
║  • Migration 027 réversible (upgrade + downgrade idempotents)                     ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ajouter src au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_telemetry_state():
    """Reset le state in-memory entre chaque test."""
    from middleware.proxy_telemetry import _reset_state_for_tests

    _reset_state_for_tests()
    yield
    _reset_state_for_tests()


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """Garantir des valeurs propres pour les env vars sensibles."""
    monkeypatch.delenv("PROXY_DISABLED", raising=False)
    # Forcer un proxy configuré pour que record_proxy_usage ne skip pas (par
    # défaut YOUTUBE_PROXY est vide en test).
    monkeypatch.setattr("middleware.proxy_telemetry.is_proxy_configured", lambda: True)
    yield


@pytest.fixture
async def db_session():
    """SQLite async in-memory session avec la table proxy_usage_daily."""
    # Use a unique in-memory DB per fixture invocation
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)

    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE proxy_usage_daily (
                    date DATE PRIMARY KEY,
                    bytes_in BIGINT NOT NULL DEFAULT 0,
                    bytes_out BIGINT NOT NULL DEFAULT 0,
                    requests_total INTEGER NOT NULL DEFAULT 0,
                    requests_by_provider TEXT NOT NULL DEFAULT '{}'
                )
                """
            )
        )

    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def patched_session_maker(monkeypatch, db_session):
    """Patche `db.database.async_session_maker` pour que record_proxy_usage(...) sans
    session arg réutilise la session de test."""
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def fake_maker():
        # Ré-utilise la connexion mais isole la transaction.
        yield db_session

    monkeypatch.setattr("db.database.async_session_maker", fake_maker, raising=False)
    yield fake_maker


# ─────────────────────────────────────────────────────────────────────────────
# Hard-stop tests
# ─────────────────────────────────────────────────────────────────────────────


class TestHardStop:
    @pytest.mark.unit
    def test_should_bypass_when_proxy_disabled_env(self, monkeypatch):
        """PROXY_DISABLED=true → bypass immédiat même sans cache MTD."""
        monkeypatch.setenv("PROXY_DISABLED", "true")
        from middleware.proxy_telemetry import should_bypass_proxy

        assert should_bypass_proxy() is True

    @pytest.mark.unit
    def test_should_bypass_when_proxy_disabled_variants(self, monkeypatch):
        """Variantes truthy de PROXY_DISABLED (1, yes, on)."""
        from middleware.proxy_telemetry import should_bypass_proxy

        for value in ("1", "yes", "YES", "ON", "True", "TRUE"):
            monkeypatch.setenv("PROXY_DISABLED", value)
            assert should_bypass_proxy() is True, f"value={value!r} should be truthy"

    @pytest.mark.unit
    def test_should_not_bypass_when_proxy_disabled_falsy(self, monkeypatch):
        """Valeurs falsy de PROXY_DISABLED ne déclenchent pas le bypass."""
        from middleware.proxy_telemetry import should_bypass_proxy

        for value in ("", "false", "0", "no", "off"):
            monkeypatch.setenv("PROXY_DISABLED", value)
            # Pas de cache MTD → fail-open → False
            assert should_bypass_proxy() is False, f"value={value!r} should be falsy"

    @pytest.mark.unit
    def test_should_bypass_when_mtd_exceeds_threshold(self):
        """MTD > 950 MB → bypass."""
        from middleware.proxy_telemetry import HARD_STOP_THRESHOLD_BYTES, should_bypass_proxy

        assert should_bypass_proxy(mtd_bytes=HARD_STOP_THRESHOLD_BYTES + 1) is True

    @pytest.mark.unit
    def test_should_not_bypass_when_mtd_below_threshold(self):
        """MTD ≤ 950 MB → pas de bypass."""
        from middleware.proxy_telemetry import HARD_STOP_THRESHOLD_BYTES, should_bypass_proxy

        assert should_bypass_proxy(mtd_bytes=HARD_STOP_THRESHOLD_BYTES) is False
        assert should_bypass_proxy(mtd_bytes=0) is False

    @pytest.mark.unit
    def test_should_bypass_fails_open_when_no_cache(self):
        """Pas de cache MTD ET proxy non disabled → pas de bypass (fail-open)."""
        from middleware.proxy_telemetry import should_bypass_proxy

        # Sans mtd_bytes explicite et sans cache, retourne False (proxy actif).
        assert should_bypass_proxy() is False

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_yt_dlp_extra_args_skips_proxy_when_bypass(self, monkeypatch):
        """`_yt_dlp_extra_args` skip `--proxy` quand should_bypass_proxy() True.

        Ne teste PAS le rerouting réseau (out of scope). Juste que le hard-stop
        propage au call site.
        """
        monkeypatch.setenv("PROXY_DISABLED", "true")
        monkeypatch.setattr("core.config.YOUTUBE_PROXY", "http://decodo:42")
        monkeypatch.setattr("core.config.get_youtube_proxy", lambda: "http://decodo:42")

        from transcripts.audio_utils import _yt_dlp_extra_args

        args = _yt_dlp_extra_args(include_proxy=True)
        # PROXY_DISABLED=true → bypass → pas de --proxy dans les args.
        assert "--proxy" not in args


# ─────────────────────────────────────────────────────────────────────────────
# record_proxy_usage / UPSERT tests
# ─────────────────────────────────────────────────────────────────────────────


class TestRecordUsage:
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_first_call_creates_row(self, db_session, patched_session_maker):
        """Premier appel pour la date du jour → INSERT avec bytes_in/out."""
        from middleware.proxy_telemetry import record_proxy_usage

        await record_proxy_usage(
            provider="ytdlp",
            bytes_in=1_000_000,
            bytes_out=2048,
            session=db_session,
        )

        result = await db_session.execute(
            text("SELECT bytes_in, bytes_out, requests_total, requests_by_provider FROM proxy_usage_daily")
        )
        row = result.first()
        assert row is not None
        assert row[0] == 1_000_000
        assert row[1] == 2048
        assert row[2] == 1
        rbp = json.loads(row[3]) if isinstance(row[3], str) else row[3]
        assert rbp == {"ytdlp": 1}

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_repeated_calls_accumulate(self, db_session, patched_session_maker):
        """Plusieurs appels même jour → bytes additionnés, compteur incrémenté."""
        from middleware.proxy_telemetry import record_proxy_usage

        for _ in range(3):
            await record_proxy_usage(
                provider="ytdlp",
                bytes_in=500,
                bytes_out=10,
                session=db_session,
            )
        await record_proxy_usage(
            provider="httpx",
            bytes_in=100,
            bytes_out=5,
            session=db_session,
        )

        result = await db_session.execute(
            text("SELECT bytes_in, bytes_out, requests_total, requests_by_provider FROM proxy_usage_daily")
        )
        row = result.first()
        assert row[0] == 1600  # 3*500 + 100
        assert row[1] == 35  # 3*10 + 5
        assert row[2] == 4
        rbp = json.loads(row[3]) if isinstance(row[3], str) else row[3]
        assert rbp == {"ytdlp": 3, "httpx": 1}

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_skip_when_proxy_not_configured(self, monkeypatch, db_session):
        """Si YOUTUBE_PROXY vide → record_proxy_usage est un no-op."""
        monkeypatch.setattr("middleware.proxy_telemetry.is_proxy_configured", lambda: False)
        from middleware.proxy_telemetry import record_proxy_usage

        await record_proxy_usage(
            provider="ytdlp",
            bytes_in=999,
            session=db_session,
        )

        result = await db_session.execute(text("SELECT COUNT(*) FROM proxy_usage_daily"))
        assert (result.scalar() or 0) == 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_skip_when_zero_bytes(self, db_session):
        """bytes_in=0 et bytes_out=0 → skip pour éviter rows vides."""
        from middleware.proxy_telemetry import record_proxy_usage

        await record_proxy_usage(
            provider="ytdlp",
            bytes_in=0,
            bytes_out=0,
            session=db_session,
        )

        result = await db_session.execute(text("SELECT COUNT(*) FROM proxy_usage_daily"))
        assert (result.scalar() or 0) == 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_get_mtd_bytes_sums_month_to_date(self, db_session):
        """get_mtd_bytes (via _fetch_mtd_total) somme bytes_in+bytes_out du mois en cours."""
        from middleware.proxy_telemetry import _fetch_mtd_total

        today = date.today()
        first_of_month = today.replace(day=1)

        # Insert : 1 row today (in scope), 1 row before month (out of scope)
        await db_session.execute(
            text(
                "INSERT INTO proxy_usage_daily "
                "(date, bytes_in, bytes_out, requests_total, requests_by_provider) "
                "VALUES (:d, :bi, :bo, :rt, :rbp)"
            ),
            {
                "d": today.isoformat(),
                "bi": 1000,
                "bo": 500,
                "rt": 1,
                "rbp": "{}",
            },
        )
        await db_session.execute(
            text(
                "INSERT INTO proxy_usage_daily "
                "(date, bytes_in, bytes_out, requests_total, requests_by_provider) "
                "VALUES (:d, :bi, :bo, :rt, :rbp)"
            ),
            {
                # 1er du mois inclus, mais si on est le 1er, mettre -1 jour
                "d": (
                    first_of_month.replace(month=first_of_month.month - 1)
                    if first_of_month.month > 1
                    else first_of_month.replace(year=first_of_month.year - 1, month=12)
                ).isoformat(),
                "bi": 9999,
                "bo": 9999,
                "rt": 1,
                "rbp": "{}",
            },
        )
        await db_session.commit()

        total = await _fetch_mtd_total(db_session)
        assert total == 1500  # only today's row in MTD scope


# ─────────────────────────────────────────────────────────────────────────────
# PostHog flush tests
# ─────────────────────────────────────────────────────────────────────────────


class TestPostHogFlush:
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_no_flush_below_threshold(self, db_session, patched_session_maker):
        """Sous 100 MB cumulés, pas d'event PostHog."""
        from middleware import proxy_telemetry

        captured = []

        async def fake_capture(distinct_id, event, properties=None):
            captured.append((event, properties))

        with patch.object(
            proxy_telemetry,
            "_maybe_flush_posthog",
            wraps=proxy_telemetry._maybe_flush_posthog,
        ):
            with patch(
                "services.posthog_service.capture_event",
                side_effect=fake_capture,
            ):
                # Cumul = 50 MB seulement → no flush
                await proxy_telemetry.record_proxy_usage(
                    provider="ytdlp",
                    bytes_in=50 * 1024 * 1024,
                    session=db_session,
                )

        assert captured == []

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_flush_at_100mb_threshold(self, db_session, patched_session_maker):
        """À ≥100 MB cumulés, un event `proxy_bandwidth_used` est émis."""
        from middleware import proxy_telemetry

        captured = []

        async def fake_capture(distinct_id, event, properties=None):
            captured.append((event, properties))

        with patch(
            "services.posthog_service.capture_event",
            side_effect=fake_capture,
        ):
            # Premier appel 60 MB
            await proxy_telemetry.record_proxy_usage(
                provider="ytdlp",
                bytes_in=60 * 1024 * 1024,
                session=db_session,
            )
            assert captured == []  # 60 MB < 100 MB
            # Second appel 50 MB → cumul = 110 MB → flush
            await proxy_telemetry.record_proxy_usage(
                provider="ytdlp",
                bytes_in=50 * 1024 * 1024,
                session=db_session,
            )

        assert len(captured) == 1
        event_name, props = captured[0]
        assert event_name == "proxy_bandwidth_used"
        assert props["provider"] == "ytdlp"
        assert props["flushed_bytes"] >= 100 * 1024 * 1024
        assert props["mtd_total_bytes"] >= 110 * 1024 * 1024
        assert "mtd_total_mb" in props

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_flush_resets_counter(self, db_session, patched_session_maker):
        """Après flush, le compteur est reset → prochain flush nécessite à nouveau 100 MB."""
        from middleware import proxy_telemetry

        captured = []

        async def fake_capture(distinct_id, event, properties=None):
            captured.append((event, properties))

        with patch(
            "services.posthog_service.capture_event",
            side_effect=fake_capture,
        ):
            # 1ère salve de 120 MB → 1 flush
            await proxy_telemetry.record_proxy_usage(
                provider="ytdlp",
                bytes_in=120 * 1024 * 1024,
                session=db_session,
            )
            # 2e salve de 50 MB → pas de flush (compteur reset à 0)
            await proxy_telemetry.record_proxy_usage(
                provider="ytdlp",
                bytes_in=50 * 1024 * 1024,
                session=db_session,
            )

        assert len(captured) == 1


# ─────────────────────────────────────────────────────────────────────────────
# ProxyByteCounter tests
# ─────────────────────────────────────────────────────────────────────────────


class TestProxyByteCounter:
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_counter_accumulates_chunks(self, db_session, patched_session_maker):
        """Streaming counter accumule les chunks avant flush."""
        from middleware.proxy_telemetry import ProxyByteCounter

        counter = ProxyByteCounter(provider="streaming_test")
        counter.set_content_length(10_000)
        counter.add(3000)
        counter.add(4000)
        counter.add(2500)  # partial — abandonné avant complete

        assert counter.bytes_in == 9500
        assert counter.content_length == 10_000

        await counter.flush(session=db_session)

        result = await db_session.execute(
            text("SELECT bytes_in, requests_total, requests_by_provider FROM proxy_usage_daily")
        )
        row = result.first()
        assert row[0] == 9500
        assert row[1] == 1
        rbp = json.loads(row[2]) if isinstance(row[2], str) else row[2]
        assert rbp == {"streaming_test": 1}

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_counter_flush_idempotent(self, db_session, patched_session_maker):
        """Flush deux fois → la 2e est un no-op (pas de double-counting)."""
        from middleware.proxy_telemetry import ProxyByteCounter

        counter = ProxyByteCounter(provider="ytdlp")
        counter.add(1000)

        await counter.flush(session=db_session)
        await counter.flush(session=db_session)  # 2e flush ignoré

        result = await db_session.execute(text("SELECT bytes_in, requests_total FROM proxy_usage_daily"))
        row = result.first()
        assert row[0] == 1000
        assert row[1] == 1  # +1 only, pas +2

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_counter_add_negative_is_noop(self):
        """add(-1) ou add(0) ne change pas le compteur (defense en profondeur)."""
        from middleware.proxy_telemetry import ProxyByteCounter

        counter = ProxyByteCounter(provider="test")
        counter.add(0)
        counter.add(-100)
        assert counter.bytes_in == 0


# ─────────────────────────────────────────────────────────────────────────────
# Migration 027 reversibility (best-effort — skip si DB pas dispo)
# ─────────────────────────────────────────────────────────────────────────────


class TestMigrationReversibility:
    @pytest.mark.unit
    @pytest.mark.skip(
        reason=(
            "Exec'ing the alembic migration file requires alembic.op context "
            "(op.get_bind() / op.create_table). Real reversibility is tested "
            "via `alembic upgrade heads && alembic downgrade -1` côté Hetzner — "
            "voir docs/runbooks/proxy-telemetry-monitoring.md."
        )
    )
    @pytest.mark.asyncio
    async def test_alembic_027_upgrade_and_downgrade_idempotent(self):
        """Skipped — requires alembic runtime context. See docstring."""
        pass

    @pytest.mark.unit
    def test_alembic_027_metadata(self):
        """Parse la migration 027 et vérifie :
        • revision_id ≤ 32 chars (alembic_version VARCHAR(32) default)
        • down_revision pointe sur 026_chatmsg_summary_null
        • Présence des fonctions upgrade() et downgrade()
        """
        from pathlib import Path
        import re

        migration_path = Path(__file__).parent.parent / "alembic" / "versions" / "027_proxy_usage_daily.py"
        content = migration_path.read_text(encoding="utf-8")

        match_rev = re.search(r'revision\s*:\s*str\s*=\s*"([^"]+)"', content)
        assert match_rev is not None, "Could not parse revision ID"
        revision_id = match_rev.group(1)
        assert len(revision_id) <= 32, (
            f"revision_id={revision_id!r} ({len(revision_id)} chars) > 32 — "
            "alembic_version VARCHAR overflow risk (cf. memory entry "
            "'Alembic DeepSight — conventions 32 chars')"
        )

        match_down = re.search(r'down_revision[^=]+=\s*"([^"]+)"', content)
        assert match_down is not None, "Could not parse down_revision"
        assert match_down.group(1) == "026_chatmsg_summary_null"

        assert "def upgrade()" in content
        assert "def downgrade()" in content
        assert "proxy_usage_daily" in content


# ─────────────────────────────────────────────────────────────────────────────
# Boot helpers
# ─────────────────────────────────────────────────────────────────────────────


class TestBootHelpers:
    @pytest.mark.unit
    def test_log_boot_state_never_raises(self, caplog):
        """log_boot_state() est best-effort, ne doit jamais raise."""
        from middleware.proxy_telemetry import log_boot_state

        log_boot_state()  # Should not raise
