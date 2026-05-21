"""Test schema migration 033 — création de la table `user_sessions` + model.

Auth V2 Wave 1 Step 1 — foundations multi-device + rotation refresh single-use.

Vérifie :
  1. Le model SQLAlchemy `UserSession` est bien déclaré avec toutes les colonnes
     attendues (id, user_id, refresh_token_hash, device_label, ip_hash,
     user_agent, stay_signed_in, issued_at, last_seen_at, sliding_expires_at,
     absolute_expires_at, revoked_at).
  2. Insert + read-back d'une UserSession avec champs requis (round-trip DB).
  3. Cascade delete : supprimer un User → ses UserSession orphelines disparaissent
     (vérifie le `ON DELETE CASCADE` côté FK + `cascade="all, delete-orphan"`
     côté relationship).
  4. Query par (user_id, revoked_at IS NULL) — pattern attendu pour la page
     « Appareils actifs » et la dependency `get_current_user` V2.

Stratégie : SQLite in-memory + `Base.metadata.create_all` pour matérialiser
le schéma sans dépendre d'Alembic (cf pattern de test_user_preferences_column.py).
"""

import uuid
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def test_session():
    """SQLite in-memory + tous les models créés via Base.metadata.create_all."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        yield session

    await engine.dispose()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_user_session_model_has_expected_columns():
    """Le model UserSession déclare toutes les colonnes du spec V2 §4.1."""
    from db.database import UserSession

    cols = {c.name for c in UserSession.__table__.columns}
    expected = {
        "id",
        "user_id",
        "refresh_token_hash",
        "device_label",
        "ip_hash",
        "user_agent",
        "stay_signed_in",
        "issued_at",
        "last_seen_at",
        "sliding_expires_at",
        "absolute_expires_at",
        "revoked_at",
    }
    missing = expected - cols
    assert not missing, f"UserSession missing columns: {missing}"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_user_session_create_with_required_fields(test_session):
    """Insert + read-back d'une UserSession avec tous les champs requis."""
    from db.database import User, UserSession

    user = User(
        username="alice_session",
        email="alice_session@example.com",
        password_hash="hashed",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    now = datetime.utcnow()
    session_id = str(uuid.uuid4())
    sess = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash="a" * 64,  # SHA-256 hex digest (64 chars)
        device_label="Chrome on macOS",
        ip_hash="b" * 64,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        stay_signed_in=True,
        sliding_expires_at=now + timedelta(days=30),
        absolute_expires_at=now + timedelta(days=90),
    )
    test_session.add(sess)
    await test_session.commit()
    await test_session.refresh(sess)

    # Read-back round-trip
    result = await test_session.execute(
        select(UserSession).where(UserSession.id == session_id)
    )
    fetched = result.scalar_one()
    assert fetched.user_id == user.id
    assert fetched.refresh_token_hash == "a" * 64
    assert fetched.device_label == "Chrome on macOS"
    assert fetched.stay_signed_in is True
    assert fetched.revoked_at is None
    assert fetched.issued_at is not None
    assert fetched.last_seen_at is not None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_user_session_cascade_delete_when_user_deleted(test_session):
    """Supprimer un User → ses UserSession liées disparaissent (FK CASCADE)."""
    from db.database import User, UserSession

    user = User(
        username="bob_cascade",
        email="bob_cascade@example.com",
        password_hash="hashed",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    now = datetime.utcnow()
    # Crée 2 sessions sur ce user (multi-device simulé)
    sess1 = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash="c" * 64,
        device_label="Chrome on macOS",
        sliding_expires_at=now + timedelta(days=30),
        absolute_expires_at=now + timedelta(days=90),
    )
    sess2 = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash="d" * 64,
        device_label="Safari on iOS",
        sliding_expires_at=now + timedelta(days=30),
        absolute_expires_at=now + timedelta(days=90),
    )
    test_session.add_all([sess1, sess2])
    await test_session.commit()

    # Sanity check : 2 sessions existent
    result = await test_session.execute(
        select(UserSession).where(UserSession.user_id == user.id)
    )
    assert len(result.scalars().all()) == 2

    # Suppression du user via session.delete() pour déclencher le cascade
    # ORM-side (cascade="all, delete-orphan" sur User.sessions) — équivalent au
    # ON DELETE CASCADE côté FK mais plus portable sur SQLite.
    await test_session.delete(user)
    await test_session.commit()

    # Les sessions doivent avoir disparu
    result = await test_session.execute(
        select(UserSession).where(UserSession.user_id == user.id)
    )
    remaining = result.scalars().all()
    assert remaining == [], (
        f"Expected sessions cascade-deleted, but {len(remaining)} remain"
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_user_session_query_by_user_id_and_revoked_at_null(test_session):
    """Pattern « sessions actives d'un user » : WHERE user_id=? AND revoked_at IS NULL.

    Vérifie que :
    - les sessions non révoquées (revoked_at=NULL) remontent ;
    - les sessions révoquées (revoked_at=timestamp) sont exclues.

    L'index `ix_user_sessions_user_id_revoked_at` (cf migration 033) supporte
    cette requête. Le test ne vérifie pas l'usage de l'index (impossible sans
    EXPLAIN), juste la correction fonctionnelle de la query.
    """
    from db.database import User, UserSession

    user = User(
        username="carol_active",
        email="carol_active@example.com",
        password_hash="hashed",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    now = datetime.utcnow()
    active_session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash="e" * 64,
        device_label="Chrome on Windows",
        sliding_expires_at=now + timedelta(days=30),
        absolute_expires_at=now + timedelta(days=90),
        revoked_at=None,
    )
    revoked_session = UserSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash="f" * 64,
        device_label="Firefox on Linux",
        sliding_expires_at=now + timedelta(days=30),
        absolute_expires_at=now + timedelta(days=90),
        revoked_at=now - timedelta(hours=1),  # révoquée il y a 1h
    )
    test_session.add_all([active_session, revoked_session])
    await test_session.commit()

    # Query : sessions actives du user
    result = await test_session.execute(
        select(UserSession).where(
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
        )
    )
    active = result.scalars().all()
    assert len(active) == 1, (
        f"Expected 1 active session, got {len(active)}"
    )
    assert active[0].device_label == "Chrome on Windows"
    assert active[0].revoked_at is None
