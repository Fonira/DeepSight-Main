"""Tests pour le service de tooltip IA.

Tâche 14 du plan Semantic Search V1 Phase 1 backend.

Pattern : SQLite in-memory async + monkeypatch de `db.database.async_session_maker`
pour que `explain_passage` (qui ouvre sa propre session via
`async with async_session_maker()`) écrive dans la MÊME DB que les tests.
Inspiré de `tests/search/test_embedding_service.py`.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Importer db.database enregistre tous les modèles sur Base.metadata
from db.database import (  # noqa: F401
    Base,
    ExplainPassageCache,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ FIXTURE — DB async SQLite in-memory
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def async_session(monkeypatch):
    """AsyncSession isolée sur SQLite in-memory.

    Patche `db.database.async_session_maker` pour que `explain_passage`
    (qui ouvre sa propre session via `async with async_session_maker()`)
    écrive dans la MÊME DB que le test.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionMaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Redirige le service vers notre engine in-memory
    monkeypatch.setattr("db.database.async_session_maker", SessionMaker)

    async with SessionMaker() as session:
        try:
            yield session
        finally:
            await session.close()
    await engine.dispose()


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_explain_passage_returns_cached_when_present(async_session):
    cache_key = hashlib.sha256("query|passage|1".encode()).hexdigest()
    async_session.add(
        ExplainPassageCache(
            cache_key=cache_key,
            explanation="Cached explanation.",
            model_used="mistral-small-latest",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
    )
    await async_session.commit()

    from search.explain_passage import explain_passage
    result = await explain_passage(
        summary_id=1, passage_text="passage", query="query", source_type="summary"
    )
    assert result["explanation"] == "Cached explanation."
    assert result["cached"] is True


@pytest.mark.asyncio
async def test_explain_passage_calls_mistral_and_caches(async_session):
    fake_mistral_response = {
        "choices": [{"message": {"content": "Ce passage matche car il mentionne X."}}]
    }
    with patch("search.explain_passage._call_mistral_chat", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = "Ce passage matche car il mentionne X."
        from search.explain_passage import explain_passage
        result = await explain_passage(
            summary_id=42, passage_text="some unique passage", query="some query",
            source_type="summary",
        )
        assert result["cached"] is False
        assert "mentionne X" in result["explanation"]
        mock_call.assert_called_once()

    # 2e appel = cache hit, sans nouveau call
    with patch("search.explain_passage._call_mistral_chat", new_callable=AsyncMock) as mock_call2:
        result2 = await explain_passage(
            summary_id=42, passage_text="some unique passage", query="some query",
            source_type="summary",
        )
        assert result2["cached"] is True
        mock_call2.assert_not_called()
