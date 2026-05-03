"""
Tests for TikTok account context extraction.

Covers:
- get_tiktok_account_context() — fetch metadata + N derniers posts via yt-dlp
- extract_tiktok_username_from_video_metadata() — helper to extract username
  from video metadata
- Hashtag parsing, description truncation, @ prefix stripping, error handling
"""

import json
import os
import subprocess as real_subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

# Make src importable for transcripts.tiktok
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers — fake subprocess.run results
# ═══════════════════════════════════════════════════════════════════════════════


def _make_completed_process(returncode: int, stdout: str = "", stderr: str = ""):
    """Build a fake CompletedProcess returned by subprocess.run mock."""
    cp = MagicMock(spec=real_subprocess.CompletedProcess)
    cp.returncode = returncode
    cp.stdout = stdout
    cp.stderr = stderr
    return cp


def _make_account_payload(username: str, entries: list, **overrides) -> dict:
    """Build a yt-dlp --dump-single-json payload for a TikTok account."""
    payload = {
        "channel": overrides.get("channel", username),
        "uploader": overrides.get("uploader", username),
        "uploader_id": username,
        "description": overrides.get("description", f"Bio test for @{username}"),
        "channel_follower_count": overrides.get("channel_follower_count", 1234567),
        "playlist_count": overrides.get("playlist_count", len(entries)),
        "entries": entries,
    }
    payload.update({k: v for k, v in overrides.items() if k not in payload})
    return payload


def _make_entry(
    title: str = "Sample TikTok #fyp",
    description: str = None,
    view_count: int = 50000,
    upload_date: str = "20260301",
):
    """Build a single yt-dlp entry for a TikTok post."""
    return {
        "id": "1234567890",
        "title": title,
        "description": description if description is not None else title,
        "view_count": view_count,
        "upload_date": upload_date,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# get_tiktok_account_context()
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetTiktokAccountContext:

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_success(self):
        """Mock yt-dlp returning 50 valid entries → full dict shape."""
        from transcripts import tiktok

        username = "charlidamelio"
        entries = [
            _make_entry(
                title=f"Post {i} #fyp #viral",
                view_count=10_000 * (i + 1),
                upload_date=f"2026030{(i % 9) + 1}",
            )
            for i in range(50)
        ]
        payload = _make_account_payload(username, entries, channel="charli d'amelio")

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(0, stdout=json.dumps(payload)),
        ):
            ctx = await tiktok.get_tiktok_account_context(username, limit=50)

        assert ctx is not None
        # Top-level shape — must mirror YouTube get_channel_context()
        assert ctx["channel_id"] == "charlidamelio"
        assert ctx["platform"] == "tiktok"
        assert ctx["name"] == "charli d'amelio"
        assert ctx["description"].startswith("Bio test")
        assert ctx["subscriber_count"] == 1234567
        assert ctx["video_count"] == 50
        assert ctx["tags"] == []
        assert ctx["categories"] == []
        # last_videos
        assert isinstance(ctx["last_videos"], list)
        assert len(ctx["last_videos"]) == 50
        first = ctx["last_videos"][0]
        assert set(first.keys()) == {"title", "description", "tags", "view_count", "upload_date"}
        assert "fyp" in first["tags"]
        assert "viral" in first["tags"]
        assert first["view_count"] == 10_000
        assert first["upload_date"] == "20260301"

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_strips_at_prefix(self):
        """`@charlidamelio` should be normalized to `charlidamelio`."""
        from transcripts import tiktok

        captured_cmd = {}

        def fake_run(cmd, *args, **kwargs):
            captured_cmd["cmd"] = cmd
            payload = _make_account_payload("charlidamelio", [_make_entry()])
            return _make_completed_process(0, stdout=json.dumps(payload))

        with patch.object(tiktok.subprocess, "run", side_effect=fake_run):
            ctx = await tiktok.get_tiktok_account_context("@charlidamelio", limit=10)

        assert ctx is not None
        assert ctx["channel_id"] == "charlidamelio"
        # The URL passed to yt-dlp must NOT contain a double @@
        url_arg = captured_cmd["cmd"][-1]
        assert url_arg == "https://www.tiktok.com/@charlidamelio"
        assert "@@" not in url_arg

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_strips_whitespace(self):
        """Leading/trailing whitespace on the username should be stripped."""
        from transcripts import tiktok

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(
                0, stdout=json.dumps(_make_account_payload("charlidamelio", []))
            ),
        ):
            ctx = await tiktok.get_tiktok_account_context("  @charlidamelio  ")

        assert ctx is not None
        assert ctx["channel_id"] == "charlidamelio"

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_extracts_hashtags(self):
        """Caption 'Test #fyp #viral' must yield tags=['fyp','viral']."""
        from transcripts import tiktok

        entry = _make_entry(
            title="Test #fyp #viral", description="Test #fyp #viral"
        )
        payload = _make_account_payload("user1", [entry])

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(0, stdout=json.dumps(payload)),
        ):
            ctx = await tiktok.get_tiktok_account_context("user1")

        assert ctx is not None
        assert len(ctx["last_videos"]) == 1
        tags = ctx["last_videos"][0]["tags"]
        assert "fyp" in tags
        assert "viral" in tags

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_dedupes_hashtags(self):
        """Repeated hashtags (case-insensitive) should be dedup'd."""
        from transcripts import tiktok

        entry = _make_entry(
            title="Test #fyp #FYP #viral #fyp",
            description="Test #fyp #FYP #viral #fyp",
        )
        payload = _make_account_payload("user1", [entry])

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(0, stdout=json.dumps(payload)),
        ):
            ctx = await tiktok.get_tiktok_account_context("user1")

        tags = ctx["last_videos"][0]["tags"]
        # case-insensitive dedup: only one fyp/FYP variant kept
        lowered = [t.lower() for t in tags]
        assert lowered.count("fyp") == 1
        assert "viral" in lowered

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_truncates_descriptions(self):
        """Description > 200 chars must be truncated to exactly 200 chars."""
        from transcripts import tiktok

        long_desc = "A" * 500
        entry = _make_entry(title="Short title", description=long_desc)
        payload = _make_account_payload("user1", [entry])

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(0, stdout=json.dumps(payload)),
        ):
            ctx = await tiktok.get_tiktok_account_context("user1")

        assert ctx is not None
        desc = ctx["last_videos"][0]["description"]
        assert len(desc) == 200
        # Same convention as YouTube channel context: hard truncate, no "..." suffix
        assert desc == "A" * 200

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_handles_private(self):
        """yt-dlp non-zero returncode (private/banned) → return None."""
        from transcripts import tiktok

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(
                1, stdout="", stderr="ERROR: This account is private"
            ),
        ):
            ctx = await tiktok.get_tiktok_account_context("private_user")

        assert ctx is None

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_handles_invalid_json(self):
        """yt-dlp success but garbled stdout → return None."""
        from transcripts import tiktok

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(0, stdout="not-json {garbage"),
        ):
            ctx = await tiktok.get_tiktok_account_context("user1")

        assert ctx is None

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_empty_username(self):
        """Empty username returns None without invoking yt-dlp."""
        from transcripts import tiktok

        with patch.object(tiktok.subprocess, "run") as mock_run:
            ctx = await tiktok.get_tiktok_account_context("")
            assert ctx is None
            ctx2 = await tiktok.get_tiktok_account_context("@")
            assert ctx2 is None
            mock_run.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_handles_no_entries(self):
        """Account with zero posts (entries=[]) returns valid dict, last_videos=[]."""
        from transcripts import tiktok

        payload = _make_account_payload("user1", [])

        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(0, stdout=json.dumps(payload)),
        ):
            ctx = await tiktok.get_tiktok_account_context("user1")

        assert ctx is not None
        assert ctx["last_videos"] == []
        assert ctx["channel_id"] == "user1"

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_respects_limit_arg(self):
        """`--playlist-items 1:N` must reflect the limit argument."""
        from transcripts import tiktok

        captured_cmd = {}

        def fake_run(cmd, *args, **kwargs):
            captured_cmd["cmd"] = cmd
            return _make_completed_process(
                0, stdout=json.dumps(_make_account_payload("user1", []))
            )

        with patch.object(tiktok.subprocess, "run", side_effect=fake_run):
            await tiktok.get_tiktok_account_context("user1", limit=20)

        cmd = captured_cmd["cmd"]
        # find --playlist-items index
        idx = cmd.index("--playlist-items")
        assert cmd[idx + 1] == "1:20"

    @pytest.mark.asyncio
    async def test_get_tiktok_account_context_returns_youtube_compatible_shape(self):
        """Strict shape check — must mirror YouTube get_channel_context() exactly."""
        from transcripts import tiktok

        payload = _make_account_payload("user1", [_make_entry()])
        with patch.object(
            tiktok.subprocess, "run",
            return_value=_make_completed_process(0, stdout=json.dumps(payload)),
        ):
            ctx = await tiktok.get_tiktok_account_context("user1")

        assert ctx is not None
        expected_top_keys = {
            "channel_id",
            "platform",
            "name",
            "description",
            "subscriber_count",
            "video_count",
            "tags",
            "categories",
            "last_videos",
        }
        assert set(ctx.keys()) == expected_top_keys
        assert ctx["platform"] == "tiktok"
        assert isinstance(ctx["tags"], list)
        assert isinstance(ctx["categories"], list)
        assert isinstance(ctx["last_videos"], list)
        # last_videos[*] shape
        expected_video_keys = {"title", "description", "tags", "view_count", "upload_date"}
        for v in ctx["last_videos"]:
            assert set(v.keys()) == expected_video_keys


# ═══════════════════════════════════════════════════════════════════════════════
# extract_tiktok_username_from_video_metadata()
# ═══════════════════════════════════════════════════════════════════════════════


class TestExtractTiktokUsernameFromMetadata:

    def test_extract_username_from_uploader_id(self):
        """uploader_id is the most reliable yt-dlp field."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {
            "uploader_id": "charlidamelio",
            "uploader": "Charli D'Amelio",
            "channel": "Charli D'Amelio",
            "webpage_url": "https://www.tiktok.com/@charlidamelio/video/123",
        }
        assert extract_tiktok_username_from_video_metadata(metadata) == "charlidamelio"

    def test_extract_username_from_webpage_url(self):
        """If uploader_id missing, parse the webpage_url."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {
            "uploader": "Some Display Name",
            "webpage_url": "https://www.tiktok.com/@bellathorne/video/7234567890",
        }
        assert extract_tiktok_username_from_video_metadata(metadata) == "bellathorne"

    def test_extract_username_from_channel_fallback(self):
        """channel as last-resort fallback."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {"channel": "khaby.lame"}
        assert extract_tiktok_username_from_video_metadata(metadata) == "khaby.lame"

    def test_extract_username_strips_at_prefix(self):
        """A leading '@' must be stripped."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {"uploader_id": "@charlidamelio"}
        assert extract_tiktok_username_from_video_metadata(metadata) == "charlidamelio"

    def test_extract_username_returns_none_when_missing(self):
        """Empty / unrelated metadata returns None."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        assert extract_tiktok_username_from_video_metadata({}) is None
        assert extract_tiktok_username_from_video_metadata(None) is None
        assert extract_tiktok_username_from_video_metadata({"unrelated": "field"}) is None

    def test_extract_username_priority_uploader_id_over_url(self):
        """If both present, uploader_id wins (it's the canonical handle)."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {
            "uploader_id": "real_handle",
            "webpage_url": "https://www.tiktok.com/@redirected_handle/video/123",
        }
        assert extract_tiktok_username_from_video_metadata(metadata) == "real_handle"

    def test_extract_username_handles_dots_and_underscores(self):
        """TikTok handles can include '.', '_', '-'."""
        from transcripts.tiktok import extract_tiktok_username_from_video_metadata

        metadata = {"uploader_id": "user.name_42"}
        assert extract_tiktok_username_from_video_metadata(metadata) == "user.name_42"
