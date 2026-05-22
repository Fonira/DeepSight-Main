"""Tests Auth V2 étendus — Wave 1 Step 6 (2026-05-21).

Coverage additionnelle pour `auth/service.py` + audit logging :

- Sliding refresh : extension via rotation, cap absolute.
- Absolute cap : 90j pour stay_signed_in, 24h sliding pour !stay_signed_in.
- Revoke : effet immédiat sur l'ancien refresh, "revoke all others" ne touche
  pas la session courante.
- Grace period (V1 cutover) : tests marqués SKIPPED tant que Step 4
  (parallèle) n'a pas mergé le feature flag AUTH_V2_ENABLED + grace window.
- Audit logs : verify que les actions `auth.session_created`,
  `auth.refresh_rotated`, `auth.refresh_replay_detected`,
  `auth.reauth_failed_wrong_password`, `auth.session_revoked` sont
  effectivement persistées dans `audit_logs`.
- Rotation single-use : blocklist Redis du JTI ancien + rejet d'un replay.

Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §2 + §4.4.

Stratégie : SQLite in-memory + fakeredis (héritage tests existants Sprint C
+ test_auth_service_v2.py / test_auth_sessions_endpoint.py / test_auth_reauth.py).
"""

import os
import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Env defaults pour import safety
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")


# ⚠️ Workaround circular import (pattern identique aux tests V2 existants).
# Cycle : auth.__init__ → .router → .service → billing.plan_config (via
# billing.__init__) → billing.router → auth.dependencies → auth.service
# (mid-init) → ImportError. On force le chargement de billing.plan_config
# SANS passer par billing.__init__.
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
    """SQLite in-memory engine partagé."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    """Session SQLAlchemy de test."""
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


def _make_request_mock(user_agent: str = None, client_host: str = None):
    """Mock Request avec headers + client.host minimal."""
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


async def _create_session_with_jwt(test_session, user_id, stay_signed_in=True, request=None):
    """Helper : crée session V2 + émet JWT + sync hash en DB.

    Mimique le flow du futur /api/auth/login (Step 3 fait, branchage Step 4).
    """
    from auth.service import create_session_v2, create_refresh_token_v2, update_session_refresh_hash

    user_session = await create_session_v2(
        session=test_session,
        user_id=user_id,
        stay_signed_in=stay_signed_in,
        request=request,
    )
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


async def _count_audit_logs(test_session, action: str = None, user_id: int = None) -> int:
    """Helper : compte les audit_logs filtrés par action / user_id."""
    from db.database import AuditLog

    query = select(AuditLog)
    if action is not None:
        query = query.where(AuditLog.action == action)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    result = await test_session.execute(query)
    return len(list(result.scalars().all()))


async def _fetch_audit_logs(test_session, action: str = None, user_id: int = None) -> list:
    """Helper : récupère les audit_logs filtrés."""
    from db.database import AuditLog

    query = select(AuditLog)
    if action is not None:
        query = query.where(AuditLog.action == action)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    result = await test_session.execute(query)
    return list(result.scalars().all())


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 Sliding refresh — extension via rotation, cap absolute
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sliding_refresh_extends_expiry(test_session, test_user):
    """Rotation multiples → chaque nouvelle session a un sliding_expires_at
    repoussé dans le futur (mécanisme « keep signed in » roulant).

    Concept : à chaque /api/auth/refresh, la nouvelle session a un sliding TTL
    fresh (30j à partir de now). L'ancienne est révoquée → on observe que les
    rotations successives augmentent monotone le sliding_expires_at.
    """
    from auth.service import rotate_refresh_session

    # 1ère session
    s1, jwt1 = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)
    sliding1 = s1.sliding_expires_at

    # 1ère rotation
    s2, ok, _ = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    await test_session.commit()
    assert ok is True
    sliding2 = s2.sliding_expires_at

    # Sliding 2 doit être >= sliding 1 (rotation = nouveau sliding fresh).
    # En pratique strictly greater car create_session_v2 utilise now() au
    # moment du flush qui est > now() du test précédent.
    assert sliding2 >= sliding1, f"Expected sliding2 ({sliding2}) >= sliding1 ({sliding1})"

    # 2e rotation : récupérer le JWT fresh émis par s2
    from auth.service import create_refresh_token_v2, update_session_refresh_hash

    ttl = int((s2.sliding_expires_at - datetime.utcnow()).total_seconds())
    jwt2 = create_refresh_token_v2(user_id=test_user.id, jti=s2.id, ttl_seconds=ttl)
    await update_session_refresh_hash(test_session, s2.id, jwt2)
    await test_session.commit()

    s3, ok, _ = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt2)
    await test_session.commit()
    assert ok is True
    sliding3 = s3.sliding_expires_at
    assert sliding3 >= sliding2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sliding_refresh_capped_by_absolute(test_session, test_user):
    """Impossible de dépasser absolute_expires_at via rotations multiples.

    Setup : on crée une session, on force absolute à un point très proche
    (5s dans le futur), on attend un peu, on tente une rotation → expire.
    Et on confirme que tout rotation après ce moment échoue.
    """
    from auth.service import rotate_refresh_session

    s1, jwt1 = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)

    # Force absolute dans le passé (déjà atteint)
    s1.absolute_expires_at = datetime.utcnow() - timedelta(seconds=1)
    await test_session.commit()

    # Rotation refusée car absolute_expired (sliding encore valide).
    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    assert ok is False
    assert reason == "absolute_expired"


# ═══════════════════════════════════════════════════════════════════════════════
# ⏰ Absolute cap — TTLs selon stay_signed_in
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_absolute_expires_at_90d_for_stay_signed_in(test_session, test_user):
    """stay_signed_in=True → absolute_expires_at ~ 90 jours."""
    from auth.service import create_session_v2

    before = datetime.utcnow()
    s = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=None,
    )

    delta_abs = s.absolute_expires_at - before
    assert timedelta(days=90, minutes=-5) < delta_abs < timedelta(days=90, minutes=5), (
        f"Expected absolute ~90d, got {delta_abs}"
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_absolute_expires_at_24h_sliding_for_no_stay_signed_in(test_session, test_user):
    """stay_signed_in=False → sliding 24h hard (absolute 90j toujours, mais
    sliding dicte la vraie expiration).

    Spec §4.2 : sans `stay_signed_in`, le sliding TTL=24h ne sera pas étendu
    par rotation (cf test_sliding_refresh_extends_expiry pour le mécanisme
    inverse). Ici on assert juste le boundary initial 24h.
    """
    from auth.service import create_session_v2

    before = datetime.utcnow()
    s = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=False,
        request=None,
    )

    delta_sliding = s.sliding_expires_at - before
    assert timedelta(hours=24, minutes=-5) < delta_sliding < timedelta(hours=24, minutes=5)

    # Absolute reste 90j même sans stay_signed_in (le cap n'est pas raccourci).
    delta_abs = s.absolute_expires_at - before
    assert timedelta(days=90, minutes=-5) < delta_abs < timedelta(days=90, minutes=5)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗑️ Revoke — effets immédiats
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_session_then_use_old_refresh_returns_401_equivalent(test_session, test_user):
    """Après revoke_session_v2, tenter rotate_refresh_session avec l'ancien
    JWT retourne (False, "session_revoked") — l'équivalent d'un 401 côté
    endpoint /api/auth/refresh.
    """
    from auth.service import revoke_session_v2, rotate_refresh_session

    s1, jwt1 = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)

    # Révoque la session
    ok_revoke = await revoke_session_v2(test_session, s1.id, test_user.id)
    await test_session.commit()
    assert ok_revoke is True

    # Tenter une rotation avec l'ancien JWT → refusé
    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    assert ok is False
    assert reason == "session_revoked"
    assert new_session is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_all_others_keeps_current_alive(test_session, test_user):
    """Le pattern « Sign out everywhere else » (router /api/auth/sessions
    DELETE) révoque toutes les sessions sauf celle dont l'id == jti courant.

    Ici on simule directement le pattern côté service (router already covered
    by test_auth_sessions_endpoint.py — ici on isole la logique de filtrage).
    """
    from auth.service import create_session_v2, list_user_sessions, revoke_session_v2

    # 3 sessions actives
    s_current = await create_session_v2(test_session, test_user.id, stay_signed_in=True)
    s_other_1 = await create_session_v2(test_session, test_user.id, stay_signed_in=True)
    s_other_2 = await create_session_v2(test_session, test_user.id, stay_signed_in=True)
    await test_session.commit()
    current_id = s_current.id

    # Liste + révoque toutes les non-current
    sessions = await list_user_sessions(test_session, test_user.id)
    revoked = 0
    for s in sessions:
        if s.id == current_id:
            continue
        if await revoke_session_v2(test_session, s.id, test_user.id):
            revoked += 1
    await test_session.commit()

    assert revoked == 2

    # Verifier état final via lookup fresh
    from db.database import UserSession

    res = await test_session.execute(select(UserSession).where(UserSession.user_id == test_user.id))
    all_sessions = list(res.scalars().all())
    by_id = {s.id: s for s in all_sessions}
    assert by_id[current_id].revoked_at is None
    assert by_id[s_other_1.id].revoked_at is not None
    assert by_id[s_other_2.id].revoked_at is not None


# ═══════════════════════════════════════════════════════════════════════════════
# ⏳ Grace period (V1 → V2 cutover) — SKIPPED pending Step 4 merge
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.skip(reason="Grace period flow lives in Step 4 (verify_token V2 branching). Will land when Step 4 merges.")
async def test_grace_period_30d_after_cutover_accepts_legacy_tokens():
    """Pendant les 30 jours suivant le cutover AUTH_V2_ENABLED, les tokens
    legacy V1 (avec claim `session` au lieu de `jti`) doivent toujours être
    acceptés via le flow legacy `validate_session_token`.

    Test reportés à Step 4 — c'est lui qui ajoute la branche verify_token V2
    avec fallback legacy. Notre Step 6 ne touche pas verify_token.
    """
    pass


@pytest.mark.unit
@pytest.mark.skip(reason="Grace period flow lives in Step 4. Cf comment ci-dessus.")
async def test_grace_period_expired_legacy_token_rejected():
    """Après expiration de la grace window (config GRACE_PERIOD_DAYS), un
    token legacy V1 doit être rejeté (force re-login pour passer en V2)."""
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 Audit logs — branchements service.py + reauth router
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_session_writes_audit_log(test_session, test_user):
    """create_session_v2 écrit un audit_log action="auth.session_created"."""
    from auth.service import create_session_v2

    s = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=_make_request_mock(user_agent="Mozilla/5.0", client_host="1.2.3.4"),
    )
    await test_session.commit()

    logs = await _fetch_audit_logs(test_session, action="auth.session_created", user_id=test_user.id)
    assert len(logs) == 1, f"Expected 1 audit_log entry, got {len(logs)}"
    entry = logs[0]
    assert entry.user_id == test_user.id
    assert entry.action == "auth.session_created"
    # details JSON contient session_id + stay_signed_in
    assert entry.details is not None
    assert entry.details.get("session_id") == s.id
    assert entry.details.get("stay_signed_in") is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotate_refresh_writes_audit_log(test_session, test_user):
    """rotate_refresh_session écrit `auth.refresh_rotated` (succès)."""
    from auth.service import rotate_refresh_session

    s1, jwt1 = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)

    # Reset audit logs créés par _create_session_with_jwt (auth.session_created)
    # — on veut compter SEULEMENT les nouveaux après rotation.
    # En pratique on filtre par action donc pas besoin de reset.

    new_session, ok, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    await test_session.commit()
    assert ok is True

    # Doit avoir un `auth.refresh_rotated` pour le user.
    rotated_logs = await _fetch_audit_logs(test_session, action="auth.refresh_rotated", user_id=test_user.id)
    assert len(rotated_logs) == 1
    entry = rotated_logs[0]
    assert entry.details.get("session_id") == new_session.id
    assert entry.details.get("old_session_id") == s1.id

    # ET un `auth.session_created` pour la NOUVELLE session.
    created_logs = await _fetch_audit_logs(test_session, action="auth.session_created", user_id=test_user.id)
    # 2 : 1 pour s1 (créé par _create_session_with_jwt) + 1 pour new_session.
    assert len(created_logs) == 2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_replay_attack_writes_security_audit_log(test_session, test_user):
    """Replay détecté → audit_log SECURITY action="auth.refresh_replay_detected"."""
    from auth.service import rotate_refresh_session

    s1, jwt1 = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)

    # 1ère rotation OK
    new_session, ok1, _ = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    assert ok1 is True
    await test_session.commit()

    # 2e rotation avec le MÊME JWT (replay) — hash mismatch → SECURITY EVENT
    replay_session, ok2, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    await test_session.commit()
    assert ok2 is False
    # On accepte les 2 reasons légitimes : replay_detected (hash mismatch
    # détecté en step 3) ou session_revoked (si Step 4 = check revoked_at
    # arrive avant). Les 2 indiquent un security event tracé en audit.
    assert reason in ("replay_detected", "session_revoked")

    # Audit log : replay_detected ou refresh_expired (selon path)
    replay_logs = await _fetch_audit_logs(
        test_session, action="auth.refresh_replay_detected", user_id=test_user.id
    )
    expired_logs = await _fetch_audit_logs(test_session, action="auth.refresh_expired", user_id=test_user.id)
    # Au moins un des deux doit être présent (la 2e tentative trace soit replay
    # soit refresh_expired:session_revoked).
    assert len(replay_logs) + len(expired_logs) >= 1, (
        f"Expected at least one replay/refresh_expired audit. "
        f"replay_logs={len(replay_logs)} expired_logs={len(expired_logs)}"
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reauth_failed_password_writes_security_audit_log(test_engine, test_user):
    """POST /api/auth/reauth avec wrong password écrit
    `auth.reauth_failed_wrong_password` (SECURITY pour brute-force detection)."""
    from httpx import ASGITransport, AsyncClient
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

    try:
        async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as c:
            resp = await c.post(
                "/api/auth/reauth",
                json={"password": "wrongpassword", "audience": "billing"},
            )
        assert resp.status_code == 401
        assert resp.json()["detail"] == "REAUTH_WRONG_PASSWORD"

        # L'endpoint a committé son audit log dans sa propre Session.
        # Lookup via une fresh session.
        async with SessionLocal() as fresh:
            logs = await _fetch_audit_logs(
                fresh, action="auth.reauth_failed_wrong_password", user_id=test_user.id
            )
            assert len(logs) >= 1, "Expected SECURITY audit log auth.reauth_failed_wrong_password"
            entry = logs[0]
            assert entry.details.get("reason") == "wrong_password"
            assert entry.details.get("audience") == "billing"
    finally:
        fastapi_app.dependency_overrides.clear()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_session_writes_audit_log(test_session, test_user):
    """revoke_session_v2 écrit `auth.session_revoked`."""
    from auth.service import create_session_v2, revoke_session_v2

    s = await create_session_v2(test_session, test_user.id, stay_signed_in=True)
    await test_session.commit()

    ok = await revoke_session_v2(test_session, s.id, test_user.id)
    await test_session.commit()
    assert ok is True

    logs = await _fetch_audit_logs(test_session, action="auth.session_revoked", user_id=test_user.id)
    assert len(logs) == 1
    entry = logs[0]
    assert entry.details.get("session_id") == s.id
    assert entry.details.get("revoked_by") == "user"


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 Rotation single-use — blocklist Redis du JTI ancien
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rotation_marks_old_jti_in_blocklist(test_session, test_user, monkeypatch):
    """rotate_refresh_session ajoute l'ancien JWT à la blocklist via
    `core.security.blacklist_token`. On mock blacklist_token pour observer."""
    from auth.service import rotate_refresh_session

    s1, jwt1 = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)

    # Mock blacklist_token pour observer l'appel
    blacklist_calls = []

    async def fake_blacklist(token, expiry_seconds=None):
        blacklist_calls.append((token, expiry_seconds))

    import core.security as _security

    monkeypatch.setattr(_security, "blacklist_token", fake_blacklist)

    new_session, ok, _ = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    await test_session.commit()
    assert ok is True

    # Verify blacklist_token a été appelé avec l'ancien JWT
    assert len(blacklist_calls) == 1, f"Expected 1 blacklist call, got {len(blacklist_calls)}"
    blacklisted_token, ttl = blacklist_calls[0]
    assert blacklisted_token == jwt1
    assert ttl is not None and ttl > 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_replay_old_refresh_after_rotation_rejected(test_session, test_user):
    """Reuse explicit du même JWT 2x → 2e tentative rejetée
    (hash mismatch en DB OU session révoquée via defense-in-depth)."""
    from auth.service import rotate_refresh_session

    s1, jwt1 = await _create_session_with_jwt(test_session, test_user.id, stay_signed_in=True)

    # 1ère rotation OK
    new_session, ok1, _ = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    await test_session.commit()
    assert ok1 is True

    # 2e tentative avec le même JWT
    replay, ok2, reason = await rotate_refresh_session(session=test_session, old_refresh_jwt=jwt1)
    assert ok2 is False
    assert replay is None
    # 2 reasons légitimes — cf test_rotate_refresh_session_detects_replay
    # dans test_auth_service_v2.py (même rationale).
    assert reason in ("replay_detected", "session_revoked")
