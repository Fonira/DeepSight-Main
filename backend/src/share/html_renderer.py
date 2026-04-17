"""Jinja2 HTML rendering for shared analysis pages.

Produces a fully-styled standalone HTML page at GET /api/share/{token}/page.
Used by bots (via User-Agent detection in router.py) and as a fallback for
clients without JS. The React frontend SPA also renders the same data
client-side for humans via /s/{token}.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from core.config import _settings as settings
from share.markdown_utils import render_markdown_safe


_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

_env = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "htm", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def _format_duration(seconds: Optional[int]) -> str:
    if not seconds or seconds <= 0:
        return ""
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h}h {m}m"
    if m > 0:
        return f"{m}m {s}s" if s else f"{m}m"
    return f"{s}s"


def _format_created_at(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d %B %Y")
    except Exception:
        return iso


def _video_url(platform: str, video_id: str) -> str:
    if platform == "tiktok":
        return f"https://www.tiktok.com/@/video/{video_id}"
    return f"https://www.youtube.com/watch?v={video_id}"


def _platform_label(platform: str) -> str:
    return {"youtube": "YouTube", "tiktok": "TikTok", "text": "Texte"}.get(
        platform, platform.title()
    )


def _api_base() -> str:
    return getattr(settings, "API_PUBLIC_URL", "https://api.deepsightsynthesis.com").rstrip("/")


def _web_base() -> str:
    return getattr(settings, "FRONTEND_URL", "https://www.deepsightsynthesis.com").rstrip("/")


def render_analysis_page(
    *,
    snapshot: Dict[str, Any],
    share_token: str,
    view_count: int,
    created_at_iso: str,
    lang: str = "fr",
) -> str:
    """Render a shared analysis snapshot to standalone HTML.

    `snapshot` is the decoded JSON stored in `SharedAnalysis.analysis_snapshot`.
    It must at least contain `video_id`, `video_title`, `platform`. All other
    fields degrade gracefully.
    """
    web_base = _web_base()
    api_base = _api_base()

    video_id = snapshot.get("video_id", "")
    platform = snapshot.get("platform", "youtube")
    video_title = snapshot.get("video_title") or "Analyse DeepSight"

    analyze_cta_url = (
        f"{web_base}/analyze?video_id={video_id}"
        f"&utm_source=share&utm_medium=cta&utm_campaign=viral"
    )

    synthesis_markdown = (
        snapshot.get("synthesis_markdown")
        or snapshot.get("summary_content")
        or snapshot.get("content")
        or ""
    )

    context = {
        "lang": lang,
        "og_locale": "fr_FR" if lang == "fr" else "en_US",
        "page_title": video_title,
        "page_description": (snapshot.get("verdict", {}) or {}).get("text")
            or snapshot.get("summary_short")
            or f"Synthèse IA de « {video_title} » par DeepSight.",
        "canonical_url": f"{web_base}/s/{share_token}",
        "og_image_url": f"{api_base}/api/share/{share_token}/og-image.png",
        "api_base": api_base,
        "web_base": web_base,
        "share_token": share_token,
        "view_count": view_count,
        "created_at_fmt": _format_created_at(created_at_iso),
        "video_url": _video_url(platform, video_id),
        "video_title": video_title,
        "video_thumbnail": snapshot.get("video_thumbnail"),
        "channel": snapshot.get("channel"),
        "platform_label": _platform_label(platform),
        "duration_fmt": _format_duration(snapshot.get("duration_seconds")),
        "tags": snapshot.get("tags") or [],
        "verdict": snapshot.get("verdict"),
        "synthesis_html": render_markdown_safe(synthesis_markdown),
        "sources": snapshot.get("sources") or [],
        "analyze_cta_url": analyze_cta_url,
    }

    template = _env.get_template("share/analysis.html")
    html = template.render(**context)
    # Normalize doctype to uppercase (HTML5 canonical form) regardless of template casing
    if html.lstrip().lower().startswith("<!doctype html>"):
        idx = html.lower().find("<!doctype html>")
        html = html[:idx] + "<!DOCTYPE html>" + html[idx + len("<!doctype html>"):]
    return html
