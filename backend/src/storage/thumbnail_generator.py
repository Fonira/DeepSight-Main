"""
Thumbnail persistence orchestrator.
Downloads video thumbnails (YouTube/TikTok) or generates AI images (text)
and uploads them to R2 for permanent storage.

Reuses existing pipeline functions — no duplication.
"""

import json
import logging
from datetime import date
from typing import Optional

from core.config import R2_CONFIG, get_mistral_key
from storage.r2 import upload_to_r2, check_exists_r2, get_r2_public_url, is_r2_available
from storage.thumbnails import download_thumbnail, process_thumbnail

logger = logging.getLogger(__name__)

# Daily budget for AI-generated thumbnails (text analyses)
DAILY_AI_THUMB_LIMIT = 50
_REDIS_COUNTER_PREFIX = "deepsight:thumb_gen:daily"

# Simplified art director prompt for text analysis thumbnails
THUMB_ART_DIRECTOR_PROMPT = """Tu es un directeur artistique pour des thumbnails editoriales.

A partir du titre et de la categorie d'un article/texte, genere un prompt visuel pour une image de couverture.

Regles :
- L'image doit etre belle et intrigante SANS contexte
- Jamais de texte, de personnes, de watermarks
- Un objet ou une scene simple, photographiable, 1-2 elements max
- Le prompt visuel DOIT etre en anglais

Reponds UNIQUEMENT avec ce JSON strict :
{"visual_prompt":"... (ENGLISH ONLY)"}"""

ART_DIRECTOR_MODEL = "mistral-small-2503"


async def _check_ai_budget() -> bool:
    """Check if we haven't exceeded the daily AI thumbnail budget."""
    try:
        from core.cache import cache_service
        if hasattr(cache_service, 'backend') and hasattr(cache_service.backend, 'redis'):
            redis = cache_service.backend.redis
            key = f"{_REDIS_COUNTER_PREFIX}:{date.today().isoformat()}"
            count = await redis.get(key)
            if count and int(count) >= DAILY_AI_THUMB_LIMIT:
                logger.info(f"AI thumbnail budget exhausted ({count}/{DAILY_AI_THUMB_LIMIT})")
                return False
            return True
    except Exception:
        pass
    return True


async def _increment_ai_budget() -> None:
    """Increment the daily AI thumbnail counter."""
    try:
        from core.cache import cache_service
        if hasattr(cache_service, 'backend') and hasattr(cache_service.backend, 'redis'):
            redis = cache_service.backend.redis
            key = f"{_REDIS_COUNTER_PREFIX}:{date.today().isoformat()}"
            await redis.incr(key)
            await redis.expire(key, 86400 * 2)  # 2 day TTL
    except Exception:
        pass


async def _generate_text_thumbnail(title: str, category: str | None) -> Optional[bytes]:
    """Generate an AI thumbnail for a text analysis using Mistral + FLUX."""
    if not get_mistral_key():
        return None

    if not await _check_ai_budget():
        return None

    try:
        from mistralai import Mistral

        client = Mistral(api_key=get_mistral_key())

        user_msg = (
            f"Titre : {title}\n"
            f"Categorie : {category or 'general'}\n\n"
            "Genere un prompt visuel pour la thumbnail de cet article."
        )

        response = await client.chat.complete_async(
            model=ART_DIRECTOR_MODEL,
            messages=[
                {"role": "system", "content": THUMB_ART_DIRECTOR_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.8,
            max_tokens=300,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)
        visual_prompt = data.get("visual_prompt")
        if not visual_prompt:
            logger.warning(f"Art director missing visual_prompt for '{title[:50]}'")
            return None

        # Generate image via the existing tiered pipeline
        from images.keyword_images import (
            _stage2_generate_image,
            _post_process,
        )

        raw_image, model_used = await _stage2_generate_image(visual_prompt, premium=False)
        webp_bytes = _post_process(raw_image)

        await _increment_ai_budget()
        logger.info(f"AI thumbnail generated for '{title[:40]}' ({model_used}, {len(webp_bytes)}B)")
        return webp_bytes

    except Exception as e:
        logger.warning(f"AI thumbnail generation failed for '{title[:40]}': {e}")
        return None


async def _update_summary_thumbnail(summary_id: int, r2_url: str) -> None:
    """Update the thumbnail_url in the summaries table."""
    try:
        from db.database import get_session
        from sqlalchemy import text

        async for session in get_session():
            await session.execute(
                text("UPDATE summaries SET thumbnail_url = :url WHERE id = :sid"),
                {"url": r2_url, "sid": summary_id},
            )
            await session.commit()
            break
    except Exception as e:
        logger.error(f"Failed to update thumbnail_url for summary {summary_id}: {e}")


async def ensure_thumbnail(
    summary_id: int,
    video_id: str,
    title: str,
    category: str | None,
    platform: str,
    original_url: str | None,
    video_url: str | None,
) -> Optional[str]:
    """
    Ensure a summary has a persistent R2 thumbnail.

    For YouTube/TikTok: downloads the thumbnail and uploads to R2.
    For text: generates an AI image via Mistral + FLUX and uploads to R2.

    Returns the R2 public URL on success, None on failure.
    Non-blocking — designed to be called via asyncio.create_task().
    """
    if not R2_CONFIG["ENABLED"] or not is_r2_available():
        return None

    try:
        # Check R2 cache first
        card_key = f"thumbnails/{video_id}/card.webp"
        if await check_exists_r2(card_key):
            r2_url = get_r2_public_url(card_key)
            await _update_summary_thumbnail(summary_id, r2_url)
            logger.debug(f"R2 thumbnail already exists: {video_id}")
            return r2_url

        # Get image bytes depending on platform
        image_bytes: Optional[bytes] = None

        if platform in ("youtube", "tiktok"):
            image_bytes = await download_thumbnail(video_id, original_url, platform)
        elif platform == "text":
            image_bytes = await _generate_text_thumbnail(title, category)

        if not image_bytes:
            return None

        # Process (resize + WebP) into card + thumb sizes
        processed = process_thumbnail(image_bytes)

        # Upload both sizes to R2
        card_url = None
        for size_name, data in processed.items():
            key = f"thumbnails/{video_id}/{size_name}.webp"
            url = await upload_to_r2(data, key)
            if size_name == "card":
                card_url = url

        if card_url:
            await _update_summary_thumbnail(summary_id, card_url)
            logger.info(
                f"Thumbnail persisted to R2: {video_id} ({platform}, "
                f"card={len(processed.get('card', b''))}B)"
            )

        return card_url

    except Exception as e:
        logger.error(f"ensure_thumbnail failed for {video_id} ({platform}): {e}")
        return None
