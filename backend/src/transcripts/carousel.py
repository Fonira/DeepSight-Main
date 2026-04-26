"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📸 CAROUSEL TRANSCRIPT — Pseudo-transcript from TikTok Image Carousels          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Uses Mistral Vision to extract text (OCR) and describe visual content           ║
║  from each slide, assembling into a pseudo-transcript for analysis.              ║
║                                                                                  ║
║  Constraints:                                                                    ║
║  • Mistral Vision: max 8 images per request                                      ║
║  • TikTok carousels: up to 35 slides                                             ║
║  • Strategy: batch images in groups of 8, sample if >24                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import base64
import logging
from typing import Optional, Tuple

import httpx

from core.config import get_mistral_key

logger = logging.getLogger("deepsight.carousel")

# ═══════════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════════

MAX_IMAGES_PER_BATCH = 8  # Mistral Vision limit
MAX_TOTAL_IMAGES = 24  # 3 batches max to control cost
MAX_IMAGE_SIZE_BYTES = 10_000_000  # 10 MB per image
DOWNLOAD_TIMEOUT = 15.0
DOWNLOAD_CONCURRENCY = 5
VISION_MODEL = "mistral-small-2603"  # Cheapest vision-capable model (~$0.001/image)
VISION_TIMEOUT = 120.0


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def get_carousel_transcript(
    images: list[str],
    title: str = "",
    description: str = "",
    lang: str = "fr",
    model: str = VISION_MODEL,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Build a pseudo-transcript from a TikTok image carousel using Mistral Vision.

    Args:
        images: List of image URLs from carousel slides
        title: Post title/caption
        description: Post description
        lang: Target language (fr/en)
        model: Mistral model to use (must support vision)

    Returns:
        (full_text, structured_text, detected_lang)
        Same format as get_tiktok_transcript() for pipeline compatibility.
    """
    if not images:
        logger.warning("[CAROUSEL] No images provided")
        return None, None, None

    api_key = get_mistral_key()
    if not api_key:
        logger.error("[CAROUSEL] No Mistral API key configured")
        return None, None, None

    total_images = len(images)
    logger.info(f"[CAROUSEL] Processing {total_images} slides")

    # Sample images if too many (>24)
    selected_urls = _select_images(images, MAX_TOTAL_IMAGES)
    logger.info(f"[CAROUSEL] Selected {len(selected_urls)} images (from {total_images})")

    # Download all images in parallel
    image_data = await _download_images(selected_urls)
    if not image_data:
        logger.error("[CAROUSEL] Failed to download any images")
        return None, None, None

    logger.info(f"[CAROUSEL] Downloaded {len(image_data)} images successfully")

    # Batch images and analyze with Vision
    batches = _batch_images(image_data, MAX_IMAGES_PER_BATCH)
    batch_results = []

    for batch_idx, batch in enumerate(batches):
        logger.info(f"[CAROUSEL] Analyzing batch {batch_idx + 1}/{len(batches)} ({len(batch)} images)")
        result = await _analyze_batch(
            batch=batch,
            batch_index=batch_idx,
            total_slides=total_images,
            lang=lang,
            model=model,
            api_key=api_key,
        )
        if result:
            batch_results.append(result)

    if not batch_results:
        logger.error("[CAROUSEL] Vision analysis failed for all batches")
        return None, None, None

    # Assemble pseudo-transcript
    full_text, structured_text = _assemble_transcript(
        batch_results=batch_results,
        title=title,
        description=description,
        total_slides=total_images,
        lang=lang,
    )

    detected_lang = lang
    logger.info(f"[CAROUSEL] Pseudo-transcript assembled: {len(full_text)} chars")

    return full_text, structured_text, detected_lang


# ═══════════════════════════════════════════════════════════════════════════════
# Image selection & download
# ═══════════════════════════════════════════════════════════════════════════════


def _select_images(urls: list[str], max_count: int) -> list[str]:
    """
    Select representative images if there are more than max_count.
    Strategy: first 4 + evenly spaced middle + last 4.
    """
    if len(urls) <= max_count:
        return urls

    # Take first 4, last 4, and sample evenly from the middle
    head = urls[:4]
    tail = urls[-4:]
    middle_pool = urls[4:-4]
    middle_count = max_count - 8
    if middle_count <= 0:
        return head + tail

    step = max(1, len(middle_pool) // middle_count)
    middle = [middle_pool[i] for i in range(0, len(middle_pool), step)][:middle_count]

    return head + middle + tail


async def _download_images(urls: list[str]) -> list[dict]:
    """Download images in parallel, convert to base64. Returns list of {index, b64, mime}."""
    semaphore = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)
    results = []

    async def _download_one(index: int, url: str):
        async with semaphore:
            try:
                async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        logger.warning(f"[CAROUSEL] Image {index + 1} download failed: HTTP {resp.status_code}")
                        return None

                    content = resp.content
                    if len(content) > MAX_IMAGE_SIZE_BYTES:
                        logger.warning(f"[CAROUSEL] Image {index + 1} too large: {len(content)} bytes")
                        return None

                    # Detect MIME type
                    content_type = resp.headers.get("content-type", "image/jpeg")
                    if "png" in content_type:
                        mime = "image/png"
                    elif "webp" in content_type:
                        mime = "image/webp"
                    else:
                        mime = "image/jpeg"

                    b64 = base64.b64encode(content).decode("utf-8")
                    return {"index": index, "b64": b64, "mime": mime}

            except Exception as e:
                logger.warning(f"[CAROUSEL] Image {index + 1} download error: {e}")
                return None

    tasks = [_download_one(i, url) for i, url in enumerate(urls)]
    raw_results = await asyncio.gather(*tasks)
    results = [r for r in raw_results if r is not None]

    # Sort by original index
    results.sort(key=lambda x: x["index"])
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# Batching & Vision analysis
# ═══════════════════════════════════════════════════════════════════════════════


def _batch_images(images: list[dict], batch_size: int) -> list[list[dict]]:
    """Split images into batches of batch_size."""
    return [images[i : i + batch_size] for i in range(0, len(images), batch_size)]


async def _analyze_batch(
    batch: list[dict],
    batch_index: int,
    total_slides: int,
    lang: str,
    model: str,
    api_key: str,
) -> Optional[str]:
    """Send a batch of images to Mistral Vision for OCR + description."""

    if lang == "fr":
        system_prompt = (
            "Tu es un expert en OCR et analyse d'images. "
            "Extrais tout le texte visible et décris les éléments visuels pertinents de chaque image. "
            "Réponds en français."
        )
        user_text = (
            f"Ce sont les slides {batch[0]['index'] + 1} à {batch[-1]['index'] + 1} "
            f"d'un carrousel TikTok de {total_slides} slides au total.\n\n"
            "Pour chaque image, fournis :\n"
            "1. [OCR] Tout texte visible (titres, sous-titres, légendes, chiffres, listes)\n"
            "2. [VISUEL] Description des éléments visuels significatifs (graphiques, schémas, photos, captures d'écran)\n"
            "3. [TYPE] Type de slide (texte, infographie, capture d'écran, photo, meme, liste)\n\n"
            "Format de sortie pour chaque image :\n"
            "[Slide N]\n"
            "OCR: ...\n"
            "Visuel: ...\n"
            "Type: ..."
        )
    else:
        system_prompt = (
            "You are an expert in OCR and image analysis. "
            "Extract all visible text and describe relevant visual elements from each image. "
            "Respond in English."
        )
        user_text = (
            f"These are slides {batch[0]['index'] + 1} to {batch[-1]['index'] + 1} "
            f"from a TikTok carousel of {total_slides} slides total.\n\n"
            "For each image, provide:\n"
            "1. [OCR] All visible text (titles, subtitles, captions, numbers, lists)\n"
            "2. [VISUAL] Description of significant visual elements (charts, diagrams, photos, screenshots)\n"
            "3. [TYPE] Slide type (text, infographic, screenshot, photo, meme, list)\n\n"
            "Output format for each image:\n"
            "[Slide N]\n"
            "OCR: ...\n"
            "Visual: ...\n"
            "Type: ..."
        )

    # Build multimodal content array
    content = [{"type": "text", "text": user_text}]
    for img in batch:
        data_uri = f"data:{img['mime']};base64,{img['b64']}"
        content.append({"type": "image_url", "image_url": data_uri})

    try:
        async with httpx.AsyncClient(timeout=VISION_TIMEOUT) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": content},
                    ],
                    "max_tokens": 4000,
                    "temperature": 0.1,
                },
            )

            if response.status_code == 200:
                data = response.json()
                result = data["choices"][0]["message"]["content"].strip()
                logger.info(f"[CAROUSEL] Batch {batch_index + 1} analyzed: {len(result)} chars")
                return result
            else:
                logger.error(f"[CAROUSEL] Mistral Vision error: {response.status_code} - {response.text[:200]}")
                return None

    except Exception as e:
        logger.error(f"[CAROUSEL] Vision analysis error: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Transcript assembly
# ═══════════════════════════════════════════════════════════════════════════════


def _assemble_transcript(
    batch_results: list[str],
    title: str,
    description: str,
    total_slides: int,
    lang: str,
) -> Tuple[str, str]:
    """
    Assemble Vision batch results into a unified pseudo-transcript.
    Returns: (full_text, structured_text)
    """
    if lang == "fr":
        header = f"📸 CARROUSEL TIKTOK — {total_slides} slides"
        title_label = "Titre"
        desc_label = "Description"
    else:
        header = f"📸 TIKTOK CAROUSEL — {total_slides} slides"
        title_label = "Title"
        desc_label = "Description"

    parts = [header]
    if title:
        parts.append(f"{title_label} : {title}")
    if description:
        parts.append(f"{desc_label} : {description[:500]}")
    parts.append("")

    # Append all batch results
    for result in batch_results:
        parts.append(result)
        parts.append("")

    structured_text = "\n".join(parts)

    # Full text: strip formatting for simpler downstream use
    full_text = structured_text

    return full_text, structured_text
