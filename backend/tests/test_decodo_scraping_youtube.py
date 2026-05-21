"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Decodo Scraping fallback for YouTube info (Feature 1.3 Phase 1)        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Coverage:                                                                         ║
║  • _parse_youtube_storyboards on captured fixture                                  ║
║  • _decodo_scrape_youtube_info: happy path (mock DecodoScrapingClient)             ║
║  • _decodo_scrape_youtube_info: empty html                                         ║
║  • _decodo_scrape_youtube_info: missing ytInitialPlayerResponse                    ║
║  • _decodo_scrape_youtube_info: malformed JSON inside the script tag               ║
║  • _decodo_scrape_youtube_info: Decodo client raises (returns None, no leak)       ║
║  • get_youtube_info_with_fallback: yt-dlp KO + Decodo OK                           ║
║  • get_youtube_info_with_fallback: yt-dlp OK → Decodo never called                 ║
║  • get_youtube_info_with_fallback: both KO → None                                  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add src to path (mirror conftest pattern for direct imports).
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

# Bootstrap the import graph by loading the main FastAPI module first. The
# `videos/__init__.py` pulls in routers that have a known circular import with
# auth.service/auth.dependencies (pre-existing CI issue, not introduced by
# this PR). Pre-loading `main` resolves the chain before any submodule import.
import main  # noqa: E402,F401  (side-effect import)

from videos import youtube_storyboard as ys  # noqa: E402


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "youtube" / "watch_decodo_player_response.json"


@pytest.fixture(scope="module")
def player_response_fixture() -> Dict[str, Any]:
    """Load the captured ytInitialPlayerResponse JSON.

    Captured 2026-05-21 via Decodo Premium+JS on Rick Astley watch page.
    """
    assert FIXTURE_PATH.exists(), f"Missing fixture: {FIXTURE_PATH}"
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.fixture
def watch_html_with_player_response(player_response_fixture) -> str:
    """Build a minimal watch.html that contains the assignment line.

    yt-dlp / our regex look for ``ytInitialPlayerResponse = {...};`` exactly.
    We surround the JSON with enough filler bytes to clear the 50KB guard.
    """
    player_json = json.dumps(player_response_fixture)
    # Pad to >50000 bytes (the guard inside _decodo_scrape_youtube_info).
    padding = "<!-- pad -->" * 4500  # ~54 KB on its own
    return (
        "<html><head><script>"
        f"var ytInitialPlayerResponse = {player_json};"
        "var foo = 1;</script></head><body>"
        f"{padding}"
        "</body></html>"
    )


# ─────────────────────────────────────────────────────────────────────────────
# _parse_youtube_storyboards
# ─────────────────────────────────────────────────────────────────────────────


class TestParseStoryboards:
    def test_parses_fixture_into_at_least_one_format(self, player_response_fixture):
        formats = ys._parse_youtube_storyboards(player_response_fixture)
        # MVP acceptance: the fixture has spec="L0|L1|L2|L3", so ≥1 format.
        assert len(formats) >= 1, "expected at least one storyboard format"
        for fmt in formats:
            assert fmt["format_id"].startswith("sb")
            assert fmt["ext"] == "mhtml"
            assert fmt["width"] > 0
            assert fmt["height"] > 0
            assert fmt["columns"] > 0
            assert fmt["rows"] > 0
            assert isinstance(fmt["fragments"], list)
            assert len(fmt["fragments"]) >= 1
            for frag in fmt["fragments"]:
                # Every sheet URL must be a YouTube CDN URL with $L/$N expanded.
                assert frag["url"].startswith("https://i.ytimg.com/sb/")
                assert "$L" not in frag["url"]
                assert "$N" not in frag["url"]

    def test_returns_empty_on_missing_storyboards_key(self):
        assert ys._parse_youtube_storyboards({"videoDetails": {}}) == []

    def test_returns_empty_on_non_dict_input(self):
        assert ys._parse_youtube_storyboards(None) == []  # type: ignore[arg-type]
        assert ys._parse_youtube_storyboards("not a dict") == []  # type: ignore[arg-type]

    def test_returns_empty_on_malformed_spec(self):
        # Spec missing the URL template placeholders.
        player = {
            "storyboards": {
                "playerStoryboardSpecRenderer": {
                    "spec": "no-pipes-here-just-a-bare-string",
                }
            }
        }
        assert ys._parse_youtube_storyboards(player) == []


# ─────────────────────────────────────────────────────────────────────────────
# _decodo_scrape_youtube_info — happy + error paths
# ─────────────────────────────────────────────────────────────────────────────


class _FakeScrapeResult:
    """Minimal stand-in for ScrapeResult that only needs .content."""

    def __init__(self, content: str) -> None:
        self.content = content


class TestDecodoScrapeYoutubeInfo:
    @pytest.mark.asyncio
    async def test_happy_path_returns_compatible_info_dict(
        self, watch_html_with_player_response, player_response_fixture
    ):
        fake_client = MagicMock()
        fake_client.scrape = AsyncMock(return_value=_FakeScrapeResult(watch_html_with_player_response))
        with patch("decodo.DecodoScrapingClient", return_value=fake_client):
            info = await ys._decodo_scrape_youtube_info("dQw4w9WgXcQ", "TEST")
        assert info is not None
        assert info["id"] == "dQw4w9WgXcQ"
        assert info["duration"] == int(player_response_fixture["videoDetails"]["lengthSeconds"])
        assert info["title"] == player_response_fixture["videoDetails"]["title"]
        # MVP acceptance: storyboards either reconstructed or empty list, never
        # missing.
        assert isinstance(info["formats"], list)
        assert info["_source"] == "decodo_scrape"
        # Confirm the client was invoked with Premium+JS on the right URL.
        fake_client.scrape.assert_awaited_once()
        call_kwargs = fake_client.scrape.call_args.kwargs
        assert call_kwargs.get("proxy_pool") == "premium"
        assert call_kwargs.get("headless") is True

    @pytest.mark.asyncio
    async def test_returns_none_when_html_too_short(self):
        fake_client = MagicMock()
        fake_client.scrape = AsyncMock(return_value=_FakeScrapeResult("<html></html>"))
        with patch("decodo.DecodoScrapingClient", return_value=fake_client):
            info = await ys._decodo_scrape_youtube_info("abc12345xyz", "TEST")
        assert info is None

    @pytest.mark.asyncio
    async def test_returns_none_when_player_response_absent(self):
        # 60KB of HTML but no ytInitialPlayerResponse assignment.
        bogus_html = "<html>" + ("noise " * 12_000) + "</html>"
        fake_client = MagicMock()
        fake_client.scrape = AsyncMock(return_value=_FakeScrapeResult(bogus_html))
        with patch("decodo.DecodoScrapingClient", return_value=fake_client):
            info = await ys._decodo_scrape_youtube_info("abc12345xyz", "TEST")
        assert info is None

    @pytest.mark.asyncio
    async def test_returns_none_on_invalid_json(self):
        # Assignment present but JSON is malformed (unbalanced braces).
        broken_html = (
            "<html><script>var ytInitialPlayerResponse = {not-valid-json};</script>" + ("pad " * 15_000) + "</html>"
        )
        fake_client = MagicMock()
        fake_client.scrape = AsyncMock(return_value=_FakeScrapeResult(broken_html))
        with patch("decodo.DecodoScrapingClient", return_value=fake_client):
            info = await ys._decodo_scrape_youtube_info("abc12345xyz", "TEST")
        assert info is None

    @pytest.mark.asyncio
    async def test_returns_none_when_client_raises(self):
        fake_client = MagicMock()
        fake_client.scrape = AsyncMock(side_effect=RuntimeError("boom"))
        with patch("decodo.DecodoScrapingClient", return_value=fake_client):
            info = await ys._decodo_scrape_youtube_info("abc12345xyz", "TEST")
        # Must swallow the exception and return None so the caller can fall
        # through to its own fallbacks (duration_hint etc.).
        assert info is None


# ─────────────────────────────────────────────────────────────────────────────
# get_youtube_info_with_fallback — cascade integration (Checkpoint 4)
# ─────────────────────────────────────────────────────────────────────────────


class TestGetYoutubeInfoWithFallback:
    """Integration tests for the cascade wrapper. Added at CP4 once the wrapper
    is wired into ``extract_storyboard_frames``."""

    @pytest.mark.asyncio
    async def test_ytdlp_ok_skips_decodo(self):
        fake_info = {"id": "x", "duration": 100, "title": "y", "formats": []}
        if not hasattr(ys, "get_youtube_info_with_fallback"):
            pytest.skip("wrapper added in CP4")
        with (
            patch.object(ys, "_ytdlp_info_sync", return_value=fake_info),
            patch.object(ys, "_decodo_scrape_youtube_info", new=AsyncMock()) as dec,
        ):
            info = await ys.get_youtube_info_with_fallback("abcdefghijk", "TEST")
        assert info is fake_info
        dec.assert_not_called()

    @pytest.mark.asyncio
    async def test_ytdlp_ko_falls_back_to_decodo(self):
        fake_info = {"id": "x", "duration": 213, "title": "y", "formats": []}
        if not hasattr(ys, "get_youtube_info_with_fallback"):
            pytest.skip("wrapper added in CP4")
        with (
            patch.object(ys, "_ytdlp_info_sync", return_value=None),
            patch.object(
                ys,
                "_decodo_scrape_youtube_info",
                new=AsyncMock(return_value=fake_info),
            ) as dec,
        ):
            info = await ys.get_youtube_info_with_fallback("abcdefghijk", "TEST")
        assert info is fake_info
        dec.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_both_ko_returns_none(self):
        if not hasattr(ys, "get_youtube_info_with_fallback"):
            pytest.skip("wrapper added in CP4")
        with (
            patch.object(ys, "_ytdlp_info_sync", return_value=None),
            patch.object(ys, "_decodo_scrape_youtube_info", new=AsyncMock(return_value=None)),
        ):
            info = await ys.get_youtube_info_with_fallback("abcdefghijk", "TEST")
        assert info is None


# ─────────────────────────────────────────────────────────────────────────────
# extract_storyboard_frames — cascade is wired in
# ─────────────────────────────────────────────────────────────────────────────


class TestExtractStoryboardFramesUsesFallback:
    """One integration test confirming that `extract_storyboard_frames` reaches
    the Decodo fallback when yt-dlp returns None. We don't drive the full
    pipeline (sheet download / PIL slicing happens against a real CDN); we
    only assert that the wrapper is called and yields enough to exit cleanly.
    """

    @pytest.mark.asyncio
    async def test_ytdlp_ko_routes_through_decodo(self, player_response_fixture):
        # yt-dlp KO → Decodo returns info with duration > 0 but storyboards=[]
        # (a realistic MVP outcome). The function should NOT raise, and it
        # should detect "No storyboard format available" then exit None.
        fake_info = {
            "id": "dQw4w9WgXcQ",
            "title": "test",
            "duration": int(player_response_fixture["videoDetails"]["lengthSeconds"]),
            "formats": [],
            "_source": "decodo_scrape",
        }
        with (
            patch.object(ys, "_ytdlp_info_sync", return_value=None),
            patch.object(ys, "_decodo_scrape_youtube_info", new=AsyncMock(return_value=fake_info)) as dec_mock,
        ):
            result = await ys.extract_storyboard_frames(
                "dQw4w9WgXcQ",
                log_tag="TEST",
            )
        # Decodo was reached (no bail-early before it).
        dec_mock.assert_awaited_once()
        # storyboards=[] → select_storyboard_format returns None → function
        # cleans up workdir and returns None. The non-bail-early goal is the
        # asserting condition: the AsyncMock above being awaited.
        assert result is None
