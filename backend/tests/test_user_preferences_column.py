"""Test schema migration 008 — adding User.preferences JSON column.

Vérifie le contrat du model :
  1. La classe SQLAlchemy ``User`` déclare bien la colonne ``preferences``.
  2. Un User créé sans valeur explicite → ``preferences`` est ``{}`` (default
     dict côté Python) ou ``None`` (server_default applique sur INSERT).
  3. Un dict arbitraire (ex: ``{"ambient_lighting_enabled": False}``) survit
     un round-trip persist → refresh.

Stratégie : SQLite in-memory + ``Base.metadata.create_all`` pour matérialiser
le schéma sans dépendre d'Alembic (cf. pattern de test_voice_e2e_unified_timeline.py).
Cela teste la cohérence model ↔ migration : si la colonne manque côté model,
le test 1 fail ; si le type JSON est mal géré côté SQLite, les tests 2/3 fail.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker


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
async def test_user_model_has_preferences_column():
    """The SQLAlchemy User model declares a `preferences` JSON column."""
    from db.database import User

    cols = {c.name for c in User.__table__.columns}
    assert "preferences" in cols, (
        "User.preferences column missing — migration 008 not applied to model"
    )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_preferences_default_is_empty_dict_or_none(test_session):
    """A freshly-created User without explicit preferences → {} or None."""
    from db.database import User

    user = User(
        username="ambient_default",
        email="ambient_default@example.com",
        password_hash="hashed",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    # Selon le dialecte (SQLite vs PG) et le moment d'application du default
    # (Python `default=dict` lors de l'INSERT vs server_default sur la table),
    # la valeur peut être {} ou None. Les deux sont acceptables.
    assert user.preferences == {} or user.preferences is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_preferences_can_store_ambient_flag(test_session):
    """Storing {ambient_lighting_enabled: false} round-trips through DB."""
    from db.database import User

    user = User(
        username="ambient_pref_user",
        email="ambient_pref@example.com",
        password_hash="hashed",
        preferences={"ambient_lighting_enabled": False},
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    assert user.preferences == {"ambient_lighting_enabled": False}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_preferences_can_store_arbitrary_dict(test_session):
    """The JSON column accepts arbitrary nested keys (futures feature flags)."""
    from db.database import User

    payload = {
        "ambient_lighting_enabled": True,
        "theme_variant": "ocean",
        "list_density": "compact",
        "nested": {"a": 1, "b": [1, 2, 3]},
    }
    user = User(
        username="ambient_arbitrary",
        email="ambient_arbitrary@example.com",
        password_hash="hashed",
        preferences=payload,
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    assert user.preferences == payload
