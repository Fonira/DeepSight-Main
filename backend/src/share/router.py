"""
Share Router — Public sharing of video analyses
POST   /api/share                       → Create a share link (auth required)
GET    /api/share/{token}               → View shared analysis (public, JSON)
GET    /api/share/{token}/og            → OG meta tags page for social bots
GET    /api/share/{token}/og-image.png  → Dynamic 1200×630 PNG for social previews
DELETE /api/share/{video_id}            → Deactivate share link (auth required)
"""

import json
import json as _json  # alias used by _build_share_snapshot for clarity
import secrets
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, SharedAnalysis, Summary, User
from auth.dependencies import get_current_user
from core.config import _settings as _cfg
from share.og_image import generate_og_image
from share.html_renderer import render_analysis_page

router = APIRouter()

FRONTEND_URL = "https://www.deepsightsynthesis.com"

# Bot User-Agent patterns for OG meta tag rendering
BOT_UA_PATTERNS = re.compile(
    r"facebookexternalhit|Twitterbot|TelegramBot|Discordbot|WhatsApp|Slackbot|LinkedInBot|bot|crawl|spider",
    re.IGNORECASE,
)


class ShareRequest(BaseModel):
    video_id: str


class ShareResponse(BaseModel):
    share_url: str
    share_token: str
    view_count: int = 0


def generate_share_token() -> str:
    return secrets.token_urlsafe(8)[:10]


def _extract_verdict(content: str) -> str:
    """Extract verdict from analysis content."""
    if not content:
        return ""
    for marker in ["**Conclusion", "**Verdict", "**Synthèse", "## Conclusion", "## Verdict"]:
        idx = content.find(marker)
        if idx != -1:
            block = content[idx : idx + 300]
            lines = block.split("\n")
            for line in lines[1:]:
                stripped = line.strip().strip("*").strip("-").strip()
                if stripped and len(stripped) > 10:
                    return stripped[:200]
    # Fallback: last paragraph
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    if paragraphs:
        return paragraphs[-1][:200]
    return content[:200]


def _build_share_snapshot(summary) -> dict:
    """Build the rich JSON snapshot stored in SharedAnalysis.analysis_snapshot.

    Consumed by the HTML page renderer (templates/share/analysis.html) and the
    OG image generator. All fields degrade gracefully to None/[] if the source
    Summary is missing columns. This is the canonical place to evolve the
    snapshot shape without touching the rendering layer.

    Attribute lookups use fallbacks so the helper works against both the
    spec'd field names (tags_json, content, verdict_tone, sources_json, etc.)
    and the real `Summary` ORM columns (tags, summary_content, video_channel,
    thumbnail_url, video_duration, enrichment_sources).
    """
    # Tags: prefer JSON string, then list, then real Summary.tags (Text JSON)
    tags: list = []
    raw_tags = (
        getattr(summary, "tags_json", None)
        if getattr(summary, "tags_json", None) is not None
        else getattr(summary, "tags", None)
    )
    if raw_tags is not None:
        if isinstance(raw_tags, list):
            tags = [str(t) for t in raw_tags]
        elif isinstance(raw_tags, str) and raw_tags.strip():
            try:
                parsed = _json.loads(raw_tags)
                if isinstance(parsed, list):
                    tags = [str(t) for t in parsed]
            except (ValueError, TypeError):
                tags = []

    # Sources: prefer sources_json, fallback to enrichment_sources on real Summary
    sources: list = []
    raw_sources = (
        getattr(summary, "sources_json", None)
        if getattr(summary, "sources_json", None) is not None
        else getattr(summary, "enrichment_sources", None)
    )
    if raw_sources is not None:
        parsed = None
        if isinstance(raw_sources, list):
            parsed = raw_sources
        elif isinstance(raw_sources, str) and raw_sources.strip():
            try:
                parsed = _json.loads(raw_sources)
            except (ValueError, TypeError):
                parsed = None
        if isinstance(parsed, list):
            for src in parsed:
                if isinstance(src, dict) and src.get("url"):
                    sources.append(
                        {
                            "url": src["url"],
                            "title": src.get("title"),
                            "site": src.get("site"),
                        }
                    )

    # Verdict object: text + tone + icon + label
    verdict = None
    verdict_text = getattr(summary, "verdict", None)
    if verdict_text:
        verdict_tone = getattr(summary, "verdict_tone", None) or "neutral"
        verdict = {
            "tone": verdict_tone,
            "label": "Verdict",
            "icon": {
                "positive": "\u2705",
                "cautious": "\u26a0\ufe0f",
                "critical": "\u274c",
            }.get(verdict_tone, "\U0001f9ed"),
            "text": verdict_text,
        }

    # Fields with real-Summary fallbacks
    video_thumbnail = (
        getattr(summary, "video_thumbnail", None)
        if getattr(summary, "video_thumbnail", None) is not None
        else getattr(summary, "thumbnail_url", None)
    )
    channel = (
        getattr(summary, "channel", None)
        if getattr(summary, "channel", None) is not None
        else getattr(summary, "video_channel", None)
    )
    duration_seconds = (
        getattr(summary, "duration_seconds", None)
        if getattr(summary, "duration_seconds", None) is not None
        else getattr(summary, "video_duration", None)
    )
    synthesis = (
        getattr(summary, "content", None)
        if getattr(summary, "content", None) is not None
        else getattr(summary, "summary_content", None)
    ) or ""

    return {
        "video_id": getattr(summary, "video_id", "") or "",
        "video_title": getattr(summary, "video_title", "") or "",
        "video_thumbnail": video_thumbnail,
        "platform": getattr(summary, "platform", None) or "youtube",
        "duration_seconds": duration_seconds,
        "channel": channel,
        "tags": tags,
        "verdict": verdict,
        "synthesis_markdown": synthesis,
        "summary_short": getattr(summary, "summary_short", None),
        "sources": sources,
    }


def _build_og_html(shared: SharedAnalysis, share_token: str) -> str:
    """Build OG meta tags HTML page for social bots."""
    title = shared.video_title or "Video Analysis"
    verdict = shared.verdict or ""
    share_url = f"{FRONTEND_URL}/s/{share_token}"

    # Dynamic branded og-image endpoint (1200×630 PNG with title + verdict chip).
    # Use getattr with fallback so the page still renders if the setting is absent.
    _api_base = getattr(_cfg, "API_PUBLIC_URL", "https://api.deepsightsynthesis.com").rstrip("/")
    og_image_url = f"{_api_base}/api/share/{share_token}/og-image.png"

    # Escape HTML entities in dynamic content
    safe_title = (title or "").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    safe_verdict = (verdict or "").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    # Truncate description to 160 chars
    if len(safe_verdict) > 160:
        safe_verdict = safe_verdict[:157] + "..."

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Analyse DeepSight : {safe_title}</title>
    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:title" content="Analyse DeepSight : {safe_title}" />
    <meta property="og:description" content="{safe_verdict}" />
    <meta property="og:image" content="{og_image_url}" />
    <meta property="og:url" content="{share_url}" />
    <meta property="og:site_name" content="DeepSight" />
    <meta property="og:locale" content="fr_FR" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Analyse DeepSight : {safe_title}" />
    <meta name="twitter:description" content="{safe_verdict}" />
    <meta name="twitter:image" content="{og_image_url}" />
    <!-- Redirect to web app -->
    <script>window.location.href = "{share_url}";</script>
</head>
<body>
    <p>Redirection vers <a href="{share_url}">DeepSight</a>...</p>
</body>
</html>"""


@router.post("", response_model=ShareResponse)
async def create_share_link(
    request: ShareRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a public share link for an analysis."""
    # Check if active share already exists for this user+video
    existing = await session.execute(
        select(SharedAnalysis).where(
            SharedAnalysis.user_id == current_user.id,
            SharedAnalysis.video_id == request.video_id,
            SharedAnalysis.is_active,
        )
    )
    existing_share = existing.scalar_one_or_none()

    if existing_share:
        return ShareResponse(
            share_url=f"{FRONTEND_URL}/s/{existing_share.share_token}",
            share_token=existing_share.share_token,
            view_count=existing_share.view_count or 0,
        )

    # Find the user's analysis for this video
    result = await session.execute(
        select(Summary)
        .where(
            Summary.user_id == current_user.id,
            Summary.video_id == request.video_id,
        )
        .order_by(Summary.created_at.desc())
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(status_code=404, detail="Analysis not found for this video")

    # Build rich snapshot (used by HTML renderer and OG image generator)
    verdict = _extract_verdict(summary.summary_content or "")
    snapshot = _build_share_snapshot(summary)
    # Legacy verdict string (extracted from content) is still useful for the
    # indexed column and for the current JSON API consumers that read
    # shared.verdict directly. Promote it into the snapshot if the Summary
    # has no structured verdict attribute of its own.
    if snapshot.get("verdict") is None and verdict:
        snapshot["verdict"] = {
            "tone": "neutral",
            "label": "Verdict",
            "icon": "\U0001f9ed",
            "text": verdict,
        }

    token = generate_share_token()

    shared = SharedAnalysis(
        share_token=token,
        video_id=request.video_id,
        user_id=current_user.id,
        analysis_snapshot=_json.dumps(snapshot, ensure_ascii=False),
        video_title=summary.video_title,
        video_thumbnail=summary.thumbnail_url,
        verdict=verdict,
        is_active=True,
    )

    session.add(shared)
    await session.commit()

    return ShareResponse(
        share_url=f"{FRONTEND_URL}/s/{token}",
        share_token=token,
        view_count=0,
    )


@router.get("/{share_token}/og")
async def get_shared_og(
    share_token: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Returns minimal HTML with OG meta tags for social bot crawlers.
    Used by Vercel rewrite to serve OG tags for /s/:token URLs.

    Returns 404 if the token never existed, 410 Gone if it existed but has
    been revoked — letting Google deindex revoked pages faster.
    """
    result = await session.execute(select(SharedAnalysis).where(SharedAnalysis.share_token == share_token))
    shared = result.scalar_one_or_none()

    if not shared:
        raise HTTPException(status_code=404, detail="Shared analysis not found")
    if not shared.is_active:
        raise HTTPException(status_code=410, detail="Shared analysis revoked")

    html = _build_og_html(shared, share_token)
    return HTMLResponse(content=html)


@router.get("/{token}/og-image.png", include_in_schema=True)
async def get_share_og_image(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Dynamic 1200×630 OG image for social previews.

    Cached 1h client-side + 24h on CDN edge to avoid re-rendering for each
    bot fetch. Returns 404 if the token never existed, 410 Gone if it
    existed but has been revoked — letting Google deindex revoked pages.
    """
    result = await session.execute(select(SharedAnalysis).where(SharedAnalysis.share_token == token))
    share: Optional[SharedAnalysis] = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if not share.is_active:
        raise HTTPException(status_code=410, detail="Share revoked")

    try:
        snapshot = json.loads(share.analysis_snapshot or "{}")
    except json.JSONDecodeError:
        snapshot = {}

    png = generate_og_image(
        video_title=snapshot.get("video_title") or share.video_title or "Analyse DeepSight",
        video_thumbnail=snapshot.get("video_thumbnail") or share.video_thumbnail,
        verdict_text=(snapshot.get("verdict") or {}).get("text")
        if isinstance(snapshot.get("verdict"), dict)
        else (snapshot.get("verdict") or share.verdict),
        channel=snapshot.get("channel"),
    )

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        },
    )


@router.get("/{token}/page", response_class=HTMLResponse, include_in_schema=True)
async def get_share_page(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> HTMLResponse:
    """Render the shared analysis as a standalone HTML page.

    Used by:
    - Social bots that follow redirects and parse rendered HTML.
    - Fallback for users whose frontend SPA fails to load.
    - Direct links from email/SMS/QR where rich preview matters.

    Returns 404 if the token never existed, 410 Gone if it existed but has
    been revoked — letting Google deindex revoked pages faster.
    Increments view_count on each call (best-effort, non-blocking).
    """
    result = await session.execute(select(SharedAnalysis).where(SharedAnalysis.share_token == token))
    share: Optional[SharedAnalysis] = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if not share.is_active:
        raise HTTPException(status_code=410, detail="Share revoked")

    try:
        snapshot = json.loads(share.analysis_snapshot or "{}")
    except json.JSONDecodeError:
        snapshot = {}

    # Best-effort view count increment
    try:
        share.view_count = (share.view_count or 0) + 1
        await session.commit()
    except Exception:
        await session.rollback()

    html = render_analysis_page(
        snapshot=snapshot,
        share_token=token,
        view_count=share.view_count or 0,
        created_at_iso=(share.created_at.isoformat() + "Z")
        if share.created_at
        else datetime.utcnow().isoformat() + "Z",
    )

    return HTMLResponse(
        content=html,
        status_code=200,
        headers={
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            "X-Robots-Tag": "index, follow",
        },
    )


@router.post("/{token}/beacon", include_in_schema=False)
async def share_beacon(
    token: str,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Fire-and-forget analytics beacon. Always returns 204.

    Used by the HTML page template (navigator.sendBeacon) to increment the
    view_count without blocking rendering. Never reveals whether the token
    exists — silently no-ops on unknown/revoked tokens to avoid info leakage
    and to keep beacons noisy-safe.
    """

    async def _record():
        try:
            result = await session.execute(
                select(SharedAnalysis).where(
                    SharedAnalysis.share_token == token,
                    SharedAnalysis.is_active.is_(True),
                )
            )
            share = result.scalar_one_or_none()
            if share:
                share.view_count = (share.view_count or 0) + 1
                await session.commit()
        except Exception:
            try:
                await session.rollback()
            except Exception:
                pass

    background.add_task(_record)
    return Response(status_code=204)


@router.get("/{share_token}")
async def get_shared_analysis(
    share_token: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Get a shared analysis by token. Returns OG meta HTML for bots, JSON for API clients."""
    result = await session.execute(
        select(SharedAnalysis).where(
            SharedAnalysis.share_token == share_token,
            SharedAnalysis.is_active,
        )
    )
    shared = result.scalar_one_or_none()

    if not shared:
        raise HTTPException(status_code=404, detail="Shared analysis not found or deactivated")

    # Increment view count
    shared.view_count = (shared.view_count or 0) + 1
    await session.commit()

    # Check if request is from a bot (for OG meta tags)
    user_agent = request.headers.get("user-agent", "")
    if BOT_UA_PATTERNS.search(user_agent):
        html = _build_og_html(shared, share_token)
        return HTMLResponse(content=html)

    # For API clients / browsers: return JSON
    snapshot = json.loads(shared.analysis_snapshot)

    return {
        "status": "success",
        "data": {
            "share_token": shared.share_token,
            "video_id": shared.video_id,
            "video_title": shared.video_title,
            "video_thumbnail": shared.video_thumbnail,
            "verdict": shared.verdict,
            "view_count": shared.view_count,
            "is_active": shared.is_active,
            "created_at": shared.created_at.isoformat() if shared.created_at else None,
            "analysis": snapshot,
        },
    }


@router.delete("/{video_id}")
async def revoke_share(
    video_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Deactivate all share links for a video (soft delete)."""
    result = await session.execute(
        select(SharedAnalysis).where(
            SharedAnalysis.user_id == current_user.id,
            SharedAnalysis.video_id == video_id,
            SharedAnalysis.is_active,
        )
    )
    shares = result.scalars().all()

    if not shares:
        raise HTTPException(status_code=404, detail="No active share found for this video")

    for share in shares:
        share.is_active = False

    await session.commit()

    return {
        "status": "success",
        "message": "Partage désactivé",
    }
