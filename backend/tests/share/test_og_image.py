import io
import pytest
from PIL import Image

from share.og_image import generate_og_image


def test_returns_png_bytes_1200x630():
    png = generate_og_image(
        video_title="My Test Video",
        video_thumbnail=None,
        verdict_text="Bien sourcé",
        channel="My Channel",
    )
    assert isinstance(png, bytes)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    img = Image.open(io.BytesIO(png))
    assert img.size == (1200, 630)


def test_handles_long_title_gracefully():
    long_title = "A" * 200
    png = generate_og_image(
        video_title=long_title,
        video_thumbnail=None,
        verdict_text=None,
        channel=None,
    )
    img = Image.open(io.BytesIO(png))
    assert img.size == (1200, 630)


def test_omits_verdict_if_none():
    png_with = generate_og_image(
        video_title="Test",
        video_thumbnail=None,
        verdict_text="Solide",
        channel=None,
    )
    png_without = generate_og_image(
        video_title="Test",
        video_thumbnail=None,
        verdict_text=None,
        channel=None,
    )
    assert png_with != png_without


def test_handles_missing_thumbnail():
    png = generate_og_image(
        video_title="No thumb",
        video_thumbnail=None,
        verdict_text=None,
        channel=None,
    )
    img = Image.open(io.BytesIO(png))
    assert img.size == (1200, 630)
