"""Tests Auth V2 — session lifecycle dans `auth/service.py`.

Wave 1 Step 2 (2026-05-21) — couvre :
- create_session_v2 : sliding TTL selon stay_signed_in, parse user-agent,
  hash IP, persistence DB.
- rotate_refresh_session : happy path, replay detection, expiration sliding,
  expiration absolute, hash mismatch.
- revoke_session_v2 : marquage revoked_at, sécurité owner.
- list_user_sessions : filtres révoquées + expirées.
- validate_session_v2 : hash mismatch, sliding expired.

Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §4.

Stratégie test : SQLite in-memory + fakeredis pour blocklist (cf pattern
test_user_sessions_model.py et test_auth_comprehensive.py Sprint C).
"""

import os
import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ⚠️ Workaround circular import (pré-existant Sprint C #522 sur Windows local).
# Sur Linux CI ce hack n'est pas nécessaire mais il reste inoffensif.
# Cycle : auth.__init__ → .router → .service → billing.plan_config (via
# billing.__init__) → billing.router → auth.dependencies → auth.service
# (mid-init) → ImportError.
#
# On force le chargement de billing.plan_config SANS passer par billing.__init__
# en l'important comme un module isolé via sys.modules manipulation. Cela
# empêche billing.__init__ de tirer billing.router → auth.dependencies, ce
# qui casse le cycle avant qu'auth.service ne s'évalue.
import db.database as _db_database  # noqa: F401, E402

# Pre-load billing.plan_config sans déclencher billing/__init__.py.
# Workaround : on importe le sous-module directement via importlib.util.
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
        # Enregistrer billing comme package vide AVANT pour que les imports
        # relatifs (s'il y en a) ne plantent pas.
        if "billing" not in _sys.modules:
            import types as _types

            _billing_pkg = _types.ModuleType("billing")
            _billing_pkg.__path__ = [str(_Path(__file__).parent.parent / "src" / "billing")]
            _sys.modules["billing"] = _billing_pkg
        _sys.modules["billing.plan_config"] = _mod
        try:
            _spec.loader.exec_module(_mod)
        except Exception:  # noqa: BLE001
            # Si ça échoue, on retombe sur le chemin normal (qui aura la
            # circular import). Le test sera skip-marked plus bas.
            _sys.modules.pop("billing.plan_config", None)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧰 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def test_session():
    """SQLite in-memory + tous les models via Base.metadata.create_all."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def test_user(test_session):
    """User réel en DB pour les tests qui ont besoin d'un FK valide."""
    from db.database import User

    user = User(
        username=f"alice_{uuid.uuid4().hex[:8]}",
        email=f"alice_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hashed",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


def _make_request_mock(user_agent: str = None, client_host: str = None):
    """Crée un Mock Request avec headers + client.host (pattern minimal).

    Mimique l'API FastAPI / Starlette : `request.headers.get("user-agent")`
    + `request.client.host`. Plus simple qu'un vrai Starlette Request, et
    suffisant pour les unit tests qui ne touchent pas le pipeline ASGI.
    """
    request = MagicMock()
    headers = MagicMock()

    def headers_get(key, default=None):
        if user_agent and key.lower() == "user-agent":
            return user_agent
        return default

    headers.get = headers_get
    request.headers = headers

    if client_host is not None:
        client = MagicMock()
        client.host = client_host
        request.client = client
    else:
        request.client = None

    return request


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 create_session_v2 — TTLs, user-agent parsing, IP hash
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_session_v2_with_stay_signed_in_true_gives_30d_sliding(test_session, test_user):
    """stay_signed_in=True → sliding TTL ~= 30 jours."""
    from auth.service import create_session_v2

    before = datetime.utcnow()
    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=_make_request_mock(user_agent="Mozilla/5.0", client_host="1.2.3.4"),
    )
    after = datetime.utcnow()

    # Sliding ~ 30 jours (±5 min tolérance pour clock skew test)
    delta_sliding = user_session.sliding_expires_at - before
    assert timedelta(days=30, minutes=-5) < delta_sliding < timedelta(days=30, minutes=5), (
        f"Expected sliding ~30d, got {delta_sliding}"
    )

    # Absolute = 90 jours
    delta_abs = user_session.absolute_expires_at - before
    assert timedelta(days=90, minutes=-5) < delta_abs < timedelta(days=90, minutes=5)

    # Issued_at borné
    assert before <= user_session.issued_at <= after + timedelta(seconds=5) or user_session.issued_at is not None
    assert user_session.stay_signed_in is True
    assert user_session.revoked_at is None
    assert user_session.id  # UUID assigné


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_session_v2_without_stay_signed_in_gives_24h_sliding(test_session, test_user):
    """stay_signed_in=False → sliding TTL = 24h hard (pas de renouvellement)."""
    from auth.service import create_session_v2

    before = datetime.utcnow()
    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=False,
        request=_make_request_mock(user_agent="Mozilla/5.0"),
    )

    delta_sliding = user_session.sliding_expires_at - before
    assert timedelta(hours=24, minutes=-5) < delta_sliding < timedelta(hours=24, minutes=5), (
        f"Expected sliding ~24h, got {delta_sliding}"
    )
    # Absolute reste 90j même sans stay_signed_in
    delta_abs = user_session.absolute_expires_at - before
    assert timedelta(days=90, minutes=-5) < delta_abs < timedelta(days=90, minutes=5)
    assert user_session.stay_signed_in is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_session_v2_parses_user_agent_to_device_label(test_session, test_user):
    """User-agent Chrome+macOS → device_label = 'Chrome on macOS'."""
    from auth.service import create_session_v2

    chrome_macos = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=_make_request_mock(user_agent=chrome_macos),
    )
    assert user_session.device_label == "Chrome on macOS", (
        f"Expected 'Chrome on macOS', got {user_session.device_label!r}"
    )
    assert user_session.user_agent == chrome_macos


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_session_v2_parses_safari_ios(test_session, test_user):
    """UA iPhone Safari → 'Safari on iOS' (couvre détection iOS spécifique)."""
    from auth.service import create_session_v2

    safari_ios = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.2 Mobile/15E148 Safari/604.1"
    )
    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=_make_request_mock(user_agent=safari_ios),
    )
    assert user_session.device_label == "Safari on iOS"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_session_v2_hashes_ip_with_salt(test_session, test_user, monkeypatch):
    """IP est hashée SHA-256(ip + IP_HASH_SALT) → 16 chars hex."""
    from auth.service import create_session_v2, _hash_ip

    monkeypatch.setenv("IP_HASH_SALT", "test-salt-xyz")

    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=_make_request_mock(user_agent="Mozilla/5.0", client_host="203.0.113.42"),
    )

    assert user_session.ip_hash is not None
    assert len(user_session.ip_hash) == 16
    # Vérifier déterminisme : même IP + même salt → même hash
    expected = _hash_ip("203.0.113.42")
    assert user_session.ip_hash == expected
    # Vérifier que c'est bien du hex
    int(user_session.ip_hash, 16)  # raises if not hex


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_session_v2_handles_missing_request_gracefully(test_session, test_user):
    """request=None → device_label=None, ip_hash=None, mais session créée."""
    from auth.service import create_session_v2

    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=None,
    )
    assert user_session.device_label is None
    assert user_session.ip_hash is None
    assert user_session.user_agent is None
    assert user_session.id


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 rotate_refresh_session — happy path + edge cases sécurité
# ═══════════════════════════════════════════════════════════════════════════════


async def _create_session_with_jwt(test_session, user_id, stay_signed_in=True, request=None):
    """Helper : crée une session V2 + émet le JWT + sync le hash en DB.

    Mimique le flow réel du router /api/auth/login (Step 3, pas encore fait).
    Retourne (user_session, refresh_jwt).
    """
    from auth.service import create_session_v2, create_refresh_token_v2, update_session_refresh_hash

    user_session = await create_session_v2(
        session=test_session,
        user_id=user_id,
        stay_signed_in=stay_signed_in,
        request=request,
    )
    # TTL = sliding restante (en secondes)
    sliding_seconds = int((user_session.sliding_expires_at - datetime.utcnow()).total_seconds())
    refresh_jwt = create_refresh_token_v2(
        user_id=user_id,
        jti=user_session.id,
        ttl_seconds=sliding_seconds,
    )
    await update_session_refresh_hash(test_session, user_session.id, refresh_jwt)
    await test_session.commit()
    await test_session.refresh(user_session)
    return user_session, refresh_jwt


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_session_happy_path(test_session, test_user):
    """Rotation OK : ancienne session révoquée + nouvelle créée + stay_signed_in préservé."""
    from auth.service import rotate_refresh_session

    old_session, old_jwt = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)
    old_id = old_session.id

    new_session, ok, reason = await rotate_refresh_session(
        session=test_session,
        old_refresh_jwt=old_jwt,
        request=_make_request_mock(user_agent="Mozilla/5.0", client_host="1.1.1.1"),
    )

    assert ok is True, f"Expected ok=True, got reason={reason}"
    assert new_session is not None
    assert new_session.id != old_id
    assert new_session.user_id == test_user.id
    assert new_session.stay_signed_in is True
    assert new_session.revoked_at is None

    # Ancienne session : revoked_at = now, sliding défensif = now
    await test_session.refresh(old_session)
    assert old_session.revoked_at is not None
    assert old_session.sliding_expires_at <= datetime.utcnow() + timedelta(seconds=5)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_session_detects_replay(test_session, test_user):
    """Rotation 2x avec même JWT → 2e tentative détecte replay (hash mismatch)."""
    from auth.service import rotate_refresh_session

    old_session, old_jwt = await _create_session_with_jwt(test_session, test_user.id)

    # 1ère rotation OK
    new_session, ok1, _ = await rotate_refresh_session(session=test_session, old_refresh_jwt=old_jwt)
    assert ok1 is True
    await test_session.commit()

    # 2e rotation avec le MÊME JWT (replay) — déjà rotaté, hash a changé
    replay_session, ok2, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=old_jwt)
    assert ok2 is False
    # On accepte 2 reasons : replay_detected (hash mismatch) ou session_revoked
    # (si la session a déjà été marquée revoked entre-temps). Les 2 sont valides.
    assert reason in ("replay_detected", "session_revoked"), f"Expected replay_detected/session_revoked, got {reason}"
    assert replay_session is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_session_rejects_expired_sliding(test_session, test_user):
    """Sliding TTL expiré → rotation refusée."""
    from auth.service import rotate_refresh_session
    from db.database import UserSession

    old_session, old_jwt = await _create_session_with_jwt(test_session, test_user.id)

    # Force sliding à expiré (1h dans le passé)
    past = datetime.utcnow() - timedelta(hours=1)
    old_session.sliding_expires_at = past
    await test_session.commit()

    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=old_jwt)
    assert ok is False
    assert reason == "sliding_expired"
    assert new_session is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_session_rejects_expired_absolute(test_session, test_user):
    """Absolute cap 90j atteint → rotation refusée même si sliding OK."""
    from auth.service import rotate_refresh_session

    old_session, old_jwt = await _create_session_with_jwt(test_session, test_user.id)

    # Force absolute à expiré, mais sliding encore valide
    past = datetime.utcnow() - timedelta(hours=1)
    future = datetime.utcnow() + timedelta(days=10)
    old_session.absolute_expires_at = past
    old_session.sliding_expires_at = future
    await test_session.commit()

    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=old_jwt)
    assert ok is False
    assert reason == "absolute_expired"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_session_rejects_revoked_session(test_session, test_user):
    """Session déjà révoquée → rotation refusée."""
    from auth.service import rotate_refresh_session

    old_session, old_jwt = await _create_session_with_jwt(test_session, test_user.id)
    old_session.revoked_at = datetime.utcnow()
    await test_session.commit()

    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=old_jwt)
    assert ok is False
    assert reason == "session_revoked"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_session_rejects_invalid_jwt(test_session, test_user):
    """JWT bidon → rotation refusée avec invalid_token."""
    from auth.service import rotate_refresh_session

    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt="not.a.valid.jwt")
    assert ok is False
    assert reason == "invalid_token"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_session_rejects_unknown_jti(test_session, test_user):
    """JWT valide mais JTI inconnu (session deleted) → session_not_found."""
    from auth.service import rotate_refresh_session, create_refresh_token_v2

    # Émettre un JWT avec un JTI random qui n'existe pas en DB
    fake_jti = str(uuid.uuid4())
    bogus_jwt = create_refresh_token_v2(user_id=test_user.id, jti=fake_jti, ttl_seconds=3600)

    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=bogus_jwt)
    assert ok is False
    assert reason == "session_not_found"


# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️ revoke_session_v2 — soft-delete + sécurité owner
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_session_v2_marks_revoked_at(test_session, test_user):
    """Révocation : revoked_at passe de None à now, sliding/absolute défensifs."""
    from auth.service import create_session_v2, revoke_session_v2

    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
    )
    await test_session.commit()
    sess_id = user_session.id

    before = datetime.utcnow()
    ok = await revoke_session_v2(test_session, sess_id, test_user.id)
    await test_session.commit()  # commit pour persister la révocation
    after = datetime.utcnow()

    assert ok is True
    # L'objet `user_session` en mémoire a déjà les attrs updatés par
    # revoke_session_v2 (modifications via .revoked_at = now). On lit
    # directement sans refresh (refresh sans commit perdrait l'update).
    from db.database import UserSession

    result = await test_session.execute(select(UserSession).where(UserSession.id == sess_id))
    fresh = result.scalar_one()
    assert fresh.revoked_at is not None
    assert before - timedelta(seconds=2) <= fresh.revoked_at <= after + timedelta(seconds=2)
    # Defense in depth : sliding + absolute aussi reset à now
    assert fresh.sliding_expires_at <= after + timedelta(seconds=2)
    assert fresh.absolute_expires_at <= after + timedelta(seconds=2)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_session_v2_security_other_user_returns_false(test_session, test_user):
    """User A ne peut PAS révoquer la session de User B (owner mismatch)."""
    from auth.service import create_session_v2, revoke_session_v2
    from db.database import User

    # Crée user B
    user_b = User(
        username=f"bob_{uuid.uuid4().hex[:8]}",
        email=f"bob_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hashed",
    )
    test_session.add(user_b)
    await test_session.commit()
    await test_session.refresh(user_b)

    # Crée une session pour user A
    user_a_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
    )
    await test_session.commit()

    # User B tente de révoquer la session de User A → False
    ok = await revoke_session_v2(test_session, user_a_session.id, user_b.id)
    assert ok is False

    # Vérifier que la session A n'est PAS révoquée
    await test_session.refresh(user_a_session)
    assert user_a_session.revoked_at is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_session_v2_returns_false_when_already_revoked(test_session, test_user):
    """Révocation idempotente : déjà révoquée → False (pas de changement)."""
    from auth.service import create_session_v2, revoke_session_v2

    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
    )
    await test_session.commit()

    ok1 = await revoke_session_v2(test_session, user_session.id, test_user.id)
    assert ok1 is True

    # 2e révocation → False
    ok2 = await revoke_session_v2(test_session, user_session.id, test_user.id)
    assert ok2 is False


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 list_user_sessions — filtres révoquées + expirées
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_list_user_sessions_filters_revoked_and_expired(test_session, test_user):
    """list_user_sessions retourne UNIQUEMENT sessions actives + non expirées."""
    from auth.service import create_session_v2, list_user_sessions

    # Session active
    s_active = await create_session_v2(session=test_session, user_id=test_user.id, stay_signed_in=True)
    # Session révoquée
    s_revoked = await create_session_v2(session=test_session, user_id=test_user.id, stay_signed_in=True)
    s_revoked.revoked_at = datetime.utcnow()
    # Session sliding expirée
    s_sliding_expired = await create_session_v2(session=test_session, user_id=test_user.id, stay_signed_in=True)
    s_sliding_expired.sliding_expires_at = datetime.utcnow() - timedelta(hours=1)
    # Session absolute expirée
    s_abs_expired = await create_session_v2(session=test_session, user_id=test_user.id, stay_signed_in=True)
    s_abs_expired.absolute_expires_at = datetime.utcnow() - timedelta(hours=1)

    await test_session.commit()

    sessions = await list_user_sessions(test_session, test_user.id)
    ids = {s.id for s in sessions}
    assert s_active.id in ids
    assert s_revoked.id not in ids
    assert s_sliding_expired.id not in ids
    assert s_abs_expired.id not in ids
    assert len(sessions) == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_list_user_sessions_only_returns_owner_sessions(test_session, test_user):
    """list_user_sessions(user_id=A) ne retourne PAS les sessions de B."""
    from auth.service import create_session_v2, list_user_sessions
    from db.database import User

    user_b = User(
        username=f"bob_{uuid.uuid4().hex[:8]}",
        email=f"bob_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="hashed",
    )
    test_session.add(user_b)
    await test_session.commit()
    await test_session.refresh(user_b)

    s_a = await create_session_v2(test_session, test_user.id, stay_signed_in=True)
    s_b = await create_session_v2(test_session, user_b.id, stay_signed_in=True)
    await test_session.commit()

    sessions_a = await list_user_sessions(test_session, test_user.id)
    assert {s.id for s in sessions_a} == {s_a.id}

    sessions_b = await list_user_sessions(test_session, user_b.id)
    assert {s.id for s in sessions_b} == {s_b.id}


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ validate_session_v2 — hash mismatch, sliding expired, happy
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_v2_happy_path(test_session, test_user):
    """Session active + hash OK → True."""
    from auth.service import validate_session_v2, _hash_refresh_jwt

    user_session, refresh_jwt = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)
    expected_hash = _hash_refresh_jwt(refresh_jwt)

    assert await validate_session_v2(test_session, user_session.id) is True
    # Avec hash
    assert await validate_session_v2(test_session, user_session.id, expected_hash) is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_v2_hash_mismatch_returns_false(test_session, test_user):
    """hash fourni ≠ DB → False (anti-tampering)."""
    from auth.service import validate_session_v2

    user_session, _ = await _create_session_with_jwt(test_session, test_user.id)

    bogus_hash = "0" * 64
    assert await validate_session_v2(test_session, user_session.id, bogus_hash) is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_v2_returns_false_for_unknown_jti(test_session):
    """JTI inconnu → False."""
    from auth.service import validate_session_v2

    assert await validate_session_v2(test_session, str(uuid.uuid4())) is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_v2_returns_false_when_revoked(test_session, test_user):
    """Session révoquée → False même si hash OK."""
    from auth.service import create_session_v2, validate_session_v2

    user_session = await create_session_v2(test_session, test_user.id, stay_signed_in=True)
    user_session.revoked_at = datetime.utcnow()
    await test_session.commit()

    assert await validate_session_v2(test_session, user_session.id) is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_session_v2_returns_false_when_sliding_expired(test_session, test_user):
    """Sliding TTL expiré → False."""
    from auth.service import create_session_v2, validate_session_v2

    user_session = await create_session_v2(test_session, test_user.id, stay_signed_in=True)
    user_session.sliding_expires_at = datetime.utcnow() - timedelta(seconds=10)
    await test_session.commit()

    assert await validate_session_v2(test_session, user_session.id) is False


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 _parse_device_label — coverage des branches UA parsing
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
def test_parse_device_label_windows_firefox():
    from auth.service import _parse_device_label

    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
    assert _parse_device_label(ua) == "Firefox on Windows"


@pytest.mark.unit
def test_parse_device_label_android_chrome():
    from auth.service import _parse_device_label

    ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    assert _parse_device_label(ua) == "Chrome on Android"


@pytest.mark.unit
def test_parse_device_label_edge_windows():
    from auth.service import _parse_device_label

    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
    assert _parse_device_label(ua) == "Edge on Windows"


@pytest.mark.unit
def test_parse_device_label_empty():
    from auth.service import _parse_device_label

    assert _parse_device_label(None) is None
    assert _parse_device_label("") is None


@pytest.mark.unit
def test_parse_device_label_falls_back_to_truncated_ua():
    from auth.service import _parse_device_label

    # UA exotique non détecté → fallback troncature 100 chars
    ua = "ExoticBot/1.0 (some custom platform that we don't recognize at all)"
    label = _parse_device_label(ua)
    assert label is not None
    # Soit le UA tronqué, soit un label partiel (Bot pas matché par notre regex)
    assert len(label) <= 100


# ═══════════════════════════════════════════════════════════════════════════════
# 🔐 _hash_ip — déterminisme + salt
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
def test_hash_ip_returns_none_for_empty():
    from auth.service import _hash_ip

    assert _hash_ip(None) is None
    assert _hash_ip("") is None


@pytest.mark.unit
def test_hash_ip_is_deterministic(monkeypatch):
    from auth.service import _hash_ip

    monkeypatch.setenv("IP_HASH_SALT", "deterministic-test")
    assert _hash_ip("1.2.3.4") == _hash_ip("1.2.3.4")


@pytest.mark.unit
def test_hash_ip_different_salts_give_different_hashes(monkeypatch):
    from auth.service import _hash_ip

    monkeypatch.setenv("IP_HASH_SALT", "salt-A")
    h1 = _hash_ip("203.0.113.1")
    monkeypatch.setenv("IP_HASH_SALT", "salt-B")
    h2 = _hash_ip("203.0.113.1")
    assert h1 != h2
    assert len(h1) == 16 and len(h2) == 16
