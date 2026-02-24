"""
Share Router — Public sharing of video analyses
POST /api/share      → Create a share link (auth required)
GET  /api/share/{token} → View shared analysis (public)
"""

import json
import secrets
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, SharedAnalysis, Summary, User
from auth.dependencies import get_current_user

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


def generate_share_token() -> str:
    return secrets.token_urlsafe(8)[:10]


def _extract_verdict(content: str) -> str:
    """Extract verdict from analysis content."""
    if not content:
        return ""
    for marker in ["**Conclusion", "**Verdict", "**Synthèse", "## Conclusion", "## Verdict"]:
        idx = content.find(marker)
        if idx != -1:
            block = content[idx:idx + 300]
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


@router.post("", response_model=ShareResponse)
async def create_share_link(
    request: ShareRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a public share link for an analysis."""
    # Check if share already exists for this user+video
    existing = await session.execute(
        select(SharedAnalysis).where(
            SharedAnalysis.user_id == current_user.id,
            SharedAnalysis.video_id == request.video_id,
        )
    )
    existing_share = existing.scalar_one_or_none()

    if existing_share:
        return ShareResponse(
            share_url=f"{FRONTEND_URL}/s/{existing_share.share_token}",
            share_token=existing_share.share_token,
        )

    # Find the user's analysis for this video
    result = await session.execute(
        select(Summary).where(
            Summary.user_id == current_user.id,
            Summary.video_id == request.video_id,
        ).order_by(Summary.created_at.desc())
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(status_code=404, detail="Analysis not found for this video")

    # Build snapshot
    verdict = _extract_verdict(summary.summary_content or "")
    snapshot = {
        "video_title": summary.video_title,
        "video_channel": summary.video_channel,
        "video_url": summary.video_url,
        "thumbnail_url": summary.thumbnail_url,
        "category": summary.category,
        "reliability_score": summary.reliability_score,
        "summary_content": summary.summary_content,
        "tags": summary.tags,
        "mode": summary.mode,
        "lang": summary.lang,
        "created_at": summary.created_at.isoformat() if summary.created_at else None,
    }

    token = generate_share_token()

    shared = SharedAnalysis(
        share_token=token,
        video_id=request.video_id,
        user_id=current_user.id,
        analysis_snapshot=json.dumps(snapshot, ensure_ascii=False),
        video_title=summary.video_title,
        video_thumbnail=summary.thumbnail_url,
        verdict=verdict,
    )

    session.add(shared)
    await session.commit()

    return ShareResponse(
        share_url=f"{FRONTEND_URL}/s/{token}",
        share_token=token,
    )


@router.get("/{share_token}")
async def get_shared_analysis(
    share_token: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Get a shared analysis by token. Returns OG meta HTML for bots, JSON for API clients."""
    result = await session.execute(
        select(SharedAnalysis).where(SharedAnalysis.share_token == share_token)
    )
    shared = result.scalar_one_or_none()

    if not shared:
        raise HTTPException(status_code=404, detail="Shared analysis not found")

    # Increment view count
    shared.view_count = (shared.view_count or 0) + 1
    await session.commit()

    # Check if request is from a bot (for OG meta tags)
    user_agent = request.headers.get("user-agent", "")
    if BOT_UA_PATTERNS.search(user_agent):
        title = shared.video_title or "Video Analysis"
        verdict = shared.verdict or ""
        thumbnail = shared.video_thumbnail or ""
        share_url = f"{FRONTEND_URL}/s/{share_token}"

        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>DeepSight — {title}</title>
    <meta property="og:title" content="DeepSight — Analyse de '{title}'" />
    <meta property="og:description" content="{verdict}" />
    <meta property="og:image" content="{thumbnail}" />
    <meta property="og:url" content="{share_url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="DeepSight" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="DeepSight — {title}" />
    <meta name="twitter:description" content="{verdict}" />
    <meta name="twitter:image" content="{thumbnail}" />
    <meta http-equiv="refresh" content="0;url={share_url}" />
</head>
<body>
    <p>Redirecting to <a href="{share_url}">{share_url}</a></p>
</body>
</html>"""
        return HTMLResponse(content=html)

    # For API clients / browsers: return JSON
    snapshot = json.loads(shared.analysis_snapshot)

    return {
        "share_token": shared.share_token,
        "video_id": shared.video_id,
        "video_title": shared.video_title,
        "video_thumbnail": shared.video_thumbnail,
        "verdict": shared.verdict,
        "view_count": shared.view_count,
        "created_at": shared.created_at.isoformat() if shared.created_at else None,
        "analysis": snapshot,
    }
