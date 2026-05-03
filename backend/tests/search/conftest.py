# backend/tests/search/conftest.py
"""Fixtures partagées pour les tests search/."""

from unittest.mock import MagicMock

import pytest


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
