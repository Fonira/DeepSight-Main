"""URL validator for voice sessions — accepts YouTube + TikTok only."""

import re
from urllib.parse import parse_qs, urlparse

YOUTUBE_RE = re.compile(
    r"^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)"
    r"([a-zA-Z0-9_-]{11})"
)

# TikTok short link via vm. subdomain — single path segment is the short id
TIKTOK_VM_RE = re.compile(r"^https?://vm\.tiktok\.com/([A-Za-z0-9]+)/?")

# TikTok web/mobile : @user/video/<long_id>, t/<short>, v/<id>
TIKTOK_RE = re.compile(
    r"^https?://(?:www\.|m\.)?tiktok\.com/"
    r"(?:@[\w.-]+/video/(\d+)|t/([A-Za-z0-9]+)|v/(\d+))"
)

# ---------- Tolerant normalization (mobile schemes / android intents / share links) ----------

# YouTube native scheme: vnd.youtube://watch?v=ID  or  youtube://watch?v=ID
_YT_SCHEME_RE = re.compile(
    r"^(?:vnd\.youtube|youtube)://(?:watch\?v=|.*[?&]v=)([a-zA-Z0-9_-]{11})",
    re.IGNORECASE,
)

# YouTube native scheme alt: vnd.youtube:ID  (no //)
_YT_SCHEME_BARE_RE = re.compile(
    r"^(?:vnd\.youtube|youtube):([a-zA-Z0-9_-]{11})$",
    re.IGNORECASE,
)

# Android intent URLs: intent://...#Intent;...;end
_INTENT_RE = re.compile(r"^intent://(.+?)#Intent;", re.IGNORECASE)

# TikTok native schemes (TikTok app, ByteDance internal)
# snssdk1233://aweme/detail/<id>  (TikTok aweme = video)
_TIKTOK_SNSSDK_RE = re.compile(
    r"^snssdk\d+://aweme/detail/(\d+)",
    re.IGNORECASE,
)
# tiktok://...video/<id>  or  tiktok://...
_TIKTOK_SCHEME_VIDEO_RE = re.compile(
    r"^tiktok://[^/]*/?(?:.*?/)?video/(\d+)",
    re.IGNORECASE,
)
_TIKTOK_SCHEME_AWEME_RE = re.compile(
    r"^tiktok://aweme/detail/(\d+)",
    re.IGNORECASE,
)


def normalize_url(url: str) -> str:
    """Normalize a raw URL/scheme/intent string into a canonical HTTPS URL.

    Handles native mobile schemes and Android intent:// links by rewriting them
    to standard https URLs that the existing regex validators accept.

    Pass-through behavior: any URL that doesn't match a known mobile pattern is
    returned as-is (stripped).

    Examples
    --------
    >>> normalize_url("vnd.youtube://watch?v=dQw4w9WgXcQ")
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    >>> normalize_url("intent://www.youtube.com/watch?v=abc#Intent;package=com.google.android.youtube;end")
    'https://www.youtube.com/watch?v=abc'
    >>> normalize_url("snssdk1233://aweme/detail/7123456789012345678")
    'https://www.tiktok.com/@_/video/7123456789012345678'
    """
    if not url:
        return url
    raw = url.strip()
    if not raw:
        return raw

    # ── YouTube native scheme ──────────────────────────────────────
    if m := _YT_SCHEME_RE.match(raw):
        return f"https://www.youtube.com/watch?v={m.group(1)}"
    if m := _YT_SCHEME_BARE_RE.match(raw):
        return f"https://www.youtube.com/watch?v={m.group(1)}"

    # ── TikTok native scheme ───────────────────────────────────────
    if m := _TIKTOK_SNSSDK_RE.match(raw):
        return f"https://www.tiktok.com/@_/video/{m.group(1)}"
    if m := _TIKTOK_SCHEME_AWEME_RE.match(raw):
        return f"https://www.tiktok.com/@_/video/{m.group(1)}"
    if m := _TIKTOK_SCHEME_VIDEO_RE.match(raw):
        return f"https://www.tiktok.com/@_/video/{m.group(1)}"

    # ── Android intent:// ──────────────────────────────────────────
    if m := _INTENT_RE.match(raw):
        # intent://www.youtube.com/watch?v=ID#Intent;...;end
        # The body before #Intent is essentially the host+path+query, scheme implicit https.
        body = m.group(1)
        # Recurse if body looks like another scheme (rare). Otherwise prepend https://.
        if "://" in body:
            return normalize_url(body)
        return f"https://{body}"

    return raw


def parse_video_url(url: str) -> tuple[str, str]:
    """Parse a YouTube or TikTok URL.

    Args:
        url: Raw URL string from user input or share extension. Tolerant of
             mobile native schemes (vnd.youtube://, snssdk1233://, tiktok://)
             and Android intent:// links via :func:`normalize_url`.

    Returns:
        Tuple of (platform, video_id) where platform is "youtube" or "tiktok".

    Raises:
        ValueError: If URL doesn't match either platform.
    """
    url = normalize_url(url)
    if m := YOUTUBE_RE.match(url):
        return ("youtube", m.group(1))
    if m := TIKTOK_VM_RE.match(url):
        return ("tiktok", m.group(1))
    if m := TIKTOK_RE.match(url):
        # Group 1=@user/video/, 2=t/, 3=v/
        video_id = next((g for g in m.groups() if g is not None), None)
        if video_id:
            return ("tiktok", video_id)
    raise ValueError(f"URL non supportée: {url[:80]}")
