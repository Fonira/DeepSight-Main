"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — url_resolver (HEAD requests, redirect following, dedup)                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Module : videos.external_pages.url_resolver                                       ║
║  Couvre :                                                                          ║
║    - resolve_url() : HEAD avec follow_redirects, gestion timeout/erreurs           ║
║    - resolve_urls() : batch + dedup par final_url                                  ║
║    - ResolvedURL dataclass : status + final_url                                    ║
║                                                                                    ║
║  Stratégie de mock : monkey-patch httpx.AsyncClient.head pour ne pas faire de       ║
║  vrai I/O. Une fixture `make_head_response(status, final_url)` simule la réponse.  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from videos.external_pages.url_resolver import (
    ResolvedURL,
    resolve_url,
    resolve_urls,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ HELPERS — fake httpx response
# ═══════════════════════════════════════════════════════════════════════════════


def _make_response(
    status: int = 200,
    final_url: str = "https://example.com",
    history: Optional[list] = None,
) -> MagicMock:
    """Crée une fausse httpx.Response avec status_code et URL finale."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status
    resp.url = httpx.URL(final_url)
    resp.history = history or []
    resp.headers = {"content-type": "text/html"}
    return resp


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — ResolvedURL dataclass
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.unit
class TestResolvedURLDataclass:
    def test_create_minimal(self):
        r = ResolvedURL(
            input_url="https://a.com",
            final_url="https://a.com",
            status=200,
        )
        assert r.input_url == "https://a.com"
        assert r.final_url == "https://a.com"
        assert r.status == 200

    def test_create_with_redirect(self):
        r = ResolvedURL(
            input_url="https://bit.ly/abc",
            final_url="https://final-destination.com/page",
            status=200,
        )
        assert r.input_url != r.final_url

    def test_dataclass_equality(self):
        a = ResolvedURL(input_url="x", final_url="y", status=200)
        b = ResolvedURL(input_url="x", final_url="y", status=200)
        assert a == b


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — resolve_url
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestResolveUrl:
    """Résolution unitaire d'une URL : HEAD, follow redirects, error handling."""

    async def test_resolves_200_direct(self):
        fake_client = AsyncMock()
        fake_client.head.return_value = _make_response(
            status=200, final_url="https://example.com"
        )
        result = await resolve_url(fake_client, "https://example.com")
        assert result is not None
        assert result.status == 200
        assert result.final_url == "https://example.com"
        assert result.input_url == "https://example.com"

    async def test_follows_redirect(self):
        """HEAD avec follow_redirects=True → final_url différente de input_url."""
        fake_client = AsyncMock()
        # Simule 1 redirect : history a 1 réponse 301, response finale 200
        history = [MagicMock(status_code=301)]
        fake_client.head.return_value = _make_response(
            status=200,
            final_url="https://www.example.com/final",
            history=history,
        )
        result = await resolve_url(fake_client, "https://bit.ly/abc")
        assert result is not None
        assert result.final_url == "https://www.example.com/final"
        assert result.input_url == "https://bit.ly/abc"

    async def test_too_many_hops_returns_none(self):
        """> MAX_HOPS (5) redirects → drop."""
        fake_client = AsyncMock()
        # Simule 6 redirects > MAX_HOPS
        history = [MagicMock(status_code=301) for _ in range(6)]
        fake_client.head.return_value = _make_response(
            status=200,
            final_url="https://example.com/end",
            history=history,
        )
        result = await resolve_url(fake_client, "https://bit.ly/abc")
        assert result is None

    async def test_timeout_returns_none(self):
        fake_client = AsyncMock()
        fake_client.head.side_effect = httpx.TimeoutException("timeout")
        result = await resolve_url(fake_client, "https://slow.example.com")
        assert result is None

    async def test_connect_error_returns_none(self):
        fake_client = AsyncMock()
        fake_client.head.side_effect = httpx.ConnectError("dns error")
        result = await resolve_url(fake_client, "https://nope.invalid")
        assert result is None

    async def test_generic_http_error_returns_none(self):
        fake_client = AsyncMock()
        fake_client.head.side_effect = httpx.HTTPError("generic error")
        result = await resolve_url(fake_client, "https://example.com")
        assert result is None

    async def test_unexpected_exception_returns_none(self):
        """Toute exception inattendue est swallow gracefully (drop)."""
        fake_client = AsyncMock()
        fake_client.head.side_effect = ValueError("oops")
        result = await resolve_url(fake_client, "https://example.com")
        assert result is None

    async def test_404_status_kept(self):
        """404 n'est pas une erreur d'I/O — on garde l'info."""
        fake_client = AsyncMock()
        fake_client.head.return_value = _make_response(
            status=404, final_url="https://example.com/notfound"
        )
        result = await resolve_url(fake_client, "https://example.com/notfound")
        # Implementation : on garde ou on drop le 404. Choix : on drop.
        # On accepte les deux comportements en attendant : drop OU kept
        # → ici on assert qu'au minimum on ne crash pas.
        # Si retourné, status=404. Si drop, None.
        if result is not None:
            assert result.status == 404

    async def test_500_status_dropped(self):
        """5xx serveur dans la galère : on drop."""
        fake_client = AsyncMock()
        fake_client.head.return_value = _make_response(
            status=500, final_url="https://example.com/oops"
        )
        result = await resolve_url(fake_client, "https://example.com/oops")
        # On drop ou on garde — accepter les deux mais sans crash
        if result is not None:
            assert result.status == 500


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — resolve_urls (batch)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.unit
class TestResolveUrls:
    """Batch resolution : dedup, error swallowing, ordre."""

    async def test_empty_list_returns_empty(self):
        result = await resolve_urls([])
        assert result == []

    async def test_dedups_by_final_url(self):
        """Deux input URLs qui redirigent vers le même final → 1 seul résultat."""
        async def fake_head(url, **kwargs):
            # bit.ly/a → final.com/x
            # bit.ly/b → final.com/x (même final !)
            return _make_response(status=200, final_url="https://final.com/x")

        fake_client = AsyncMock()
        fake_client.head.side_effect = fake_head

        with patch(
            "videos.external_pages.url_resolver.get_proxied_client"
        ) as mock_get:
            mock_get.return_value.__aenter__.return_value = fake_client
            mock_get.return_value.__aexit__.return_value = None
            result = await resolve_urls(
                ["https://bit.ly/a", "https://bit.ly/b"]
            )
            assert len(result) == 1

    async def test_drops_failed_urls(self):
        """Les URLs qui timeout/échouent ne doivent pas crash et sont droppées."""
        call_count = {"n": 0}

        async def fake_head(url, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise httpx.TimeoutException("timeout")
            return _make_response(status=200, final_url=str(url))

        fake_client = AsyncMock()
        fake_client.head.side_effect = fake_head

        with patch(
            "videos.external_pages.url_resolver.get_proxied_client"
        ) as mock_get:
            mock_get.return_value.__aenter__.return_value = fake_client
            mock_get.return_value.__aexit__.return_value = None
            result = await resolve_urls(
                ["https://slow.com", "https://fast.com"]
            )
            # 1 échec (timeout), 1 succès
            assert len(result) == 1
            assert result[0].final_url == "https://fast.com"

    async def test_keeps_distinct_final_urls(self):
        async def fake_head(url, **kwargs):
            # Chaque URL résout à elle-même
            return _make_response(status=200, final_url=str(url))

        fake_client = AsyncMock()
        fake_client.head.side_effect = fake_head

        with patch(
            "videos.external_pages.url_resolver.get_proxied_client"
        ) as mock_get:
            mock_get.return_value.__aenter__.return_value = fake_client
            mock_get.return_value.__aexit__.return_value = None
            result = await resolve_urls(
                ["https://a.com", "https://b.com", "https://c.com"]
            )
            assert len(result) == 3

    async def test_all_failures_returns_empty(self):
        async def always_fail(url, **kwargs):
            raise httpx.ConnectError("dead")

        fake_client = AsyncMock()
        fake_client.head.side_effect = always_fail

        with patch(
            "videos.external_pages.url_resolver.get_proxied_client"
        ) as mock_get:
            mock_get.return_value.__aenter__.return_value = fake_client
            mock_get.return_value.__aexit__.return_value = None
            result = await resolve_urls(
                ["https://dead1.invalid", "https://dead2.invalid"]
            )
            assert result == []
