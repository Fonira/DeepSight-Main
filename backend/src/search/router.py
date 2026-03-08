"""
Search Router — Semantic search across cached transcripts.
POST /api/search/semantic  -> Auth required
"""

from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from db.database import User
from auth.dependencies import get_current_user
from .embedding_service import search_similar

router = APIRouter()


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    limit: int = Field(10, ge=1, le=30)
    category: Optional[str] = None


class SearchResultItem(BaseModel):
    video_id: str
    score: float
    text_preview: str
    video_title: str
    video_channel: str
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
    """
    Search cached transcripts by semantic similarity.
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
        searched_at=datetime.utcnow().isoformat(),
    )
