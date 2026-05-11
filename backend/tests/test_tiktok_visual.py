"""Tests pour le pipeline TikTok visual analysis (sprint 2026-05-11).

Couvre :
- `_yt_dlp_extra_args(use_tiktok_cookies=True)` — swap YouTube cookies ↔ TikTok cookies
- `_download_tiktok_video_via_ytdlp` — subprocess yt-dlp + proxy Decodo + cookies TikTok
- `_extract_tiktok_visual_frames` — yt-dlp prio + tikwm fallback + double-failure
- `get_tiktok_cookies_path` — getter Pydantic
"""

import os
import sys
from pathlib import Path as _Path
from unittest.mock import MagicMock

import pytest

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ get_tiktok_cookies_path — Pydantic setting
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetTiktokCookiesPath:
    def test_returns_setting_value(self, monkeypatch):
        from core import config

        monkeypatch.setattr(config._settings, "TIKTOK_COOKIES_PATH", "/app/tiktok_cookies.txt")
        assert config.get_tiktok_cookies_path() == "/app/tiktok_cookies.txt"

    def test_returns_empty_when_unset(self, monkeypatch):
        from core import config

        monkeypatch.setattr(config._settings, "TIKTOK_COOKIES_PATH", "")
        assert config.get_tiktok_cookies_path() == ""


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 _yt_dlp_extra_args — cookies switching
# ═══════════════════════════════════════════════════════════════════════════════


class TestYtDlpExtraArgs:
    def test_youtube_cookies_default(self, monkeypatch):
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "http://decodo:7000")
        monkeypatch.setattr(au, "get_ytdlp_cookies_path", lambda: "/app/cookies.txt")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "/app/tiktok_cookies.txt")
        monkeypatch.setattr(au.os.path, "exists", lambda p: True)

        args = au._yt_dlp_extra_args()
        assert "--proxy" in args
        assert "http://decodo:7000" in args
        assert "--cookies" in args
        assert "/app/cookies.txt" in args
        assert "/app/tiktok_cookies.txt" not in args

    def test_tiktok_cookies_when_flag_set(self, monkeypatch):
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "http://decodo:7000")
        monkeypatch.setattr(au, "get_ytdlp_cookies_path", lambda: "/app/cookies.txt")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "/app/tiktok_cookies.txt")
        monkeypatch.setattr(au.os.path, "exists", lambda p: True)

        args = au._yt_dlp_extra_args(use_tiktok_cookies=True)
        assert "--proxy" in args
        assert "http://decodo:7000" in args
        assert "--cookies" in args
        assert "/app/tiktok_cookies.txt" in args
        assert "/app/cookies.txt" not in args

    def test_no_proxy_no_cookies(self, monkeypatch):
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(au, "get_ytdlp_cookies_path", lambda: "")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "")

        assert au._yt_dlp_extra_args(use_tiktok_cookies=True) == []
        assert au._yt_dlp_extra_args() == []

    def test_include_proxy_false_skips_proxy(self, monkeypatch):
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "http://decodo:7000")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "/app/tiktok_cookies.txt")
        monkeypatch.setattr(au.os.path, "exists", lambda p: True)

        args = au._yt_dlp_extra_args(include_proxy=False, use_tiktok_cookies=True)
        assert "--proxy" not in args
        # Cookies still injected
        assert "--cookies" in args

    def test_cookies_path_missing_file_skipped(self, monkeypatch):
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "/app/missing.txt")
        monkeypatch.setattr(au.os.path, "exists", lambda p: False)

        args = au._yt_dlp_extra_args(use_tiktok_cookies=True)
        assert "--cookies" not in args


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 _download_tiktok_video_via_ytdlp — subprocess yt-dlp wrapper
# ═══════════════════════════════════════════════════════════════════════════════


def _fake_subprocess_writing_mp4(captured_cmd: list, mp4_bytes: bytes = b"\x00\x00\x00\x18ftypmp42" + b"x" * 5000):
    """Fake subprocess.run that captures cmd and writes a fake .mp4 to the -o path."""

    def _run(cmd, capture_output=True, text=True, timeout=60):
        captured_cmd.extend(cmd)
        try:
            idx = cmd.index("-o")
            out_path = cmd[idx + 1]
            _Path(out_path).write_bytes(mp4_bytes)
        except (ValueError, IndexError, OSError):
            pass
        result = MagicMock()
        result.returncode = 0
        result.stderr = ""
        return result

    return _run


class TestDownloadTiktokVideoViaYtdlp:
    @pytest.mark.asyncio
    async def test_subprocess_called_with_proxy_and_tiktok_cookies(self, monkeypatch):
        """yt-dlp cmd doit contenir --proxy <decodo> et --cookies <tiktok_path>."""
        from videos import visual_integration as vi
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "http://decodo:7000")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "/app/tiktok_cookies.txt")
        monkeypatch.setattr(au, "get_ytdlp_cookies_path", lambda: "/app/cookies.txt")
        monkeypatch.setattr(au.os.path, "exists", lambda p: True)

        captured_cmd: list = []
        monkeypatch.setattr(vi.subprocess, "run", _fake_subprocess_writing_mp4(captured_cmd))

        result = await vi._download_tiktok_video_via_ytdlp(
            "https://www.tiktok.com/@user/video/12345",
            log_tag="TEST",
            timeout_s=10,
        )

        assert result is not None
        assert len(result) > 1000
        assert captured_cmd[0] == "yt-dlp"
        assert "--proxy" in captured_cmd
        assert "http://decodo:7000" in captured_cmd
        assert "--cookies" in captured_cmd
        assert "/app/tiktok_cookies.txt" in captured_cmd
        # Pas les cookies YouTube
        assert "/app/cookies.txt" not in captured_cmd
        # URL passée en dernier
        assert captured_cmd[-1] == "https://www.tiktok.com/@user/video/12345"

    @pytest.mark.asyncio
    async def test_subprocess_nonzero_returns_none(self, monkeypatch):
        from videos import visual_integration as vi
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "")

        def fake_run(cmd, capture_output=True, text=True, timeout=60):
            result = MagicMock()
            result.returncode = 1
            result.stderr = "ERROR: video unavailable"
            return result

        monkeypatch.setattr(vi.subprocess, "run", fake_run)

        result = await vi._download_tiktok_video_via_ytdlp(
            "https://www.tiktok.com/@user/video/12345",
            log_tag="TEST",
            timeout_s=10,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_subprocess_writes_no_mp4_returns_none(self, monkeypatch):
        """yt-dlp returns 0 but no .mp4/.webm/.mkv produced → None."""
        from videos import visual_integration as vi
        from transcripts import audio_utils as au

        monkeypatch.setattr(au, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(au, "get_tiktok_cookies_path", lambda: "")

        def fake_run(cmd, capture_output=True, text=True, timeout=60):
            result = MagicMock()
            result.returncode = 0
            result.stderr = ""
            return result

        monkeypatch.setattr(vi.subprocess, "run", fake_run)

        result = await vi._download_tiktok_video_via_ytdlp(
            "https://www.tiktok.com/@user/video/12345",
            log_tag="TEST",
            timeout_s=10,
        )
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 _extract_tiktok_visual_frames — yt-dlp prio + tikwm fallback
# ═══════════════════════════════════════════════════════════════════════════════


def _fake_frame_extraction(workdir_str: str = "/tmp/fake_tk"):
    from videos.frame_extractor import FrameExtractionResult

    fx = FrameExtractionResult(
        workdir=workdir_str,
        frame_paths=[f"{workdir_str}/f1.jpg", f"{workdir_str}/f2.jpg"],
        frame_timestamps=[0.5, 5.0],
        duration_s=15.0,
        fps_used=0.2,
        frame_count=2,
        width=512,
        long_video_warning=False,
    )
    fx.cleanup = MagicMock()
    return fx


class TestExtractTiktokVisualFrames:
    @pytest.mark.asyncio
    async def test_ytdlp_success_skips_tikwm(self, monkeypatch):
        """yt-dlp returns bytes → tikwm NOT called → frames extracted."""
        from videos import visual_integration as vi

        ytdlp_called: list = []
        tikwm_called: list = []

        async def fake_ytdlp(url, *, log_tag, timeout_s=60):
            ytdlp_called.append(url)
            return b"\x00\x00\x00\x18ftypmp42" + b"x" * 5000

        async def fake_tikwm(url, *, log_tag):
            tikwm_called.append(url)
            return b"should not be called"

        async def fake_extract(path, *, mode, log_tag):
            return _fake_frame_extraction()

        monkeypatch.setattr(vi, "_download_tiktok_video_via_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/12345",
            "12345",
            mode="default",
            log_tag="TEST",
        )

        assert result is not None
        assert result.frame_count == 2
        assert len(ytdlp_called) == 1
        assert len(tikwm_called) == 0  # critical: tikwm pas appelé si yt-dlp réussit

    @pytest.mark.asyncio
    async def test_ytdlp_failure_falls_back_to_tikwm(self, monkeypatch):
        """yt-dlp returns None → tikwm called → frames extracted via fallback."""
        from videos import visual_integration as vi

        ytdlp_called: list = []
        tikwm_called: list = []

        async def fake_ytdlp(url, *, log_tag, timeout_s=60):
            ytdlp_called.append(url)
            return None

        async def fake_tikwm(url, *, log_tag):
            tikwm_called.append(url)
            return b"\x00\x00\x00\x18ftypmp42" + b"x" * 5000

        async def fake_extract(path, *, mode, log_tag):
            return _fake_frame_extraction()

        monkeypatch.setattr(vi, "_download_tiktok_video_via_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/12345",
            "12345",
            mode="expert",
            log_tag="TEST",
        )

        assert result is not None
        assert len(ytdlp_called) == 1
        assert len(tikwm_called) == 1

    @pytest.mark.asyncio
    async def test_both_fail_returns_none(self, monkeypatch):
        """yt-dlp ET tikwm renvoient None → None, pas d'appel ffmpeg."""
        from videos import visual_integration as vi

        ffmpeg_called: list = []

        async def fake_ytdlp(url, *, log_tag, timeout_s=60):
            return None

        async def fake_tikwm(url, *, log_tag):
            return None

        async def fake_extract(path, *, mode, log_tag):
            ffmpeg_called.append(path)
            return None

        monkeypatch.setattr(vi, "_download_tiktok_video_via_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/12345",
            "12345",
            mode="default",
            log_tag="TEST",
        )

        assert result is None
        assert len(ffmpeg_called) == 0

    @pytest.mark.asyncio
    async def test_ytdlp_raises_falls_back_to_tikwm(self, monkeypatch):
        """yt-dlp raise → catch → tikwm path tried."""
        from videos import visual_integration as vi

        tikwm_called: list = []

        async def fake_ytdlp(url, *, log_tag, timeout_s=60):
            raise RuntimeError("yt-dlp crashed")

        async def fake_tikwm(url, *, log_tag):
            tikwm_called.append(url)
            return b"\x00\x00\x00\x18ftypmp42" + b"x" * 5000

        async def fake_extract(path, *, mode, log_tag):
            return _fake_frame_extraction()

        monkeypatch.setattr(vi, "_download_tiktok_video_via_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/12345",
            "12345",
            mode="default",
            log_tag="TEST",
        )

        assert result is not None
        assert len(tikwm_called) == 1

    @pytest.mark.asyncio
    async def test_tikwm_raises_after_ytdlp_failure_returns_none(self, monkeypatch):
        """yt-dlp returns None AND tikwm raises → None (graceful, pas de re-raise)."""
        from videos import visual_integration as vi

        async def fake_ytdlp(url, *, log_tag, timeout_s=60):
            return None

        async def fake_tikwm(url, *, log_tag):
            raise RuntimeError("tikwm crashed")

        monkeypatch.setattr(vi, "_download_tiktok_video_via_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/12345",
            "12345",
            mode="default",
            log_tag="TEST",
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_mode_passed_to_extract_frames(self, monkeypatch):
        """Vérifie que `mode` est propagé à extract_frames_from_local."""
        from videos import visual_integration as vi

        captured_mode: dict = {}

        async def fake_ytdlp(url, *, log_tag, timeout_s=60):
            return b"\x00\x00\x00\x18ftypmp42" + b"x" * 5000

        async def fake_tikwm(url, *, log_tag):
            return None

        async def fake_extract(path, *, mode, log_tag):
            captured_mode["mode"] = mode
            captured_mode["log_tag"] = log_tag
            return _fake_frame_extraction()

        monkeypatch.setattr(vi, "_download_tiktok_video_via_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract)

        await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/12345",
            "12345",
            mode="expert",
            log_tag="VISUAL_INT user=42",
        )

        assert captured_mode["mode"] == "expert"
        assert "TIKTOK" in captured_mode["log_tag"]
