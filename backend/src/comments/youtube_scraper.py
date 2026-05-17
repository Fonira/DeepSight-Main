"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎬 YOUTUBE COMMENTS SCRAPER — Innertube /youtubei/v1/next                         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Méthode : Innertube API non officielle (WEB client) via proxy Decodo Residential ║
║  Pas de dépendance yt-dlp / subprocess. Tout passe par httpx → traçable telemetry ║
║                                                                                    ║
║  Pagination via continuation tokens (≈20 comments/page).                          ║
║  Stop conditions : max_pages, plus de continuation, ou hard-limit cumul total.    ║
║                                                                                    ║
║  Cas dégradés :                                                                    ║
║    - commentaires désactivés → CommentsBatch(disabled=True)                       ║
║    - Innertube 403/429 → 1 retry backoff 2s puis abandon (CommentsBatch vide)     ║
║    - peu de commentaires (<20) → on retourne ce qui existe                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any, Iterator

from core.http_client import get_proxied_client
from core.logging import logger
from middleware.proxy_telemetry import record_proxy_usage

from .sampler import dedupe_comments, sample_top_and_random
from .schemas import Comment, CommentsBatch

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

INNERTUBE_NEXT_URL = "https://www.youtube.com/youtubei/v1/next"

# Clé publique sniffée depuis youtube.com (WEB client). Peut être rotée par
# YouTube → on lit en runtime via _get_innertube_key() pour permettre l'override
# via env var sans redeploy.
INNERTUBE_API_KEY_DEFAULT = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"

INNERTUBE_CONTEXT: dict[str, Any] = {
    "client": {
        "clientName": "WEB",
        "clientVersion": "2.20260513.01.00",
        "hl": "en",
        "gl": "US",
        "userAgent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }
}

# Pagination
DEFAULT_MAX_PAGES = 10
DEFAULT_PAGE_TIMEOUT_S = 12.0
DEFAULT_RETRY_BACKOFF_S = 2.0

# Hard limit cumul brut (sanity check) — au-delà on stop la pagination même si
# YouTube nous donne encore une continuation. Évite de scraper 10k commentaires
# par accident.
MAX_RAW_COMMENTS_HARD_LIMIT = 500


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 INNERTUBE KEY (overridable via env var)
# ═══════════════════════════════════════════════════════════════════════════════


def _get_innertube_key() -> str:
    """Lit YOUTUBE_INNERTUBE_KEY env var si présente, sinon fallback default.

    Permet hot-rotate sans redeploy en cas de rotation par YouTube.
    """
    import os

    return os.environ.get("YOUTUBE_INNERTUBE_KEY", "").strip() or INNERTUBE_API_KEY_DEFAULT


# ═══════════════════════════════════════════════════════════════════════════════
# 🔎 WALK / PARSE — navigation JSON brute
# ═══════════════════════════════════════════════════════════════════════════════


def _walk(node: Any, target_key: str) -> Iterator[dict[str, Any]]:
    """Yield récursivement tous les dicts contenant `target_key` dans `node`."""
    if isinstance(node, dict):
        if target_key in node and isinstance(node[target_key], dict):
            yield node[target_key]
        for v in node.values():
            yield from _walk(v, target_key)
    elif isinstance(node, list):
        for item in node:
            yield from _walk(item, target_key)


def _parse_like_count(text: str | None) -> int:
    """Parse '1.2K', '3.4M', '847' → int. Retourne 0 si parsing échoue."""
    if not text:
        return 0
    s = str(text).strip().replace(",", ".").replace("\xa0", "").replace(" ", "")
    if not s:
        return 0
    multiplier = 1
    if s[-1] in ("K", "k"):
        multiplier = 1_000
        s = s[:-1]
    elif s[-1] in ("M", "m"):
        multiplier = 1_000_000
        s = s[:-1]
    elif s[-1] in ("B", "b"):
        multiplier = 1_000_000_000
        s = s[:-1]
    try:
        return int(float(s) * multiplier)
    except (ValueError, TypeError):
        return 0


def _extract_text(node: dict[str, Any] | None) -> str:
    """Extrait le texte concaténé de YouTube `simpleText` ou `runs[].text`."""
    if not node or not isinstance(node, dict):
        return ""
    if "simpleText" in node:
        return str(node["simpleText"])
    runs = node.get("runs")
    if isinstance(runs, list):
        return "".join(str(r.get("text", "")) for r in runs if isinstance(r, dict))
    return ""


def _extract_comment_threads(data: dict[str, Any]) -> Iterator[Comment]:
    """Parse les commentEntityPayload (format Innertube récent)."""
    # Format moderne 2024+ : entityPayloads → commentEntityPayload
    if isinstance(data, dict):
        # Mutations payload
        mutations = []
        for fc in _walk(data, "frameworkUpdates"):
            for mut in fc.get("entityBatchUpdate", {}).get("mutations", []) or []:
                mutations.append(mut)

        for mut in mutations:
            payload = mut.get("payload") if isinstance(mut, dict) else None
            if not isinstance(payload, dict):
                continue
            cep = payload.get("commentEntityPayload")
            if not isinstance(cep, dict):
                continue

            props = cep.get("properties", {}) or {}
            author_block = cep.get("author", {}) or {}
            toolbar = cep.get("toolbar", {}) or {}

            cid = props.get("commentId") or ""
            text = props.get("content", {}).get("content") or ""
            author = author_block.get("displayName") or ""
            author_id = author_block.get("channelId") or None
            is_creator = bool(author_block.get("isCreator", False))

            # Likes / replies — toolbar contient les chiffres formatés.
            like_count = _parse_like_count(toolbar.get("likeCountNotliked") or toolbar.get("likeCountLiked") or "0")
            reply_count = _parse_like_count(toolbar.get("replyCount") or "0")

            published_at = None
            published_text = props.get("publishedTime") or ""
            # On garde le texte brut, pas de parsing strict de date relative.
            _ = published_text  # noqa: F841

            if not cid or not text:
                continue

            yield Comment(
                comment_id=str(cid),
                author=str(author),
                author_id=str(author_id) if author_id else None,
                text=str(text),
                like_count=int(like_count),
                reply_count=int(reply_count),
                published_at=published_at,
                is_reply=False,
                parent_id=None,
                is_creator_reply=is_creator,
                is_pinned=False,
            )

    # Format legacy : commentThreadRenderer (au cas où Innertube revienne dessus)
    for thread in _walk(data, "commentThreadRenderer"):
        cr = thread.get("comment", {}).get("commentRenderer") if isinstance(thread, dict) else None
        if not isinstance(cr, dict):
            continue
        cid = cr.get("commentId")
        content = _extract_text(cr.get("contentText"))
        author = _extract_text(cr.get("authorText"))
        like_text = _extract_text(cr.get("voteCount"))
        like_count = _parse_like_count(like_text)
        reply_count = 0
        replies = thread.get("replies", {}) or {}
        if replies:
            rcr = replies.get("commentRepliesRenderer", {})
            view_replies = _extract_text(rcr.get("viewReplies"))
            reply_count = _parse_like_count(view_replies)

        if not cid or not content:
            continue

        yield Comment(
            comment_id=str(cid),
            author=str(author),
            author_id=None,
            text=str(content),
            like_count=int(like_count),
            reply_count=int(reply_count),
            published_at=None,
            is_reply=False,
            parent_id=None,
            is_creator_reply=False,
            is_pinned=False,
        )


def _extract_next_continuation(data: dict[str, Any]) -> str | None:
    """Cherche le prochain continuation token pour paginer.

    Cherche dans l'ordre :
      - continuationItemRenderer[.continuationEndpoint].continuationCommand.token
      - reloadContinuationItemsCommand.continuationItems[].continuationItemRenderer...
    """
    for cir in _walk(data, "continuationItemRenderer"):
        ep = cir.get("continuationEndpoint") if isinstance(cir, dict) else None
        if isinstance(ep, dict):
            cmd = ep.get("continuationCommand") or {}
            tok = cmd.get("token")
            if tok:
                return str(tok)
        button = cir.get("button") if isinstance(cir, dict) else None
        if isinstance(button, dict):
            br = button.get("buttonRenderer", {}) or {}
            ep2 = br.get("command", {}).get("continuationCommand") or {}
            tok = ep2.get("token")
            if tok:
                return str(tok)
    return None


def _extract_initial_continuation(data: dict[str, Any]) -> str | None:
    """Extrait le continuation token initial pour la section commentaires.

    Cherche dans engagementPanelSectionListRenderer avec
    targetId='engagement-panel-comments-section'.
    """
    if not isinstance(data, dict):
        return None

    for panel in _walk(data, "engagementPanelSectionListRenderer"):
        if not isinstance(panel, dict):
            continue
        if panel.get("targetId") != "engagement-panel-comments-section":
            continue
        # Format moderne : header + content avec continuation imbriqué
        for cir in _walk(panel, "continuationItemRenderer"):
            ep = cir.get("continuationEndpoint") if isinstance(cir, dict) else None
            if isinstance(ep, dict):
                cmd = ep.get("continuationCommand") or {}
                tok = cmd.get("token")
                if tok:
                    return str(tok)
        for cmd_node in _walk(panel, "continuationCommand"):
            tok = cmd_node.get("token") if isinstance(cmd_node, dict) else None
            if tok:
                return str(tok)

    # Fallback global (peut attraper le mauvais token mais better than nothing)
    for cir in _walk(data, "continuationItemRenderer"):
        ep = cir.get("continuationEndpoint") if isinstance(cir, dict) else None
        if isinstance(ep, dict):
            cmd = ep.get("continuationCommand") or {}
            tok = cmd.get("token")
            if tok:
                return str(tok)
    return None


def _has_comments_disabled_marker(data: dict[str, Any]) -> bool:
    """Détecte la sentinel "Comments are disabled" ou panel absent."""
    if not isinstance(data, dict):
        return False

    # 1. Panel "comments" absent entièrement → considéré disabled.
    has_panel = False
    for panel in _walk(data, "engagementPanelSectionListRenderer"):
        if isinstance(panel, dict) and panel.get("targetId") == "engagement-panel-comments-section":
            has_panel = True
            break

    if not has_panel:
        # Si on a pas du tout de panel comments, c'est désactivé OU page bizarre.
        # On considère désactivé : c'est l'UX la plus sûre.
        return True

    # 2. Marker textuel explicite (rare mais présent sur certaines pages).
    for run in _walk(data, "messageRenderer"):
        text = _extract_text(run.get("text") if isinstance(run, dict) else None)
        if (
            text
            and "comment" in text.lower()
            and ("disabled" in text.lower() or "désactivé" in text.lower() or "turn" in text.lower())
        ):
            return True

    return False


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 HTTP CALLS — Innertube /youtubei/v1/next
# ═══════════════════════════════════════════════════════════════════════════════


async def _post_innertube(
    payload: dict[str, Any], *, timeout: float = DEFAULT_PAGE_TIMEOUT_S
) -> tuple[dict[str, Any] | None, int]:
    """POST vers Innertube avec proxy + telemetry. Retourne (data, bytes_in).

    Si HTTP != 200 ou parse fail → (None, bytes_in).
    """
    key = _get_innertube_key()
    url = f"{INNERTUBE_NEXT_URL}?key={key}"
    payload_bytes = json.dumps(payload).encode("utf-8")
    bytes_out = len(payload_bytes)

    try:
        async with get_proxied_client(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
    except Exception as e:
        logger.warning(f"[COMMENTS_YOUTUBE] HTTP exception: {e}")
        return None, 0

    bytes_in = len(resp.content) if resp.content is not None else 0

    # Telemetry — best-effort, ne pas masquer d'autres erreurs.
    try:
        await record_proxy_usage(
            provider="comments_youtube",
            bytes_in=bytes_in,
            bytes_out=bytes_out,
        )
    except Exception as te:
        logger.debug(f"[COMMENTS_YOUTUBE] proxy telemetry failed: {te}")

    if resp.status_code != 200:
        logger.warning(f"[COMMENTS_YOUTUBE] Innertube HTTP {resp.status_code}")
        return None, bytes_in

    try:
        data = resp.json()
        return data, bytes_in
    except Exception as e:
        logger.warning(f"[COMMENTS_YOUTUBE] JSON parse failed: {e}")
        return None, bytes_in


async def _fetch_continuation(video_id: str) -> tuple[str | None, bool, int]:
    """Step 1 — récupère le continuation token initial + flag disabled.

    Returns:
        (token, disabled, bytes_in). Token=None et disabled=True si commentaires KO.
    """
    payload = {**INNERTUBE_CONTEXT, "videoId": video_id}
    data, bytes_in = await _post_innertube(payload)
    if data is None:
        # Pas d'info → on présume "indisponible" mais pas "disabled" pour la UI.
        # On retourne disabled=False pour laisser le caller décider, et token=None
        # signale "scrape failed".
        return None, False, bytes_in

    if _has_comments_disabled_marker(data):
        return None, True, bytes_in

    token = _extract_initial_continuation(data)
    return token, False, bytes_in


async def _fetch_comments_page(token: str) -> tuple[list[Comment], str | None, int]:
    """Step 2+ — paginate via continuation token. Retourne (comments, next_token, bytes_in)."""
    payload = {**INNERTUBE_CONTEXT, "continuation": token}
    data, bytes_in = await _post_innertube(payload)
    if data is None:
        return [], None, bytes_in
    comments = list(_extract_comment_threads(data))
    next_token = _extract_next_continuation(data)
    return comments, next_token, bytes_in


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════


async def fetch_youtube_comments(
    video_id: str,
    *,
    top_n: int = 100,
    random_n: int = 50,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> CommentsBatch:
    """Récupère les commentaires d'une vidéo YouTube via Innertube + sampling.

    Pipeline :
      1. /youtubei/v1/next?videoId=... → récupère le token initial.
      2. POST avec continuation token N → paginate jusqu'à max_pages OU plus de token.
      3. Déduplication via comment_id.
      4. Sampling Top top_n + Random random_n (déterministe via seed video_id).

    Args:
        video_id: ID YouTube (ex "dQw4w9WgXcQ").
        top_n: nombre de commentaires top likes à inclure (défaut 100).
        random_n: nombre de commentaires aléatoires bonus (défaut 50).
        max_pages: cap dur sur le nombre de pages Innertube (défaut 10).

    Returns:
        CommentsBatch avec sampled[], total_seen, disabled, bytes_used.
    """
    total_bytes = 0
    token, disabled, b = await _fetch_continuation(video_id)
    total_bytes += b

    if disabled:
        return CommentsBatch(
            platform="youtube",
            video_id=video_id,
            total_seen=0,
            sampled=[],
            disabled=True,
            bytes_used=total_bytes,
        )

    if not token:
        # Scrape failed → batch vide non-disabled (l'orchestrateur traitera comme
        # insufficient_data plutôt que disabled, ce qui est plus honnête).
        return CommentsBatch(
            platform="youtube",
            video_id=video_id,
            total_seen=0,
            sampled=[],
            disabled=False,
            bytes_used=total_bytes,
        )

    raw: list[Comment] = []
    pages_done = 0
    retried = False

    while token and pages_done < max_pages:
        pages_done += 1
        comments, next_token, b = await _fetch_comments_page(token)
        total_bytes += b

        if not comments and not next_token and not retried:
            # 1 retry après backoff sur la première page vide (peut-être 429 silencieux).
            retried = True
            await asyncio.sleep(DEFAULT_RETRY_BACKOFF_S)
            comments, next_token, b = await _fetch_comments_page(token)
            total_bytes += b

        for c in comments:
            # Attache le video_id pour le seed déterministe du sampler.
            c.video_id = video_id
            raw.append(c)

        if len(raw) >= MAX_RAW_COMMENTS_HARD_LIMIT:
            logger.info(
                f"[COMMENTS_YOUTUBE] hard limit {MAX_RAW_COMMENTS_HARD_LIMIT} reached "
                f"after {pages_done} pages for {video_id}"
            )
            break

        token = next_token

    raw = dedupe_comments(raw)
    sampled = sample_top_and_random(raw, top_n=top_n, random_n=random_n, video_id=video_id)

    return CommentsBatch(
        platform="youtube",
        video_id=video_id,
        total_seen=len(raw),
        sampled=sampled,
        disabled=False,
        fetched_at=datetime.utcnow(),
        bytes_used=total_bytes,
    )


__all__ = [
    "INNERTUBE_API_KEY_DEFAULT",
    "INNERTUBE_NEXT_URL",
    "fetch_youtube_comments",
]
