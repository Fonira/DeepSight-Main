"""Backend tools exposed to the KNOWLEDGE_TUTOR voice agent.

The KNOWLEDGE_TUTOR agent reasons over the *user's whole history* of video
analyses (not a single video). These four async tools let it pull just enough
context per turn:

    - get_user_history    : last N analyses (title / platform / date / concepts)
    - get_concept_keys    : top concepts/keywords aggregated across history
    - search_history      : semantic search over the user's corpus (V1, PR #292)
    - get_summary_detail  : full details of a precise analysis

All tools take a `user: User` parameter so they cannot leak across users — they
are bound to the session's authenticated user, never to a free-text user_id.

Each tool returns a structured `dict` (or `list[dict]`) so the router can
forward it to ElevenLabs' webhook tool runtime as-is. The voice agent then
picks the relevant facts from the JSON.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Summary, User

logger = logging.getLogger(__name__)


# Same regex as history_router.py — matches Obsidian-style [[concept]] or
# [[concept|alias]] markers embedded in summary_content by Mistral.
_CONCEPT_PATTERN = re.compile(r"\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]")


def _summary_concept_keys(summary: Summary, limit: int = 5) -> list[str]:
    """Extract concept keys from a Summary (concepts > tags fallback).

    Mirrors history_router's get_all_keywords priority:
    1. [[concept]] markers in summary_content
    2. comma-separated tags
    """
    seen: set[str] = set()
    keys: list[str] = []

    if summary.summary_content:
        for match in _CONCEPT_PATTERN.findall(summary.summary_content):
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

    if summary.tags:
        for raw in summary.tags.split(","):
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


# ─────────────────────────────────────────────────────────────────────
# Tool 1 : get_user_history
# ─────────────────────────────────────────────────────────────────────


async def get_user_history(
    user: User,
    db: AsyncSession,
    limit: int = 10,
    days_back: int = 60,
) -> list[dict[str, Any]]:
    """Return the last N analyses owned by the user.

    Each item: {id, title, video_id, platform, created_at, key_concepts}.
    Bounded by days_back to avoid pulling ancient history into the model.
    """
    limit = max(1, min(int(limit), 25))
    days_back = max(1, min(int(days_back), 365))
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

    logger.info(
        "knowledge_tutor.get_user_history",
        extra={"user_id": user.id, "limit": limit, "days_back": days_back},
    )

    try:
        stmt = (
            select(Summary)
            .where(Summary.user_id == user.id)
            .where(Summary.created_at >= cutoff)
            .order_by(Summary.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        rows = list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001
        logger.error("get_user_history failed: %s", exc, exc_info=True)
        return []

    items: list[dict[str, Any]] = []
    for s in rows:
        items.append(
            {
                "id": s.id,
                "title": s.video_title or "",
                "video_id": s.video_id or "",
                "platform": s.platform or "youtube",
                "channel": s.video_channel or "",
                "category": s.category or "",
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "key_concepts": _summary_concept_keys(s, limit=5),
            }
        )
    return items


# ─────────────────────────────────────────────────────────────────────
# Tool 2 : get_concept_keys
# ─────────────────────────────────────────────────────────────────────


async def get_concept_keys(
    user: User,
    db: AsyncSession,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Return the top aggregated concepts/keywords across the user's history.

    Mirrors `/api/history/keywords` extraction logic: priority to [[concept]]
    markers in summary_content, fallback to comma-separated tags. Each
    concept is returned with the most recent summary it was found in
    (so the agent can quote `summary_id` if it wants to dig deeper via
    get_summary_detail).
    """
    limit = max(1, min(int(limit), 100))

    logger.info(
        "knowledge_tutor.get_concept_keys",
        extra={"user_id": user.id, "limit": limit},
    )

    try:
        stmt = (
            select(
                Summary.id,
                Summary.summary_content,
                Summary.tags,
                Summary.video_title,
                Summary.video_id,
                Summary.category,
                Summary.created_at,
            )
            .where(Summary.user_id == user.id)
            .where(or_(Summary.tags.isnot(None), Summary.summary_content.isnot(None)))
            .order_by(Summary.created_at.desc())
            .limit(200)
        )
        result = await db.execute(stmt)
        rows = list(result.all())
    except Exception as exc:  # noqa: BLE001
        logger.error("get_concept_keys failed: %s", exc, exc_info=True)
        return []

    seen: set[str] = set()
    keywords: list[dict[str, Any]] = []

    def _add(term: str, row) -> None:
        term = term.strip()
        if not term or len(term) < 2:
            return
        tl = term.lower()
        if tl in seen:
            return
        if len(keywords) >= limit:
            return
        seen.add(tl)
        keywords.append(
            {
                "term": term,
                "summary_id": row.id,
                "video_title": row.video_title or "",
                "video_id": row.video_id or "",
                "category": row.category or "",
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )

    for row in rows:
        if len(keywords) >= limit:
            break
        if row.summary_content:
            for concept in _CONCEPT_PATTERN.findall(row.summary_content):
                _add(concept, row)
                if len(keywords) >= limit:
                    break
        if len(keywords) >= limit:
            break
        if row.tags:
            for tag in row.tags.split(","):
                _add(tag, row)
                if len(keywords) >= limit:
                    break

    return keywords


# ─────────────────────────────────────────────────────────────────────
# Tool 3 : search_history (semantic V1)
# ─────────────────────────────────────────────────────────────────────


async def search_history(
    user: User,
    query: str,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Semantic search over the user's whole history (PR #292 V1 pipeline).

    Uses search.global_search.search_global() which handles the cosine on
    embeddings stored across summary / flashcard / quiz / chat / transcript
    tables, all filtered by user_id. Returns a slim shape suited to the voice
    agent (no embedding payloads).
    """
    if not query or len(query.strip()) < 2:
        return []

    top_k = max(1, min(int(top_k), 20))

    logger.info(
        "knowledge_tutor.search_history",
        extra={"user_id": user.id, "top_k": top_k},
    )

    try:
        # Lazy import: avoid pulling search subsystem at module import time.
        from search.global_search import search_global, SearchFilters

        filters = SearchFilters(limit=top_k)
        results = await search_global(user_id=user.id, query=query, filters=filters)
    except Exception as exc:  # noqa: BLE001
        logger.error("search_history failed: %s", exc, exc_info=True)
        return []

    items: list[dict[str, Any]] = []
    for r in results:
        meta = r.source_metadata or {}
        items.append(
            {
                "source_type": r.source_type,
                "summary_id": r.summary_id,
                "score": round(float(r.score), 3),
                "text_preview": (r.text_preview or "")[:400],
                "video_title": meta.get("summary_title", ""),
                "video_id": meta.get("video_id", ""),
                "channel": meta.get("channel", ""),
            }
        )
    return items


# ─────────────────────────────────────────────────────────────────────
# Tool 4 : get_summary_detail
# ─────────────────────────────────────────────────────────────────────


async def get_summary_detail(
    user: User,
    db: AsyncSession,
    summary_id: int,
) -> dict[str, Any]:
    """Return the full detail of one analysis owned by the user.

    Includes title, full_digest (or a clipped summary_content fallback), key
    points (parsed from the markdown headers when present), and the fact-check
    JSON when available.
    """
    try:
        sid = int(summary_id)
    except (TypeError, ValueError):
        return {"error": "invalid_summary_id"}

    logger.info(
        "knowledge_tutor.get_summary_detail",
        extra={"user_id": user.id, "summary_id": sid},
    )

    try:
        result = await db.execute(
            select(Summary).where(Summary.id == sid).where(Summary.user_id == user.id)
        )
        summary = result.scalar_one_or_none()
    except Exception as exc:  # noqa: BLE001
        logger.error("get_summary_detail failed: %s", exc, exc_info=True)
        return {"error": "lookup_failed"}

    if summary is None:
        return {"error": "not_found"}

    # full_digest may be JSON or raw text — both are valid in prod.
    digest_raw = summary.full_digest or summary.summary_content or ""
    digest_text = digest_raw
    digest_json: Optional[dict] = None
    if summary.full_digest:
        try:
            digest_json = json.loads(summary.full_digest)
            if isinstance(digest_json, dict):
                # Prefer the human-readable "digest" field if present
                digest_text = digest_json.get("digest") or digest_json.get("summary") or digest_raw
        except (json.JSONDecodeError, TypeError):
            digest_json = None

    # Clip to keep voice payloads bounded.
    if digest_text and len(digest_text) > 4000:
        digest_text = digest_text[:4000] + "…"

    # Key points: try to grab the "## Points clés" / "## Key points" section.
    key_points = _extract_key_points(summary.summary_content or "")

    # Fact-check JSON (if any).
    fact_check: Any = None
    if summary.fact_check_result:
        try:
            fact_check = json.loads(summary.fact_check_result)
        except (json.JSONDecodeError, TypeError):
            fact_check = summary.fact_check_result

    return {
        "id": summary.id,
        "title": summary.video_title or "",
        "video_id": summary.video_id or "",
        "platform": summary.platform or "youtube",
        "channel": summary.video_channel or "",
        "category": summary.category or "",
        "created_at": summary.created_at.isoformat() if summary.created_at else None,
        "digest": digest_text,
        "key_points": key_points,
        "fact_check": fact_check,
        "reliability_score": summary.reliability_score,
        "key_concepts": _summary_concept_keys(summary, limit=10),
    }


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────


_KEY_POINTS_HEADERS = (
    "points clés",
    "points cles",
    "key points",
    "points essentiels",
    "idées principales",
    "idees principales",
)


def _extract_key_points(content: str, max_points: int = 8) -> list[str]:
    """Best-effort extraction of bullet points under a 'Key points' header.

    Returns up to ``max_points`` raw bullets. Used to feed the voice agent a
    short list it can quote back to the user.
    """
    if not content or not content.strip():
        return []

    capturing = False
    bullets: list[str] = []
    for raw_line in content.split("\n"):
        line = raw_line.rstrip()
        stripped = line.strip()

        if stripped.startswith("##"):
            if capturing:
                # Reached the next section — stop.
                break
            header = stripped.lstrip("#").strip().lower()
            if any(needle in header for needle in _KEY_POINTS_HEADERS):
                capturing = True
            continue

        if capturing and stripped.startswith(("- ", "* ", "• ")):
            point = stripped.lstrip("-*• ").strip()
            if point:
                bullets.append(point)
                if len(bullets) >= max_points:
                    break

    return bullets
