"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Decodo TikTok visual fallback (Phase 1.1)                              ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Coverage:                                                                         ║
║  • _parse_tiktok_video_url_from_html — happy path with real fixture                 ║
║  • _parse_tiktok_video_url_from_html — empty / too short HTML returns None          ║
║  • _parse_tiktok_video_url_from_html — short string (<5000 chars) returns None      ║
║  • _decodo_scrape_tiktok_page — fixture-driven + mock CDN download → bytes          ║
║  • _extract_tiktok_visual_frames — yt-dlp+tikwm KO + decodo OK → frames non-None    ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Note: the fixture `backend/tests/fixtures/tiktok_page_premium_js.html` is a real
Decodo Premium+JS rendered page for a TikTok video. It contains the
`__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON-LD with `itemStruct.video.playAddr`
(URL-encoded with `\\u002F`). Tests run without network.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add src to path (mirror conftest pattern, defensive)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Force-load core.config FIRST to seed the import graph correctly. Without this,
# importing `videos.visual_integration` as the first module triggers a circular
# import cascade (videos → router → auth.dependencies → auth.service in flight)
# when this test file runs standalone. Same pattern as tests/test_tiktok_visual.py.
import core.config  # noqa: F401, E402  isort:skip


# ─────────────────────────────────────────────────────────────────────────────
# Fixture loader
# ─────────────────────────────────────────────────────────────────────────────


_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "tiktok_page_premium_js.html"


@pytest.fixture(scope="module")
def tiktok_html_fixture() -> str:
    """Load the real Decodo Premium+JS TikTok page fixture (~570KB)."""
    return _FIXTURE_PATH.read_text(encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Unit tests — parser
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_tiktok_playaddr_from_real_fixture(tiktok_html_fixture: str):
    """Parser extracts a valid tiktokcdn URL from the real Decodo HTML fixture."""
    from videos.visual_integration import _parse_tiktok_video_url_from_html

    url = _parse_tiktok_video_url_from_html(tiktok_html_fixture)
    assert url is not None, "Expected non-None playAddr from real fixture"
    assert url.startswith("https://"), f"Expected https URL, got {url[:60]}"
    # TikTok CDN uses v16-webapp / tiktokcdn / tos / tikcdn etc.
    assert any(marker in url for marker in ("tiktokcdn", "tiktok.com", "ttwstatic", "tos")), (
        f"URL doesn't look like a TikTok MP4: {url[:120]}"
    )
    # The unescape step should have stripped JSON encoding artifacts.
    assert "\\u002F" not in url, "Found unescaped \\u002F in result"
    assert "\\/" not in url, "Found unescaped \\/ in result"


def test_parse_tiktok_returns_none_on_empty_html():
    """Empty input returns None without raising."""
    from videos.visual_integration import _parse_tiktok_video_url_from_html

    assert _parse_tiktok_video_url_from_html("") is None
    assert _parse_tiktok_video_url_from_html(None) is None  # type: ignore[arg-type]


def test_parse_tiktok_returns_none_on_short_html():
    """HTML shorter than 5000 chars (suspect / error page) returns None."""
    from videos.visual_integration import _parse_tiktok_video_url_from_html

    # Just below the 5000-char threshold even with playAddr in it.
    short = '<html><body>"playAddr":"https://v16.tiktokcdn.com/foo"</body></html>'
    assert len(short) < 5000
    assert _parse_tiktok_video_url_from_html(short) is None


def test_parse_tiktok_unescape_handles_u002f_and_slash():
    """URL containing \\u002F and \\/ escapes is properly decoded."""
    from videos.visual_integration import _unescape_tiktok_url

    raw = "https:\\u002F\\u002Fv16-webapp.tiktokcdn.com\\u002Fvideo\\/tos\\u002Ftest"
    decoded = _unescape_tiktok_url(raw)
    assert decoded == "https://v16-webapp.tiktokcdn.com/video/tos/test"


# ─────────────────────────────────────────────────────────────────────────────
# Integration tests — scrape helper
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_decodo_scrape_tiktok_page_happy_path(tiktok_html_fixture: str):
    """_decodo_scrape_tiktok_page returns MP4 bytes when scrape + CDN download succeed."""
    from videos import visual_integration as vi

    # Mock the Decodo client to return our fixture HTML.
    fake_result = MagicMock()
    fake_result.content = tiktok_html_fixture

    fake_client = MagicMock()
    fake_client.scrape = AsyncMock(return_value=fake_result)

    # Mock the CDN download via get_proxied_client.
    fake_http_response = MagicMock()
    fake_http_response.status_code = 200
    fake_http_response.content = b"\x00\x00\x00\x20ftypisom" + b"a" * 5000  # fake MP4-ish bytes

    fake_http_client = AsyncMock()
    fake_http_client.get = AsyncMock(return_value=fake_http_response)
    fake_http_cm = AsyncMock()
    fake_http_cm.__aenter__ = AsyncMock(return_value=fake_http_client)
    fake_http_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("videos.visual_integration.DecodoScrapingClient", return_value=fake_client, create=True):
        # Ensure import works inside the function — patch the module re-import path too.
        import sys as _sys

        mock_decodo_module = MagicMock()
        mock_decodo_module.DecodoScrapingClient = MagicMock(return_value=fake_client)
        _sys.modules["decodo"] = mock_decodo_module

        with (
            patch.object(vi, "get_proxied_client", return_value=fake_http_cm),
            patch.object(vi, "record_proxied_response", new=AsyncMock()),
        ):
            result = await vi._decodo_scrape_tiktok_page("7641616810298592543", "khaby.lame", log_tag="TEST-CP1")

    assert result is not None
    assert isinstance(result, bytes)
    assert len(result) > 1000


@pytest.mark.asyncio
async def test_decodo_scrape_tiktok_page_returns_none_on_no_playaddr():
    """If scrape returns HTML without playAddr, helper returns None gracefully."""
    from videos import visual_integration as vi

    fake_result = MagicMock()
    fake_result.content = "<html>" + ("x" * 10000) + "</html>"  # long but no playAddr

    fake_client = MagicMock()
    fake_client.scrape = AsyncMock(return_value=fake_result)

    import sys as _sys

    mock_decodo_module = MagicMock()
    mock_decodo_module.DecodoScrapingClient = MagicMock(return_value=fake_client)
    _sys.modules["decodo"] = mock_decodo_module

    result = await vi._decodo_scrape_tiktok_page("1234567890", "fake_user", log_tag="TEST-NONE")
    assert result is None


# ─────────────────────────────────────────────────────────────────────────────
# Integration test — cascade in _extract_tiktok_visual_frames
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_extract_tiktok_visual_frames_falls_back_to_decodo(tiktok_html_fixture: str):
    """When yt-dlp KO + tikwm KO, the Decodo 3rd-fallback path produces frames.

    Wired by Checkpoint 3 of Phase 1.1 — the 3rd fallback is inserted after
    tikwm in `_extract_tiktok_visual_frames` (just before `return None`).
    """
    from videos import visual_integration as vi
    from videos.frame_extractor import FrameExtractionResult

    # Make a fake frame result (matches the dataclass at frame_extractor.py:103).
    fake_frames = FrameExtractionResult(
        workdir="/tmp/fake-test",
        frame_paths=["/tmp/fake-test/frame-%03d.jpg" % i for i in range(8)],
        frame_timestamps=[float(i) for i in range(8)],
        duration_s=8.0,
        fps_used=1.0,
        frame_count=8,
        width=720,
        long_video_warning=False,
    )

    # Mock the two existing paths to return None.
    with (
        patch.object(vi, "_download_tiktok_video_via_ytdlp", new=AsyncMock(return_value=None)),
        patch.object(vi, "_download_tiktok_video_no_watermark", new=AsyncMock(return_value=None)),
        patch.object(vi, "_decodo_scrape_tiktok_page", new=AsyncMock(return_value=b"\x00" * 50000)),
        patch.object(vi, "extract_frames_from_local", new=AsyncMock(return_value=fake_frames)),
    ):
        result = await vi._extract_tiktok_visual_frames(
            url="https://www.tiktok.com/@khaby.lame/video/7641616810298592543",
            video_id="7641616810298592543",
            mode="default",
            log_tag="TEST-CASCADE",
        )

    assert result is not None
    assert result is fake_frames


@pytest.mark.asyncio
async def test_extract_tiktok_visual_frames_returns_none_when_all_three_fail():
    """Cascade exhaustion (yt-dlp + tikwm + decodo all return None) → None."""
    from videos import visual_integration as vi

    with (
        patch.object(vi, "_download_tiktok_video_via_ytdlp", new=AsyncMock(return_value=None)),
        patch.object(vi, "_download_tiktok_video_no_watermark", new=AsyncMock(return_value=None)),
        patch.object(vi, "_decodo_scrape_tiktok_page", new=AsyncMock(return_value=None)),
    ):
        result = await vi._extract_tiktok_visual_frames(
            url="https://www.tiktok.com/@dead/video/0",
            video_id="0",
            mode="default",
            log_tag="TEST-ALL-FAIL",
        )

    assert result is None
