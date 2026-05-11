"""
Tests pour la chain `_extract_tiktok_visual_frames` (Sprint A — Decodo proxy).

Couvre la chain de fallback TikTok après refactor :
    1. yt-dlp via proxy Decodo (primaire)
    2. tikwm.com `data.play` (fallback secondaire)
    3. Failure explicite (None)

Stratégie de mocks :
- Patcher `_download_tiktok_video_ytdlp` (async) pour simuler le proxy primaire
- Patcher `_download_tiktok_video_no_watermark` (async) pour simuler tikwm
- Patcher `extract_frames_from_local` pour ne pas exécuter ffmpeg réel
- Pour le test sync helper `_download_tiktok_video_ytdlp_sync`, patcher
  `subprocess.run` et `_yt_dlp_extra_args`
"""

import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


def _make_fake_extraction(frame_count: int = 3, duration_s: float = 15.0):
    """Construit un FrameExtractionResult factice avec un cleanup mockable."""
    from videos.frame_extractor import FrameExtractionResult

    res = FrameExtractionResult(
        workdir="/tmp/fake_tk_workdir",
        frame_paths=[f"/tmp/fake_tk_workdir/f{i}.jpg" for i in range(frame_count)],
        frame_timestamps=[float(i) for i in range(frame_count)],
        duration_s=duration_s,
        fps_used=0.2,
        frame_count=frame_count,
        width=512,
        long_video_warning=False,
    )
    res.cleanup = MagicMock()
    return res


# ═══════════════════════════════════════════════════════════════════════════════
# 1️⃣ Chain : yt-dlp success → tikwm SKIPPED
# ═══════════════════════════════════════════════════════════════════════════════


class TestTikTokYtdlpPrimarySuccess:
    @pytest.mark.asyncio
    async def test_ytdlp_success_skips_tikwm(self, monkeypatch):
        """yt-dlp+Decodo réussit → extract_frames_from_local OK → tikwm pas appelé."""
        from videos import visual_integration as vi

        fake_extraction = _make_fake_extraction()
        ytdlp_calls = {"count": 0}
        tikwm_calls = {"count": 0}
        extract_calls = {"count": 0}

        async def fake_ytdlp(url, *, log_tag):
            ytdlp_calls["count"] += 1
            # Simule un fichier temporaire téléchargé par yt-dlp
            return Path("/tmp/fake_workdir/tiktok_video.mp4")

        async def fake_tikwm(url, *, log_tag):
            tikwm_calls["count"] += 1
            return b"unreachable"

        async def fake_extract_from_local(video_path, *, mode, log_tag):
            extract_calls["count"] += 1
            assert "TIKTOK_YTDLP" in log_tag
            return fake_extraction

        monkeypatch.setattr(vi, "_download_tiktok_video_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract_from_local)
        # rmtree est appelé pour cleanup du workdir parent — ne doit rien casser
        monkeypatch.setattr(vi.shutil, "rmtree", lambda *a, **kw: None)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@khaby.lame/video/7459716872551976210",
            "7459716872551976210",
            mode="default",
            log_tag="TEST",
        )

        assert result is fake_extraction
        assert ytdlp_calls["count"] == 1
        assert tikwm_calls["count"] == 0, "tikwm ne doit pas être appelé quand yt-dlp réussit"
        assert extract_calls["count"] == 1


# ═══════════════════════════════════════════════════════════════════════════════
# 2️⃣ Chain : yt-dlp KO → tikwm success
# ═══════════════════════════════════════════════════════════════════════════════


class TestTikTokFallbackToTikwm:
    @pytest.mark.asyncio
    async def test_ytdlp_fails_tikwm_succeeds(self, monkeypatch):
        """yt-dlp+Decodo renvoie None (IP blocked) → tikwm `data.play` prend le relais."""
        from videos import visual_integration as vi

        fake_extraction = _make_fake_extraction(frame_count=5)
        ytdlp_calls = {"count": 0}
        tikwm_calls = {"count": 0}
        extract_local_calls = []

        async def fake_ytdlp(url, *, log_tag):
            ytdlp_calls["count"] += 1
            return None  # yt-dlp KO

        async def fake_tikwm(url, *, log_tag):
            tikwm_calls["count"] += 1
            # 100 KB de bytes factices (au-dessus du seuil 1000)
            return b"\x00\x00\x00\x18ftypmp42" + b"X" * (100 * 1024)

        async def fake_extract_from_local(video_path, *, mode, log_tag):
            extract_local_calls.append({"path": video_path, "log_tag": log_tag})
            return fake_extraction

        # write_bytes ne doit pas casser sur Windows ni leak — on patch sur Path
        original_write_bytes = Path.write_bytes
        original_unlink = Path.unlink

        def safe_write_bytes(self, data):
            # Skip réel disk write — on simule juste le retour
            return len(data)

        def safe_unlink(self, missing_ok=True):
            return None

        monkeypatch.setattr(vi, "_download_tiktok_video_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract_from_local)
        monkeypatch.setattr(Path, "write_bytes", safe_write_bytes)
        monkeypatch.setattr(Path, "unlink", safe_unlink)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/123",
            "123",
            mode="expert",
            log_tag="TEST",
        )

        assert result is fake_extraction
        assert ytdlp_calls["count"] == 1
        assert tikwm_calls["count"] == 1
        assert len(extract_local_calls) == 1
        assert "TIKTOK_TIKWM" in extract_local_calls[0]["log_tag"]
        assert extract_local_calls[0]["log_tag"].endswith("TIKTOK_TIKWM")


# ═══════════════════════════════════════════════════════════════════════════════
# 3️⃣ Chain : les deux échouent → None
# ═══════════════════════════════════════════════════════════════════════════════


class TestTikTokBothFail:
    @pytest.mark.asyncio
    async def test_ytdlp_and_tikwm_both_fail_returns_none(self, monkeypatch):
        """Si yt-dlp ET tikwm échouent → None (caller renvoie STATUS_EXTRACT_FAILED)."""
        from videos import visual_integration as vi

        ytdlp_calls = {"count": 0}
        tikwm_calls = {"count": 0}
        extract_calls = {"count": 0}

        async def fake_ytdlp(url, *, log_tag):
            ytdlp_calls["count"] += 1
            return None

        async def fake_tikwm(url, *, log_tag):
            tikwm_calls["count"] += 1
            return None

        async def fake_extract_from_local(*args, **kwargs):
            extract_calls["count"] += 1
            return None

        monkeypatch.setattr(vi, "_download_tiktok_video_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract_from_local)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@user/video/456",
            "456",
            mode="default",
            log_tag="TEST",
        )

        assert result is None
        assert ytdlp_calls["count"] == 1
        assert tikwm_calls["count"] == 1
        # extract_frames_from_local n'est PAS appelée parce que les deux downloads ont
        # retourné None avant qu'on arrive à extraire
        assert extract_calls["count"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 4️⃣ Chain : yt-dlp OK mais ffmpeg KO → fallback tikwm
# ═══════════════════════════════════════════════════════════════════════════════


class TestTikTokYtdlpExtractFailsThenTikwm:
    @pytest.mark.asyncio
    async def test_ytdlp_download_ok_but_ffmpeg_fails_falls_back_to_tikwm(self, monkeypatch):
        """yt-dlp DL OK mais extract_frames_from_local renvoie None → tikwm prend le relais."""
        from videos import visual_integration as vi

        fake_extraction = _make_fake_extraction(frame_count=4)
        extract_local_calls = []

        async def fake_ytdlp(url, *, log_tag):
            return Path("/tmp/fake/tiktok_video.mp4")

        async def fake_tikwm(url, *, log_tag):
            return b"\x00\x00\x00\x18ftypmp42" + b"Y" * (50 * 1024)

        async def fake_extract_from_local(video_path, *, mode, log_tag):
            extract_local_calls.append(log_tag)
            # 1er appel (yt-dlp path) → None ; 2e appel (tikwm path) → succès
            if "TIKTOK_YTDLP" in log_tag:
                return None
            return fake_extraction

        def safe_write_bytes(self, data):
            return len(data)

        def safe_unlink(self, missing_ok=True):
            return None

        monkeypatch.setattr(vi, "_download_tiktok_video_ytdlp", fake_ytdlp)
        monkeypatch.setattr(vi, "_download_tiktok_video_no_watermark", fake_tikwm)
        monkeypatch.setattr(vi, "extract_frames_from_local", fake_extract_from_local)
        monkeypatch.setattr(vi.shutil, "rmtree", lambda *a, **kw: None)
        monkeypatch.setattr(Path, "write_bytes", safe_write_bytes)
        monkeypatch.setattr(Path, "unlink", safe_unlink)

        result = await vi._extract_tiktok_visual_frames(
            "https://www.tiktok.com/@x/video/789",
            "789",
            mode="default",
            log_tag="TEST",
        )

        assert result is fake_extraction
        assert len(extract_local_calls) == 2
        assert any("TIKTOK_YTDLP" in tag for tag in extract_local_calls)
        assert any("TIKTOK_TIKWM" in tag for tag in extract_local_calls)


# ═══════════════════════════════════════════════════════════════════════════════
# 5️⃣ yt-dlp sync helper — proxy args injection
# ═══════════════════════════════════════════════════════════════════════════════


class TestYtdlpSyncHelper:
    def test_ytdlp_sync_invokes_yt_dlp_with_proxy_args(self, monkeypatch, tmp_path):
        """_download_tiktok_video_ytdlp_sync construit cmd correct + injecte proxy/cookies."""
        from videos import visual_integration as vi

        # Mock _yt_dlp_extra_args pour simuler injection proxy+cookies
        fake_extra_args = ["--proxy", "http://decodo:7000", "--cookies", "/tmp/c.txt"]

        captured = {}

        def fake_subprocess_run(cmd, **kwargs):
            captured["cmd"] = cmd
            captured["kwargs"] = kwargs
            # Crée un faux fichier de sortie pour le glob
            output_file = tmp_path / "tiktok_video.mp4"
            output_file.write_bytes(b"fake mp4 bytes")
            return SimpleNamespace(returncode=0, stderr="", stdout="")

        # Patch direct sur le module audio_utils car _yt_dlp_extra_args est importé localement
        # dans la fonction sync (pour éviter cycle d'import au load)
        import transcripts.audio_utils as au

        monkeypatch.setattr(au, "_yt_dlp_extra_args", lambda **kw: fake_extra_args)
        monkeypatch.setattr(subprocess, "run", fake_subprocess_run)

        result = vi._download_tiktok_video_ytdlp_sync(
            "https://www.tiktok.com/@u/video/1",
            str(tmp_path),
            log_tag="TEST",
        )

        assert result is not None
        assert "tiktok_video.mp4" in result
        # Vérifier que _yt_dlp_extra_args a été spread dans cmd
        assert captured["cmd"][0] == "yt-dlp"
        # Le fake_extra_args doit apparaître quelque part entre "yt-dlp" et l'URL
        cmd_str = " ".join(captured["cmd"])
        assert "--proxy" in cmd_str
        assert "http://decodo:7000" in cmd_str
        assert "--cookies" in cmd_str
        assert "/tmp/c.txt" in cmd_str
        # Vérifier que -f format, --max-filesize, --no-playlist sont bien là
        assert "-f" in captured["cmd"]
        assert "--max-filesize" in captured["cmd"]
        assert "--no-playlist" in captured["cmd"]
        assert "--no-warnings" in captured["cmd"]
        # L'URL doit être le dernier arg
        assert captured["cmd"][-1] == "https://www.tiktok.com/@u/video/1"

    def test_ytdlp_sync_returns_none_on_nonzero_exit(self, monkeypatch, tmp_path):
        """yt-dlp avec returncode != 0 → None (et caller bascule sur tikwm)."""
        from videos import visual_integration as vi

        def fake_subprocess_run(cmd, **kwargs):
            return SimpleNamespace(
                returncode=1,
                stderr="ERROR: [TikTok] 123: Your IP address is blocked",
                stdout="",
            )

        import transcripts.audio_utils as au

        monkeypatch.setattr(au, "_yt_dlp_extra_args", lambda **kw: [])
        monkeypatch.setattr(subprocess, "run", fake_subprocess_run)

        result = vi._download_tiktok_video_ytdlp_sync(
            "https://www.tiktok.com/@blocked/video/1",
            str(tmp_path),
            log_tag="TEST",
        )

        assert result is None

    def test_ytdlp_sync_returns_none_on_timeout(self, monkeypatch, tmp_path):
        """yt-dlp TimeoutExpired → None (subprocess.TimeoutExpired catchée)."""
        from videos import visual_integration as vi

        def fake_subprocess_run(cmd, **kwargs):
            raise subprocess.TimeoutExpired(cmd=cmd, timeout=300)

        import transcripts.audio_utils as au

        monkeypatch.setattr(au, "_yt_dlp_extra_args", lambda **kw: [])
        monkeypatch.setattr(subprocess, "run", fake_subprocess_run)

        result = vi._download_tiktok_video_ytdlp_sync(
            "https://www.tiktok.com/@slow/video/1",
            str(tmp_path),
            log_tag="TEST",
        )

        assert result is None
