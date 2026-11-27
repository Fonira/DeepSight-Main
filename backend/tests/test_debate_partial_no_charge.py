"""Débat en mode auto sans vidéo opposée trouvée : résultat partiel, 0 crédit.

Sans clé Brave, la recherche de la vidéo B échoue toujours : le pipeline
termine avec la seule analyse de la vidéo A. Ce résultat partiel n'est plus
facturé (seul un débat complet coûte 5 crédits). IO externes mockés.
"""

import json
import os
import sys

import pytest
import pytest_asyncio

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def db_session():
    from db.database import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with maker() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_auto_debate_without_opposing_video_is_not_charged(db_session, monkeypatch):
    import debate.matching as debate_matching
    import debate.router as debate_router
    import voice.avatar as voice_avatar
    from db.database import DebateAnalysis, User

    user = User(username="partial", email="partial@example.com", password_hash="x", plan="pro", credits=20)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    debate = DebateAnalysis(user_id=user.id, video_a_id="vidA", status="pending", mode="auto", lang="fr")
    db_session.add(debate)
    await db_session.commit()
    await db_session.refresh(debate)

    class _SessionCtx:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(debate_router, "async_session_maker", lambda: _SessionCtx())

    async def _video_info(vid):
        return {"title": f"Title {vid}", "channel": "Ch", "thumbnail_url": "https://img/x.jpg"}

    async def _transcript(vid):
        return ("Transcript A", [], "fr")

    async def _mistral(messages, **kwargs):
        return json.dumps({"topic": "Sujet", "thesis": "Thèse A", "key_arguments": []})

    async def _no_opposing(*args, **kwargs):
        return None

    deduct_calls = []

    async def _deduct(*args, **kwargs):
        deduct_calls.append(args)
        return (True, 0)

    monkeypatch.setattr(debate_router, "get_video_info", _video_info)
    monkeypatch.setattr(debate_router, "get_transcript_with_timestamps", _transcript)
    monkeypatch.setattr(debate_router, "_call_mistral", _mistral)
    monkeypatch.setattr(debate_matching, "search_opposing_video_legacy_compat", _no_opposing)
    monkeypatch.setattr(debate_router, "deduct_credits", _deduct)
    monkeypatch.setattr(voice_avatar, "ensure_debate_avatar", lambda *_a, **_k: None)

    await debate_router._run_debate_pipeline(
        debate_id=debate.id,
        video_a_id="vidA",
        video_b_id=None,
        platform_a="youtube",
        platform_b=None,
        user_id=user.id,
        user_plan="pro",
        lang="fr",
        mode="auto",
    )

    await db_session.refresh(debate)
    assert debate.status == "completed"
    assert debate.debate_summary.startswith("Analyse partielle")
    assert debate.credits_used == 0
    assert deduct_calls == []
