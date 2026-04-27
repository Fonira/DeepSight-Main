"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TEST USER PREFERENCES AMBIENT — Persistance JSON server-side (Task 15)        ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Vérifie que `update_user_preferences()` persiste effectivement les préférences
ambient_lighting_enabled (et extra_preferences) dans la colonne JSON
`User.preferences` (migration 008).

Stratégie : SQLite in-memory + ``Base.metadata.create_all`` pour matérialiser
le schéma et tester un round-trip complet (write → read), comme dans
test_user_preferences_column.py.

Tests :
  1. update avec ambient_lighting_enabled=True → User.preferences contient {ambient_lighting_enabled: True}
  2. update avec ambient_lighting_enabled=False (flip) → preferences flippe à False
  3. update d'un champ scalaire (default_lang) → ne touche pas le JSON existant
     (idempotence préservée)
  4. update avec extra_preferences (dict arbitraire) → mergé dans preferences
  5. ambient_lighting_enabled + extra_preferences combinés → merge correct
"""

import os
import sys
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Env defaults pour import safety
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 FIXTURES — SQLite in-memory + un User réel
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def db_session():
    """SQLite in-memory + tous les models créés via Base.metadata.create_all."""
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def existing_user(db_session):
    """Crée un User réel en DB (sans préférences initiales)."""
    from db.database import User

    user = User(
        username="ambient_user",
        email="ambient_user@example.com",
        password_hash="hashed_pw",
        plan="pro",
        credits=100,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ TESTS — Persistance round-trip
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_preferences_persists_ambient_lighting_true(db_session, existing_user):
    """update_user_preferences(ambient_lighting_enabled=True) → preferences[...]==True."""
    from auth.service import update_user_preferences
    from db.database import User
    from sqlalchemy import select

    success = await update_user_preferences(
        db_session,
        existing_user.id,
        ambient_lighting_enabled=True,
    )
    assert success is True

    # Re-fetch from DB pour confirmer la persistance (pas juste la mutation Python)
    result = await db_session.execute(select(User).where(User.id == existing_user.id))
    user = result.scalar_one()
    assert user.preferences is not None, "preferences ne doit pas être NULL après update"
    assert user.preferences.get("ambient_lighting_enabled") is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_preferences_flips_ambient_lighting_to_false(db_session, existing_user):
    """Flip ambient_lighting_enabled True → False et vice-versa."""
    from auth.service import update_user_preferences
    from db.database import User
    from sqlalchemy import select

    # 1. Set to True
    await update_user_preferences(db_session, existing_user.id, ambient_lighting_enabled=True)

    # 2. Flip to False
    await update_user_preferences(db_session, existing_user.id, ambient_lighting_enabled=False)

    result = await db_session.execute(select(User).where(User.id == existing_user.id))
    user = result.scalar_one()
    assert user.preferences.get("ambient_lighting_enabled") is False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_scalar_field_does_not_clobber_preferences(db_session, existing_user):
    """Update d'un champ scalaire (default_lang) ne doit pas écraser le JSON preferences."""
    from auth.service import update_user_preferences
    from db.database import User
    from sqlalchemy import select

    # Setup : poser une préférence ambient
    await update_user_preferences(db_session, existing_user.id, ambient_lighting_enabled=True)

    # Update d'un champ scalaire SANS toucher à ambient_lighting_enabled
    await update_user_preferences(db_session, existing_user.id, default_lang="en")

    result = await db_session.execute(select(User).where(User.id == existing_user.id))
    user = result.scalar_one()
    # Le scalaire doit être à jour
    assert user.default_lang == "en"
    # Le JSON preferences doit être intact (idempotence)
    assert user.preferences.get("ambient_lighting_enabled") is True


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_preferences_merges_extra_preferences(db_session, existing_user):
    """extra_preferences (dict arbitraire) est mergé non-destructivement."""
    from auth.service import update_user_preferences
    from db.database import User
    from sqlalchemy import select

    # 1. Poser ambient_lighting_enabled
    await update_user_preferences(db_session, existing_user.id, ambient_lighting_enabled=True)

    # 2. Ajouter des extras sans toucher ambient
    await update_user_preferences(
        db_session,
        existing_user.id,
        extra_preferences={"theme_variant": "ocean", "list_density": "compact"},
    )

    result = await db_session.execute(select(User).where(User.id == existing_user.id))
    user = result.scalar_one()
    assert user.preferences.get("ambient_lighting_enabled") is True, (
        "extra_preferences ne doit pas effacer la pref existante"
    )
    assert user.preferences.get("theme_variant") == "ocean"
    assert user.preferences.get("list_density") == "compact"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_preferences_combined_ambient_and_extra(db_session, existing_user):
    """Combinaison ambient_lighting_enabled + extra_preferences en un seul call → merge OK."""
    from auth.service import update_user_preferences
    from db.database import User
    from sqlalchemy import select

    await update_user_preferences(
        db_session,
        existing_user.id,
        ambient_lighting_enabled=False,
        extra_preferences={"theme_variant": "sunset", "ambient_lighting_enabled": True},
    )

    result = await db_session.execute(select(User).where(User.id == existing_user.id))
    user = result.scalar_one()
    # Le champ explicite ambient_lighting_enabled gagne sur extra_preferences (False)
    assert user.preferences.get("ambient_lighting_enabled") is False
    assert user.preferences.get("theme_variant") == "sunset"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_update_preferences_returns_false_on_unknown_user(db_session):
    """update_user_preferences avec user_id inexistant → False (pas d'exception)."""
    from auth.service import update_user_preferences

    success = await update_user_preferences(
        db_session,
        user_id=99999,
        ambient_lighting_enabled=True,
    )
    assert success is False
