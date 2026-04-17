"""
Voice Debate Avatar — Dynamic avatar generation for the debate moderator voice agent.

Strategy:
  - Reuse the existing `keyword_images` pipeline (Mistral Art Director → FLUX / DALL-E).
  - Derive a deterministic "term" from the debate's detected topic so that two
    debates on the same topic share the same avatar (cache cross-user).
  - Cache lookup via `get_image_url(term)` — hash-based dedup.
  - Generation is fired as a background task to keep the API response fast.

Public API:
  - `build_avatar_term(topic)`          → normalized cache key
  - `get_debate_avatar_url(debate)`     → Optional[str] — cache lookup
  - `ensure_debate_avatar(debate, ...)` → kicks off generation if missing
  - `generate_debate_avatar(debate)`    → awaitable generation (for workers)
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional

from db.database import DebateAnalysis
from images.keyword_images import (
    generate_keyword_image,
    get_image_url,
    _get_pool,
)

logger = logging.getLogger(__name__)


# ─── Term normalization ───────────────────────────────────────────────────────

_AVATAR_PREFIX = "debate-avatar"
_AVATAR_CATEGORY = "debate-avatar"
_TOPIC_MAX_LEN = 180


def _normalize_topic(topic: str) -> str:
    """Lowercase, strip, collapse whitespace, truncate. Deterministic."""
    if not topic:
        return "sans-sujet"
    t = topic.strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t[:_TOPIC_MAX_LEN]


def build_avatar_term(topic: Optional[str]) -> str:
    """Cache key used by `keyword_images.term_hash`.

    Two debates on the same topic → same avatar (desirable cross-user cache).
    """
    return f"{_AVATAR_PREFIX}:{_normalize_topic(topic or '')}"


def _build_definition(debate: DebateAnalysis) -> str:
    """Build a short "definition" string fed into the Art Director stage.

    Helps the Mistral Art Director produce a balanced, symbolic metaphor
    (two perspectives confronting each other) rather than a generic illustration.
    """
    topic = debate.detected_topic or "un débat d'idées"
    channel_a = (debate.video_a_channel or "Perspective A").strip()
    channel_b = (debate.video_b_channel or "Perspective B").strip()
    return (
        f"Avatar pour un modérateur de débat IA neutre et équilibré. "
        f"Sujet du débat : {topic}. "
        f"Deux perspectives confrontées : « {channel_a} » vs « {channel_b} ». "
        f"Style recherché : symbolique, équilibré, abstrait — "
        f"évoque la pesée de deux points de vue, la balance, le dialogue. "
        f"Ambiance : moderne, intellectuelle, accessible."
    )


# ─── Cache lookup ─────────────────────────────────────────────────────────────

async def get_debate_avatar_url(debate: DebateAnalysis, pool=None) -> Optional[str]:
    """Return the cached avatar URL for this debate, or None if not ready."""
    term = build_avatar_term(debate.detected_topic)
    try:
        return await get_image_url(term, pool=pool)
    except Exception as e:
        logger.warning("⚠️ Avatar cache lookup failed for debate %s: %s", debate.id, e)
        return None


# ─── Generation ───────────────────────────────────────────────────────────────

async def generate_debate_avatar(debate: DebateAnalysis, pool=None) -> Optional[str]:
    """Synchronously generate the avatar via the full image pipeline.

    Uses `premium=True` to leverage Mistral FLUX Pro Ultra / DALL-E 3 for
    a higher-quality avatar (one-shot cost, cached forever).
    """
    term = build_avatar_term(debate.detected_topic)
    definition = _build_definition(debate)

    if pool is None:
        try:
            pool = await _get_pool()
        except Exception as e:
            logger.error("❌ Avatar gen: pool unavailable: %s", e)
            return None

    # Double-check cache right before firing — race-safe
    existing = await get_image_url(term, pool=pool)
    if existing:
        logger.info("🎨 Debate avatar already cached for topic=%r", term)
        return existing

    logger.info("🎨 Generating debate avatar for debate_id=%s topic=%r", debate.id, term)
    try:
        url = await generate_keyword_image(
            term=term,
            definition=definition,
            category=_AVATAR_CATEGORY,
            premium=True,
            pool=pool,
        )
        if url:
            logger.info("✅ Debate avatar ready: debate_id=%s url=%s", debate.id, url)
        else:
            logger.warning("⚠️ Debate avatar generation returned None: debate_id=%s", debate.id)
        return url
    except Exception as e:
        logger.exception("❌ Debate avatar generation failed: debate_id=%s err=%s", debate.id, e)
        return None


def ensure_debate_avatar(debate: DebateAnalysis) -> None:
    """Fire-and-forget: kicks off avatar generation in the background.

    Safe to call multiple times — the pipeline short-circuits on cache hit.
    Intended to be called at the moment the debate pipeline completes.
    """
    try:
        # Schedule on the running loop so the caller is not blocked.
        loop = asyncio.get_event_loop()
        loop.create_task(generate_debate_avatar(debate))
    except RuntimeError:
        # No running loop — fallback: run in a new loop (rare, mostly for tests)
        try:
            asyncio.run(generate_debate_avatar(debate))
        except Exception as e:
            logger.error("❌ ensure_debate_avatar fallback failed: %s", e)
