"""
API Router — Keyword Images (illustrations IA "Le Saviez-Vous").
"""

import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth.dependencies import get_current_admin

router = APIRouter()


class ImageResponse(BaseModel):
    term: str
    image_url: Optional[str] = None
    status: str


class ImageStatsResponse(BaseModel):
    total: int
    pending: int
    ready: int
    failed: int


class GenerateRequest(BaseModel):
    term: str
    definition: str
    category: str = "misc"


# ─── Public endpoint ──────────────────────────────────────────────────────────

@router.get("/keyword/{term}", response_model=ImageResponse)
async def get_keyword_image(term: str):
    """Get image URL for a keyword term."""
    from images.keyword_images import get_image_url

    url = await get_image_url(term)
    return ImageResponse(
        term=term,
        image_url=url,
        status="ready" if url else "not_found",
    )


# ─── Admin endpoints ──────────────────────────────────────────────────────────

@router.post("/generate", response_model=dict)
async def trigger_generate(
    request: GenerateRequest,
    admin=Depends(get_current_admin),
):
    """Admin: manually trigger image generation for a keyword."""
    from tasks.image_tasks import generate_keyword_image_task

    task = generate_keyword_image_task.delay(
        request.term, request.definition, request.category,
    )
    return {
        "task_id": task.id,
        "term": request.term,
        "status": "enqueued",
    }


@router.get("/stats", response_model=ImageStatsResponse)
async def get_image_stats(admin=Depends(get_current_admin)):
    """Admin: get image generation statistics."""
    from images.keyword_images import _get_pool

    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'ready') as ready,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM keyword_images
            """
        )

    return ImageStatsResponse(
        total=row["total"],
        pending=row["pending"],
        ready=row["ready"],
        failed=row["failed"],
    )
