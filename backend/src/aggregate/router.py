"""
Aggregate Router — Public landing pages grouping shared analyses.

These pages turn user-shared analyses into long-tail SEO/GEO content. Only
analyses with `SharedAnalysis.is_active=true` are exposed (RGPD: explicit
share opt-in by the original user).

All routes are public (no auth) and mounted under `/api/aggregate` in main.py.
Path naming distinguishes JSON endpoints (resource-style: /channels,
/channels/{slug}) from HTML render endpoints (suffixed: /channels-render,
/channel-render/{slug}) to avoid path conflicts between detail-by-slug and
index-render routes.

Vercel rewrites map user-friendly paths to these endpoints:
  /chaines           → /api/aggregate/channels-render
  /chaine/:slug      → /api/aggregate/channel-render/:slug
  /categories        → /api/aggregate/categories-render
  /categorie/:slug   → /api/aggregate/category-render/:slug
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from aggregate.html_renderer import (
    render_categories_index,
    render_category_page,
    render_channel_page,
    render_channels_index,
)
from aggregate.queries import (
    find_category_by_slug,
    find_channel_by_slug,
    list_analyses_for_category,
    list_analyses_for_channel,
    list_categories,
    list_channels,
)


router = APIRouter()


# ─── JSON DTOs ───────────────────────────────────────────────────────────────


class ChannelDTO(BaseModel):
    name: str
    slug: str
    analyses_count: int
    total_views: int


class CategoryDTO(BaseModel):
    name: str
    slug: str
    analyses_count: int
    total_views: int


class AnalysisRefDTO(BaseModel):
    share_token: str
    video_id: str
    video_title: str | None
    video_thumbnail: str | None
    verdict: str | None
    view_count: int
    channel: str | None
    category: str | None
    platform: str | None


class ChannelDetailDTO(BaseModel):
    channel: ChannelDTO
    analyses: list[AnalysisRefDTO]


class CategoryDetailDTO(BaseModel):
    category: CategoryDTO
    analyses: list[AnalysisRefDTO]


# ─── JSON endpoints (resource-style) ─────────────────────────────────────────


@router.get("/channels", response_model=list[ChannelDTO])
async def get_channels(
    db: AsyncSession = Depends(get_session),
    min_analyses: int = 1,
    limit: int = 200,
) -> list[ChannelDTO]:
    items = await list_channels(db, min_analyses=min_analyses, limit=limit)
    return [
        ChannelDTO(
            name=item.name,
            slug=item.slug,
            analyses_count=item.analyses_count,
            total_views=item.total_views,
        )
        for item in items
    ]


@router.get("/channels/{slug}", response_model=ChannelDetailDTO)
async def get_channel_detail(
    slug: str,
    db: AsyncSession = Depends(get_session),
    limit: int = 50,
) -> ChannelDetailDTO:
    channel = await find_channel_by_slug(db, slug)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    analyses = await list_analyses_for_channel(db, channel.name, limit=limit)
    return ChannelDetailDTO(
        channel=ChannelDTO(
            name=channel.name,
            slug=channel.slug,
            analyses_count=channel.analyses_count,
            total_views=channel.total_views,
        ),
        analyses=[
            AnalysisRefDTO(
                share_token=a.share_token,
                video_id=a.video_id,
                video_title=a.video_title,
                video_thumbnail=a.video_thumbnail,
                verdict=a.verdict,
                view_count=a.view_count,
                channel=a.channel,
                category=a.category,
                platform=a.platform,
            )
            for a in analyses
        ],
    )


@router.get("/categories", response_model=list[CategoryDTO])
async def get_categories(
    db: AsyncSession = Depends(get_session),
    min_analyses: int = 1,
    limit: int = 100,
) -> list[CategoryDTO]:
    items = await list_categories(db, min_analyses=min_analyses, limit=limit)
    return [
        CategoryDTO(
            name=item.name,
            slug=item.slug,
            analyses_count=item.analyses_count,
            total_views=item.total_views,
        )
        for item in items
    ]


@router.get("/categories/{slug}", response_model=CategoryDetailDTO)
async def get_category_detail(
    slug: str,
    db: AsyncSession = Depends(get_session),
    limit: int = 50,
) -> CategoryDetailDTO:
    category = await find_category_by_slug(db, slug)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    analyses = await list_analyses_for_category(db, category.name, limit=limit)
    return CategoryDetailDTO(
        category=CategoryDTO(
            name=category.name,
            slug=category.slug,
            analyses_count=category.analyses_count,
            total_views=category.total_views,
        ),
        analyses=[
            AnalysisRefDTO(
                share_token=a.share_token,
                video_id=a.video_id,
                video_title=a.video_title,
                video_thumbnail=a.video_thumbnail,
                verdict=a.verdict,
                view_count=a.view_count,
                channel=a.channel,
                category=a.category,
                platform=a.platform,
            )
            for a in analyses
        ],
    )


# ─── SSR HTML pages (consumed by Vercel rewrites) ────────────────────────────


@router.get(
    "/channel-render/{slug}",
    response_class=HTMLResponse,
    include_in_schema=False,
)
async def render_channel_html(
    slug: str,
    db: AsyncSession = Depends(get_session),
) -> HTMLResponse:
    channel = await find_channel_by_slug(db, slug)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    analyses = await list_analyses_for_channel(db, channel.name, limit=50)
    html = render_channel_page(channel, analyses)
    return HTMLResponse(
        content=html,
        status_code=200,
        headers={
            "Cache-Control": "public, max-age=900, s-maxage=900",
            "X-Robots-Tag": "index, follow",
        },
    )


@router.get(
    "/category-render/{slug}",
    response_class=HTMLResponse,
    include_in_schema=False,
)
async def render_category_html(
    slug: str,
    db: AsyncSession = Depends(get_session),
) -> HTMLResponse:
    category = await find_category_by_slug(db, slug)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    analyses = await list_analyses_for_category(db, category.name, limit=50)
    html = render_category_page(category, analyses)
    return HTMLResponse(
        content=html,
        status_code=200,
        headers={
            "Cache-Control": "public, max-age=900, s-maxage=900",
            "X-Robots-Tag": "index, follow",
        },
    )


@router.get(
    "/channels-render",
    response_class=HTMLResponse,
    include_in_schema=False,
)
async def render_channels_index_html(
    db: AsyncSession = Depends(get_session),
) -> HTMLResponse:
    channels = await list_channels(db, min_analyses=1, limit=200)
    html = render_channels_index(channels)
    return HTMLResponse(
        content=html,
        status_code=200,
        headers={
            "Cache-Control": "public, max-age=1800, s-maxage=1800",
            "X-Robots-Tag": "index, follow",
        },
    )


@router.get(
    "/categories-render",
    response_class=HTMLResponse,
    include_in_schema=False,
)
async def render_categories_index_html(
    db: AsyncSession = Depends(get_session),
) -> HTMLResponse:
    categories = await list_categories(db, min_analyses=1, limit=100)
    html = render_categories_index(categories)
    return HTMLResponse(
        content=html,
        status_code=200,
        headers={
            "Cache-Control": "public, max-age=1800, s-maxage=1800",
            "X-Robots-Tag": "index, follow",
        },
    )
