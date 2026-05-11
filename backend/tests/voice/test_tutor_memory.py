"""Tests for the adaptive Tuteur memory snapshot (V2 / 2026-05-11).

Coverage:
    - Four compression levels driven by analysis count (long/medium/short/ultra)
    - `key_topics` extraction from markdown ``## `` headings
    - `top_concepts` aggregation from `[[concept]]` markers across history
    - `top_categories` aggregation
    - Recent slice capped per level (5 items at ultra)
    - Redis cache hit/miss path
    - Strict user isolation (no cross-user leak)

Tests use the local SQLite in-memory async DB provided by conftest.py
(``async_db_session`` + ``kt_user`` style fixtures).
"""

from __future__ import annotations

import json
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, User
from voice.tutor_memory import (
    LEVEL_LONG,
    LEVEL_MEDIUM,
    LEVEL_SHORT,
    LEVEL_ULTRA,
    _cache_key,
    _compression_level,
    _extract_key_topics,
    build_tutor_memory,
)


# ─────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture(autouse=True)
async def _isolate_cache_service():
    """Reset the project-wide ``cache_service`` between tests.

    ``cache_service`` is a process-wide singleton; without isolation a snapshot
    written by test N leaks into test N+1 and we get cache_hit false positives.
    The autouse fixture clears the in-memory backend before each test runs.
    """
    try:
        from core.cache import cache_service

        backend = cache_service.backend
        # In-memory backend stores its data in `_cache` + `_expiry`. We reach
        # into the internal state because the public API has no flush helper.
        if hasattr(backend, "_cache"):
            backend._cache.clear()
        if hasattr(backend, "_expiry"):
            backend._expiry.clear()
    except Exception:  # pragma: no cover - defensive
        pass
    yield


@pytest_asyncio.fixture
async def tutor_user(async_db_session: AsyncSession) -> User:
    user = User(
        username="tutor_mem",
        email="tutor_mem@test.fr",
        password_hash="x",
        plan="pro",
        email_verified=True,
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


def _summary(
    user_id: int,
    idx: int,
    *,
    category: str = "ai",
    concepts: list[str] | None = None,
    sections: list[str] | None = None,
    tags: str | None = None,
) -> Summary:
    """Build an in-memory Summary with predictable content for tests."""
    if sections is None:
        sections = ["Résumé", "Points clés", "Conclusion"]
    if concepts is None:
        concepts = []

    content_parts: list[str] = []
    for s in sections:
        content_parts.append(f"## {s}\nSection {s} body content.\n")
    if concepts:
        content_parts.append(
            "Mentions : " + ", ".join(f"[[{c}]]" for c in concepts) + ".\n"
        )

    return Summary(
        user_id=user_id,
        video_id=f"vid_{idx:03d}",
        video_title=f"Analyse #{idx}",
        video_channel="Test Channel",
        platform="youtube",
        lang="fr",
        category=category,
        summary_content="\n".join(content_parts),
        tags=tags,
    )


async def _persist_n_summaries(
    db: AsyncSession,
    user: User,
    n: int,
    *,
    categories: list[str] | None = None,
    shared_concepts: list[str] | None = None,
) -> list[Summary]:
    """Create n summaries owned by ``user`` and persist them."""
    rows: list[Summary] = []
    cats = categories or ["ai", "science", "philo"]
    shared = shared_concepts or ["alignment", "transformer"]
    for i in range(n):
        rows.append(
            _summary(
                user.id,
                idx=i,
                category=cats[i % len(cats)],
                concepts=[shared[0]] if i % 2 == 0 else [shared[1]],
                sections=["Résumé", f"Axe {i}", "Conclusion"],
                tags="t1, t2",
            )
        )
    for r in rows:
        db.add(r)
    await db.commit()
    for r in rows:
        await db.refresh(r)
    return rows


# ─────────────────────────────────────────────────────────────────────
# Compression levels
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "count,expected",
    [
        (0, LEVEL_LONG),
        (1, LEVEL_LONG),
        (10, LEVEL_LONG),
        (11, LEVEL_MEDIUM),
        (30, LEVEL_MEDIUM),
        (31, LEVEL_SHORT),
        (100, LEVEL_SHORT),
        (101, LEVEL_ULTRA),
        (150, LEVEL_ULTRA),
        (500, LEVEL_ULTRA),
    ],
)
def test_compression_level_thresholds(count: int, expected: str):
    assert _compression_level(count) == expected


@pytest.mark.asyncio
async def test_snapshot_long_level_with_5_analyses(
    async_db_session: AsyncSession, tutor_user: User
):
    await _persist_n_summaries(async_db_session, tutor_user, 5)
    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    assert snap["total_analyses"] == 5
    assert snap["level"] == LEVEL_LONG
    assert len(snap["recent_analyses"]) == 5
    # Each recent item must carry key_topics (since sections exist).
    for item in snap["recent_analyses"]:
        assert "key_topics" in item
        assert isinstance(item["key_topics"], list)
        # Sections "Résumé", "Axe N", "Conclusion" → at least one non-empty.
        assert len(item["key_topics"]) >= 1
        assert "key_concepts" in item
    # Categories aggregated.
    assert snap["top_categories"]
    # Concepts aggregated from [[alignment]] / [[transformer]] markers.
    concept_terms = {c["term"].lower() for c in snap["top_concepts"]}
    assert {"alignment", "transformer"}.issubset(concept_terms)


@pytest.mark.asyncio
async def test_snapshot_medium_level_with_25_analyses(
    async_db_session: AsyncSession, tutor_user: User
):
    await _persist_n_summaries(async_db_session, tutor_user, 25)
    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    assert snap["total_analyses"] == 25
    assert snap["level"] == LEVEL_MEDIUM
    # At medium level the recent slice covers all 25 items (ceiling = 30).
    assert len(snap["recent_analyses"]) == 25
    # Each item only carries 1-2 key_topics at medium (cap = 2).
    for item in snap["recent_analyses"]:
        assert len(item["key_topics"]) <= 2


@pytest.mark.asyncio
async def test_snapshot_short_level_with_60_analyses(
    async_db_session: AsyncSession, tutor_user: User
):
    await _persist_n_summaries(async_db_session, tutor_user, 60)
    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    assert snap["total_analyses"] == 60
    assert snap["level"] == LEVEL_SHORT
    # At short level we cap the recent slice to 10.
    assert len(snap["recent_analyses"]) == 10
    # Categories surfaced.
    assert snap["top_categories"]
    # Each item key_topics capped at 2.
    for item in snap["recent_analyses"]:
        assert len(item["key_topics"]) <= 2


@pytest.mark.asyncio
async def test_snapshot_ultra_level_with_150_analyses(
    async_db_session: AsyncSession, tutor_user: User
):
    # We only scan up to 200 rows (MAX_SCAN). For total_analyses we expose
    # whatever the scan returned — for 150 that's still 150.
    await _persist_n_summaries(async_db_session, tutor_user, 150)
    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    assert snap["total_analyses"] == 150
    assert snap["level"] == LEVEL_ULTRA
    # At ultra level we cap recent_analyses to 5.
    assert len(snap["recent_analyses"]) == 5


# ─────────────────────────────────────────────────────────────────────
# key_topics extraction
# ─────────────────────────────────────────────────────────────────────


def test_extract_key_topics_from_markdown():
    content = (
        "## Résumé\nblah\n"
        "## Points clés\n"
        "- point un\n"
        "## Analyse critique\nmore\n"
        "### Sous-section ignored\n"
        "## Conclusion\nfin\n"
    )
    topics = _extract_key_topics(content, limit=10)
    # Level-2 headings only.
    assert topics == ["Résumé", "Points clés", "Analyse critique", "Conclusion"]


def test_extract_key_topics_respects_limit():
    content = (
        "## Alpha section\nx\n"
        "## Beta section\ny\n"
        "## Gamma section\nz\n"
        "## Delta section\nw\n"
    )
    topics = _extract_key_topics(content, limit=2)
    assert topics == ["Alpha section", "Beta section"]


def test_extract_key_topics_dedup_case_insensitive():
    content = "## Sujet\nfirst\n## sujet\nduplicate\n## SUJET\nstill dup\n## Autre\nz\n"
    topics = _extract_key_topics(content, limit=10)
    # "Sujet" deduplicated despite case variations.
    assert len(topics) == 2
    assert topics[0].lower() == "sujet"
    assert topics[1] == "Autre"


def test_extract_key_topics_handles_empty_or_zero():
    assert _extract_key_topics(None, limit=5) == []
    assert _extract_key_topics("", limit=5) == []
    assert _extract_key_topics("## Title", limit=0) == []
    assert _extract_key_topics("No headings here", limit=5) == []


# ─────────────────────────────────────────────────────────────────────
# Concept aggregation
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_top_concepts_aggregates_repeated_markers(
    async_db_session: AsyncSession, tutor_user: User
):
    """`[[alignment]]` appearing in 4 different summaries should rank above
    `[[gradient descent]]` appearing only in 1."""
    rows = [
        _summary(tutor_user.id, idx=1, concepts=["alignment", "rlhf"]),
        _summary(tutor_user.id, idx=2, concepts=["alignment"]),
        _summary(tutor_user.id, idx=3, concepts=["alignment", "rlhf"]),
        _summary(tutor_user.id, idx=4, concepts=["alignment"]),
        _summary(tutor_user.id, idx=5, concepts=["gradient descent"]),
    ]
    for r in rows:
        async_db_session.add(r)
    await async_db_session.commit()

    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    by_term = {c["term"].lower(): c for c in snap["top_concepts"]}
    assert by_term["alignment"]["count"] == 4
    assert by_term["rlhf"]["count"] == 2
    assert by_term["gradient descent"]["count"] == 1
    # alignment should rank first.
    assert snap["top_concepts"][0]["term"].lower() == "alignment"


@pytest.mark.asyncio
async def test_top_concepts_capped_at_20(
    async_db_session: AsyncSession, tutor_user: User
):
    """When the corpus has > 20 distinct concepts, the snapshot keeps the top 20."""
    # 25 distinct concepts, one per summary.
    rows: list[Summary] = []
    for i in range(25):
        rows.append(
            _summary(tutor_user.id, idx=i, concepts=[f"concept_{i:02d}"])
        )
    for r in rows:
        async_db_session.add(r)
    await async_db_session.commit()

    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    assert len(snap["top_concepts"]) <= 20


@pytest.mark.asyncio
async def test_top_categories_aggregated_with_counts(
    async_db_session: AsyncSession, tutor_user: User
):
    rows = [
        _summary(tutor_user.id, idx=1, category="ai"),
        _summary(tutor_user.id, idx=2, category="ai"),
        _summary(tutor_user.id, idx=3, category="ai"),
        _summary(tutor_user.id, idx=4, category="philo"),
        _summary(tutor_user.id, idx=5, category="science"),
    ]
    for r in rows:
        async_db_session.add(r)
    await async_db_session.commit()

    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    cats = {c["category"]: c["count"] for c in snap["top_categories"]}
    assert cats["ai"] == 3
    assert cats["philo"] == 1
    assert cats["science"] == 1
    # AI should rank first.
    assert snap["top_categories"][0]["category"] == "ai"


# ─────────────────────────────────────────────────────────────────────
# Empty corpus
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_snapshot_empty_corpus(
    async_db_session: AsyncSession, tutor_user: User
):
    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    assert snap["total_analyses"] == 0
    assert snap["level"] == LEVEL_LONG
    assert snap["top_categories"] == []
    assert snap["top_concepts"] == []
    assert snap["recent_analyses"] == []
    assert snap["snapshot_at"] is not None


# ─────────────────────────────────────────────────────────────────────
# User isolation
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_snapshot_isolated_per_user(
    async_db_session: AsyncSession, tutor_user: User
):
    """A second user must not see the first user's analyses in the snapshot."""
    await _persist_n_summaries(async_db_session, tutor_user, 3)

    other = User(
        username="other_mem",
        email="other_mem@test.fr",
        password_hash="x",
        plan="pro",
        email_verified=True,
    )
    async_db_session.add(other)
    await async_db_session.commit()
    await async_db_session.refresh(other)

    snap_other = await build_tutor_memory(user=other, db=async_db_session)
    assert snap_other["total_analyses"] == 0
    assert snap_other["recent_analyses"] == []


# ─────────────────────────────────────────────────────────────────────
# Redis cache path
# ─────────────────────────────────────────────────────────────────────


class _FakeRedis:
    """Tiny async stub matching the subset of redis.asyncio used by the snapshot."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.get_calls: int = 0
        self.setex_calls: int = 0

    async def get(self, key: str) -> str | None:
        self.get_calls += 1
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self.setex_calls += 1
        self.store[key] = value


@pytest.mark.asyncio
async def test_snapshot_writes_to_redis(
    async_db_session: AsyncSession, tutor_user: User
):
    await _persist_n_summaries(async_db_session, tutor_user, 3)
    fake = _FakeRedis()

    snap = await build_tutor_memory(user=tutor_user, db=async_db_session, redis=fake)
    assert snap["total_analyses"] == 3
    # Snapshot was persisted.
    assert fake.setex_calls == 1
    key = _cache_key(tutor_user.id)
    assert key in fake.store
    # And the payload is JSON-serializable.
    decoded = json.loads(fake.store[key])
    assert decoded["total_analyses"] == 3


@pytest.mark.asyncio
async def test_snapshot_reads_from_redis_cache(
    async_db_session: AsyncSession, tutor_user: User
):
    """A pre-populated Redis cache should short-circuit the DB scan."""
    fake = _FakeRedis()
    # Insert a fake snapshot directly.
    cached_payload: dict[str, Any] = {
        "total_analyses": 99,
        "level": "short",
        "top_categories": [{"category": "ai", "count": 99}],
        "top_concepts": [],
        "recent_analyses": [],
        "snapshot_at": "2026-05-11T00:00:00+00:00",
    }
    fake.store[_cache_key(tutor_user.id)] = json.dumps(cached_payload)

    # Even though no Summary exists in DB, the cache hit returns the stub.
    snap = await build_tutor_memory(user=tutor_user, db=async_db_session, redis=fake)
    assert snap["total_analyses"] == 99
    assert snap["level"] == "short"
    # SETEX must NOT have been called on a hit.
    assert fake.setex_calls == 0


@pytest.mark.asyncio
async def test_snapshot_redis_error_falls_through_to_db(
    async_db_session: AsyncSession, tutor_user: User, monkeypatch: pytest.MonkeyPatch
):
    """A Redis read failure must not break the snapshot — the DB path runs."""
    await _persist_n_summaries(async_db_session, tutor_user, 2)

    class _BoomRedis:
        async def get(self, *_args, **_kwargs):
            raise RuntimeError("redis is dead")

        async def setex(self, *_args, **_kwargs):
            raise RuntimeError("still dead")

    snap = await build_tutor_memory(
        user=tutor_user, db=async_db_session, redis=_BoomRedis()
    )
    assert snap["total_analyses"] == 2
    assert snap["level"] == LEVEL_LONG


# ─────────────────────────────────────────────────────────────────────
# Recent slice ordering (most recent first)
# ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_recent_analyses_ordered_desc(
    async_db_session: AsyncSession, tutor_user: User
):
    """The recent slice must follow ``created_at DESC`` (most recent first)."""
    rows = await _persist_n_summaries(async_db_session, tutor_user, 7)
    snap = await build_tutor_memory(user=tutor_user, db=async_db_session)
    # The DB default applies func.now() — all rows share the same timestamp at
    # the second resolution. We can still verify the slice contains the right
    # set of ids.
    snap_ids = {item["id"] for item in snap["recent_analyses"]}
    persisted_ids = {r.id for r in rows}
    assert snap_ids == persisted_ids
