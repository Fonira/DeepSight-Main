"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📱 SCREENSHOT DETECTION — Détection de captures d'écran YouTube/TikTok           ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pipeline :                                                                        ║
║  1. OCR via Mistral /v1/ocr (quota séparé du chat)                                ║
║  2. Parse URLs YouTube/TikTok + indicateurs de plateforme                         ║
║  3. Fallback Vision (pixtral → small → Claude) si OCR garbage                     ║
║  4. Recherche vidéo via yt-dlp ytsearch + Brave Search                            ║
║                                                                                    ║
║  Consolidé depuis 20+ commits feat/fix screenshot (mars-avril 2026)              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import logging
import os
import re
import subprocess
from typing import Any, Dict, List, Optional

import httpx

from core.config import BRAVE_SEARCH_API_KEY

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════════

# Mistral Vision fallback chain
VISION_MODELS_SCREENSHOT = [
    "pixtral-12b-2409",
    "pixtral-large-2411",
    "mistral-small-2603",
    "mistral-small-latest",
    "mistral-medium-2508",
]

# Mistral Vision fallback chain for general analysis
VISION_MODELS_ANALYSIS = [
    "mistral-small-2603",
    "pixtral-large-2411",
    "pixtral-12b-2409",
    "mistral-small-latest",
    "mistral-medium-2508",
    "mistral-large-latest",
]

MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"

# Browser noise keywords to filter from OCR
BROWSER_NOISE_KEYWORDS = [
    "connexion", "chrome", "edge", "firefox", "copilot", "bing", "google.com",
    "nouvel onglet", "new tab", "favoris", "bookmarks", "translate", "extensions",
    "paramètres", "settings", "téléchargements", "downloads", "historique",
    "http://", "https://", ".com/", ".fr/", "www.", "://", "\\|",
]

# Platform indicator words
YOUTUBE_INDICATORS = [
    "youtube", "subscribe", "s'abonner", "views", "vues", "shorts",
    "j'aime", "dislike", "partager", "enregistrer", "save",
    "playlist", "regarder plus tard", "watch later", "abonnés", "subscribers",
]

TIKTOK_INDICATORS = [
    "tiktok", "pour toi", "for you", "fyp", "following",
    "suivre", "likes", "duet", "stitch", "son original",
    "original sound", "partager", "répondre", "discover", "créer",
]

# UI words to filter from title candidates
UI_WORDS = [
    "subscribe", "s'abonner", "views", "vues", "likes", "share",
    "partager", "follow", "j'aime", "enregistrer", "save",
    "clip", "remix", "thanks", "merci", "download",
]


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════

async def detect_video_screenshot(
    image: Any,
    api_key: str,
) -> Optional[Dict[str, str]]:
    """
    Détecte si une image est une capture d'écran YouTube/TikTok.

    Utilise l'API OCR dédiée de Mistral (/v1/ocr) qui a son propre rate limit
    séparé du chat completions. Extrait le texte visible puis parse pour
    trouver des URLs YouTube/TikTok et des indices de plateforme.

    Returns:
        Dict avec platform, search_query, video_title, channel, video_url
        ou None si pas un screenshot vidéo.
    """
    b64_data = _clean_base64(image.data)
    data_uri = f"data:{image.mime_type};base64,{b64_data}"

    try:
        # ── Étape 1 : OCR via /v1/ocr (quota séparé) ──
        ocr_text = await _call_mistral_ocr(data_uri, api_key)
        if not ocr_text:
            return None

        logger.info("[SCREENSHOT_DETECT] OCR extracted %d chars", len(ocr_text))

        # ── Étape 2 : Chercher des URLs YouTube/TikTok ──
        video_url, platform = _extract_video_url(ocr_text)

        # ── Étape 3 : Si pas d'URL, chercher des indices de plateforme ──
        if not platform:
            platform = _detect_platform_from_text(ocr_text)

        if not platform:
            return None

        # ── Étape 4 : Extraire titre et chaîne du texte OCR ──
        clean_lines = _filter_browser_noise(ocr_text)
        channel = _extract_channel(clean_lines)
        video_title = _extract_title(clean_lines)

        # Construire la query de recherche
        parts = []
        if video_title:
            parts.append(video_title[:80])
        if channel:
            parts.append(channel)
        search_query = " ".join(parts) if parts else None

        logger.info(
            "[SCREENSHOT_DETECT] Detected %s: url='%s' title='%s' channel='%s'",
            platform, video_url, video_title, channel,
        )

        return {
            "platform": platform,
            "search_query": search_query,
            "video_title": video_title,
            "channel": channel,
            "video_url": video_url,
        }

    except Exception as e:
        logger.warning("[SCREENSHOT_DETECT] Error: %s", e)
        return None


async def detect_video_screenshot_vision(
    image: Any,
    api_key: str,
    platform: str = "youtube",
) -> Optional[Dict[str, str]]:
    """
    Fallback Vision : extraction titre + chaîne depuis un screenshot
    quand l'OCR donne du texte garbage.

    Chaîne de fallback : pixtral-12b → pixtral-large → mistral-small → Claude Vision.

    Returns:
        Dict avec platform, search_query, video_title, channel, video_url
        ou None si rien trouvé.
    """
    b64_data = _clean_base64(image.data)

    platform_name = "YouTube" if platform == "youtube" else "TikTok"
    prompt_text = (
        f"This is a screenshot of a {platform_name} video page. "
        f"Your task is to identify the EXACT video being watched.\n\n"
        f"Extract the following information visible on screen:\n"
        f"1. The video TITLE (the main, large title text of the video being played)\n"
        f"2. The CHANNEL name (the creator/uploader name below the title)\n"
        f"3. If visible in the browser address bar, the video URL or video ID\n\n"
        f"Reply in this exact format:\n"
        f"TITLE: <the exact video title as shown on screen>\n"
        f"CHANNEL: <the channel name>\n"
        f"URL: <the video URL if visible, otherwise UNKNOWN>\n"
        f"If you cannot find a field, write UNKNOWN for that field.\n"
        f"IMPORTANT: Focus on the MAIN video being watched, not suggested/related videos."
    )

    # ── Try Mistral models ──
    for model in VISION_MODELS_SCREENSHOT:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    MISTRAL_CHAT_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{image.mime_type};base64,{b64_data}",
                                    },
                                },
                                {"type": "text", "text": prompt_text},
                            ],
                        }],
                        "max_tokens": 150,
                        "temperature": 0.0,
                    },
                )

                if response.status_code == 429:
                    wait = 15 if "pixtral" in model else 5
                    logger.warning("[SCREENSHOT_VISION] %s rate-limited, retrying in %ds", model, wait)
                    await asyncio.sleep(wait)
                    continue
                if response.status_code != 200:
                    logger.warning("[SCREENSHOT_VISION] %s error: %d", model, response.status_code)
                    continue

                data = response.json()
                answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                logger.info("[SCREENSHOT_VISION] %s response: %s", model, answer[:200])

                result = _parse_vision_response(answer, platform)
                if result:
                    return result

        except Exception as e:
            logger.warning("[SCREENSHOT_VISION] %s exception: %s", model, e)
            continue

    # ── Fallback: Anthropic Claude Vision ──
    result = await _claude_vision_screenshot(b64_data, image.mime_type, prompt_text, platform)
    if result:
        return result

    logger.warning("[SCREENSHOT_VISION] All models exhausted, no title found")
    return None


async def search_video_from_screenshot(
    search_query: str,
    platform: str,
) -> Optional[str]:
    """
    Recherche une vidéo YouTube/TikTok à partir des infos extraites d'un screenshot.

    Stratégie multi-fallback :
    - YouTube : yt-dlp ytsearch (titre + chaîne)
    - TikTok : yt-dlp search sur TikTok (titre + @username)
    - Fallback : Brave Search API si yt-dlp échoue
    """
    if not search_query or len(search_query.strip()) < 3:
        return None

    try:
        if platform == "youtube":
            url = await _ytdlp_search(search_query, "ytsearch5")
            if url:
                return url
            return await _brave_search_video(search_query, "youtube")

        elif platform == "tiktok":
            url = await _ytdlp_search_tiktok(search_query)
            if url:
                return url
            return await _brave_search_video(search_query, "tiktok")

    except Exception as e:
        logger.warning("[SCREENSHOT_SEARCH] Error: %s", e)

    return None


async def mistral_vision_request(
    api_key: str,
    messages: list,
    model: str = "mistral-small-2603",
    max_tokens: int = 4096,
    temperature: float = 0.1,
    response_format: Optional[Dict] = None,
    timeout: float = 120.0,
    fallback_models: Optional[List[str]] = None,
) -> Optional[str]:
    """
    Appel Vision résilient : Mistral → Claude Vision fallback.
    Jamais d'erreur rate-limit visible pour l'utilisateur.

    Phase 1 : Mistral (rotation rapide sur 2-3 modèles)
    Phase 2 : Anthropic Claude Vision
    Phase 3 : Retries progressifs sur Mistral (20s, 40s, 60s)
    """
    # -- Phase 1: Mistral (3 modèles max, rotation rapide) --
    mistral_models = [model] + (fallback_models or [])[:2]

    for model_idx, current_model in enumerate(mistral_models):
        for attempt in range(2):
            try:
                payload: Dict[str, Any] = {
                    "model": current_model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                }
                if response_format:
                    payload["response_format"] = response_format

                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        MISTRAL_CHAT_URL,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                    if response.status_code == 200:
                        data = response.json()
                        content = (
                            data.get("choices", [{}])[0]
                            .get("message", {})
                            .get("content", "")
                        )
                        if content:
                            if model_idx > 0 or attempt > 0:
                                logger.info(
                                    "[MISTRAL_VISION] Success with %s (attempt %d)",
                                    current_model, attempt + 1,
                                )
                            return content.strip()
                    if response.status_code == 429:
                        logger.warning("[MISTRAL_VISION] %s rate-limited, next model", current_model)
                        break
                    logger.warning(
                        "[MISTRAL_VISION] %s error %d: %s",
                        current_model, response.status_code, response.text[:200],
                    )
                    break
            except Exception as e:
                logger.warning("[MISTRAL_VISION] %s exception: %s", current_model, e)
                if attempt == 0:
                    await asyncio.sleep(2)
                    continue
                break

    # -- Phase 2: Anthropic Claude Vision --
    claude_result = await _claude_vision_general(messages, max_tokens, timeout)
    if claude_result:
        return claude_result

    # -- Phase 3: Retries progressifs sur Mistral --
    for retry_idx, wait_secs in enumerate([20, 40, 60]):
        logger.info(
            "[VISION_FALLBACK] Retry %d/3 — waiting %ds for rate limit reset",
            retry_idx + 1, wait_secs,
        )
        await asyncio.sleep(wait_secs)
        try:
            retry_model = mistral_models[retry_idx % len(mistral_models)]
            payload = {
                "model": retry_model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            if response_format:
                payload["response_format"] = response_format

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    MISTRAL_CHAT_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if response.status_code == 200:
                    data = response.json()
                    content = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                    )
                    if content:
                        logger.info("[VISION_FALLBACK] Retry %d success with %s", retry_idx + 1, retry_model)
                        return content.strip()
                if response.status_code == 429:
                    logger.warning("[VISION_FALLBACK] Retry %d still rate-limited", retry_idx + 1)
                    continue
                logger.warning("[VISION_FALLBACK] Retry %d error %d", retry_idx + 1, response.status_code)
        except Exception as e:
            logger.warning("[VISION_FALLBACK] Retry %d exception: %s", retry_idx + 1, e)

    logger.error("[VISION_FALLBACK] FINAL FAILURE after 3 retries (~2min wait)")
    return None


def is_garbage_query(query: str) -> bool:
    """Check if OCR-extracted query is garbage (mostly symbols, numbers, too short)."""
    if not query or len(query.strip()) < 5:
        return True

    q = query.strip()

    # Mostly digits/spaces/symbols
    alpha_chars = sum(1 for c in q if c.isalpha())
    if alpha_chars < 5:
        return True

    # Repetitive patterns (0 0 0 0...)
    words = q.split()
    if len(words) > 3 and len(set(words)) <= 2:
        return True

    # HTML entities
    if "&lt;" in q or "&gt;" in q or "&amp;" in q:
        return True

    # Too many hashtags or special chars relative to real words
    hashtag_count = q.count("#")
    if hashtag_count >= 2 and alpha_chars < 15:
        return True

    # Garbled OCR: high ratio of digits+symbols to letters
    non_alpha = sum(1 for c in q if not c.isalpha() and not c.isspace())
    if len(q) > 8 and non_alpha > alpha_chars:
        return True

    # Single "word" queries that look like garbled text
    if len(words) <= 2 and any(
        len(w) > 5 and sum(c.isdigit() for c in w) > len(w) * 0.3
        for w in words
    ):
        return True

    # Starts with "Playlist:" but has garbled content after
    if re.match(r"^(Playlist|Mix|Queue)\s*:", q, re.IGNORECASE):
        after_colon = q.split(":", 1)[1].strip() if ":" in q else ""
        if len(after_colon) < 10 or sum(1 for c in after_colon if c.isalpha()) < 5:
            return True

    return False


# ═══════════════════════════════════════════════════════════════════════════════
# Internal — OCR
# ═══════════════════════════════════════════════════════════════════════════════

def _clean_base64(data: str) -> str:
    """Strip data: URI prefix from base64 string."""
    if data.startswith("data:"):
        return data.split(",", 1)[-1]
    return data


async def _call_mistral_ocr(data_uri: str, api_key: str) -> Optional[str]:
    """Call Mistral OCR API (/v1/ocr) — separate rate limit from chat."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                MISTRAL_OCR_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-ocr-latest",
                    "document": {
                        "type": "image_url",
                        "image_url": data_uri,
                    },
                },
            )

            if response.status_code != 200:
                logger.warning("[SCREENSHOT_DETECT] OCR API error: %d", response.status_code)
                return None

            ocr_data = response.json()
            ocr_text = ""
            for page in ocr_data.get("pages", []):
                ocr_text += page.get("markdown", "") + "\n"

            return ocr_text.strip() or None

    except Exception as e:
        logger.warning("[SCREENSHOT_DETECT] OCR call failed: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Internal — URL & Platform extraction
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_video_url(ocr_text: str) -> tuple[Optional[str], Optional[str]]:
    """Extract YouTube/TikTok URL from OCR text. Returns (url, platform)."""
    # YouTube URLs
    yt_patterns = [
        r'(https?://(?:www\.)?youtube\.com/watch\?v=[A-Za-z0-9_-]+[^\s\)\"\']*)',
        r'(https?://youtu\.be/[A-Za-z0-9_-]+[^\s\)\"\']*)',
        r'(https?://(?:www\.)?youtube\.com/shorts/[A-Za-z0-9_-]+[^\s\)\"\']*)',
        r'(youtube\.com/watch\?v=[A-Za-z0-9_-]+[^\s\)\"\']*)',
    ]
    for pattern in yt_patterns:
        match = re.search(pattern, ocr_text)
        if match:
            url = match.group(1)
            if not url.startswith("http"):
                url = "https://" + url
            logger.info("[SCREENSHOT_DETECT] YouTube URL found in OCR: %s", url)
            return url, "youtube"

    # TikTok URLs
    tt_patterns = [
        r'(https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+[^\s\)\"\']*)',
        r'(https?://vm\.tiktok\.com/[\w-]+[^\s\)\"\']*)',
        r'(tiktok\.com/@[\w.-]+/video/\d+)',
    ]
    for pattern in tt_patterns:
        match = re.search(pattern, ocr_text)
        if match:
            url = match.group(1)
            if not url.startswith("http"):
                url = "https://" + url
            logger.info("[SCREENSHOT_DETECT] TikTok URL found in OCR: %s", url)
            return url, "tiktok"

    return None, None


def _detect_platform_from_text(ocr_text: str) -> Optional[str]:
    """Detect platform from indicator words in OCR text."""
    ocr_lower = ocr_text.lower()

    yt_score = sum(1 for ind in YOUTUBE_INDICATORS if ind in ocr_lower)
    tt_score = sum(1 for ind in TIKTOK_INDICATORS if ind in ocr_lower)

    # Lower threshold if @username detected (strong platform signal)
    has_at_user = bool(re.search(r"@[\w.-]{2,30}", ocr_text))
    threshold = 1 if has_at_user else 2

    if yt_score >= threshold and yt_score > tt_score:
        return "youtube"
    elif tt_score >= threshold:
        return "tiktok"

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Internal — Title & Channel extraction
# ═══════════════════════════════════════════════════════════════════════════════

def _filter_browser_noise(ocr_text: str) -> list[str]:
    """Filter browser UI noise from OCR lines."""
    lines = [line.strip() for line in ocr_text.split("\n") if line.strip()]
    clean_lines = []

    for line in lines:
        ll = line.lower()

        # Skip tab bar lines (separated by | or · with site names)
        if ll.count("|") >= 2 or ll.count("·") >= 2:
            continue

        # Skip lines with too much browser noise
        noise_count = sum(1 for nw in BROWSER_NOISE_KEYWORDS if nw in ll)
        if noise_count >= 2 and len(line) < 80:
            continue

        # Skip raw URLs
        if re.match(r"^https?://\S+$", line.strip()):
            continue

        clean_lines.append(line)

    return clean_lines


def _extract_channel(clean_lines: list[str]) -> Optional[str]:
    """Extract @channel from filtered OCR lines."""
    for line in clean_lines:
        channel_match = re.search(r"@([\w.-]{2,30})", line)
        if channel_match:
            return f"@{channel_match.group(1)}"
    return None


def _extract_title(clean_lines: list[str]) -> Optional[str]:
    """Extract probable video title from filtered OCR lines."""
    candidate_titles = []

    for line in clean_lines:
        if len(line) < 10:
            continue
        if line.startswith("@") and len(line.split()) <= 2:
            continue
        if re.match(r"^[\d\s.,:%]+$", line):
            continue
        # Filter short UI elements
        if any(w in line.lower() for w in UI_WORDS) and len(line) < 40:
            continue
        candidate_titles.append(line)

    # Prefer the longest line (usually the video title)
    if candidate_titles:
        title = max(candidate_titles, key=len)
        return title[:120]

    if clean_lines:
        return clean_lines[0][:120]

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Internal — Vision response parsing
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_vision_response(
    answer: str,
    platform: str,
) -> Optional[Dict[str, str]]:
    """Parse structured TITLE/CHANNEL/URL response from Vision model."""
    title_match = re.search(r"TITLE:\s*(.+)", answer)
    channel_match = re.search(r"CHANNEL:\s*(.+)", answer)
    url_match = re.search(r"URL:\s*(.+)", answer)

    title = title_match.group(1).strip() if title_match else None
    channel = channel_match.group(1).strip() if channel_match else None
    url_text = url_match.group(1).strip() if url_match else None

    if title and title.upper() == "UNKNOWN":
        title = None
    if channel and channel.upper() == "UNKNOWN":
        channel = None

    # Extract video URL from Vision response
    video_url = None
    if url_text and url_text.upper() != "UNKNOWN":
        yt_id_match = re.search(r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})", url_text)
        if yt_id_match:
            video_url = f"https://www.youtube.com/watch?v={yt_id_match.group(1)}"
        tt_match = re.search(r"(tiktok\.com/@[\w.-]+/video/\d+)", url_text)
        if tt_match and not video_url:
            video_url = f"https://www.{tt_match.group(1)}"

    if not title and not channel and not video_url:
        return None

    parts = []
    if title:
        parts.append(title[:80])
    if channel:
        parts.append(channel[:30])
    search_query = " ".join(parts)

    logger.info(
        "[SCREENSHOT_VISION] Extracted: title='%s' channel='%s' url='%s' query='%s'",
        title, channel, video_url, search_query,
    )

    return {
        "platform": platform,
        "search_query": search_query,
        "video_title": title,
        "channel": channel,
        "video_url": video_url,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Internal — Claude Vision fallback
# ═══════════════════════════════════════════════════════════════════════════════

def _get_anthropic_key() -> str:
    """Get Anthropic API key from environment."""
    return os.environ.get("ANTHROPIC_API_KEY", "")


async def _claude_vision_screenshot(
    b64_data: str,
    mime_type: str,
    prompt_text: str,
    platform: str,
) -> Optional[Dict[str, str]]:
    """Call Claude Vision for screenshot title extraction."""
    anthropic_key = _get_anthropic_key()
    if not anthropic_key:
        logger.info("[SCREENSHOT_VISION] No ANTHROPIC_API_KEY, skipping Claude fallback")
        return None

    try:
        logger.info("[SCREENSHOT_VISION] Trying Claude Vision fallback")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 150,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": mime_type,
                                    "data": b64_data,
                                },
                            },
                            {"type": "text", "text": prompt_text},
                        ],
                    }],
                },
            )

            if response.status_code == 200:
                data = response.json()
                answer = ""
                for block in data.get("content", []):
                    if block.get("type") == "text":
                        answer += block.get("text", "")
                logger.info("[SCREENSHOT_VISION] Claude response: %s", answer[:200])
                return _parse_vision_response(answer, platform)
            else:
                logger.warning(
                    "[SCREENSHOT_VISION] Claude error: %d %s",
                    response.status_code, response.text[:200],
                )
    except Exception as e:
        logger.warning("[SCREENSHOT_VISION] Claude exception: %s", e)

    return None


async def _claude_vision_general(
    messages: list,
    max_tokens: int,
    timeout: float,
) -> Optional[str]:
    """Call Claude Vision as general fallback for mistral_vision_request."""
    anthropic_key = _get_anthropic_key()
    if not anthropic_key:
        logger.info("[VISION_FALLBACK] No ANTHROPIC_API_KEY, skipping")
        return None

    logger.info("[VISION_FALLBACK] Mistral exhausted, trying Claude Vision")

    try:
        # Convert Mistral messages format to Anthropic format
        claude_messages = _convert_messages_to_anthropic(messages)

        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    resp = await client.post(
                        ANTHROPIC_API_URL,
                        headers={
                            "x-api-key": anthropic_key,
                            "anthropic-version": "2023-06-01",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "claude-sonnet-4-20250514",
                            "max_tokens": max_tokens or 1024,
                            "messages": claude_messages,
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        answer = ""
                        for block in data.get("content", []):
                            if block.get("type") == "text":
                                answer += block.get("text", "")
                        if answer:
                            logger.info("[VISION_FALLBACK] Claude Vision success!")
                            return answer.strip()
                    if resp.status_code == 429:
                        logger.warning("[VISION_FALLBACK] Claude rate-limited, attempt %d/2", attempt + 1)
                        await asyncio.sleep(5)
                        continue
                    logger.warning("[VISION_FALLBACK] Claude error %d: %s", resp.status_code, resp.text[:200])
                    break
            except Exception as e:
                logger.warning("[VISION_FALLBACK] Claude exception: %s", e)
                if attempt == 0:
                    await asyncio.sleep(3)
                    continue
                break
    except Exception as e:
        logger.warning("[VISION_FALLBACK] Claude setup error: %s", e)

    return None


def _convert_messages_to_anthropic(messages: list) -> list:
    """Convert Mistral-format messages to Anthropic format."""
    claude_messages = []

    for msg in messages:
        role = msg.get("role", "user")
        raw_content = msg.get("content", "")

        if isinstance(raw_content, str):
            claude_messages.append({"role": role, "content": raw_content})
        elif isinstance(raw_content, list):
            claude_content = []
            for item in raw_content:
                if not isinstance(item, dict):
                    claude_content.append(item)
                    continue

                if item.get("type") == "text":
                    claude_content.append(item)
                elif item.get("type") == "image_url":
                    img_url = item.get("image_url", "")
                    url_str = ""
                    if isinstance(img_url, str):
                        url_str = img_url
                    elif isinstance(img_url, dict):
                        url_str = img_url.get("url", "")

                    # Convert data URI to Anthropic image block
                    if url_str.startswith("data:"):
                        parts = url_str.split(",", 1)
                        media_type = parts[0].replace("data:", "").replace(";base64", "")
                        b64 = parts[1] if len(parts) > 1 else ""
                        claude_content.append({
                            "type": "image",
                            "source": {"type": "base64", "media_type": media_type, "data": b64},
                        })
                    else:
                        claude_content.append({"type": "text", "text": "[Image URL]"})
                else:
                    claude_content.append(item)

            claude_messages.append({"role": role, "content": claude_content})
        else:
            claude_messages.append({"role": role, "content": str(raw_content)})

    return claude_messages


# ═══════════════════════════════════════════════════════════════════════════════
# Internal — Video search (yt-dlp + Brave)
# ═══════════════════════════════════════════════════════════════════════════════

async def _ytdlp_search(query: str, search_prefix: str = "ytsearch5") -> Optional[str]:
    """Search YouTube via yt-dlp ytsearch."""
    import json as json_module

    cmd = [
        "yt-dlp",
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        "--geo-bypass",
        f"{search_prefix}:{query}",
    ]

    loop = asyncio.get_event_loop()

    def _run():
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            return result.stdout
        except Exception:
            return ""

    stdout = await loop.run_in_executor(None, _run)

    if stdout:
        for line in stdout.strip().split("\n"):
            if not line:
                continue
            try:
                video = json_module.loads(line)
                video_id = video.get("id")
                if video_id:
                    url = f"https://www.youtube.com/watch?v={video_id}"
                    logger.info("[SCREENSHOT_SEARCH] Found YouTube: %s (%s)", url, video.get("title", "?"))
                    return url
            except json_module.JSONDecodeError:
                continue

    return None


async def _ytdlp_search_tiktok(query: str) -> Optional[str]:
    """Search TikTok via yt-dlp."""
    import json as json_module

    cmd = [
        "yt-dlp",
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        f"tiktoksearch3:{query}",
    ]

    loop = asyncio.get_event_loop()

    def _run():
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
            return result.stdout
        except Exception:
            return ""

    stdout = await loop.run_in_executor(None, _run)

    if stdout:
        for line in stdout.strip().split("\n"):
            if not line:
                continue
            try:
                video = json_module.loads(line)
                video_url = video.get("webpage_url") or video.get("url")
                if video_url and "tiktok.com" in video_url:
                    logger.info("[SCREENSHOT_SEARCH] Found TikTok: %s", video_url)
                    return video_url
                video_id = video.get("id")
                uploader = video.get("uploader_id") or video.get("uploader")
                if video_id and uploader:
                    url = f"https://www.tiktok.com/@{uploader}/video/{video_id}"
                    logger.info("[SCREENSHOT_SEARCH] Found TikTok (constructed): %s", url)
                    return url
            except json_module.JSONDecodeError:
                continue

    return None


async def _brave_search_video(query: str, platform: str) -> Optional[str]:
    """Search video via Brave Search API when yt-dlp fails."""
    brave_key = BRAVE_SEARCH_API_KEY
    if not brave_key:
        return None

    try:
        site_filter = (
            "site:youtube.com OR site:youtu.be"
            if platform == "youtube"
            else "site:tiktok.com"
        )
        search_q = f"{query} {site_filter}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                BRAVE_SEARCH_URL,
                headers={
                    "X-Subscription-Token": brave_key,
                    "Accept": "application/json",
                },
                params={"q": search_q, "count": 5},
            )

            if response.status_code != 200:
                return None

            results = response.json().get("web", {}).get("results", [])
            for r in results:
                url = r.get("url", "")
                if platform == "youtube" and re.search(
                    r"youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/", url
                ):
                    logger.info("[BRAVE_SEARCH] Found YouTube: %s", url)
                    return url
                elif platform == "tiktok" and re.search(
                    r"tiktok\.com/.*/video/\d+|tiktok\.com/@", url
                ):
                    logger.info("[BRAVE_SEARCH] Found TikTok: %s", url)
                    return url

    except Exception as e:
        logger.warning("[BRAVE_SEARCH] Error: %s", e)

    return None
