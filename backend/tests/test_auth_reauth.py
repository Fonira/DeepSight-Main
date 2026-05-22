"""Tests Auth V2 — POST /api/auth/reauth + dependency `require_recent_reauth`.

Wave 1 Step 3 (2026-05-21) — couvre :
- POST /api/auth/reauth : password verification + émission JWT scopé 5 min.
- `require_recent_reauth(audience)` : accepte un token valide, rejette
  expired / wrong audience / wrong scope / missing header.

Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §4.6.

Pattern : SQLite in-memory + override deps + appel direct de la dependency
factory pour les tests unitaires (pas besoin d'un endpoint wiré).
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")


# ⚠️ Workaround circular import (pattern test_auth_service_v2.py).
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
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(test_session):
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
async def app(test_engine, test_user):
    from main import app as fastapi_app
    from db.database import get_session
    from auth.dependencies import get_current_user

    SessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session():
        async with SessionLocal() as s:
            yield s

    async def override_user():
        return test_user

    fastapi_app.dependency_overrides[get_session] = override_session
    fastapi_app.dependency_overrides[get_current_user] = override_user

    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def _make_request_mock(headers: dict | None = None):
    """Mock minimal d'un Request pour tester `require_recent_reauth` direct."""
    req = MagicMock()
    h = MagicMock()
    headers = headers or {}
    h.get = lambda key, default=None: headers.get(key, default)
    req.headers = h
    return req


# ═══════════════════════════════════════════════════════════════════════════════
# 📨 POST /api/auth/reauth
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_POST_reauth_wrong_password_returns_401_REAUTH_WRONG_PASSWORD(client):
    """Mot de passe incorrect → 401 REAUTH_WRONG_PASSWORD."""
    resp = await client.post(
        "/api/auth/reauth",
        json={"password": "wrongpassword", "audience": "billing"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "REAUTH_WRONG_PASSWORD"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_POST_reauth_emits_5min_jwt_with_correct_claims(client):
    """Mot de passe correct → JWT 5 min avec scope=reauth + aud=audience."""
    import core.config as _cc  # runtime lookup (cf importlib.reload edge case)

    resp = await client.post(
        "/api/auth/reauth",
        json={"password": "correctpassword", "audience": "billing"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["expires_in"] == 300  # 5 min
    token = body["reauth_token"]
    assert token

    # Decode + check claims
    payload = jwt.decode(
        token,
        _cc.JWT_CONFIG["SECRET_KEY"],
        algorithms=[_cc.JWT_CONFIG["ALGORITHM"]],
        audience="billing",
    )
    assert payload["scope"] == "reauth"
    assert payload["aud"] == "billing"

    # exp doit être ~ 5min dans le futur
    now = datetime.now(timezone.utc).timestamp()
    assert 290 < (payload["exp"] - now) < 305


@pytest.mark.unit
@pytest.mark.asyncio
async def test_POST_reauth_rejects_invalid_audience_schema(client):
    """Audience hors Literal → 422 (validation Pydantic)."""
    resp = await client.post(
        "/api/auth/reauth",
        json={"password": "correctpassword", "audience": "not-a-valid-audience"},
    )
    assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 🔒 require_recent_reauth(audience) — dependency unitaire
# ═══════════════════════════════════════════════════════════════════════════════


def _emit_reauth_token(user_id: int, audience: str, ttl_seconds: int = 300, scope: str = "reauth") -> str:
    """Helper : émet un JWT reauth (ou variant pour tests négatifs).

    Runtime lookup de JWT_CONFIG (et non `from core.config import`) parce que
    `tests/billing/test_pricing_v2.py` reload `core.config` via importlib —
    un import figé donnerait un secret différent de celui utilisé par
    `auth.dependencies` après le reload.
    """
    import core.config as _cc

    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "scope": scope,
            "aud": audience,
            "iat": now,
            "exp": now + timedelta(seconds=ttl_seconds),
        },
        _cc.JWT_CONFIG["SECRET_KEY"],
        algorithm=_cc.JWT_CONFIG["ALGORITHM"],
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_recent_reauth_accepts_valid_token(test_user):
    """Token valide → la dépendance retourne None sans exception."""
    from auth.dependencies import require_recent_reauth

    token = _emit_reauth_token(test_user.id, "billing")
    dep = require_recent_reauth("billing")
    request = _make_request_mock({"X-Reauth-Token": token})

    result = await dep(request=request, current_user=test_user)
    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_recent_reauth_rejects_missing_header(test_user):
    """Pas de X-Reauth-Token → 401 REAUTH_REQUIRED."""
    from auth.dependencies import require_recent_reauth

    dep = require_recent_reauth("billing")
    request = _make_request_mock(headers={})  # no X-Reauth-Token

    with pytest.raises(HTTPException) as exc:
        await dep(request=request, current_user=test_user)
    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "REAUTH_REQUIRED"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_recent_reauth_rejects_expired_token(test_user):
    """Token avec exp dans le passé → 401 REAUTH_EXPIRED."""
    from auth.dependencies import require_recent_reauth

    token = _emit_reauth_token(test_user.id, "billing", ttl_seconds=-10)  # déjà expiré
    dep = require_recent_reauth("billing")
    request = _make_request_mock({"X-Reauth-Token": token})

    with pytest.raises(HTTPException) as exc:
        await dep(request=request, current_user=test_user)
    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "REAUTH_EXPIRED"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_recent_reauth_rejects_wrong_audience(test_user):
    """Token aud="delete" appelé avec audience="billing" → 401 REAUTH_WRONG_AUDIENCE."""
    from auth.dependencies import require_recent_reauth

    token = _emit_reauth_token(test_user.id, "delete")  # aud=delete
    dep = require_recent_reauth("billing")  # mais on attend billing
    request = _make_request_mock({"X-Reauth-Token": token})

    with pytest.raises(HTTPException) as exc:
        await dep(request=request, current_user=test_user)
    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "REAUTH_WRONG_AUDIENCE"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_recent_reauth_rejects_wrong_scope(test_user):
    """Token avec scope=access (pas reauth) → 401 REAUTH_WRONG_SCOPE."""
    from auth.dependencies import require_recent_reauth

    token = _emit_reauth_token(test_user.id, "billing", scope="access")
    dep = require_recent_reauth("billing")
    request = _make_request_mock({"X-Reauth-Token": token})

    with pytest.raises(HTTPException) as exc:
        await dep(request=request, current_user=test_user)
    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "REAUTH_WRONG_SCOPE"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_require_recent_reauth_rejects_user_mismatch(test_user):
    """Token sub=other_user_id → 401 REAUTH_USER_MISMATCH."""
    from auth.dependencies import require_recent_reauth

    other_user_id = test_user.id + 9999
    token = _emit_reauth_token(other_user_id, "billing")
    dep = require_recent_reauth("billing")
    request = _make_request_mock({"X-Reauth-Token": token})

    with pytest.raises(HTTPException) as exc:
        await dep(request=request, current_user=test_user)
    assert exc.value.status_code == 401
    assert exc.value.detail["code"] == "REAUTH_USER_MISMATCH"
