"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📺 YOUTUBE CHANNEL CONTEXT SERVICE                                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Récupère métadonnées + N derniers uploads d'une chaîne YouTube via yt-dlp        ║
║  pour injection dans le contexte d'analyse Mistral.                                ║
║                                                                                    ║
║  Usage produit :                                                                   ║
║  • Permet à Mistral de comprendre si une vidéo est représentative ou exception    ║
║  • Permet de classifier la chaîne (poubelle/dangereuse/divertissement/éducative)  ║
║                                                                                    ║
║  API publique :                                                                    ║
║  • get_channel_context(channel_id, limit=50) -> dict | None                       ║
║  • extract_channel_id_from_video_metadata(metadata) -> str | None                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Optional

from transcripts.audio_utils import _yt_dlp_extra_args

logger = logging.getLogger(__name__)

# Timeout global pour l'invocation yt-dlp d'une chaîne (s)
_YTDLP_TIMEOUT_S = 60

# Tronquage des descriptions d'uploads pour éviter d'exploser le contexte LLM
_VIDEO_DESCRIPTION_MAX_CHARS = 200

# Régex pour extraire un ID de chaîne UCxxx depuis une URL `youtube.com/channel/UCxxx[...]`
_CHANNEL_ID_FROM_URL_RE = re.compile(r"/channel/(UC[A-Za-z0-9_-]{20,})")


def _build_channel_url(channel_id: str) -> str:
    """Construit l'URL `/videos` adaptée au format de l'identifiant.

    yt-dlp accepte indifféremment :
    - https://www.youtube.com/channel/UCxxx/videos    (ID canonique UCxxx)
    - https://www.youtube.com/@handle/videos          (handle, commence par @)

    Pour tout autre format (ex. nom legacy), on retombe sur `/channel/`.
    """
    if channel_id.startswith("@"):
        # Le handle conserve son préfixe `@` dans l'URL.
        return f"https://www.youtube.com/{channel_id}/videos"
    return f"https://www.youtube.com/channel/{channel_id}/videos"


async def _run_ytdlp_channel(channel_url: str, limit: int) -> Optional[dict[str, Any]]:
    """Lance `yt-dlp --flat-playlist --dump-single-json` sur l'URL chaîne.

    Retourne le dict JSON parsé, ou None en cas d'échec (timeout, returncode != 0,
    JSON invalide, exécutable absent, etc.).
    """
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-single-json",
        "--playlist-items",
        f"1:{limit}",
        "--no-warnings",
        "--skip-download",
        *_yt_dlp_extra_args(),
        channel_url,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        logger.warning("yt-dlp executable not found on PATH; cannot fetch channel %s", channel_url)
        return None
    except Exception as exc:  # défense en profondeur — spawn imprévu
        logger.warning("Failed to spawn yt-dlp for %s: %s", channel_url, exc)
        return None

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=_YTDLP_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.warning("yt-dlp channel fetch timed out (>%ss) for %s", _YTDLP_TIMEOUT_S, channel_url)
        try:
            proc.kill()
            await proc.wait()
        except ProcessLookupError:
            pass
        return None

    if proc.returncode != 0:
        stderr_text = (stderr or b"").decode("utf-8", errors="replace").strip()
        logger.warning(
            "yt-dlp channel fetch failed (rc=%s) for %s: %s",
            proc.returncode,
            channel_url,
            stderr_text[:300],
        )
        return None

    try:
        return json.loads(stdout.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        logger.warning("yt-dlp returned invalid JSON for %s: %s", channel_url, exc)
        return None


def _parse_channel_payload(
    channel_id: str,
    payload: dict[str, Any],
    limit: int,
) -> dict[str, Any]:
    """Convertit le JSON yt-dlp en dict canonique 'channel context'."""
    entries = payload.get("entries") or []

    last_videos: list[dict[str, Any]] = []
    for entry in entries[:limit]:
        if not isinstance(entry, dict):
            continue
        description = entry.get("description") or ""
        if len(description) > _VIDEO_DESCRIPTION_MAX_CHARS:
            description = description[:_VIDEO_DESCRIPTION_MAX_CHARS]
        last_videos.append(
            {
                "title": entry.get("title") or "",
                "description": description,
                "tags": list(entry.get("tags") or []),
                "view_count": entry.get("view_count"),
                "upload_date": entry.get("upload_date"),
            }
        )

    return {
        "channel_id": channel_id,
        "platform": "youtube",
        "name": payload.get("channel") or payload.get("uploader") or payload.get("title") or "",
        "description": payload.get("description") or "",
        "subscriber_count": payload.get("channel_follower_count"),
        "video_count": payload.get("playlist_count"),
        "tags": list(payload.get("tags") or []),
        "categories": list(payload.get("categories") or []),
        "last_videos": last_videos,
    }


async def get_channel_context(channel_id: str, limit: int = 50) -> Optional[dict[str, Any]]:
    """Fetch métadonnées + N derniers uploads d'une chaîne YouTube.

    Args:
        channel_id: ID canonique (`UCxxx...`) ou handle (`@xxx`) d'une chaîne YouTube.
        limit: nombre max d'uploads à remonter dans `last_videos` (défaut 50).

    Returns:
        Un dict de la forme :

            {
                "channel_id": str,
                "platform": "youtube",
                "name": str,
                "description": str,
                "subscriber_count": int | None,
                "video_count": int | None,
                "tags": list[str],
                "categories": list[str],
                "last_videos": [
                    {
                        "title": str,
                        "description": str,           # tronqué à 200 chars
                        "tags": list[str],
                        "view_count": int | None,
                        "upload_date": str | None,    # YYYYMMDD (format yt-dlp)
                    },
                    ...
                ],
            }

        ou `None` en cas d'échec (chaîne privée/supprimée, rate-limit, timeout, etc.).
    """
    if not channel_id or not isinstance(channel_id, str):
        logger.debug("get_channel_context: channel_id vide/invalide -> None")
        return None
    if limit <= 0:
        logger.debug("get_channel_context: limit<=0 -> None")
        return None

    url_primary = _build_channel_url(channel_id)
    payload = await _run_ytdlp_channel(url_primary, limit)

    # Fallback : si l'utilisateur a passé un handle SANS le préfixe `@`, retenter
    # avec `@`. yt-dlp accepte aussi `youtube.com/<handle>` mais sans `@` cela
    # échoue silencieusement pour la plupart des handles modernes.
    if payload is None and not channel_id.startswith("@") and not channel_id.startswith("UC"):
        url_handle = f"https://www.youtube.com/@{channel_id}/videos"
        logger.info("Retrying channel fetch with handle URL: %s", url_handle)
        payload = await _run_ytdlp_channel(url_handle, limit)

    if payload is None:
        return None

    try:
        return _parse_channel_payload(channel_id, payload, limit)
    except Exception as exc:  # défense en profondeur — payload yt-dlp inattendu
        logger.warning("Failed to parse yt-dlp channel payload for %s: %s", channel_id, exc)
        return None


def extract_channel_id_from_video_metadata(metadata: dict[str, Any]) -> Optional[str]:
    """Extrait l'ID de chaîne depuis le metadata d'une vidéo (output de
    `get_video_info_ytdlp`).

    Ordre de préférence :
    1. champ direct `channel_id` (le plus fiable, ex: `UCxxx...`)
    2. parse de `channel_url` (`https://www.youtube.com/channel/UCxxx`)
    3. fallback `uploader_id` (peut être un handle `@xxx` ou un nom legacy)

    Returns:
        L'ID canonique `UCxxx...` ou un handle `@xxx`, ou `None` si rien de
        exploitable.
    """
    if not isinstance(metadata, dict):
        return None

    direct = metadata.get("channel_id")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    channel_url = metadata.get("channel_url") or metadata.get("uploader_url")
    if isinstance(channel_url, str) and channel_url:
        match = _CHANNEL_ID_FROM_URL_RE.search(channel_url)
        if match:
            return match.group(1)
        # `youtube.com/@handle` -> handle préfixé `@`
        handle_match = re.search(r"youtube\.com/(@[A-Za-z0-9._-]+)", channel_url)
        if handle_match:
            return handle_match.group(1)

    uploader_id = metadata.get("uploader_id")
    if isinstance(uploader_id, str) and uploader_id.strip():
        return uploader_id.strip()

    return None


__all__ = [
    "get_channel_context",
    "extract_channel_id_from_video_metadata",
]
