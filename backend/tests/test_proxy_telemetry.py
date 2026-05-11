"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Proxy Telemetry (Sprint E observability)                              ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║  • record_proxy_request : accumulator stage + flush vers proxy_usage_daily        ║
║  • Coalescing : plusieurs events fusionnés dans une seule row daily               ║
║  • record_httpx_response : extraction Content-Length depuis httpx.Response        ║
║  • is_proxy_enabled : honor PROXY_DISABLED flag                                   ║
║  • get_usage_summary : agrégation N jours + estimation cost USD                   ║
║  • Endpoint admin GET /api/admin/proxy/usage : auth + format réponse              ║
║                                                                                    ║
║  SQLite in-memory + monkeypatch async_session_factory (cf. test_email_dlq).       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import date, datetime, timedelta
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# Path setup (au cas où le test est lancé seul)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
async def sqlite_session(monkeypatch):
    """SQLite in-memory async session avec la table proxy_usage_daily.

    Monkeypatch `async_session_factory` pour que le middleware persist dans
    cette DB éphémère.
    """
    from sqlalchemy.ext.asyncio import (
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )

    from db import database as db_module
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    monkeypatch.setattr(db_module, "async_session_factory", session_factory)

    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture(autouse=True)
async def reset_accumulator():
    """Reset le singleton accumulator entre chaque test."""
    from middleware import proxy_telemetry

    proxy_telemetry._accumulator = proxy_telemetry._ProxyTelemetryAccumulator()
    yield


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests : extract_content_length
# ─────────────────────────────────────────────────────────────────────────────


class TestExtractContentLength:
    @pytest.mark.unit
    def test_reads_content_length_header(self):
        from middleware.proxy_telemetry import extract_content_length

        response = httpx.Response(
            status_code=200, headers={"Content-Length": "1024"}, content=b""
        )
        assert extract_content_length(response) == 1024

    @pytest.mark.unit
    def test_falls_back_to_body_length(self):
        from middleware.proxy_telemetry import extract_content_length

        body = b"x" * 512
        response = httpx.Response(status_code=200, content=body)
        # Strip Content-Length so we exercise the fallback.
        response.headers.pop("Content-Length", None)
        assert extract_content_length(response) == 512

    @pytest.mark.unit
    def test_returns_zero_for_unknown(self):
        from middleware.proxy_telemetry import extract_content_length

        response = httpx.Response(status_code=204)
        response.headers.pop("Content-Length", None)
        # No body, no header
        assert extract_content_length(response) == 0


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests : is_proxy_enabled
# ─────────────────────────────────────────────────────────────────────────────


class TestIsProxyEnabled:
    @pytest.mark.unit
    def test_disabled_when_proxy_disabled_flag_true(self, monkeypatch):
        from middleware import proxy_telemetry

        monkeypatch.setattr(proxy_telemetry, "PROXY_DISABLED", True)
        monkeypatch.setattr(
            proxy_telemetry, "get_youtube_proxy", lambda: "socks5://example.com:1080"
        )
        assert proxy_telemetry.is_proxy_enabled() is False

    @pytest.mark.unit
    def test_disabled_when_no_proxy_url(self, monkeypatch):
        from middleware import proxy_telemetry

        monkeypatch.setattr(proxy_telemetry, "PROXY_DISABLED", False)
        monkeypatch.setattr(proxy_telemetry, "get_youtube_proxy", lambda: "")
        assert proxy_telemetry.is_proxy_enabled() is False

    @pytest.mark.unit
    def test_enabled_when_proxy_set_and_not_disabled(self, monkeypatch):
        from middleware import proxy_telemetry

        monkeypatch.setattr(proxy_telemetry, "PROXY_DISABLED", False)
        monkeypatch.setattr(
            proxy_telemetry, "get_youtube_proxy", lambda: "socks5://example.com:1080"
        )
        assert proxy_telemetry.is_proxy_enabled() is True


# ─────────────────────────────────────────────────────────────────────────────
# Integration tests : record_proxy_request → DB
# ─────────────────────────────────────────────────────────────────────────────


class TestRecordProxyRequest:
    @pytest.mark.asyncio
    async def test_persists_single_event(self, sqlite_session):
        from sqlalchemy import select

        from db.database import ProxyUsageDaily
        from middleware.proxy_telemetry import flush, record_proxy_request

        await record_proxy_request("default", bytes_in=2048, bytes_out=128)
        await flush()

        result = await sqlite_session.execute(select(ProxyUsageDaily))
        rows = result.scalars().all()
        assert len(rows) == 1
        row = rows[0]
        assert row.date == date.today()
        assert row.bytes_in == 2048
        assert row.bytes_out == 128
        assert row.requests_total == 1
        assert "default" in row.requests_by_provider
        assert row.requests_by_provider["default"]["requests"] == 1
        assert row.requests_by_provider["default"]["bytes_in"] == 2048

    @pytest.mark.asyncio
    async def test_coalesces_multiple_events_same_day(self, sqlite_session):
        """3 events on the same day → 1 row, counters summed."""
        from sqlalchemy import select

        from db.database import ProxyUsageDaily
        from middleware.proxy_telemetry import flush, record_proxy_request

        await record_proxy_request("default", bytes_in=100)
        await record_proxy_request("default", bytes_in=200)
        await record_proxy_request("sticky", bytes_in=50)
        await flush()

        result = await sqlite_session.execute(select(ProxyUsageDaily))
        rows = result.scalars().all()
        assert len(rows) == 1
        row = rows[0]
        assert row.bytes_in == 350
        assert row.requests_total == 3
        assert row.requests_by_provider["default"]["requests"] == 2
        assert row.requests_by_provider["default"]["bytes_in"] == 300
        assert row.requests_by_provider["sticky"]["requests"] == 1
        assert row.requests_by_provider["sticky"]["bytes_in"] == 50

    @pytest.mark.asyncio
    async def test_accumulates_across_flushes(self, sqlite_session):
        """flush() then more events → second flush UPDATES the same daily row."""
        from sqlalchemy import select

        from db.database import ProxyUsageDaily
        from middleware.proxy_telemetry import flush, record_proxy_request

        await record_proxy_request("default", bytes_in=100)
        await flush()

        await record_proxy_request("default", bytes_in=500)
        await record_proxy_request("geo_us", bytes_in=200)
        await flush()

        result = await sqlite_session.execute(select(ProxyUsageDaily))
        rows = result.scalars().all()
        assert len(rows) == 1
        row = rows[0]
        assert row.bytes_in == 800
        assert row.requests_total == 3
        assert row.requests_by_provider["default"]["bytes_in"] == 600
        assert row.requests_by_provider["geo_us"]["bytes_in"] == 200

    @pytest.mark.asyncio
    async def test_swallows_db_errors(self, monkeypatch):
        """If the DB blow up, record_proxy_request must not raise."""
        from middleware import proxy_telemetry
        from middleware.proxy_telemetry import flush, record_proxy_request

        # Point async_session_factory at a broken context manager.
        class BrokenSession:
            async def __aenter__(self):
                raise RuntimeError("DB unreachable")

            async def __aexit__(self, *args):
                return False

        def broken_factory():
            return BrokenSession()

        from db import database as db_module

        monkeypatch.setattr(db_module, "async_session_factory", broken_factory)

        # Must NOT raise
        await record_proxy_request("default", bytes_in=42)
        await flush()


class TestRecordHttpxResponse:
    @pytest.mark.asyncio
    async def test_uses_content_length(self, sqlite_session):
        from sqlalchemy import select

        from db.database import ProxyUsageDaily
        from middleware.proxy_telemetry import flush, record_httpx_response

        response = httpx.Response(
            status_code=200, headers={"Content-Length": "4096"}, content=b""
        )
        await record_httpx_response("sticky", response)
        await flush()

        result = await sqlite_session.execute(select(ProxyUsageDaily))
        row = result.scalar_one()
        assert row.bytes_in == 4096
        assert row.requests_by_provider["sticky"]["bytes_in"] == 4096


# ─────────────────────────────────────────────────────────────────────────────
# Integration tests : get_usage_summary aggregation
# ─────────────────────────────────────────────────────────────────────────────


class TestGetUsageSummary:
    @pytest.mark.asyncio
    async def test_empty_db_returns_zero(self, sqlite_session):
        from middleware.proxy_telemetry import get_usage_summary

        summary = await get_usage_summary(days=30)
        assert summary["period_days"] == 30
        assert summary["total_bytes_in"] == 0
        assert summary["total_requests"] == 0
        assert summary["estimated_cost_usd"] == 0.0
        assert summary["by_provider"] == {}
        assert summary["daily"] == []

    @pytest.mark.asyncio
    async def test_aggregates_across_days(self, sqlite_session):
        from db.database import ProxyUsageDaily
        from middleware.proxy_telemetry import get_usage_summary

        today = date.today()
        d1 = today - timedelta(days=1)
        d2 = today - timedelta(days=2)

        sqlite_session.add_all(
            [
                ProxyUsageDaily(
                    date=today,
                    bytes_in=1024 * 1024 * 100,  # 100 MB
                    bytes_out=1024,
                    requests_total=10,
                    requests_by_provider={
                        "default": {"requests": 8, "bytes_in": 80 * 1024 * 1024},
                        "sticky": {"requests": 2, "bytes_in": 20 * 1024 * 1024},
                    },
                ),
                ProxyUsageDaily(
                    date=d1,
                    bytes_in=1024 * 1024 * 50,  # 50 MB
                    bytes_out=0,
                    requests_total=5,
                    requests_by_provider={
                        "default": {"requests": 5, "bytes_in": 50 * 1024 * 1024},
                    },
                ),
                ProxyUsageDaily(
                    date=d2,
                    bytes_in=1024 * 1024 * 25,  # 25 MB
                    bytes_out=512,
                    requests_total=3,
                    requests_by_provider={
                        "default": {"requests": 2, "bytes_in": 15 * 1024 * 1024},
                        "geo_us": {"requests": 1, "bytes_in": 10 * 1024 * 1024},
                    },
                ),
            ]
        )
        await sqlite_session.commit()

        summary = await get_usage_summary(days=7)
        # 175 MB total in
        assert summary["total_bytes_in"] == (100 + 50 + 25) * 1024 * 1024
        assert summary["total_requests"] == 18
        assert summary["total_bytes_out"] == 1024 + 512
        # 175 MB ≈ 0.171 GB × $4 ≈ $0.683
        assert summary["estimated_cost_usd"] > 0.6
        assert summary["estimated_cost_usd"] < 0.7
        # By-provider aggregation
        assert summary["by_provider"]["default"]["requests"] == 15
        assert summary["by_provider"]["sticky"]["requests"] == 2
        assert summary["by_provider"]["geo_us"]["requests"] == 1
        # Daily list ordered desc by date
        assert len(summary["daily"]) == 3
        assert summary["daily"][0]["date"] == today.isoformat()

    @pytest.mark.asyncio
    async def test_respects_days_window(self, sqlite_session):
        from db.database import ProxyUsageDaily
        from middleware.proxy_telemetry import get_usage_summary

        today = date.today()
        old = today - timedelta(days=40)

        sqlite_session.add_all(
            [
                ProxyUsageDaily(date=today, bytes_in=100, bytes_out=0, requests_total=1),
                ProxyUsageDaily(date=old, bytes_in=999999, bytes_out=0, requests_total=99),
            ]
        )
        await sqlite_session.commit()

        # 30-day window should EXCLUDE the 40-day-old row.
        summary = await get_usage_summary(days=30)
        assert summary["total_bytes_in"] == 100
        assert summary["total_requests"] == 1


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint test : GET /api/admin/proxy/usage
# ─────────────────────────────────────────────────────────────────────────────


class TestAdminProxyUsageEndpoint:
    @pytest.mark.asyncio
    async def test_requires_admin_auth(self, sqlite_session):
        """Endpoint requires admin role — non-admin → 403."""
        from fastapi import FastAPI
        from httpx import ASGITransport, AsyncClient

        from admin.router import router as admin_router
        from auth.dependencies import get_current_admin
        from fastapi import HTTPException, status

        app = FastAPI()
        app.include_router(admin_router, prefix="/api/admin")

        # Override admin dep to ALWAYS deny.
        async def deny_admin():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "admin_required", "message": "Admin access required"},
            )

        app.dependency_overrides[get_current_admin] = deny_admin

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/admin/proxy/usage")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_returns_summary_for_admin(self, sqlite_session):
        from fastapi import FastAPI
        from httpx import ASGITransport, AsyncClient

        from admin.router import router as admin_router
        from auth.dependencies import get_current_admin
        from db.database import ProxyUsageDaily

        # Seed a daily row.
        sqlite_session.add(
            ProxyUsageDaily(
                date=date.today(),
                bytes_in=2 * 1024 * 1024 * 1024,  # 2 GB
                bytes_out=1024,
                requests_total=7,
                requests_by_provider={
                    "default": {"requests": 7, "bytes_in": 2 * 1024 * 1024 * 1024},
                },
            )
        )
        await sqlite_session.commit()

        app = FastAPI()
        app.include_router(admin_router, prefix="/api/admin")

        fake_admin = MagicMock()
        fake_admin.id = 1
        fake_admin.email = "admin@example.com"
        fake_admin.is_admin = True

        async def allow_admin():
            return fake_admin

        app.dependency_overrides[get_current_admin] = allow_admin

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/admin/proxy/usage?days=7")

        assert response.status_code == 200
        body = response.json()
        assert body["period_days"] == 7
        assert body["total_bytes_in"] == 2 * 1024 * 1024 * 1024
        assert body["total_requests"] == 7
        # 2 GB × $4 = $8
        assert abs(body["estimated_cost_usd"] - 8.0) < 0.01
        assert "default" in body["by_provider"]
        assert body["by_provider"]["default"]["requests"] == 7
        assert len(body["daily"]) == 1
        assert body["daily"][0]["date"] == date.today().isoformat()

    @pytest.mark.asyncio
    async def test_days_query_param_validation(self, sqlite_session):
        """days must be 1..365 (FastAPI Query bounds)."""
        from fastapi import FastAPI
        from httpx import ASGITransport, AsyncClient

        from admin.router import router as admin_router
        from auth.dependencies import get_current_admin

        app = FastAPI()
        app.include_router(admin_router, prefix="/api/admin")

        async def allow_admin():
            user = MagicMock()
            user.is_admin = True
            return user

        app.dependency_overrides[get_current_admin] = allow_admin

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 0 → too small
            r1 = await client.get("/api/admin/proxy/usage?days=0")
            assert r1.status_code == 422
            # 400 → too big
            r2 = await client.get("/api/admin/proxy/usage?days=400")
            assert r2.status_code == 422
