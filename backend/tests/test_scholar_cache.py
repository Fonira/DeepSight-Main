"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Scholar cache (PR1 / spec §8)                                         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║  • Cache HIT short-circuits the HTTP fetch                                         ║
║  • Cache MISS then HIT for the same query                                         ║
║  • Empty batch NEVER stored (cache poisoning protection — spec §8.3)               ║
║  • Cache key normalized on lower().strip()                                         ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from academic import scholar  # noqa: E402
from academic.scholar import ScholarBatch, ScholarPaper  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_scholar_state():
    scholar._reset_state_for_tests()
    yield
    scholar._reset_state_for_tests()


def _sample_batch(query: str, n_papers: int = 3) -> ScholarBatch:
    return ScholarBatch(
        query=query,
        papers=[
            ScholarPaper(
                scholar_id=f"id{i}",
                title=f"Paper {i}",
                authors=[f"Author {i}"],
                year=2024,
                citation_count=100 + i,
            )
            for i in range(n_papers)
        ],
        fetched_at=time.time(),
        raw_html_size=10000,
    )


# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cache_hit_skips_http_request(redis_client_fixture):
    """When the cache key is populated, search_scholar must NOT issue an HTTP call."""
    await scholar.init_scholar_redis(redis_client_fixture)

    query = "quantum computing"
    pre_cached = _sample_batch(query, n_papers=5)
    await scholar._cache_set(query, pre_cached)

    # Patch the Decodo scraping client class so we can assert it's never instantiated.
    # Phase 1.2 (PR #535) migrated from get_proxied_client → DecodoScrapingClient.
    mock_client_cls = MagicMock()
    with patch("decodo.DecodoScrapingClient", mock_client_cls):
        result = await scholar.search_scholar(query, use_cache=True)

    assert mock_client_cls.call_count == 0, "HTTP client should not be instantiated on cache HIT"
    assert len(result.papers) == 5
    assert result.papers[0].title == "Paper 0"


@pytest.mark.asyncio
async def test_cache_miss_then_hit(redis_client_fixture):
    """First call → MISS+set, second identical call → HIT, same content."""
    await scholar.init_scholar_redis(redis_client_fixture)

    query = "histoire de la psychiatrie"
    batch1 = _sample_batch(query, n_papers=2)
    await scholar._cache_set(query, batch1)

    # Direct cache_get (simulates what search_scholar does on subsequent calls).
    hit = await scholar._cache_get(query)
    assert hit is not None
    assert len(hit.papers) == 2
    assert hit.query == query

    # Repeated _cache_get still hits.
    hit2 = await scholar._cache_get(query)
    assert hit2 is not None
    assert hit2.papers[0].title == hit.papers[0].title


@pytest.mark.asyncio
async def test_cache_empty_batch_not_stored(redis_client_fixture):
    """An empty papers batch must NOT pollute the cache (spec §8.3)."""
    await scholar.init_scholar_redis(redis_client_fixture)

    query = "this query returned 0 papers due to captcha"
    empty = ScholarBatch(query=query, papers=[], fetched_at=time.time(), raw_html_size=0)
    await scholar._cache_set(query, empty)

    # The key must not exist in Redis.
    raw = await redis_client_fixture.get(scholar._cache_key(query))
    assert raw is None, f"empty batch was wrongly cached: {raw!r}"

    # And _cache_get returns None.
    assert await scholar._cache_get(query) is None


@pytest.mark.asyncio
async def test_cache_key_normalized(redis_client_fixture):
    """Cache key must be invariant under lower() and strip()."""
    await scholar.init_scholar_redis(redis_client_fixture)

    variants = [
        "Quantum Computing",
        "quantum computing",
        "  quantum computing  ",
        "QUANTUM COMPUTING",
        "\tQuantum Computing\n",
    ]
    keys = {scholar._cache_key(v) for v in variants}
    assert len(keys) == 1, f"variants produced different cache keys: {keys!r}"

    # And different queries produce different keys.
    other = scholar._cache_key("histoire de la folie")
    assert other not in keys
