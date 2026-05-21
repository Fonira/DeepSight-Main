"""Tests Auth V2 — endpoints sessions (`/api/auth/sessions`).

Wave 1 Step 3 (2026-05-21) — couvre :
- GET /api/auth/sessions : liste les sessions actives uniquement, marque
  `current` via `jti`, isolement strict par user.
- DELETE /api/auth/sessions/{id} : révoque une session, 404 sur ID inconnu
  OU appartenant à un autre user.
- DELETE /api/auth/sessions : révoque toutes les autres sessions, préserve
  la courante.

Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §4.4.

Stratégie test : SQLite in-memory + override `get_session` + `get_current_user`
+ `get_current_token_payload`. Pattern identique à `test_auth_service_v2.py`
pour la fixture DB + le workaround circular import sur Windows local.
"""

import os
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Env defaults pour import safety
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")


# ⚠️ Workaround circular import (pattern identique à test_auth_service_v2.py).
import db.database as _db_database  # noqa: F401, E402
import importlib.util as _ilu  # noqa: E402
import sys as _sys  # noqa: E402
from pathlib import Path as _Path  # noqa: E402

if "billing.plan_config" not in _sys.modules:
    _spec = _ilu.spec_from_file_location(
        "billing.plan_config",
        str(_Path(__file__).parent.parent / "src" / "billing" / "plan_config.py"),
    )
    if _spec is not None and _spec.loader is not None:
        _mod = _ilu.module_from_spec(_spec)
        if "billing" not in _sys.modules:
            import types as _types

            _billing_pkg = _types.ModuleType("billing")
            _billing_pkg.__path__ = [str(_Path(__file__).parent.parent / "src" / "billing")]
            _sys.modules["billing"] = _billing_pkg
        _sys.modules["billing.plan_config"] = _mod
        try:
            _spec.loader.exec_module(_mod)
        except Exception:  # noqa: BLE001
            _sys.modules.pop("billing.plan_config", None)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧰 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def test_engine():
    """SQLite in-memory engine partagé entre app + tests."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    """Session SQLAlchemy partagée (commit dans les tests visible côté app)."""
    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(test_session):
    """User réel en DB."""
    from db.database import User, hash_password

    user = User(
        username=f"alice_{uuid.uuid4().hex[:8]}",
        email=f"alice_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("correctpassword"),
        email_verified=True,
        plan="free",
        credits=10,
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def other_user(test_session):
    """Second user pour les tests d'isolement."""
    from db.database import User, hash_password

    user = User(
        username=f"bob_{uuid.uuid4().hex[:8]}",
        email=f"bob_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("otherpw"),
        email_verified=True,
        plan="free",
        credits=10,
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


async def _create_session(test_session, user_id: int, ua: str = "Mozilla/5.0", host: str = "1.2.3.4"):
    """Helper : crée une UserSession V2 + sync hash. Retourne la session ORM."""
    from unittest.mock import MagicMock

    from auth.service import create_session_v2, create_refresh_token_v2, update_session_refresh_hash

    request = MagicMock()
    headers = MagicMock()
    headers.get = lambda key, default=None: ua if key.lower() == "user-agent" else default
    request.headers = headers
    client = MagicMock()
    client.host = host
    request.client = client

    user_session = await create_session_v2(
        session=test_session,
        user_id=user_id,
        stay_signed_in=True,
        request=request,
    )
    ttl = int((user_session.sliding_expires_at - datetime.utcnow()).total_seconds())
    refresh_jwt = create_refresh_token_v2(user_id=user_id, jti=user_session.id, ttl_seconds=ttl)
    await update_session_refresh_hash(test_session, user_session.id, refresh_jwt)
    await test_session.commit()
    await test_session.refresh(user_session)
    return user_session


@pytest_asyncio.fixture
async def app(test_engine, test_session, test_user):
    """App FastAPI avec get_session + get_current_user overridés."""
    from main import app as fastapi_app
    from db.database import get_session
    from auth.dependencies import get_current_user, get_current_token_payload

    # Override get_session pour utiliser notre engine SQLite in-memory.
    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session():
        async with SessionLocal() as s:
            yield s

    async def override_user():
        return test_user

    fastapi_app.dependency_overrides[get_session] = override_session
    fastapi_app.dependency_overrides[get_current_user] = override_user

    # Par défaut : pas de jti (token legacy V1). Les tests qui ont besoin
    # d'un jti spécifique le surchargent eux-mêmes dans le test.
    async def override_payload():
        return {"sub": str(test_user.id)}

    fastapi_app.dependency_overrides[get_current_token_payload] = override_payload

    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 GET /api/auth/sessions
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_GET_sessions_returns_only_active_for_user(client, test_session, test_user):
    """GET /sessions retourne seulement les sessions actives (non révoquées, non expirées)."""
    # 2 sessions actives + 1 révoquée + 1 expirée
    s1 = await _create_session(test_session, test_user.id)
    s2 = await _create_session(test_session, test_user.id)
    s_revoked = await _create_session(test_session, test_user.id)
    s_expired = await _create_session(test_session, test_user.id)

    # Marquer une session comme révoquée
    s_revoked.revoked_at = datetime.utcnow()
    # Marquer une autre comme expirée (sliding dans le passé)
    s_expired.sliding_expires_at = datetime.utcnow() - timedelta(hours=1)
    await test_session.commit()

    resp = await client.get("/api/auth/sessions")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)

    ids = [s["id"] for s in data]
    assert s1.id in ids
    assert s2.id in ids
    assert s_revoked.id not in ids
    assert s_expired.id not in ids


@pytest.mark.unit
@pytest.mark.asyncio
async def test_GET_sessions_marks_current_via_jti(app, test_session, test_user):
    """La session dont l'id == jti du JWT courant a `current=True`."""
    from auth.dependencies import get_current_token_payload

    s1 = await _create_session(test_session, test_user.id)
    s2 = await _create_session(test_session, test_user.id)

    # Override le payload pour pointer vers s1
    async def override_payload():
        return {"sub": str(test_user.id), "jti": s1.id}

    app.dependency_overrides[get_current_token_payload] = override_payload

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/auth/sessions")

    assert resp.status_code == 200
    data = resp.json()
    by_id = {s["id"]: s for s in data}
    assert by_id[s1.id]["current"] is True
    assert by_id[s2.id]["current"] is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_GET_sessions_other_user_isolation(client, test_session, test_user, other_user):
    """Les sessions d'autres users ne sont pas retournées."""
    s_mine = await _create_session(test_session, test_user.id)
    s_other = await _create_session(test_session, other_user.id)

    resp = await client.get("/api/auth/sessions")
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert s_mine.id in ids
    assert s_other.id not in ids


# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️ DELETE /api/auth/sessions/{id}
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_DELETE_session_by_id_marks_revoked(client, test_engine, test_session, test_user):
    """DELETE /sessions/{id} marque revoked_at."""
    from db.database import UserSession
    from sqlalchemy import select

    s = await _create_session(test_session, test_user.id)
    session_id = s.id
    assert s.revoked_at is None

    resp = await client.delete(f"/api/auth/sessions/{session_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True

    # Re-lookup avec session fraîche (l'endpoint commit dans une SessionLocal
    # distincte → test_session a une identity-map cache qu'on doit éviter).
    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as fresh:
        result = await fresh.execute(select(UserSession).where(UserSession.id == session_id))
        refreshed = result.scalar_one()
        assert refreshed.revoked_at is not None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_DELETE_session_other_user_returns_404(client, test_session, test_user, other_user):
    """Tenter de révoquer une session d'un autre user → 404 (sécurité par énumération)."""
    s_other = await _create_session(test_session, other_user.id)

    resp = await client.delete(f"/api/auth/sessions/{s_other.id}")
    assert resp.status_code == 404


@pytest.mark.unit
@pytest.mark.asyncio
async def test_DELETE_session_unknown_id_returns_404(client):
    """DELETE /sessions/{id} avec UUID inconnu → 404."""
    fake_id = str(uuid.uuid4())
    resp = await client.delete(f"/api/auth/sessions/{fake_id}")
    assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️ DELETE /api/auth/sessions (révoque les autres)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_DELETE_all_sessions_keeps_current_one(app, test_engine, test_session, test_user):
    """DELETE /sessions révoque toutes SAUF celle du jti courant."""
    from db.database import UserSession
    from sqlalchemy import select
    from auth.dependencies import get_current_token_payload

    s_current = await _create_session(test_session, test_user.id)
    s_other_1 = await _create_session(test_session, test_user.id)
    s_other_2 = await _create_session(test_session, test_user.id)
    current_id, other_1_id, other_2_id = s_current.id, s_other_1.id, s_other_2.id

    async def override_payload():
        return {"sub": str(test_user.id), "jti": current_id}

    app.dependency_overrides[get_current_token_payload] = override_payload

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.delete("/api/auth/sessions")

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "2" in body["message"]  # 2 sessions révoquées

    # Verify en DB via session fraîche (cf commentaire dans test_DELETE_session_by_id_marks_revoked)
    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as fresh:
        result = await fresh.execute(select(UserSession).where(UserSession.user_id == test_user.id))
        all_sessions = list(result.scalars().all())
        by_id = {s.id: s for s in all_sessions}
        assert by_id[current_id].revoked_at is None  # current preserved
        assert by_id[other_1_id].revoked_at is not None
        assert by_id[other_2_id].revoked_at is not None
