"""
Tests for _yt_dlp_extra_args() helper from transcripts/audio_utils.py.

Verifies that the proxy/cookies wiring used by YouTube AND TikTok yt-dlp
invocations behaves correctly across env var combinations.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


class TestYtDlpExtraArgs:
    def test_returns_empty_when_no_env(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        assert audio_utils._yt_dlp_extra_args() == []

    def test_includes_proxy_when_set(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://user:pass@proxy:1080")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "")

        args = audio_utils._yt_dlp_extra_args()
        assert args == ["--proxy", "http://user:pass@proxy:1080"]

    def test_includes_cookies_when_file_exists(self, monkeypatch, tmp_path):
        from transcripts import audio_utils

        cookies_file = tmp_path / "cookies.txt"
        cookies_file.write_text("# Netscape cookies file")

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: str(cookies_file))

        args = audio_utils._yt_dlp_extra_args()
        assert args == ["--cookies", str(cookies_file)]

    def test_skips_cookies_when_path_does_not_exist(self, monkeypatch):
        from transcripts import audio_utils

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: "/nonexistent/cookies.txt")

        assert audio_utils._yt_dlp_extra_args() == []

    def test_proxy_and_cookies_together(self, monkeypatch, tmp_path):
        from transcripts import audio_utils

        cookies_file = tmp_path / "cookies.txt"
        cookies_file.write_text("# cookies")

        monkeypatch.setattr(audio_utils, "get_youtube_proxy", lambda: "http://proxy:1080")
        monkeypatch.setattr(audio_utils, "get_ytdlp_cookies_path", lambda: str(cookies_file))

        args = audio_utils._yt_dlp_extra_args()
        assert args == ["--proxy", "http://proxy:1080", "--cookies", str(cookies_file)]

    def test_re_export_from_ultra_resilient(self):
        """Backward-compat: ultra_resilient still exposes _yt_dlp_extra_args."""
        from transcripts.ultra_resilient import _yt_dlp_extra_args as ur_helper
        from transcripts.audio_utils import _yt_dlp_extra_args as au_helper

        assert ur_helper is au_helper

    def test_tiktok_imports_helper(self):
        """tiktok module imports the shared helper."""
        from transcripts import tiktok

        assert hasattr(tiktok, "_yt_dlp_extra_args")
