"""
Extraction de (platform, video_id) depuis une URL YouTube ou TikTok.
"""

import re
from urllib.parse import urlparse, parse_qs

from voice.url_validator import normalize_url


def extract_video_id(url: str) -> tuple[str, str]:
    """Extrait (platform, video_id) depuis une URL vidéo.

    Plateformes supportées :
      - YouTube : youtube.com/watch?v=, youtu.be/, /embed/, /v/, /shorts/
      - TikTok  : tiktok.com/@user/video/ID, tiktok.com/t/CODE, vm.tiktok.com/CODE

    Tolère également les schemes natifs mobile (vnd.youtube://, snssdk1233://,
    tiktok://) et les Android intent:// links via :func:`normalize_url`.

    Raises:
        ValueError: Si l'URL n'est pas supportée.
    """
    url = normalize_url(url.strip())
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()

    # ── YouTube ──────────────────────────────────────────────────
    if host in ("www.youtube.com", "youtube.com", "m.youtube.com"):
        # /watch?v=ID
        if parsed.path == "/watch":
            qs = parse_qs(parsed.query)
            vid = qs.get("v", [None])[0]
            if vid:
                return ("youtube", vid)

        # /embed/ID, /v/ID, /shorts/ID
        match = re.match(r"^/(?:embed|v|shorts)/([a-zA-Z0-9_-]+)", parsed.path)
        if match:
            return ("youtube", match.group(1))

    if host == "youtu.be":
        vid = parsed.path.lstrip("/").split("/")[0].split("?")[0]
        if vid:
            return ("youtube", vid)

    # ── TikTok ───────────────────────────────────────────────────
    if host in ("www.tiktok.com", "tiktok.com"):
        # /@user/video/ID
        match = re.match(r"^/@[^/]+/video/(\d+)", parsed.path)
        if match:
            return ("tiktok", match.group(1))

        # /t/CODE
        match = re.match(r"^/t/([a-zA-Z0-9]+)", parsed.path)
        if match:
            return ("tiktok", match.group(1))

    if host == "vm.tiktok.com":
        code = parsed.path.lstrip("/").split("/")[0]
        if code:
            return ("tiktok", code)

    raise ValueError(f"URL non supportée : {url}")
