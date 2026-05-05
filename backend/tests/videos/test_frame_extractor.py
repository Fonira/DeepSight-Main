"""
Tests pour videos/frame_extractor.py — logique de budget frames + extraction.

Couvre :
- compute_frame_budget (pure logique, pas de binaire)
- Edge cases focused mode
- Cleanup TTL workdirs
- Extraction locale via fixture vidéo générée à la volée (skippé sans ffmpeg)
"""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


_HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


# ═══════════════════════════════════════════════════════════════════════════════
# 📐 compute_frame_budget — logique pure
# ═══════════════════════════════════════════════════════════════════════════════


class TestComputeFrameBudget:
    """Vérifie le scaling claude-video-style par durée."""

    def test_short_video_under_30s(self):
        from videos.frame_extractor import MAX_FPS, compute_frame_budget

        fps, frames, warning = compute_frame_budget(20.0)
        assert frames <= 30
        assert frames >= 10
        assert fps <= MAX_FPS
        assert warning is False

    def test_medium_30_60s(self):
        from videos.frame_extractor import compute_frame_budget

        fps, frames, warning = compute_frame_budget(45.0)
        assert frames == 40
        assert warning is False

    def test_1_to_3_min(self):
        from videos.frame_extractor import compute_frame_budget

        fps, frames, warning = compute_frame_budget(120.0)
        assert frames == 60
        assert warning is False

    def test_3_to_10_min(self):
        from videos.frame_extractor import compute_frame_budget

        fps, frames, warning = compute_frame_budget(420.0)  # 7 min
        assert frames == 80
        assert warning is False

    def test_long_video_warning(self):
        from videos.frame_extractor import MAX_FRAMES, compute_frame_budget

        fps, frames, warning = compute_frame_budget(1800.0)  # 30 min
        assert frames == MAX_FRAMES
        assert warning is True

    def test_fps_capped_at_max(self):
        """Sur très courte vidéo, fps ne doit jamais dépasser MAX_FPS."""
        from videos.frame_extractor import MAX_FPS, compute_frame_budget

        fps, _, _ = compute_frame_budget(5.0)
        assert fps <= MAX_FPS

    def test_focused_mode_dense(self):
        """Focused mode → densité plus élevée que full video."""
        from videos.frame_extractor import compute_frame_budget

        # 10s focus dans une vidéo de 600s
        fps, frames, warning = compute_frame_budget(
            600.0, focused_start=120.0, focused_end=130.0
        )
        # 10s à 2 fps cap = 20 frames max attendu
        assert frames <= 30
        assert warning is False

    def test_focused_mode_full_range_implicit(self):
        """focused_start sans focused_end → end = duration."""
        from videos.frame_extractor import compute_frame_budget

        fps, frames, _ = compute_frame_budget(60.0, focused_start=30.0)
        # On focus sur 30→60s, soit 30s
        assert frames > 0

    def test_zero_duration_safety(self):
        """Durée 0 ne crashe pas (max() de protection)."""
        from videos.frame_extractor import compute_frame_budget

        fps, frames, _ = compute_frame_budget(0.5)
        assert frames >= 0
        assert fps >= 0


# ═══════════════════════════════════════════════════════════════════════════════
# 🧹 cleanup_stale_frames
# ═══════════════════════════════════════════════════════════════════════════════


class TestCleanupStaleFrames:
    def test_removes_old_workdirs(self, tmp_path, monkeypatch):
        from videos import frame_extractor

        monkeypatch.setattr(frame_extractor, "FRAMES_BASE_DIR", str(tmp_path))

        old = tmp_path / "job_oldoldold"
        recent = tmp_path / "job_recentaa"
        unrelated = tmp_path / "not_a_job"
        for d in (old, recent, unrelated):
            d.mkdir()

        # Vieillir le mtime de "old" à 2h dans le passé
        past = time.time() - 7200
        os.utime(old, (past, past))

        purged = frame_extractor.cleanup_stale_frames(ttl_seconds=3600)

        assert purged == 1
        assert not old.exists()
        assert recent.exists()
        assert unrelated.exists()  # Ne touche pas aux dirs hors convention

    def test_no_basedir_returns_zero(self, tmp_path, monkeypatch):
        from videos import frame_extractor

        ghost = tmp_path / "does-not-exist"
        monkeypatch.setattr(frame_extractor, "FRAMES_BASE_DIR", str(ghost))

        assert frame_extractor.cleanup_stale_frames() == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 🎞️ Intégration ffmpeg (si dispo) — extract_frames_from_local
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.skipif(not _HAS_FFMPEG, reason="ffmpeg/ffprobe not installed locally")
class TestExtractFramesFromLocal:
    """Tests intégration avec une vidéo synthétique de couleur unie."""

    @pytest.fixture
    def synthetic_video(self, tmp_path):
        """Crée une vidéo MP4 de 4 secondes, 320x240, couleur unie."""
        out = tmp_path / "test.mp4"
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=320x240:d=4",
            "-pix_fmt",
            "yuv420p",
            "-y",
            str(out),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode != 0:
            pytest.skip(f"Failed to create synthetic video: {result.stderr[:200]}")
        return str(out)

    @pytest.mark.asyncio
    async def test_extract_frames_short_video(self, synthetic_video, tmp_path, monkeypatch):
        from videos import frame_extractor

        monkeypatch.setattr(frame_extractor, "FRAMES_BASE_DIR", str(tmp_path / "frames"))

        result = await frame_extractor.extract_frames_from_local(
            synthetic_video, log_tag="TEST"
        )
        assert result is not None
        assert result.frame_count > 0
        assert result.duration_s == pytest.approx(4.0, abs=0.5)
        assert all(Path(p).exists() for p in result.frame_paths)
        assert len(result.frame_timestamps) == len(result.frame_paths)

        result.cleanup()
        assert not Path(result.workdir).exists()

    @pytest.mark.asyncio
    async def test_extract_frames_focused_mode(self, synthetic_video, tmp_path, monkeypatch):
        from videos import frame_extractor

        monkeypatch.setattr(frame_extractor, "FRAMES_BASE_DIR", str(tmp_path / "frames"))

        result = await frame_extractor.extract_frames_from_local(
            synthetic_video,
            focused_start=1.0,
            focused_end=3.0,
            log_tag="TEST_FOCUSED",
        )
        assert result is not None
        assert result.frame_count > 0
        # Premier timestamp doit être >= 1.0 (start)
        assert result.frame_timestamps[0] >= 1.0 - 0.1  # tolérance arrondi

        result.cleanup()

    @pytest.mark.asyncio
    async def test_extract_frames_with_max_override(
        self, synthetic_video, tmp_path, monkeypatch
    ):
        from videos import frame_extractor

        monkeypatch.setattr(frame_extractor, "FRAMES_BASE_DIR", str(tmp_path / "frames"))

        result = await frame_extractor.extract_frames_from_local(
            synthetic_video, max_frames_override=3, log_tag="TEST_OVERRIDE"
        )
        assert result is not None
        assert result.frame_count <= 3
        result.cleanup()
