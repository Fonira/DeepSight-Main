"""Adaptive memory snapshot of the user's analysis history for KNOWLEDGE_TUTOR.

The KNOWLEDGE_TUTOR voice agent needs a *carte mentale* (mind map) of the
user's whole learning path before it can pick a revision topic. The existing
helpers (``get_user_history`` + ``get_concept_keys``) return raw lists, but when
the user owns 30+ analyses the agent gets overwhelmed and fails to pick a
direction.

This module builds a **compressed snapshot** whose shape depends on the total
analysis count:

    ≤ 10  → long    : full per-analysis detail (title + 3-5 key_topics + concepts)
    11-30 → medium  : per-analysis with fewer key_topics (1-2 per item)
    31-100 → short  : aggregated (top categories + top concepts + 10 recent items)
    > 100 → ultra   : aggregated + 5 most recent items only

The "key_topics" of each analysis are extracted directly from the markdown
``## `` section headings in ``summary.summary_content`` — no extra Mistral
call required for V1.

Result is cached for 30 minutes in Redis under ``tutor:memory:{user_id}`` so
repeated calls during the same voice session reuse the same snapshot.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, User

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────
# Constants — compression levels
# ─────────────────────────────────────────────────────────────────────

LEVEL_LONG = "long"
LEVEL_MEDIUM = "medium"
LEVEL_SHORT = "short"
LEVEL_ULTRA = "ultra"

# Cap on the number of summaries we scan when aggregating categories / concepts.
# Beyond this the snapshot becomes too costly without adding signal — the agent
# only needs the dominant themes, not exhaustive coverage.
_MAX_SCAN_ROWS = 200

# Cache TTL (seconds). 30 min is enough to cover the longest voice session
# (15 min) plus the user resuming a session a few minutes later.
CACHE_TTL_SECONDS = 30 * 60

# Same regex as knowledge_tutor_tools.py — Obsidian-style [[concept]] markers.
_CONCEPT_PATTERN = re.compile(r"\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]")

# Markdown heading pattern: only ``## `` (level-2) at the start of a line.
# Avoids capturing ``### `` (level-3) — too noisy and not what the agent needs
# as macro-axes.
_HEADING_PATTERN = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)


# ─────────────────────────────────────────────────────────────────────
# Helpers — extraction
# ─────────────────────────────────────────────────────────────────────


def _extract_key_topics(content: Optional[str], limit: int) -> list[str]:
    """Extract macro-axes (``## `` section headings) from a markdown summary.

    Heading text is stripped, deduplicated case-insensitively, and capped at
    ``limit``. Returns an empty list when ``content`` is empty.

    Examples:
        >>> _extract_key_topics("## Résumé\\nblah\\n## Points clés\\nfoo", 5)
        ['Résumé', 'Points clés']
    """
    if not content or not content.strip() or limit <= 0:
        return []

    seen: set[str] = set()
    topics: list[str] = []
    for match in _HEADING_PATTERN.findall(content):
        topic = match.strip().lstrip("#").strip()
        if not topic:
            continue
        # Drop leading bullets / decorations like "- " or "1. " that sometimes
        # creep into markdown headings.
        topic = topic.lstrip("-*0123456789. ").strip()
        if not topic or len(topic) < 2:
            continue
        tl = topic.lower()
        if tl in seen:
            continue
        seen.add(tl)
        topics.append(topic)
        if len(topics) >= limit:
            break
    return topics


def _extract_concepts(content: Optional[str], tags: Optional[str], limit: int) -> list[str]:
    """Extract ``[[concept]]`` markers + tag fallback (same logic as
    ``knowledge_tutor_tools._summary_concept_keys``). Returned terms are
    deduplicated case-insensitively and capped at ``limit``."""
    if limit <= 0:
        return []
    seen: set[str] = set()
    keys: list[str] = []

    if content:
        for match in _CONCEPT_PATTERN.findall(content):
            term = match.strip()
            if not term or len(term) < 2:
                continue
            tl = term.lower()
            if tl in seen:
                continue
            seen.add(tl)
            keys.append(term)
            if len(keys) >= limit:
                return keys

    if tags:
        for raw in tags.split(","):
            term = raw.strip()
            if not term or len(term) < 2:
                continue
            tl = term.lower()
            if tl in seen:
                continue
            seen.add(tl)
            keys.append(term)
            if len(keys) >= limit:
                break

    return keys


def _compression_level(count: int) -> str:
    """Map a total analysis count to a compression level."""
    if count <= 10:
        return LEVEL_LONG
    if count <= 30:
        return LEVEL_MEDIUM
    if count <= 100:
        return LEVEL_SHORT
    return LEVEL_ULTRA


def _topics_per_item(level: str) -> int:
    """Max number of ``key_topics`` to surface per analysis at this level."""
    if level == LEVEL_LONG:
        return 5
    if level == LEVEL_MEDIUM:
        return 2
    # short / ultra: aggregated view, recent items only carry a couple of axes.
    return 2


def _concepts_per_item(level: str) -> int:
    """Max number of ``key_concepts`` to surface per analysis at this level."""
    if level == LEVEL_LONG:
        return 5
    if level == LEVEL_MEDIUM:
        return 3
    return 3


def _recent_count(level: str) -> int:
    """How many of the most recent analyses to surface verbatim."""
    if level == LEVEL_LONG:
        # All of them (up to 10 — that's the LEVEL_LONG ceiling).
        return 10
    if level == LEVEL_MEDIUM:
        # All of them (up to 30 — that's the LEVEL_MEDIUM ceiling).
        return 30
    if level == LEVEL_SHORT:
        return 10
    return 5  # LEVEL_ULTRA


# ─────────────────────────────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────────────────────────────


def _cache_key(user_id: int) -> str:
    return f"tutor:memory:{user_id}"


async def _read_from_redis(redis, key: str) -> Optional[dict[str, Any]]:
    """Fetch a JSON payload from a redis client. Returns None on miss / error."""
    if redis is None:
        return None
    try:
        raw = await redis.get(key)
        if raw is None:
            return None
        # decode_responses=True is the project default (core.cache) → strings
        # come back as str. Be defensive for raw clients passed by tests.
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        return json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning("tutor_memory: redis GET failed: %s", exc)
        return None


async def _write_to_redis(redis, key: str, payload: dict[str, Any]) -> None:
    """Set the payload in redis with TTL. Best-effort — failures are swallowed."""
    if redis is None:
        return
    try:
        serialized = json.dumps(payload, ensure_ascii=False, default=str)
        # redis.asyncio exposes setex(name, time, value).
        await redis.setex(key, CACHE_TTL_SECONDS, serialized)
    except Exception as exc:  # noqa: BLE001
        logger.warning("tutor_memory: redis SETEX failed: %s", exc)


async def _read_from_cache_service(key: str) -> Optional[dict[str, Any]]:
    """Fallback cache read via the project-wide ``cache_service`` singleton.

    Used when no explicit ``redis`` client is passed — keeps the snapshot warm
    even in dev (in-memory cachetools) or when the route doesn't have a
    request-scoped redis client.
    """
    try:
        from core.cache import cache_service

        return await cache_service.get(key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("tutor_memory: cache_service GET failed: %s", exc)
        return None


async def _write_to_cache_service(key: str, payload: dict[str, Any]) -> None:
    """Best-effort write via the project-wide ``cache_service`` singleton."""
    try:
        from core.cache import cache_service

        await cache_service.set(key, payload, ttl=CACHE_TTL_SECONDS)
    except Exception as exc:  # noqa: BLE001
        logger.warning("tutor_memory: cache_service SET failed: %s", exc)


# ─────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────


async def build_tutor_memory(
    user: User,
    db: AsyncSession,
    redis: Optional[Any] = None,
) -> dict[str, Any]:
    """Build an adaptive memory snapshot of the user's analysis history.

    Compression level adapts to total analysis count:
        ≤ 10   → ``long``   per-analysis: title + up to 5 key_topics + concepts
        11-30  → ``medium`` per-analysis: title + up to 2 key_topics + concepts
        31-100 → ``short``  top 10 categories + top 20 concepts + 10 recent items
        > 100  → ``ultra``  same as ``short`` but only 5 most recent items

    Args:
        user: the authenticated User (snapshot is strictly scoped to this user).
        db: async DB session.
        redis: optional explicit redis client. When None, falls back to the
            project ``cache_service`` singleton (Redis when prod, in-memory
            elsewhere).

    Returns:
        A JSON-friendly dict with the shape::

            {
                "total_analyses": int,
                "level": "long" | "medium" | "short" | "ultra",
                "top_categories": [{"category": str, "count": int}, ...],
                "top_concepts":   [{"term": str, "count": int,
                                    "latest_summary_id": int}, ...],
                "recent_analyses": [
                    {
                        "id": int,
                        "title": str,
                        "platform": str,
                        "created_at": iso-str | None,
                        "category": str,
                        "key_topics": [str, ...],
                        "key_concepts": [str, ...],
                    },
                    ...
                ],
                "snapshot_at": iso-str,
            }
    """
    cache_key = _cache_key(user.id)

    # ── Cache hit? ───────────────────────────────────────────────────
    cached: Optional[dict[str, Any]] = None
    if redis is not None:
        cached = await _read_from_redis(redis, cache_key)
    if cached is None:
        cached = await _read_from_cache_service(cache_key)
    if cached is not None:
        logger.info(
            "tutor_memory.cache_hit",
            extra={"user_id": user.id, "level": cached.get("level")},
        )
        return cached

    # ── Cache miss → rebuild ─────────────────────────────────────────
    logger.info("tutor_memory.cache_miss", extra={"user_id": user.id})

    try:
        stmt = (
            select(Summary)
            .where(Summary.user_id == user.id)
            .order_by(Summary.created_at.desc())
            .limit(_MAX_SCAN_ROWS)
        )
        result = await db.execute(stmt)
        rows = list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001
        logger.error("tutor_memory: DB select failed: %s", exc, exc_info=True)
        rows = []

    total = len(rows)
    level = _compression_level(total)
    topics_limit = _topics_per_item(level)
    concepts_limit = _concepts_per_item(level)
    recent_n = _recent_count(level)

    # ── Aggregate top categories + top concepts across the scan ───────
    category_counts: dict[str, int] = {}
    # term lower → {"term": original_case, "count": int, "latest_summary_id": int}
    concept_index: dict[str, dict[str, Any]] = {}

    for s in rows:
        cat = (s.category or "").strip()
        if cat:
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # Concept terms from [[markers]] + tag fallback, scanned with a wide
        # per-row cap (10) so the global aggregate has good coverage.
        for term in _extract_concepts(s.summary_content, s.tags, limit=10):
            tl = term.lower()
            entry = concept_index.get(tl)
            if entry is None:
                concept_index[tl] = {
                    "term": term,
                    "count": 1,
                    "latest_summary_id": s.id,
                }
            else:
                entry["count"] += 1
                # rows are ordered DESC → first occurrence has the latest id.

    top_categories = sorted(
        ({"category": k, "count": v} for k, v in category_counts.items()),
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    top_concepts_limit = 20 if level in (LEVEL_SHORT, LEVEL_ULTRA) else 20
    top_concepts = sorted(
        concept_index.values(),
        key=lambda x: x["count"],
        reverse=True,
    )[:top_concepts_limit]

    # ── Recent analyses verbatim slice ────────────────────────────────
    recent_rows = rows[:recent_n]
    recent_analyses: list[dict[str, Any]] = []
    for s in recent_rows:
        recent_analyses.append(
            {
                "id": s.id,
                "title": s.video_title or "",
                "platform": s.platform or "youtube",
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "category": s.category or "",
                "key_topics": _extract_key_topics(s.summary_content, topics_limit),
                "key_concepts": _extract_concepts(
                    s.summary_content, s.tags, limit=concepts_limit
                ),
            }
        )

    snapshot: dict[str, Any] = {
        "total_analyses": total,
        "level": level,
        "top_categories": top_categories,
        "top_concepts": top_concepts,
        "recent_analyses": recent_analyses,
        "snapshot_at": datetime.now(timezone.utc).isoformat(),
    }

    # ── Cache write (best-effort) ────────────────────────────────────
    if redis is not None:
        await _write_to_redis(redis, cache_key, snapshot)
    await _write_to_cache_service(cache_key, snapshot)

    return snapshot
