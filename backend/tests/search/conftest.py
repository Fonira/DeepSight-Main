# backend/tests/search/conftest.py
"""Fixtures partagées pour les tests search/.

Contenu :
- `fake_embedding_1024` / `fake_embedding_other_1024` : vecteurs factices
- `mock_mistral_embed_response` / `mock_mistral_embed_batch_response`
- `patch_httpx_post` : monkeypatch de `httpx.AsyncClient.post` pour mocker Mistral
- Factories génériques pour tests qui définissent leur propre `async_session` :
  * `flashcard_factory`
  * `quiz_question_factory`
  * `chat_message_factory`
  * `summary_embedding_factory`
  * `flashcard_embedding_factory`

Note : les factories prennent `async_session` en paramètre. Pytest résout
ce fixture dans le scope local du test (chaque fichier de test search/ inline
son propre `async_session` car les patches de `async_session_maker` divergent
selon le service ciblé). Si un test n'a pas d'`async_session` local, ces
factories ne seront pas exploitables — c'est attendu.
"""

import json
from unittest.mock import MagicMock

import pytest
import pytest_asyncio


@pytest.fixture
def fake_embedding_1024() -> list[float]:
    """Embedding factice de 1024 floats normalisés."""
    return [0.001 * (i + 1) for i in range(1024)]


@pytest.fixture
def fake_embedding_other_1024() -> list[float]:
    """Second embedding factice (différent du premier) pour tester cosine != 1.0."""
    return [0.002 * (i + 1) for i in range(1024)]


@pytest.fixture
def mock_mistral_embed_response(fake_embedding_1024):
    """Mock de la réponse JSON de POST /v1/embeddings."""
    return {
        "data": [{"embedding": fake_embedding_1024, "index": 0}],
        "model": "mistral-embed",
        "usage": {"prompt_tokens": 10, "total_tokens": 10},
    }


@pytest.fixture
def mock_mistral_embed_batch_response(fake_embedding_1024, fake_embedding_other_1024):
    """Mock de la réponse JSON pour un batch de 2 embeddings."""
    return {
        "data": [
            {"embedding": fake_embedding_1024, "index": 0},
            {"embedding": fake_embedding_other_1024, "index": 1},
        ],
        "model": "mistral-embed",
        "usage": {"prompt_tokens": 20, "total_tokens": 20},
    }


@pytest.fixture
def patch_httpx_post(monkeypatch, fake_embedding_1024):
    """Patche httpx.AsyncClient.post pour retourner N embeddings factices.

    Le fixture inspecte le payload JSON envoyé pour produire EXACTEMENT autant
    d'embeddings que d'entrées dans `input` (compatible single + batch). Cela
    permet aux helpers `embed_summary`/`embed_flashcards`/etc. d'embarquer
    plusieurs sections d'un coup sans recevoir un batch sous-dimensionné.
    """

    async def mock_post(*_args, **kwargs):
        payload = kwargs.get("json") or {}
        inputs = payload.get("input") or []
        # Si l'appelant utilise generate_embedding (single text passé en list[str])
        # ou generate_embeddings_batch (list[str]) — len(inputs) suffit.
        n = max(len(inputs), 1)
        data = [{"embedding": fake_embedding_1024, "index": i} for i in range(n)]
        response = MagicMock()
        response.json = MagicMock(
            return_value={
                "data": data,
                "model": "mistral-embed",
                "usage": {"prompt_tokens": 10 * n, "total_tokens": 10 * n},
            }
        )
        response.raise_for_status = MagicMock()
        response.status_code = 200
        return response

    import httpx

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr("search.embedding_service.MISTRAL_API_KEY", "sk-test-fake")
    return mock_post


# ═══════════════════════════════════════════════════════════════════════════════
# 🏭 FACTORIES GÉNÉRIQUES — utilisables par tout test search/ qui fournit son
# propre `async_session` (et `summary_factory`/`flashcard_factory` si besoin).
# Ces factories sont additives — chaque test file peut continuer à inliner ses
# propres versions si une signature spécifique est requise.
# ═══════════════════════════════════════════════════════════════════════════════


@pytest_asyncio.fixture
async def flashcard_factory(async_session):
    """Crée et persiste une Flashcard liée à un summary existant.

    Usage : `await flashcard_factory(summary, position=0, front="Q", back="A")`
    """
    from db.database import Flashcard

    counter = {"n": 0}

    async def _factory(
        summary,
        position: int | None = None,
        front: str = "Q",
        back: str = "A",
        category: str | None = None,
        **kwargs,
    ):
        counter["n"] += 1
        pos = position if position is not None else counter["n"] - 1
        fc = Flashcard(
            summary_id=summary.id,
            user_id=summary.user_id,
            position=pos,
            front=front,
            back=back,
            category=category,
            **kwargs,
        )
        async_session.add(fc)
        await async_session.commit()
        await async_session.refresh(fc)
        return fc

    return _factory


@pytest_asyncio.fixture
async def quiz_question_factory(async_session):
    """Crée et persiste une QuizQuestion liée à un summary existant.

    Usage : `await quiz_question_factory(summary, position=0, question="?")`
    """
    from db.database import QuizQuestion

    counter = {"n": 0}

    async def _factory(
        summary,
        position: int | None = None,
        question: str = "Question?",
        options: list | None = None,
        correct_index: int = 0,
        explanation: str | None = None,
        difficulty: str = "standard",
        **kwargs,
    ):
        counter["n"] += 1
        pos = position if position is not None else counter["n"] - 1
        if options is None:
            options = ["A", "B", "C", "D"]
        q = QuizQuestion(
            summary_id=summary.id,
            user_id=summary.user_id,
            position=pos,
            question=question,
            options_json=json.dumps(options),
            correct_index=correct_index,
            explanation=explanation,
            difficulty=difficulty,
            **kwargs,
        )
        async_session.add(q)
        await async_session.commit()
        await async_session.refresh(q)
        return q

    return _factory


@pytest_asyncio.fixture
async def chat_message_factory(async_session):
    """Crée et persiste un ChatMessage lié à un summary existant.

    Usage : `await chat_message_factory(summary, role="user", content="hello")`
    """
    from db.database import ChatMessage

    async def _factory(
        summary,
        role: str = "user",
        content: str = "message",
        **kwargs,
    ):
        msg = ChatMessage(
            user_id=summary.user_id,
            summary_id=summary.id,
            role=role,
            content=content,
            **kwargs,
        )
        async_session.add(msg)
        await async_session.commit()
        await async_session.refresh(msg)
        return msg

    return _factory


@pytest_asyncio.fixture
async def summary_embedding_factory(async_session, fake_embedding_1024):
    """Crée un SummaryEmbedding persisté.

    Usage : `await summary_embedding_factory(summary, section_index=0, ...)`
    """
    from db.database import SummaryEmbedding

    async def _factory(
        summary,
        section_index: int = 0,
        text_preview: str = "section text",
        embedding: list[float] | None = None,
        section_ref: str | None = None,
        token_count: int | None = None,
        model_version: str = "mistral-embed",
        source_metadata: str | None = None,
        **kwargs,
    ):
        emb = SummaryEmbedding(
            summary_id=summary.id,
            user_id=summary.user_id,
            section_index=section_index,
            section_ref=section_ref,
            embedding_json=json.dumps(embedding or fake_embedding_1024),
            text_preview=text_preview,
            token_count=token_count if token_count is not None else len(text_preview.split()),
            model_version=model_version,
            source_metadata=source_metadata,
            **kwargs,
        )
        async_session.add(emb)
        await async_session.commit()
        await async_session.refresh(emb)
        return emb

    return _factory


@pytest_asyncio.fixture
async def flashcard_embedding_factory(async_session, fake_embedding_1024):
    """Crée un FlashcardEmbedding persisté.

    Usage : `await flashcard_embedding_factory(flashcard, ...)`
    """
    from db.database import FlashcardEmbedding

    async def _factory(
        flashcard,
        text_preview: str = "flashcard text",
        embedding: list[float] | None = None,
        model_version: str = "mistral-embed",
        **kwargs,
    ):
        emb = FlashcardEmbedding(
            flashcard_id=flashcard.id,
            summary_id=flashcard.summary_id,
            user_id=flashcard.user_id,
            embedding_json=json.dumps(embedding or fake_embedding_1024),
            text_preview=text_preview,
            model_version=model_version,
            **kwargs,
        )
        async_session.add(emb)
        await async_session.commit()
        await async_session.refresh(emb)
        return emb

    return _factory
