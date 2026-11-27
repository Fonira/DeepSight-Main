"""Remboursement des crédits quand une génération d'outil d'étude échoue.

Couvre `study/router.py` (/api/study/*) et les endpoints `/api/videos/study/*`
de `videos/router.py` : le crédit est débité avant l'appel Mistral et doit être
rendu (transaction "refund") si la génération lève une erreur ou ne produit
rien. Les générateurs LLM sont mockés : aucun appel réseau.
"""

from __future__ import annotations

import importlib
import sys
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from db.database import Base, CreditTransaction, Summary, User

INITIAL_CREDITS = 10


@pytest_asyncio.fixture
async def async_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def summary(async_session: AsyncSession) -> Summary:
    user = User(
        username="refund_tester",
        email="refund@test.fr",
        password_hash="x",
        plan="pro",
        email_verified=True,
        credits=INITIAL_CREDITS,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)

    s = Summary(
        user_id=user.id,
        video_id="vid-refund",
        video_title="Vidéo test",
        video_channel="Chaîne test",
        platform="youtube",
        lang="fr",
        summary_content="Résumé.",
        transcript_context="Transcript.",
    )
    async_session.add(s)
    await async_session.commit()
    await async_session.refresh(s)
    s.user = user
    return s


@pytest.fixture(autouse=True)
def _no_video_cache(monkeypatch):
    """Les handlers font `from main import get_video_cache` : stub sans cache."""
    fake_main = type(sys)("main")
    fake_main.get_video_cache = lambda: None  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "main", fake_main)


async def _balance(session: AsyncSession, user_id: int) -> int:
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    await session.refresh(user)
    return user.credits


async def _refunds(session: AsyncSession, user_id: int) -> list[int]:
    rows = (
        await session.execute(
            select(CreditTransaction).where(
                CreditTransaction.user_id == user_id, CreditTransaction.transaction_type == "refund"
            )
        )
    ).scalars()
    return [r.amount for r in rows]


# ─── /api/study/* ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_quiz_failure_refunds_credit(async_session, summary, monkeypatch):
    monkeypatch.setattr("study.router.generate_study_card", AsyncMock(side_effect=RuntimeError("mistral down")))
    from study.router import generate_quiz

    with pytest.raises(HTTPException) as exc:
        await generate_quiz(summary.id, summary.user, async_session)

    assert exc.value.status_code == 500
    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS
    assert await _refunds(async_session, summary.user_id) == [1]


@pytest.mark.asyncio
async def test_quiz_success_keeps_debit(async_session, summary, monkeypatch):
    monkeypatch.setattr(
        "study.router.generate_study_card",
        AsyncMock(return_value={"quiz": [{"question": "Q?", "options": ["A", "B"], "correct_index": 0}]}),
    )
    from study.router import generate_quiz

    response = await generate_quiz(summary.id, summary.user, async_session)

    assert len(response.quiz) == 1
    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS - 1
    assert await _refunds(async_session, summary.user_id) == []


@pytest.mark.asyncio
async def test_empty_flashcards_refund_credit(async_session, summary, monkeypatch):
    monkeypatch.setattr("study.router.generate_study_card", AsyncMock(return_value={"key_points": []}))
    from study.router import generate_flashcards

    with pytest.raises(HTTPException):
        await generate_flashcards(summary.id, summary.user, async_session)

    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS
    assert await _refunds(async_session, summary.user_id) == [1]


@pytest.mark.asyncio
async def test_mindmap_failure_refunds_credit(async_session, summary, monkeypatch):
    monkeypatch.setattr("study.router.generate_concept_map", AsyncMock(side_effect=ValueError("JSON invalide")))
    from study.router import generate_mindmap

    with pytest.raises(HTTPException):
        await generate_mindmap(summary.id, summary.user, async_session)

    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS


@pytest.mark.asyncio
async def test_study_all_partial_failure_refunds_failed_part(async_session, summary, monkeypatch):
    monkeypatch.setattr(
        "study.router.generate_study_materials",
        AsyncMock(return_value={"study_card": {"quiz": []}, "concept_map_error": "boom"}),
    )
    from study.router import generate_all_materials

    result = await generate_all_materials(summary.id, summary.user, async_session)

    assert result["success"] is True
    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS - 1
    assert await _refunds(async_session, summary.user_id) == [1]


@pytest.mark.asyncio
async def test_study_all_total_failure_refunds_everything(async_session, summary, monkeypatch):
    monkeypatch.setattr(
        "study.router.generate_study_materials",
        AsyncMock(return_value={"study_card_error": "a", "concept_map_error": "b"}),
    )
    from study.router import generate_all_materials

    with pytest.raises(HTTPException):
        await generate_all_materials(summary.id, summary.user, async_session)

    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS
    assert await _refunds(async_session, summary.user_id) == [2]


@pytest.mark.asyncio
async def test_no_refund_when_debit_did_not_happen(async_session, summary, monkeypatch):
    """Si le débit a échoué (course entre deux requêtes), rien n'est « rendu »."""

    async def _failed_deduct(*_args, **_kwargs):
        return False

    monkeypatch.setattr("study.router.deduct_credit", _failed_deduct)
    monkeypatch.setattr("study.router.generate_study_card", AsyncMock(side_effect=RuntimeError("down")))
    from study.router import generate_quiz

    with pytest.raises(HTTPException):
        await generate_quiz(summary.id, summary.user, async_session)

    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS
    assert await _refunds(async_session, summary.user_id) == []


# ─── /api/videos/study/* ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_videos_study_card_failure_refunds_credit(async_session, summary, monkeypatch):
    videos_router = importlib.import_module("videos.router")

    monkeypatch.setattr(videos_router, "generate_study_card", AsyncMock(side_effect=RuntimeError("down")))

    with pytest.raises(HTTPException):
        await videos_router.create_study_card(summary.id, summary.user, async_session)

    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS
    assert await _refunds(async_session, summary.user_id) == [1]


@pytest.mark.asyncio
async def test_videos_study_all_partial_failure_refunds_failed_part(async_session, summary, monkeypatch):
    videos_router = importlib.import_module("videos.router")

    monkeypatch.setattr(
        videos_router,
        "generate_study_materials",
        AsyncMock(return_value={"study_card_error": "a", "concept_map": {"mermaid_code": "mindmap"}}),
    )

    await videos_router.create_all_study_materials(summary.id, summary.user, async_session)

    assert await _balance(async_session, summary.user_id) == INITIAL_CREDITS - 1
    assert await _refunds(async_session, summary.user_id) == [1]
