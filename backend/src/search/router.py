"""Search Router — Semantic Search V1.

Endpoints :
- POST /api/search/semantic            (legacy, conservé pour backward compat)
- POST /api/search/global              (V1, cross-source filtered by user_id)
- POST /api/search/within/{summary_id} (V1, intra-analyse)
- POST /api/search/explain-passage     (V1, tooltip IA Pro+Expert)
- GET/DELETE /api/search/recent-queries
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from auth.dependencies import get_current_user
from billing.plan_config import is_feature_available
from db.database import User, Summary, async_session_maker
from .embedding_service import search_similar
from .explain_passage import explain_passage
from .global_search import search_global, SearchFilters, ALL_SOURCE_TYPES
from .recent_queries import (
    get_recent_queries,
    push_recent_query,
    clear_recent_queries,
)
from .within_search import search_within, NotOwnerError

logger = logging.getLogger(__name__)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════════════════
# LEGACY — POST /api/search/semantic (gardé pour backward compat)
# ════════════════════════════════════════════════════════════════════════════════


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    limit: int = Field(10, ge=1, le=30)
    category: Optional[str] = None


class SearchResultItem(BaseModel):
    video_id: str
    score: float
    text_preview: str
    video_title: Optional[str] = None
    video_channel: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None


class SemanticSearchResponse(BaseModel):
    results: List[SearchResultItem]
    query: str
    total_results: int
    searched_at: str


@router.post("/semantic", response_model=SemanticSearchResponse)
async def semantic_search(
    request: SemanticSearchRequest,
    current_user: User = Depends(get_current_user),
):
    """Search cached transcripts by semantic similarity.

    Auth required (any plan).
    """
    results = await search_similar(
        query=request.query,
        limit=request.limit,
        category=request.category,
    )

    return SemanticSearchResponse(
        results=[SearchResultItem(**r) for r in results],
        query=request.query,
        total_results=len(results),
        searched_at=datetime.now(timezone.utc).isoformat(),
    )


# ════════════════════════════════════════════════════════════════════════════════
# V1 — POST /api/search/global
# ════════════════════════════════════════════════════════════════════════════════


class GlobalSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    limit: int = Field(20, ge=1, le=50)
    source_types: Optional[list[str]] = None
    platform: Optional[str] = None
    lang: Optional[str] = None
    category: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    favorites_only: bool = False
    playlist_id: Optional[str] = None


class GlobalSearchResultItem(BaseModel):
    source_type: str
    source_id: int
    summary_id: Optional[int]
    score: float
    text_preview: str
    source_metadata: dict


class GlobalSearchResponse(BaseModel):
    query: str
    total_results: int
    results: list[GlobalSearchResultItem]
    searched_at: str


@router.post("/global", response_model=GlobalSearchResponse)
async def global_search(
    request: GlobalSearchRequest,
    user: User = Depends(get_current_user),
):
    """Recherche sémantique globale dans tout le contenu personnel du user."""
    source_types = request.source_types or list(ALL_SOURCE_TYPES)
    invalid = set(source_types) - set(ALL_SOURCE_TYPES)
    if invalid:
        raise HTTPException(400, f"Invalid source_types: {sorted(invalid)}")

    filters = SearchFilters(
        limit=request.limit,
        source_types=source_types,
        platform=request.platform,
        lang=request.lang,
        category=request.category,
        date_from=request.date_from,
        date_to=request.date_to,
        favorites_only=request.favorites_only,
        playlist_id=request.playlist_id,
    )
    results = await search_global(user_id=user.id, query=request.query, filters=filters)

    # Push fire-and-forget dans recent queries (best-effort, ne bloque jamais
    # la réponse). Le service `push_recent_query` capture déjà ses propres
    # exceptions ; on ajoute un try/except defensif autour de la création de
    # task pour les cas extrêmes (ex: event loop fermé en test).
    try:
        asyncio.create_task(push_recent_query(user.id, request.query))
    except Exception as e:  # pragma: no cover - defensive
        logger.warning(f"[SEARCH] recent_queries push failed: {e}")

    return GlobalSearchResponse(
        query=request.query,
        total_results=len(results),
        results=[
            GlobalSearchResultItem(
                source_type=r.source_type,
                source_id=r.source_id,
                summary_id=r.summary_id,
                score=r.score,
                text_preview=r.text_preview,
                source_metadata=r.source_metadata,
            )
            for r in results
        ],
        searched_at=datetime.now(timezone.utc).isoformat(),
    )


# ════════════════════════════════════════════════════════════════════════════════
# V1 — POST /api/search/within/{summary_id}
# ════════════════════════════════════════════════════════════════════════════════


class WithinSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    source_types: Optional[list[str]] = None


class WithinMatchItem(BaseModel):
    source_type: str
    source_id: int
    summary_id: int
    text: str
    text_html: str
    tab: str
    score: float
    passage_id: str
    metadata: dict


class WithinSearchResponse(BaseModel):
    summary_id: int
    query: str
    matches: list[WithinMatchItem]


@router.post("/within/{summary_id}", response_model=WithinSearchResponse)
async def within_search_endpoint(
    request: WithinSearchRequest,
    summary_id: int = Path(..., gt=0),
    user: User = Depends(get_current_user),
):
    """Recherche sémantique intra-analyse.

    SECURITY : ownership-check FIRST (avant la validation de longueur de query
    dans le service), pour ne pas leaker l'existence d'un summary à un user
    non propriétaire via une query trop courte.
    """
    # Ownership check (avant validation query length du service)
    async with async_session_maker() as session:
        summary = await session.get(Summary, summary_id)
        if summary is None:
            raise HTTPException(404, "Summary not found")
        if summary.user_id != user.id:
            raise HTTPException(403, "Not owner of this summary")

    # Maintenant l'ownership est garantie : on peut appeler le service.
    try:
        matches = await search_within(
            summary_id=summary_id,
            user_id=user.id,
            query=request.query,
            source_types=request.source_types,
        )
    except NotOwnerError:
        # Defensive : ne devrait pas arriver post ownership-check, mais safe.
        raise HTTPException(403, "Not owner of this summary")

    return WithinSearchResponse(
        summary_id=summary_id,
        query=request.query,
        matches=[
            WithinMatchItem(
                source_type=m.source_type,
                source_id=m.source_id,
                summary_id=m.summary_id,
                text=m.text,
                text_html=m.text_html,
                tab=m.tab,
                score=m.score,
                passage_id=m.passage_id,
                metadata=m.metadata,
            )
            for m in matches
        ],
    )


# ════════════════════════════════════════════════════════════════════════════════
# V1 — POST /api/search/explain-passage  (Pro+Expert only)
# ════════════════════════════════════════════════════════════════════════════════


class ExplainPassageRequest(BaseModel):
    summary_id: int = Field(..., gt=0)
    passage_text: str = Field(..., min_length=1, max_length=5000)
    query: str = Field(..., min_length=2, max_length=500)
    source_type: str = Field(..., pattern="^(summary|flashcard|quiz|chat|transcript)$")


class ExplainPassageResponse(BaseModel):
    explanation: str
    cached: bool
    model_used: str


@router.post("/explain-passage", response_model=ExplainPassageResponse)
async def explain_passage_endpoint(
    request: ExplainPassageRequest,
    user: User = Depends(get_current_user),
):
    """Tooltip IA — explique pourquoi un passage matche une query.

    Plan gating : `semantic_search_tooltip` feature flag (Pro+Expert only).
    Free user → 403.
    """
    # Plan gating
    if not is_feature_available(user.plan, feature="semantic_search_tooltip", platform="web"):
        raise HTTPException(
            403,
            "Le tooltip IA est inclus à partir du plan Pro. Upgrade pour débloquer.",
        )

    # Verify ownership of the summary
    async with async_session_maker() as session:
        summary = await session.get(Summary, request.summary_id)
        if summary is None:
            raise HTTPException(404, "Summary not found")
        if summary.user_id != user.id:
            raise HTTPException(403, "Not owner of this summary")

    result = await explain_passage(
        summary_id=request.summary_id,
        passage_text=request.passage_text,
        query=request.query,
        source_type=request.source_type,
    )
    return ExplainPassageResponse(**result)


# ════════════════════════════════════════════════════════════════════════════════
# V1 — GET / DELETE /api/search/recent-queries
# ════════════════════════════════════════════════════════════════════════════════


class RecentQueriesResponse(BaseModel):
    queries: list[str]


@router.get("/recent-queries", response_model=RecentQueriesResponse)
async def list_recent_queries(user: User = Depends(get_current_user)):
    """Liste les 10 dernières queries du user (most-recent-first)."""
    queries = await get_recent_queries(user.id)
    return RecentQueriesResponse(queries=queries)


@router.delete("/recent-queries", status_code=204)
async def delete_recent_queries(user: User = Depends(get_current_user)):
    """Efface toutes les queries récentes du user."""
    await clear_recent_queries(user.id)
