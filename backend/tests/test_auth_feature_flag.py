"""Tests Auth V2 — feature flag bucketing + cutover + dependency routing.

Wave 1 Step 4 (2026-05-21) — couvre :
- is_user_in_auth_v2_bucket : disabled, 100%, 0%, déterminisme, distribution
  ~50% sur 1000 users.
- verify_token_with_flow : décide V1 (pre-cutover ou hors bucket) vs V2
  (post-cutover ET in-bucket).
- get_current_user : route correctement via le flow décidé par feature_flag.

Spec : 01-Projects/DeepSight/Specs/2026-05-21-auth-v2-complet-design.md §4.5.

Stratégie test : monkeypatch direct sur `core.config.AUTH_V2_*` (lus
dynamiquement par feature_flags via `_core_config`, pas import figé) +
SQLite in-memory pour les tests qui touchent les sessions.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Env defaults pour import safety (mêmes que test_auth_service_v2.py).
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")


# ⚠️ Workaround circular import (pattern identique à test_auth_service_v2.py et
# test_auth_sessions_endpoint.py). Cycle :
#   auth.__init__ → .router → .service → billing.plan_config (via billing.__init__)
#   → billing.router → auth.dependencies → auth.service (mid-init) → ImportError.
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
# 🧰 FIXTURES & HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def _reset_flag_defaults(monkeypatch):
    """Reset les flags à leurs valeurs par défaut (disabled) avant chaque test.

    Évite la fuite d'état entre tests qui activent le flag différemment.
    """
    import core.config as _cfg

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", False, raising=False)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 0, raising=False)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "", raising=False)
    monkeypatch.setattr(_cfg, "AUTH_V2_GRACE_PERIOD_DAYS", 30, raising=False)
    yield


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


# ═══════════════════════════════════════════════════════════════════════════════
# 🚩 is_user_in_auth_v2_bucket
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
def test_is_user_in_auth_v2_bucket_disabled_returns_false(_reset_flag_defaults, monkeypatch):
    """AUTH_V2_ENABLED=false → False même si bucket=100."""
    import core.config as _cfg
    from auth.feature_flags import is_user_in_auth_v2_bucket

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", False)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)

    for uid in (1, 42, 999, 1_000_000):
        assert is_user_in_auth_v2_bucket(uid) is False


@pytest.mark.unit
def test_is_user_in_auth_v2_bucket_100_percent_returns_true(_reset_flag_defaults, monkeypatch):
    """ENABLED + bucket=100 → True pour tout user_id."""
    import core.config as _cfg
    from auth.feature_flags import is_user_in_auth_v2_bucket

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)

    for uid in (1, 2, 42, 100, 999, 1_000_000, 1_234_567_890):
        assert is_user_in_auth_v2_bucket(uid) is True


@pytest.mark.unit
def test_is_user_in_auth_v2_bucket_0_percent_returns_false(_reset_flag_defaults, monkeypatch):
    """ENABLED + bucket=0 → False pour tout user_id."""
    import core.config as _cfg
    from auth.feature_flags import is_user_in_auth_v2_bucket

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 0)

    for uid in (1, 2, 42, 100, 999, 1_000_000):
        assert is_user_in_auth_v2_bucket(uid) is False


@pytest.mark.unit
def test_is_user_in_auth_v2_bucket_deterministic_same_user_same_result(_reset_flag_defaults, monkeypatch):
    """Même user → même réponse sur 5 appels successifs (pas de flip-flop)."""
    import core.config as _cfg
    from auth.feature_flags import is_user_in_auth_v2_bucket

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 50)

    # Stabilité sur plusieurs users à 50% (≈ moitié dans, moitié dehors)
    for uid in (1, 7, 13, 42, 100, 999):
        results = {is_user_in_auth_v2_bucket(uid) for _ in range(5)}
        assert len(results) == 1, f"user {uid} flip-flopped: {results}"


@pytest.mark.unit
def test_is_user_in_auth_v2_bucket_50_percent_distribution(_reset_flag_defaults, monkeypatch):
    """1000 users à 50% → ~500 in-bucket ±50 (tolerance 10%)."""
    import core.config as _cfg
    from auth.feature_flags import is_user_in_auth_v2_bucket

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 50)

    in_bucket = sum(1 for uid in range(1, 1001) if is_user_in_auth_v2_bucket(uid))
    # SHA-256 sur des int séquentiels donne une très bonne distribution ;
    # tolerance ±50 sur 1000 = ±10% est ultra-conservatrice.
    assert 450 <= in_bucket <= 550, f"Expected ~500 in-bucket, got {in_bucket}"


@pytest.mark.unit
def test_is_user_in_auth_v2_bucket_clamps_negative_percent(_reset_flag_defaults, monkeypatch):
    """AUTH_V2_BUCKET_PERCENT négatif est clampé à 0 (anti-erreur ops)."""
    import core.config as _cfg
    from auth.feature_flags import is_user_in_auth_v2_bucket

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", -5)

    for uid in (1, 42, 999):
        assert is_user_in_auth_v2_bucket(uid) is False


@pytest.mark.unit
def test_is_user_in_auth_v2_bucket_clamps_overflow_percent(_reset_flag_defaults, monkeypatch):
    """AUTH_V2_BUCKET_PERCENT > 100 est clampé à 100 (anti-erreur ops)."""
    import core.config as _cfg
    from auth.feature_flags import is_user_in_auth_v2_bucket

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 150)

    for uid in (1, 42, 999):
        assert is_user_in_auth_v2_bucket(uid) is True


# ═══════════════════════════════════════════════════════════════════════════════
# ⏰ Cutover date + grace period
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
def test_get_cutover_date_parses_iso_with_z(_reset_flag_defaults, monkeypatch):
    """'2026-05-22T00:00:00Z' parsé correctement en UTC."""
    import core.config as _cfg
    from auth.feature_flags import get_cutover_date

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "2026-05-22T00:00:00Z")
    dt = get_cutover_date()
    assert dt is not None
    assert dt.year == 2026
    assert dt.month == 5
    assert dt.day == 22
    assert dt.tzinfo is not None


@pytest.mark.unit
def test_get_cutover_date_parses_date_only(_reset_flag_defaults, monkeypatch):
    """Date seule '2026-05-22' → 00:00 UTC."""
    import core.config as _cfg
    from auth.feature_flags import get_cutover_date

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "2026-05-22")
    dt = get_cutover_date()
    assert dt is not None
    assert dt.year == 2026 and dt.month == 5 and dt.day == 22


@pytest.mark.unit
def test_get_cutover_date_empty_returns_none(_reset_flag_defaults, monkeypatch):
    """AUTH_V2_CUTOVER_DATE vide → None (pas de cutover défini)."""
    import core.config as _cfg
    from auth.feature_flags import get_cutover_date

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "")
    assert get_cutover_date() is None


@pytest.mark.unit
def test_get_cutover_date_invalid_returns_none(_reset_flag_defaults, monkeypatch):
    """AUTH_V2_CUTOVER_DATE bogus → None (log silencieux, pas de raise)."""
    import core.config as _cfg
    from auth.feature_flags import get_cutover_date

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "not-a-date")
    assert get_cutover_date() is None


@pytest.mark.unit
def test_is_token_pre_cutover_returns_true_for_old_iat(_reset_flag_defaults, monkeypatch):
    """Token émis 2j AVANT le cutover → pre-cutover=True."""
    import core.config as _cfg
    from auth.feature_flags import is_token_pre_cutover

    cutover_iso = "2026-05-22T00:00:00Z"
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", cutover_iso)

    cutover = datetime(2026, 5, 22, tzinfo=timezone.utc)
    old_iat = (cutover - timedelta(days=2)).timestamp()
    assert is_token_pre_cutover(old_iat) is True


@pytest.mark.unit
def test_is_token_pre_cutover_returns_false_for_new_iat(_reset_flag_defaults, monkeypatch):
    """Token émis APRÈS le cutover → pre-cutover=False."""
    import core.config as _cfg
    from auth.feature_flags import is_token_pre_cutover

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "2026-05-22T00:00:00Z")
    cutover = datetime(2026, 5, 22, tzinfo=timezone.utc)
    new_iat = (cutover + timedelta(hours=1)).timestamp()
    assert is_token_pre_cutover(new_iat) is False


@pytest.mark.unit
def test_is_token_pre_cutover_returns_false_when_no_cutover(_reset_flag_defaults, monkeypatch):
    """Pas de cutover configuré → toujours False (pas de discrimination)."""
    import core.config as _cfg
    from auth.feature_flags import is_token_pre_cutover

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "")
    old_iat = datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp()
    assert is_token_pre_cutover(old_iat) is False


@pytest.mark.unit
def test_is_in_grace_period_within_window(_reset_flag_defaults, monkeypatch):
    """now = cutover + 10j (dans la fenêtre 30j) → True."""
    import core.config as _cfg
    from auth.feature_flags import is_in_grace_period

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "2026-05-22T00:00:00Z")
    monkeypatch.setattr(_cfg, "AUTH_V2_GRACE_PERIOD_DAYS", 30)

    cutover = datetime(2026, 5, 22, tzinfo=timezone.utc)
    assert is_in_grace_period(now=cutover + timedelta(days=10)) is True
    assert is_in_grace_period(now=cutover + timedelta(days=29, hours=23)) is True


@pytest.mark.unit
def test_is_in_grace_period_after_window(_reset_flag_defaults, monkeypatch):
    """now = cutover + 31j → False (grace expirée)."""
    import core.config as _cfg
    from auth.feature_flags import is_in_grace_period

    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "2026-05-22T00:00:00Z")
    monkeypatch.setattr(_cfg, "AUTH_V2_GRACE_PERIOD_DAYS", 30)

    cutover = datetime(2026, 5, 22, tzinfo=timezone.utc)
    assert is_in_grace_period(now=cutover + timedelta(days=31)) is False


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 verify_token_with_flow — V1 legacy vs V2 routing
# ═══════════════════════════════════════════════════════════════════════════════


def _make_access_jwt(user_id: int, *, jti: str = None, iat: datetime = None, secret_key: str = None) -> str:
    """Forge un access JWT pour tester verify_token_with_flow.

    Utilise les mêmes claims que create_access_token_v2 (V2) ou create_access_token (V1).
    `exp` toujours fixé à now+1h indépendamment de `iat` (sinon les tokens
    « pre-cutover » avec iat ancien seraient déjà expirés et `verify_token`
    retournerait None avant qu'on teste le branching).

    Important : utilise le `JWT_CONFIG` importé dans `auth.service` (pas
    celui de `core.config` directement) pour éviter le mismatch quand un
    autre test (ex: test_pricing_v2) a fait `importlib.reload(core.config)`
    et invalidé la référence figée par auth.service au top du module.
    """
    import jwt as pyjwt
    import auth.service as _auth_service

    jwt_config = _auth_service.JWT_CONFIG
    secret_key = secret_key or jwt_config["SECRET_KEY"]
    now = datetime.now(timezone.utc)
    iat_value = iat or now
    payload = {
        "sub": str(user_id),
        "exp": now + timedelta(hours=1),
        "iat": iat_value,
        "type": "access",
        "is_admin": False,
    }
    if jti:
        payload["jti"] = jti
    return pyjwt.encode(payload, secret_key, algorithm=jwt_config["ALGORITHM"])


@pytest.mark.unit
def test_verify_token_with_flow_legacy_path_when_disabled(_reset_flag_defaults, monkeypatch):
    """AUTH_V2_ENABLED=false → flow toujours v1, même si jti présent."""
    from auth.service import verify_token_with_flow

    jwt_v2 = _make_access_jwt(user_id=42, jti=str(uuid.uuid4()))
    payload, flow = verify_token_with_flow(jwt_v2)
    assert payload is not None
    assert flow == "v1"


@pytest.mark.unit
def test_verify_token_with_flow_legacy_path_before_cutover(_reset_flag_defaults, monkeypatch):
    """User dans le bucket V2 MAIS token émis avant cutover ET dans grace period → V1."""
    import core.config as _cfg
    from auth.service import verify_token_with_flow

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)
    # Cutover fixé "maintenant" → tous les tokens avec iat ancien sont pre-cutover.
    now = datetime.now(timezone.utc)
    cutover = now - timedelta(hours=1)  # cutover il y a 1h
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", cutover.isoformat())
    monkeypatch.setattr(_cfg, "AUTH_V2_GRACE_PERIOD_DAYS", 30)

    # Token émis 2h avant maintenant → 1h avant cutover → pre-cutover.
    old_iat = now - timedelta(hours=2)
    legacy_jwt = _make_access_jwt(user_id=42, iat=old_iat)
    payload, flow = verify_token_with_flow(legacy_jwt)
    assert payload is not None
    assert flow == "v1", "Pre-cutover token within grace period must stay on V1"


@pytest.mark.unit
def test_verify_token_with_flow_v2_path_after_cutover(_reset_flag_defaults, monkeypatch):
    """User dans le bucket V2 ET token émis après cutover → V2."""
    import core.config as _cfg
    from auth.service import verify_token_with_flow

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)
    # Cutover hier → tokens d'aujourd'hui sont post-cutover.
    now = datetime.now(timezone.utc)
    cutover = now - timedelta(days=1)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", cutover.isoformat())

    v2_jwt = _make_access_jwt(user_id=42, jti=str(uuid.uuid4()), iat=now)
    payload, flow = verify_token_with_flow(v2_jwt)
    assert payload is not None
    assert flow == "v2"


@pytest.mark.unit
def test_verify_token_with_flow_v2_path_when_no_cutover_configured(_reset_flag_defaults, monkeypatch):
    """User dans le bucket V2 + pas de cutover → V2 systématique."""
    import core.config as _cfg
    from auth.service import verify_token_with_flow

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "")

    v2_jwt = _make_access_jwt(user_id=42, jti=str(uuid.uuid4()))
    payload, flow = verify_token_with_flow(v2_jwt)
    assert payload is not None
    assert flow == "v2"


@pytest.mark.unit
def test_verify_token_with_flow_v2_path_outside_grace_period(_reset_flag_defaults, monkeypatch):
    """User in-bucket + token pre-cutover + grace expirée → V2 (force renewal)."""
    import core.config as _cfg
    from auth.service import verify_token_with_flow

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)
    # Cutover il y a 60j, grace 30j → grace expirée depuis 30j.
    now = datetime.now(timezone.utc)
    cutover = now - timedelta(days=60)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", cutover.isoformat())
    monkeypatch.setattr(_cfg, "AUTH_V2_GRACE_PERIOD_DAYS", 30)

    # Token émis avant cutover.
    old_iat = cutover - timedelta(days=1)
    legacy_jwt = _make_access_jwt(user_id=42, iat=old_iat)
    payload, flow = verify_token_with_flow(legacy_jwt)
    assert payload is not None
    assert flow == "v2", "Grace period expired → token should be routed to V2"


@pytest.mark.unit
def test_verify_token_with_flow_user_not_in_bucket_stays_v1(_reset_flag_defaults, monkeypatch):
    """User PAS dans le bucket (0%) → V1 même avec cutover passé."""
    import core.config as _cfg
    from auth.service import verify_token_with_flow

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 0)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "2020-01-01T00:00:00Z")

    jwt_token = _make_access_jwt(user_id=42, jti=str(uuid.uuid4()))
    payload, flow = verify_token_with_flow(jwt_token)
    assert payload is not None
    assert flow == "v1"


@pytest.mark.unit
def test_verify_token_with_flow_invalid_token_returns_none_v1(_reset_flag_defaults, monkeypatch):
    """JWT bidon → (None, 'v1') — pas de tentative de branche."""
    from auth.service import verify_token_with_flow

    payload, flow = verify_token_with_flow("not.a.valid.jwt")
    assert payload is None
    assert flow == "v1"


# ═══════════════════════════════════════════════════════════════════════════════
# 🔗 get_current_user — routing via feature flag
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_routes_via_feature_flag_v2_path(_reset_flag_defaults, monkeypatch, test_session, test_user):
    """User in-bucket + cutover passé → get_current_user appelle validate_session_v2."""
    import core.config as _cfg
    from auth.service import create_session_v2, create_access_token_v2, update_session_refresh_hash, create_refresh_token_v2
    from auth import dependencies as deps
    from fastapi.security import HTTPAuthorizationCredentials

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "")  # pas de cutover → tous V2

    # Crée une vraie UserSession V2 en DB pour que validate_session_v2 trouve le jti.
    user_session = await create_session_v2(
        session=test_session,
        user_id=test_user.id,
        stay_signed_in=True,
        request=None,
    )
    sliding_seconds = int((user_session.sliding_expires_at - datetime.utcnow()).total_seconds())
    refresh_jwt = create_refresh_token_v2(test_user.id, user_session.id, sliding_seconds)
    await update_session_refresh_hash(test_session, user_session.id, refresh_jwt)
    await test_session.commit()

    access_jwt = create_access_token_v2(user_id=test_user.id, jti=user_session.id)

    # Désactiver security side-effects (rate limit + blocklist) pour isoler le flow.
    monkeypatch.setattr(deps, "SECURITY_AVAILABLE", False, raising=False)

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_jwt)
    user = await deps.get_current_user(credentials=creds, token=None, session=test_session)
    assert user.id == test_user.id


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_routes_v1_when_disabled(_reset_flag_defaults, monkeypatch, test_session, test_user):
    """AUTH_V2_ENABLED=false → flow legacy, validate_session_token classique."""
    import core.config as _cfg
    from auth.service import create_user_session, create_access_token
    from auth import dependencies as deps
    from fastapi.security import HTTPAuthorizationCredentials

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", False)

    # Crée un session_token legacy (User.session_token) + JWT V1 (claim "session", pas "jti").
    session_token = await create_user_session(test_session, test_user.id)
    access_jwt = create_access_token(user_id=test_user.id, session_token=session_token)

    monkeypatch.setattr(deps, "SECURITY_AVAILABLE", False, raising=False)

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_jwt)
    user = await deps.get_current_user(credentials=creds, token=None, session=test_session)
    assert user.id == test_user.id


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_rejects_v2_token_without_jti(_reset_flag_defaults, monkeypatch, test_session, test_user):
    """User bucketé V2 + token sans jti → 401 session_upgrade_required."""
    import core.config as _cfg
    from auth.service import create_access_token
    from auth import dependencies as deps
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "")

    # Token V1 (pas de jti) sur un user qui devrait être V2.
    legacy_jwt = create_access_token(user_id=test_user.id, session_token="legacy-token")

    monkeypatch.setattr(deps, "SECURITY_AVAILABLE", False, raising=False)

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=legacy_jwt)
    with pytest.raises(HTTPException) as exc_info:
        await deps.get_current_user(credentials=creds, token=None, session=test_session)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "session_upgrade_required"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_rejects_v2_token_with_invalid_jti(_reset_flag_defaults, monkeypatch, test_session, test_user):
    """User bucketé V2 + jti inconnu en DB → 401 session_expired."""
    import core.config as _cfg
    from auth.service import create_access_token_v2
    from auth import dependencies as deps
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    monkeypatch.setattr(_cfg, "AUTH_V2_ENABLED", True)
    monkeypatch.setattr(_cfg, "AUTH_V2_BUCKET_PERCENT", 100)
    monkeypatch.setattr(_cfg, "AUTH_V2_CUTOVER_DATE", "")

    # JTI random qui n'existe pas en DB.
    fake_jti = str(uuid.uuid4())
    bad_jwt = create_access_token_v2(user_id=test_user.id, jti=fake_jti)

    monkeypatch.setattr(deps, "SECURITY_AVAILABLE", False, raising=False)

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=bad_jwt)
    with pytest.raises(HTTPException) as exc_info:
        await deps.get_current_user(credentials=creds, token=None, session=test_session)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "session_expired"
