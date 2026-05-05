"""
Tests pour videos/youtube_storyboard.py — Pivot 5 (storyboards YouTube).

Couvre :
- normalize_video_id (URL → 11-char id, edge cases)
- select_storyboard_format (sélection meilleure résolution)
- _slice_sheet (Pillow grid math sur fake JPEG)
- extract_storyboard_frames happy path (mock yt-dlp + httpx)
- extract_storyboard_frames failure paths
"""

import io
import json
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from PIL import Image

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ normalize_video_id
# ═══════════════════════════════════════════════════════════════════════════════


class TestNormalizeVideoId:
    def test_raw_id(self):
        from videos.youtube_storyboard import normalize_video_id

        assert normalize_video_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_watch_url(self):
        from videos.youtube_storyboard import normalize_video_id

        assert (
            normalize_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
            == "dQw4w9WgXcQ"
        )

    def test_short_url(self):
        from videos.youtube_storyboard import normalize_video_id

        assert normalize_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_embed_url(self):
        from videos.youtube_storyboard import normalize_video_id

        assert (
            normalize_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ")
            == "dQw4w9WgXcQ"
        )

    def test_shorts_url(self):
        from videos.youtube_storyboard import normalize_video_id

        assert (
            normalize_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ")
            == "dQw4w9WgXcQ"
        )

    def test_invalid(self):
        from videos.youtube_storyboard import normalize_video_id

        assert normalize_video_id("") is None
        assert normalize_video_id("not-an-id") is None
        assert normalize_video_id("https://example.com/foo") is None

    def test_strips_whitespace(self):
        from videos.youtube_storyboard import normalize_video_id

        assert normalize_video_id("  dQw4w9WgXcQ  ") == "dQw4w9WgXcQ"


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 select_storyboard_format
# ═══════════════════════════════════════════════════════════════════════════════


class TestSelectStoryboardFormat:
    def test_picks_highest_resolution(self):
        from videos.youtube_storyboard import select_storyboard_format

        info = {
            "formats": [
                {"format_id": "sb0", "width": 80, "height": 45, "columns": 5, "rows": 5},
                {"format_id": "sb1", "width": 160, "height": 90, "columns": 5, "rows": 5},
                {"format_id": "sb2", "width": 320, "height": 180, "columns": 5, "rows": 5},
                {"format_id": "mp4-720p", "width": 1280, "height": 720},
            ]
        }
        sb = select_storyboard_format(info)
        assert sb is not None
        assert sb["format_id"] == "sb2"

    def test_no_storyboards_returns_none(self):
        from videos.youtube_storyboard import select_storyboard_format

        info = {"formats": [{"format_id": "mp4-720p", "width": 1280, "height": 720}]}
        assert select_storyboard_format(info) is None

    def test_empty_formats(self):
        from videos.youtube_storyboard import select_storyboard_format

        assert select_storyboard_format({}) is None
        assert select_storyboard_format({"formats": []}) is None


# ═══════════════════════════════════════════════════════════════════════════════
# 🖼️ _slice_sheet
# ═══════════════════════════════════════════════════════════════════════════════


def _make_test_sheet(width: int, height: int, color=(100, 150, 200)) -> bytes:
    """Crée un JPEG d'une couleur unie de la taille demandée."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


class TestSliceSheet:
    def test_5x5_grid(self):
        from videos.youtube_storyboard import _slice_sheet

        sheet = _make_test_sheet(800, 450)  # 5×5 de 160×90
        frames = _slice_sheet(sheet, cols=5, rows=5, log_tag="TEST")
        assert len(frames) == 25
        # Vérifie que chaque frame est un JPEG valide
        for fb in frames:
            assert fb[:3] == b"\xff\xd8\xff"
            img = Image.open(io.BytesIO(fb))
            assert img.size == (160, 90)

    def test_3x3_grid(self):
        from videos.youtube_storyboard import _slice_sheet

        sheet = _make_test_sheet(960, 540)
        frames = _slice_sheet(sheet, cols=3, rows=3, log_tag="TEST")
        assert len(frames) == 9

    def test_invalid_grid_returns_empty(self):
        from videos.youtube_storyboard import _slice_sheet

        sheet = _make_test_sheet(100, 100)
        assert _slice_sheet(sheet, cols=0, rows=5, log_tag="TEST") == []
        assert _slice_sheet(sheet, cols=5, rows=0, log_tag="TEST") == []

    def test_corrupt_bytes_returns_empty(self):
        from videos.youtube_storyboard import _slice_sheet

        assert _slice_sheet(b"not a jpeg", cols=3, rows=3, log_tag="TEST") == []


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 extract_storyboard_frames — happy path & failures
# ═══════════════════════════════════════════════════════════════════════════════


FAKE_INFO_JSON = {
    "duration": 30.0,
    "title": "Fake Video",
    "formats": [
        {
            "format_id": "sb1",
            "width": 320,
            "height": 180,
            "columns": 2,
            "rows": 2,
            "fragments": [
                {"url": "https://i.ytimg.com/sb/test/storyboard3_L1/M0.jpg", "duration": 15.0},
                {"url": "https://i.ytimg.com/sb/test/storyboard3_L1/M1.jpg", "duration": 15.0},
            ],
        },
    ],
}


@pytest.fixture
def fake_sheet_bytes():
    """4 sub-frames de 160×90 dans un sheet 320×180."""
    return _make_test_sheet(320, 180)


class TestExtractStoryboardFrames:
    @pytest.mark.asyncio
    async def test_happy_path(self, tmp_path, monkeypatch, fake_sheet_bytes):
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))

        # Mock yt-dlp
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: FAKE_INFO_JSON,
        )

        # Mock httpx
        async def fake_download(client, url, log_tag):
            return fake_sheet_bytes

        monkeypatch.setattr(youtube_storyboard, "_download_sheet", fake_download)

        result = await youtube_storyboard.extract_storyboard_frames("dQw4w9WgXcQ")
        assert result is not None
        # 2 sheets × 2×2 = 8 frames attendues, MAX 100
        assert result.frame_count == 8
        assert result.duration_s == 30.0
        assert len(result.frame_paths) == 8
        assert len(result.frame_timestamps) == 8
        # Timestamps croissants
        assert result.frame_timestamps == sorted(result.frame_timestamps)
        # Tous les paths existent
        assert all(Path(p).exists() for p in result.frame_paths)

        result.cleanup()
        assert not Path(result.workdir).exists()

    @pytest.mark.asyncio
    async def test_invalid_video_id(self, tmp_path, monkeypatch):
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))

        result = await youtube_storyboard.extract_storyboard_frames("not-a-video-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_ytdlp_returns_none(self, tmp_path, monkeypatch):
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: None,
        )

        result = await youtube_storyboard.extract_storyboard_frames("dQw4w9WgXcQ")
        assert result is None
        # Workdir doit être nettoyé
        assert not list(Path(tmp_path).glob("job_sb_*"))

    @pytest.mark.asyncio
    async def test_no_storyboard_format(self, tmp_path, monkeypatch):
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))

        info = {"duration": 30.0, "formats": [{"format_id": "mp4-720p", "width": 1280, "height": 720}]}
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: info,
        )

        result = await youtube_storyboard.extract_storyboard_frames("dQw4w9WgXcQ")
        assert result is None

    @pytest.mark.asyncio
    async def test_max_frames_override(self, tmp_path, monkeypatch, fake_sheet_bytes):
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: FAKE_INFO_JSON,
        )

        async def fake_download(client, url, log_tag):
            return fake_sheet_bytes

        monkeypatch.setattr(youtube_storyboard, "_download_sheet", fake_download)

        result = await youtube_storyboard.extract_storyboard_frames(
            "dQw4w9WgXcQ", max_frames_override=4
        )
        assert result is not None
        assert result.frame_count <= 4
        result.cleanup()

    @pytest.mark.asyncio
    async def test_all_sheets_fail_returns_none(self, tmp_path, monkeypatch):
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: FAKE_INFO_JSON,
        )

        async def fake_download_fail(client, url, log_tag):
            return None  # Simule 403/network error sur tous les sheets

        monkeypatch.setattr(youtube_storyboard, "_download_sheet", fake_download_fail)

        result = await youtube_storyboard.extract_storyboard_frames("dQw4w9WgXcQ")
        assert result is None
