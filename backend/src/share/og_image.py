"""Dynamic OG image generator for shared analysis pages.

Produces a 1200×630 PNG: background gradient + (optional) video thumbnail
masked to rounded rect + title + verdict chip + DeepSight branding.
Used at GET /api/share/{token}/og-image.png for rich social previews
(Twitter/X, LinkedIn, Facebook, iMessage, Slack, WhatsApp, Discord).
"""

from __future__ import annotations

import io
import logging
import os
from typing import Optional

import httpx
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

_STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "share")
_BG_PATH = os.path.join(_STATIC_DIR, "og-bg.png")
_FONT_DIR = os.path.join(_STATIC_DIR, "fonts")

W, H = 1200, 630


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Load Inter font or fall back to default."""
    try:
        name = "Inter-Bold.ttf" if bold else "Inter-Regular.ttf"
        return ImageFont.truetype(os.path.join(_FONT_DIR, name), size)
    except OSError:
        logger.debug("Inter font not found, using default")
        return ImageFont.load_default()


def _load_bg() -> Image.Image:
    try:
        return Image.open(_BG_PATH).convert("RGB").copy()
    except FileNotFoundError:
        bg = Image.new("RGB", (W, H), (10, 10, 15))
        return bg


def _download_thumbnail(url: str, timeout: float = 4.0) -> Optional[Image.Image]:
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        logger.debug(f"OG thumbnail download failed: {e}")
        return None


def _rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)], radius=radius, fill=255)
    return mask


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
    max_lines: int = 3,
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
            if len(lines) >= max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(".") + "…"
    elif words and lines and " ".join(lines) != text:
        lines[-1] = lines[-1].rstrip(".") + "…"
    return lines


def generate_og_image(
    *,
    video_title: str,
    video_thumbnail: Optional[str] = None,
    verdict_text: Optional[str] = None,
    channel: Optional[str] = None,
) -> bytes:
    """Generate a 1200×630 OG image and return PNG bytes."""
    canvas = _load_bg()
    draw = ImageDraw.Draw(canvas)

    if video_thumbnail:
        thumb = _download_thumbnail(video_thumbnail)
        if thumb:
            tw, th = 480, 270
            thumb = thumb.resize((tw, th), Image.LANCZOS)
            mask = _rounded_mask((tw, th), radius=16)
            canvas.paste(thumb, (W - tw - 60, (H - th) // 2), mask=mask)

    logo_font = _load_font(28, bold=True)
    draw.text((60, 50), "◉  DEEPSIGHT", fill=(200, 210, 255), font=logo_font)

    title_font = _load_font(56, bold=True)
    title_lines = _wrap_text(draw, video_title, title_font, max_width=560, max_lines=3)
    y = 170
    for line in title_lines:
        draw.text((60, y), line, fill=(245, 245, 247), font=title_font)
        y += 72

    if channel:
        channel_font = _load_font(22)
        draw.text((60, y + 10), channel, fill=(168, 168, 179), font=channel_font)
        y += 40

    if verdict_text:
        chip_font = _load_font(20, bold=False)
        chip_text = verdict_text if len(verdict_text) <= 80 else verdict_text[:77] + "…"
        bbox = draw.textbbox((0, 0), chip_text, font=chip_font)
        chip_w = (bbox[2] - bbox[0]) + 32
        chip_h = 44
        chip_x, chip_y = 60, H - 110
        draw.rounded_rectangle(
            [(chip_x, chip_y), (chip_x + chip_w, chip_y + chip_h)],
            radius=22,
            fill=(99, 102, 241, 255),
        )
        draw.text(
            (chip_x + 16, chip_y + 10),
            chip_text,
            fill=(255, 255, 255),
            font=chip_font,
        )

    tagline_font = _load_font(18)
    tagline = "🇫🇷 Analyse IA française par DeepSight"
    tbbox = draw.textbbox((0, 0), tagline, font=tagline_font)
    draw.text(
        (W - (tbbox[2] - tbbox[0]) - 60, H - 50),
        tagline,
        fill=(139, 92, 246),
        font=tagline_font,
    )

    out = io.BytesIO()
    canvas.save(out, format="PNG", optimize=True)
    return out.getvalue()
