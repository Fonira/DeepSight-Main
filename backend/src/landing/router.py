"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🌐 LANDING PUBLIC ROUTER — Stats homepage (no auth)                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  GET /api/public/landing-stats                                               ║
║  Renvoie 3 compteurs agrégés (vidéos analysées, mots synthétisés,            ║
║  utilisateurs actifs 30 j) avec cache Redis 1 h.                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User, Summary
from core.cache import cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["Landing Public"])


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class LandingStatsResponse(BaseModel):
    """Compteurs agrégés exposés publiquement sur la homepage."""

    total_videos_analyzed: int
    total_words_synthesized: int
    active_users_30d: int


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════


CACHE_KEY = "landing:public_stats"
CACHE_TTL_SECONDS = 3600  # 1 hour


async def _compute_landing_stats(session: AsyncSession) -> dict:
    """Calcule les 3 agrégats à partir de la DB.

    Modèle SQL inspiré de admin/router.py mais sans auth admin.
    Aucune PII : uniquement des counts agrégés globaux.
    """
    total_videos_result = await session.execute(
        select(func.coalesce(func.sum(User.total_videos), 0))
    )
    total_videos = int(total_videos_result.scalar() or 0)

    total_words_result = await session.execute(
        select(func.coalesce(func.sum(User.total_words), 0))
    )
    total_words = int(total_words_result.scalar() or 0)

    cutoff = datetime.utcnow() - timedelta(days=30)
    active_users_result = await session.execute(
        select(func.count(distinct(Summary.user_id))).where(Summary.created_at >= cutoff)
    )
    active_users = int(active_users_result.scalar() or 0)

    return {
        "total_videos_analyzed": total_videos,
        "total_words_synthesized": total_words,
        "active_users_30d": active_users,
    }


@router.get("/landing-stats", response_model=LandingStatsResponse)
async def get_landing_stats(session: AsyncSession = Depends(get_session)):
    """
    📊 Compteurs publics homepage.

    - **total_videos_analyzed** : sum(User.total_videos) — toutes les analyses cumulées
    - **total_words_synthesized** : sum(User.total_words) — tous les mots des synthèses
    - **active_users_30d** : count distinct user_id avec une Summary créée < 30 j

    Cache Redis 1 h (clé `landing:public_stats`). Pas d'auth requise.
    """

    async def _factory():
        return await _compute_landing_stats(session)

    stats = await cache_service.get_or_set(CACHE_KEY, _factory, ttl=CACHE_TTL_SECONDS)

    if stats is None:
        # cache_service KO : recompute live
        logger.warning(
            "cache_service.get_or_set returned None for %s, computing live", CACHE_KEY
        )
        stats = await _compute_landing_stats(session)

    return LandingStatsResponse(**stats)
