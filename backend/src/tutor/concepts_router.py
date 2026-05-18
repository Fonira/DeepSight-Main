"""Endpoints REST pour le carrousel concepts illustrés Tuteur.

Routes:
- GET  /api/tutor/concepts           — liste concepts du user + images si ready
- POST /api/tutor/concepts/generate  — déclenche la gen d'un concept précis
- POST /api/tutor/concepts/refresh   — force re-fetch (stub V1)

Gating: réservé au plan Expert (admin bypass). Cap quotidien Redis 300/jour
global (cf core.config.TUTOR_DOODLE_DAILY_CAP).
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from core.config import TUTOR_DOODLE_DAILY_CAP
from db.database import User, get_session
from images.keyword_images import _term_hash, generate_doodle_image, get_doodle_url

from .concepts_schemas import (
    GenerateConceptRequest,
    GenerateConceptResponse,
    TutorConceptItem,
    TutorConceptsResponse,
)
from .concepts_service import (
    attach_image_urls,
    check_lookup_pending,
    collect_user_concepts,
    consume_daily_cap,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _check_expert_gating(user: User) -> None:
    """Gate Expert-only (admin bypass).

    Le carrousel est une feature premium (consomme cap quotidien global +
    crédits IA pour Gemini). On le réserve à Expert pour la V1, en cohérence
    avec le positionnement "outils d'étude avancés".
    """
    if getattr(user, "is_admin", False):
        return
    plan = (user.plan or "").lower()
    if plan != "expert":
        raise HTTPException(
            status_code=403,
            detail={
                "code": "feature_blocked",
                "message": "Carrousel de concepts illustrés réservé au plan Expert",
                "required_plan": "expert",
            },
        )


@router.get("", response_model=TutorConceptsResponse)
async def list_concepts(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Retourne les concepts du user illustrés ou en cours de génération.

    Concepts merged depuis:
      (a) les `## ` headings du `summary_content` des analyses récentes
      (b) `entities_extracted.concepts` (et fallback "keywords"/"entities")
    Dédup par SHA256(normalized term). Images résolues via lookup
    `keyword_images` style='tutor_doodle'.

    Query params:
      limit : int dans [1, 50], défaut 20.
    """
    _check_expert_gating(user)
    limit = max(1, min(50, limit))

    concepts = await collect_user_concepts(user.id, db, limit=limit)
    if not concepts:
        return TutorConceptsResponse(
            concepts=[], total=0, ready_count=0, pending_count=0
        )

    concepts = await attach_image_urls(concepts)
    concepts = await check_lookup_pending(concepts)

    items = [
        TutorConceptItem(
            term=c["term"],
            term_hash=c["term_hash"],
            category=c.get("category"),
            image_url=c.get("image_url"),
            status=c.get("status", "missing"),
        )
        for c in concepts
    ]
    ready = sum(1 for i in items if i.status == "ready")
    pending = sum(1 for i in items if i.status in ("pending", "missing"))
    return TutorConceptsResponse(
        concepts=items,
        total=len(items),
        ready_count=ready,
        pending_count=pending,
    )


@router.post("/generate", response_model=GenerateConceptResponse)
async def generate_concept(
    body: GenerateConceptRequest,
    user: User = Depends(get_current_user),
):
    """Déclenche la génération asynchrone d'un doodle pour un concept précis.

    Idempotent: si le doodle existe déjà (status='ready'), retourne l'URL
    directement sans consommer le cap. Sinon enqueue fire-and-forget et
    retourne status='pending' — le frontend poll `GET /api/tutor/concepts`
    pour récupérer l'URL quand prête.

    Si le cap quotidien est atteint, retourne status='throttled', cap_remaining=0.
    """
    _check_expert_gating(user)
    term = body.term.strip()
    if not term:
        raise HTTPException(400, "term is required")

    # Idempotency: doodle déjà ready ?
    existing_url = await get_doodle_url(term)
    if existing_url:
        return GenerateConceptResponse(
            term=term,
            term_hash=_term_hash(term, style="tutor_doodle"),
            status="ready",
            image_url=existing_url,
            cap_remaining=TUTOR_DOODLE_DAILY_CAP,
        )

    # Check cap before enqueueing (atomic INCRBY)
    allowed, remaining = await consume_daily_cap(n=1)
    if not allowed:
        return GenerateConceptResponse(
            term=term,
            term_hash=_term_hash(term, style="tutor_doodle"),
            status="throttled",
            image_url=None,
            cap_remaining=0,
        )

    # Enqueue background gen. consume_daily_cap a déjà incrémenté, donc on
    # appelle directement generate_doodle_image (pas enqueue_doodle_generation
    # qui re-incrémenterait le cap).
    async def _bg():
        try:
            await generate_doodle_image(term, body.definition, body.category)
        except Exception as e:
            logger.error(f"Manual doodle gen failed '{term}': {e}")

    asyncio.create_task(_bg())

    return GenerateConceptResponse(
        term=term,
        term_hash=_term_hash(term, style="tutor_doodle"),
        status="pending",
        image_url=None,
        cap_remaining=remaining,
    )


@router.post("/refresh")
async def refresh_concepts(user: User = Depends(get_current_user)):
    """Force-refresh: invalide tout cache Redis applicatif pour ce user.

    Note V1: la liste est recalculée à chaque GET /concepts (pas de cache
    user-level), donc cet endpoint est un no-op fonctionnel. Stub volontaire
    pour V2 si on ajoute un cache 30min user-level — le frontend peut déjà
    s'y reposer pour le bouton "Refresh".
    """
    _check_expert_gating(user)
    return {"refreshed": True}
