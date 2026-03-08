"""
Thumbnail processing pipeline: download → resize → WebP → upload to R2.
"""

import io
import logging
from typing import Optional

import httpx
from PIL import Image

from core.config import R2_CONFIG
from storage.r2 import upload_to_r2, check_exists_r2, get_r2_public_url

logger = logging.getLogger(__name__)

THUMBNAIL_SIZES = {
    "card": (480, 270),
    "thumb": (120, 68),
}

YOUTUBE_FALLBACK_QUALITIES = [
    "maxresdefault",
    "hqdefault",
    "mqdefault",
    "default",
]

MIN_IMAGE_SIZE = 1000  # YouTube returns tiny placeholder for missing thumbnails


async def download_image(url: str) -> Optional[bytes]:
    """Download an image from a URL with timeout."""
    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers={"User-Agent": "DeepSight/1.0"},
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and len(resp.content) > MIN_IMAGE_SIZE:
                return resp.content
    except (httpx.HTTPError, httpx.TimeoutException) as e:
        logger.debug(f"Download failed for {url}: {e}")
    return None


async def download_youtube_thumbnail(video_id: str) -> Optional[bytes]:
    """Try YouTube thumbnail URLs in quality order."""
    for quality in YOUTUBE_FALLBACK_QUALITIES:
        url = f"https://img.youtube.com/vi/{video_id}/{quality}.jpg"
        data = await download_image(url)
        if data:
            logger.debug(f"YouTube thumbnail found: {quality} for {video_id}")
            return data
    return None


async def download_thumbnail(
    video_id: str,
    original_url: Optional[str],
    platform: str,
) -> Optional[bytes]:
    """Download a thumbnail with platform-specific fallbacks."""
    if platform == "youtube":
        # Try YouTube CDN chain (more reliable than stored URL)
        data = await download_youtube_thumbnail(video_id)
        if data:
            return data
        # Last resort: try the stored URL
        if original_url:
            return await download_image(original_url)
        return None

    if platform == "tiktok":
        # TikTok URLs expire — try the stored one, no fallback
        if original_url:
            return await download_image(original_url)
        return None

    # Other platforms: try the original URL
    if original_url:
        return await download_image(original_url)
    return None


def process_thumbnail(image_bytes: bytes) -> dict[str, bytes]:
    """Resize image to card + thumb sizes and convert to WebP."""
    original = Image.open(io.BytesIO(image_bytes))

    # Convert RGBA/P to RGB (WebP lossy needs RGB)
    if original.mode in ("RGBA", "P", "LA"):
        original = original.convert("RGB")

    results = {}
    for size_name, (width, height) in THUMBNAIL_SIZES.items():
        img = original.copy()
        img = img.resize((width, height), Image.LANCZOS)

        buffer = io.BytesIO()
        img.save(buffer, format="WEBP", quality=80, method=4)
        results[size_name] = buffer.getvalue()

    return results


async def store_thumbnail_r2(
    video_id: str,
    original_url: Optional[str],
    platform: str = "youtube",
) -> Optional[str]:
    """
    Full pipeline: download → resize → upload to R2.
    Returns the R2 public URL for the card-size thumbnail, or None on failure.
    """
    if not R2_CONFIG["ENABLED"]:
        return None

    # Skip text/placeholder thumbnails
    if platform == "text" or not original_url:
        return None

    # Check if already uploaded
    card_key = f"thumbnails/{video_id}/card.webp"
    if await check_exists_r2(card_key):
        logger.debug(f"R2 thumbnail already exists: {video_id}")
        return get_r2_public_url(card_key)

    # Download
    image_bytes = await download_thumbnail(video_id, original_url, platform)
    if not image_bytes:
        logger.warning(f"Could not download thumbnail for {video_id} ({platform})")
        return None

    # Process (resize + WebP)
    try:
        processed = process_thumbnail(image_bytes)
    except Exception as e:
        logger.warning(f"Thumbnail processing failed for {video_id}: {e}")
        return None

    # Upload both sizes
    card_url = None
    for size_name, data in processed.items():
        key = f"thumbnails/{video_id}/{size_name}.webp"
        url = await upload_to_r2(data, key)
        if size_name == "card":
            card_url = url

    logger.info(
        f"✅ Thumbnail stored in R2: {video_id} "
        f"(card={len(processed.get('card', b''))}B, "
        f"thumb={len(processed.get('thumb', b''))}B)"
    )
    return card_url
