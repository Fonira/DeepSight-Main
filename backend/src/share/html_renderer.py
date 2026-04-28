"""Jinja2 HTML rendering for shared analysis pages.

Produces a fully-styled standalone HTML page at GET /api/share/{token}/page.
Used by bots (via User-Agent detection in router.py) and as a fallback for
clients without JS. The React frontend SPA also renders the same data
client-side for humans via /s/{token}.
"""

from __future__ import annotations

import json
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


def _format_duration_iso(seconds: Optional[int]) -> str:
    """Format seconds to ISO 8601 PT#H#M#S for Schema.org VideoObject duration."""
    if not seconds or seconds <= 0:
        return ""
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    out = "PT"
    if h > 0:
        out += f"{h}H"
    if m > 0:
        out += f"{m}M"
    if s > 0:
        out += f"{s}S"
    return out if out != "PT" else "PT0S"


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
    return {"youtube": "YouTube", "tiktok": "TikTok", "text": "Texte"}.get(platform, platform.title())


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

    analyze_cta_url = f"{web_base}/analyze?video_id={video_id}&utm_source=share&utm_medium=cta&utm_campaign=viral"

    synthesis_markdown = (
        snapshot.get("synthesis_markdown") or snapshot.get("summary_content") or snapshot.get("content") or ""
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

    # Schema.org VideoObject JSON-LD — built Python-side and HTML-escaped for inline <script>
    video_object: Dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": video_title,
        "description": context["page_description"],
        "uploadDate": created_at_iso,
        "publisher": {
            "@type": "Organization",
            "name": "DeepSight",
            "logo": {
                "@type": "ImageObject",
                "url": f"{web_base}/icons/icon-512x512.png",
            },
        },
        "isAccessibleForFree": True,
        "isFamilyFriendly": True,
        "inLanguage": lang,
    }
    if snapshot.get("video_thumbnail"):
        video_object["thumbnailUrl"] = snapshot["video_thumbnail"]
    if context["video_url"]:
        video_object["contentUrl"] = context["video_url"]
    if platform == "youtube" and video_id:
        video_object["embedUrl"] = f"https://www.youtube.com/embed/{video_id}"
    duration_iso = _format_duration_iso(snapshot.get("duration_seconds"))
    if duration_iso:
        video_object["duration"] = duration_iso
    if snapshot.get("channel"):
        video_object["creator"] = {"@type": "Person", "name": snapshot["channel"]}

    context["video_object_jsonld"] = (
        json.dumps(video_object, ensure_ascii=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )

    template = _env.get_template("share/analysis.html")
    html = template.render(**context)
    # Normalize doctype to uppercase (HTML5 canonical form) regardless of template casing
    if html.lstrip().lower().startswith("<!doctype html>"):
        idx = html.lower().find("<!doctype html>")
        html = html[:idx] + "<!DOCTYPE html>" + html[idx + len("<!doctype html>") :]
    return html
