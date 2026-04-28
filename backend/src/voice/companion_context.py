"""Builder principal du contexte COMPANION agent — profil + recos + cache."""

import json
import logging
from voice.schemas import CompanionContextResponse, ProfileBlock

logger = logging.getLogger(__name__)

CACHE_KEY_TEMPLATE = "companion_context:{user_id}"
CACHE_TTL_SECONDS = 3600  # 1h


async def build_companion_context(
    user,
    db,
    redis,
    services,
    force_refresh: bool = False,
) -> CompanionContextResponse:
    cache_key = CACHE_KEY_TEMPLATE.format(user_id=user.id)

    if not force_refresh:
        cached = await redis.get(cache_key)
        if cached:
            try:
                data = json.loads(cached)
                resp = CompanionContextResponse(**data)
                resp.cache_hit = True
                return resp
            except (json.JSONDecodeError, ValueError) as exc:
                logger.warning("companion_context cache decode failed: %s", exc)

    # Cache miss → full pipeline
    total = await db.fetch_user_summary_count(user_id=user.id)
    recents = await db.fetch_recent_summaries(user_id=user.id, limit=5)
    stats = await db.fetch_user_study_stats(user_id=user.id)
    themes = await services.themes_fn(user_id=user.id, db=db)

    primary_theme = themes[0] if themes else "découverte"
    initial_recos = await services.initial_recos_fn(primary_theme=primary_theme)

    profile = ProfileBlock(
        prenom=user.first_name or user.prenom or "ami",
        plan=user.plan,
        langue=getattr(user, "language", "fr") or "fr",
        total_analyses=total,
        recent_titles=[r.title for r in recents],
        themes=themes,
        streak_days=getattr(stats, "current_streak_days", 0) or 0,
        flashcards_due_today=getattr(stats, "flashcards_due_today", 0) or 0,
    )

    resp = CompanionContextResponse(
        profile=profile,
        initial_recos=initial_recos,
        cache_hit=False,
    )

    # Write-through cache
    try:
        await redis.set(cache_key, resp.model_dump_json(), ex=CACHE_TTL_SECONDS)
    except Exception as exc:
        logger.warning("companion_context cache write failed: %s", exc)

    return resp


async def invalidate_companion_context_cache(redis, user_id: int) -> None:
    """Hook appelé depuis /videos/analyze pour invalider le cache."""
    try:
        await redis.delete(CACHE_KEY_TEMPLATE.format(user_id=user_id))
    except Exception as exc:
        logger.warning("companion_context cache invalidate failed: %s", exc)
