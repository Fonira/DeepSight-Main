"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎵 TIKTOK COMMENTS SCRAPER — Web /api/comment/list/                              ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Méthode V1 : endpoint web `https://www.tiktok.com/api/comment/list/`             ║
║  Pas de signature mobile à reproduire. JSON propre `{comments, cursor, has_more}` ║
║                                                                                    ║
║  Pagination : count=50/page, suivre cursor jusqu'à has_more=False. Max 4 pages.   ║
║  msToken : généré aléatoirement (32 chars hex) en V1.                              ║
║                                                                                    ║
║  Cas dégradés :                                                                    ║
║    - comments désactivés : `status_code=10202` ou `comments_total=0` → disabled   ║
║    - vidéo privée/supprimée : abandon silencieux                                  ║
║    - signature renforcée future → fallback méthode B (à implémenter en V2)       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any

from core.config import is_public_data_only
from core.http_client import get_proxied_client
from core.logging import logger
from middleware.proxy_telemetry import record_proxy_usage

from .sampler import dedupe_comments, sample_top_and_random
from .schemas import Comment, CommentsBatch

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

TIKTOK_WEB_COMMENTS_URL = "https://www.tiktok.com/api/comment/list/"

DEFAULT_PAGE_TIMEOUT_S = 12.0
DEFAULT_PAGE_COUNT = 50  # max page size accepté par l'endpoint web
DEFAULT_MAX_PAGES = 4
MAX_RAW_COMMENTS_HARD_LIMIT = 250

# Code de retour TikTok : 10202 = comments disabled, 10204 = video removed.
_DISABLED_STATUS_CODES = {10202}
_REMOVED_STATUS_CODES = {10204, 10216}


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 msToken
# ═══════════════════════════════════════════════════════════════════════════════


def _generate_ms_token() -> str:
    """Génère un msToken aléatoire 64 chars (alphanumérique). Suffisant pour V1."""
    return secrets.token_hex(32)


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 PARSE — comment item TikTok
# ═══════════════════════════════════════════════════════════════════════════════


def _parse_tiktok_comment(item: dict[str, Any]) -> Comment | None:
    """Parse un item de comments[] TikTok vers un Comment normalisé."""
    if not isinstance(item, dict):
        return None
    cid = item.get("cid") or item.get("id")
    text = item.get("text") or ""
    user = item.get("user") or {}
    author = user.get("nickname") or user.get("unique_id") or ""
    author_id = user.get("uid") or user.get("sec_uid") or None
    like_count = int(item.get("digg_count", 0) or 0)
    reply_count = int(item.get("reply_comment_total", 0) or item.get("reply_total", 0) or 0)
    is_creator_reply = bool(item.get("is_author_digged", False))  # Approximation
    published_at = None
    create_time = item.get("create_time")
    if isinstance(create_time, (int, float)) and create_time > 0:
        try:
            published_at = datetime.utcfromtimestamp(int(create_time))
        except (ValueError, OSError):
            published_at = None

    if not cid or not text:
        return None

    return Comment(
        comment_id=str(cid),
        author=str(author),
        author_id=str(author_id) if author_id else None,
        text=str(text),
        like_count=like_count,
        reply_count=reply_count,
        published_at=published_at,
        is_reply=False,
        parent_id=None,
        is_creator_reply=is_creator_reply,
        is_pinned=bool(item.get("stick_position", 0) or 0),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 HTTP CALLS
# ═══════════════════════════════════════════════════════════════════════════════


async def _fetch_page(
    video_id: str,
    *,
    cursor: int,
    count: int,
    ms_token: str,
) -> tuple[dict[str, Any] | None, int, int]:
    """Fetch une page de commentaires. Retourne (json, bytes_in, status_code).

    status_code=-1 si erreur HTTP/transport (non-200 ou exception).
    """
    params = {
        "aweme_id": video_id,
        "count": str(count),
        "cursor": str(cursor),
        "msToken": ms_token,
        "current_region": "US",
    }
    headers = {
        "Referer": f"https://www.tiktok.com/@user/video/{video_id}",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
    }

    # Estimation grossière des bytes_out (query string).
    bytes_out = sum(len(k) + len(v) + 2 for k, v in params.items())

    try:
        async with get_proxied_client(timeout=DEFAULT_PAGE_TIMEOUT_S, headers=headers) as client:
            resp = await client.get(TIKTOK_WEB_COMMENTS_URL, params=params)
    except Exception as e:
        logger.warning(f"[COMMENTS_TIKTOK] HTTP exception: {e}")
        return None, 0, -1

    bytes_in = len(resp.content) if resp.content is not None else 0

    # Telemetry — best-effort, ne masque pas d'autres erreurs.
    try:
        await record_proxy_usage(
            provider="comments_tiktok",
            bytes_in=bytes_in,
            bytes_out=bytes_out,
        )
    except Exception as te:
        logger.debug(f"[COMMENTS_TIKTOK] proxy telemetry failed: {te}")

    if resp.status_code != 200:
        logger.warning(f"[COMMENTS_TIKTOK] HTTP {resp.status_code} for video {video_id}")
        return None, bytes_in, resp.status_code

    try:
        return resp.json(), bytes_in, resp.status_code
    except Exception as e:
        logger.warning(f"[COMMENTS_TIKTOK] JSON parse failed: {e}")
        return None, bytes_in, resp.status_code


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════


async def fetch_tiktok_comments(
    video_id: str,
    *,
    top_n: int = 100,
    random_n: int = 50,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> CommentsBatch:
    """Récupère les commentaires d'une vidéo TikTok via l'endpoint web + sampling.

    Pipeline :
      1. GET /api/comment/list/?aweme_id=...&count=50&cursor=0 (page 1).
      2. Suivre cursor tant que has_more=True, max_pages.
      3. Déduplication via comment_id.
      4. Sampling Top top_n + Random random_n (déterministe via seed video_id).

    Args:
        video_id: aweme_id TikTok.
        top_n: top likes.
        random_n: random bonus.
        max_pages: cap dur sur pagination (défaut 4).

    Returns:
        CommentsBatch avec sampled[], total_seen, disabled, bytes_used.
    """
    # 🔒 PUBLIC_DATA_ONLY : le scraping de l'endpoint web TikTok est interdit.
    if is_public_data_only():
        logger.info("🔒 PUBLIC_DATA_ONLY: scraping commentaires TikTok désactivé (%s)", video_id)
        return CommentsBatch(platform="tiktok", video_id=video_id, disabled=True)

    ms_token = _generate_ms_token()
    cursor = 0
    total_bytes = 0
    raw: list[Comment] = []
    pages_done = 0

    while pages_done < max_pages:
        pages_done += 1
        data, bytes_in, status = await _fetch_page(
            video_id,
            cursor=cursor,
            count=DEFAULT_PAGE_COUNT,
            ms_token=ms_token,
        )
        total_bytes += bytes_in

        if data is None:
            # HTTP failure → abort, batch vide (non-disabled).
            break

        status_code = data.get("status_code")

        if status_code in _DISABLED_STATUS_CODES:
            return CommentsBatch(
                platform="tiktok",
                video_id=video_id,
                total_seen=0,
                sampled=[],
                disabled=True,
                bytes_used=total_bytes,
            )

        if status_code in _REMOVED_STATUS_CODES:
            # Vidéo supprimée → batch vide, on n'affiche pas "disabled" volontairement.
            break

        comments_payload = data.get("comments") or []
        if not comments_payload:
            # Pas de comments dans la première page → soit pas de commentaires,
            # soit comments_total = 0 → on traite comme insufficient_data
            # (non-disabled : la vidéo a juste 0 commentaires).
            if pages_done == 1 and data.get("total", 0) == 0:
                break
            # Page vide en cours de pagination → fin.
            break

        for item in comments_payload:
            parsed = _parse_tiktok_comment(item)
            if parsed is not None:
                parsed.video_id = video_id
                raw.append(parsed)

        if len(raw) >= MAX_RAW_COMMENTS_HARD_LIMIT:
            logger.info(
                f"[COMMENTS_TIKTOK] hard limit {MAX_RAW_COMMENTS_HARD_LIMIT} reached "
                f"after {pages_done} pages for {video_id}"
            )
            break

        has_more = bool(data.get("has_more", False))
        next_cursor = data.get("cursor")
        if not has_more or next_cursor is None or next_cursor == cursor:
            break
        try:
            cursor = int(next_cursor)
        except (TypeError, ValueError):
            break

    raw = dedupe_comments(raw)
    sampled = sample_top_and_random(raw, top_n=top_n, random_n=random_n, video_id=video_id)

    return CommentsBatch(
        platform="tiktok",
        video_id=video_id,
        total_seen=len(raw),
        sampled=sampled,
        disabled=False,
        fetched_at=datetime.utcnow(),
        bytes_used=total_bytes,
    )


__all__ = ["TIKTOK_WEB_COMMENTS_URL", "fetch_tiktok_comments"]
