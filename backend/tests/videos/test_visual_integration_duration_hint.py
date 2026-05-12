"""
Tests pour la propagation de `duration_hint` (Option C).

Bug originel (prod 2026-05-11) :
- `videos/visual_integration.py::maybe_enrich_with_visual` skip silencieusement
  quand `extract_storyboard_frames` ne trouve pas de duration, alors que
  `video_info["duration"]` est dispo en amont (Supadata metadata l'a déjà
  fetched).
- Les 4 fallbacks actuels (yt-dlp top-level, fragments sb*, Supadata
  get_video_info, transcript timestamps regex) échouent en cascade sur
  certaines vidéos (vieilles/lockées + transcript Supadata = plain text
  sans `[mm:ss]` à cause du bug endpoint unifié).

Fix Option C :
- Propager `duration_hint=int(video_info.get("duration") or 0)` depuis
  `videos/router.py` (call sites V1/V2/V2.1).
- `maybe_enrich_with_visual` accepte ce param et le passe à
  `extract_storyboard_frames`.
- `extract_storyboard_frames` l'utilise comme 5ème fallback APRÈS les 4
  existants (le plus fiable car Supadata metadata HTTP est solide).

Ces tests verrouillent le contrat :
1. `extract_storyboard_frames(duration_hint=3600)` utilise bien le hint quand
   les 4 fallbacks classiques retournent rien.
2. `maybe_enrich_with_visual(duration_hint=3600)` propage bien le hint
   jusqu'à `extract_storyboard_frames`.
3. Sans `duration_hint`, le comportement legacy reste intact (None retourné).
"""

import io
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
# 🛠️ Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _make_test_sheet(width: int = 320, height: int = 180) -> bytes:
    """Crée un mini-JPEG factice pour les tests."""
    img = Image.new("RGB", (width, height), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_user(plan: str, user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    return user


# yt-dlp info SANS duration top-level, fragments sans duration, et pas de
# Supadata duration → simule le cas réel buggué prod.
INFO_NO_DURATION = {
    "duration": None,  # ❌ Top-level absent
    "title": "Locked Old Video",
    "formats": [
        {
            "format_id": "sb1",
            "width": 320,
            "height": 180,
            "columns": 2,
            "rows": 2,
            "fragments": [
                # ❌ Fragments sans `duration`
                {"url": "https://i.ytimg.com/sb/test/M0.jpg"},
                {"url": "https://i.ytimg.com/sb/test/M1.jpg"},
            ],
        },
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 extract_storyboard_frames — duration_hint comme 5ème fallback
# ═══════════════════════════════════════════════════════════════════════════════


class TestExtractStoryboardFramesDurationHint:
    @pytest.mark.asyncio
    async def test_duration_hint_used_when_all_fallbacks_fail(
        self, tmp_path, monkeypatch
    ):
        """
        Reproduit le bug prod : tous les fallbacks fail mais on a duration_hint.
        - yt-dlp top-level: None
        - fragments sb*: pas de duration
        - Supadata get_video_info: simulé None
        - transcript_hint: plain text sans timestamps
        - duration_hint=3600 (1h, fourni par caller depuis Supadata metadata)

        Attendu : extraction réussit en utilisant duration_hint.
        """
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: INFO_NO_DURATION,
        )

        # Supadata get_video_info mocké pour ne pas fournir de duration
        async def fake_get_video_info(_video_id):
            return {"title": "x", "duration": None}

        # On patche le module dynamique `transcripts` qui contient get_video_info
        import transcripts

        monkeypatch.setattr(
            transcripts, "get_video_info", fake_get_video_info, raising=False
        )

        sheet_bytes = _make_test_sheet()

        async def fake_download(client, url, log_tag):
            return sheet_bytes

        monkeypatch.setattr(youtube_storyboard, "_download_sheet", fake_download)

        result = await youtube_storyboard.extract_storyboard_frames(
            "dQw4w9WgXcQ",
            transcript_hint="Plain text without any timestamps at all",
            duration_hint=3600.0,
        )

        assert result is not None, (
            "extract_storyboard_frames should succeed using duration_hint "
            "when all 4 prior fallbacks fail"
        )
        assert result.duration_s == 3600.0
        assert result.frame_count > 0
        result.cleanup()

    @pytest.mark.asyncio
    async def test_no_duration_hint_falls_back_to_legacy_behavior(
        self, tmp_path, monkeypatch
    ):
        """
        Sans duration_hint, comportement legacy : si tous les 4 fallbacks
        fail → return None (pas de régression).
        """
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: INFO_NO_DURATION,
        )

        async def fake_get_video_info(_video_id):
            return {"title": "x", "duration": None}

        import transcripts

        monkeypatch.setattr(
            transcripts, "get_video_info", fake_get_video_info, raising=False
        )

        result = await youtube_storyboard.extract_storyboard_frames(
            "dQw4w9WgXcQ",
            transcript_hint="Plain text without timestamps",
            # ⚠️ Pas de duration_hint
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_duration_hint_zero_treated_as_absent(self, tmp_path, monkeypatch):
        """duration_hint=0 ou None doivent être traités identiquement."""
        from videos import youtube_storyboard

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: INFO_NO_DURATION,
        )

        async def fake_get_video_info(_video_id):
            return {"title": "x", "duration": None}

        import transcripts

        monkeypatch.setattr(
            transcripts, "get_video_info", fake_get_video_info, raising=False
        )

        result = await youtube_storyboard.extract_storyboard_frames(
            "dQw4w9WgXcQ",
            duration_hint=0.0,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_yt_dlp_duration_takes_priority_over_hint(
        self, tmp_path, monkeypatch
    ):
        """Si yt-dlp donne déjà duration, on l'utilise — duration_hint ignoré."""
        from videos import youtube_storyboard

        info_with_duration = {
            "duration": 30.0,  # ✅ yt-dlp top-level
            "title": "Fake Video",
            "formats": [
                {
                    "format_id": "sb1",
                    "width": 320,
                    "height": 180,
                    "columns": 2,
                    "rows": 2,
                    "fragments": [
                        {"url": "https://i.ytimg.com/sb/test/M0.jpg", "duration": 15.0},
                        {"url": "https://i.ytimg.com/sb/test/M1.jpg", "duration": 15.0},
                    ],
                },
            ],
        }

        monkeypatch.setattr(youtube_storyboard, "FRAMES_BASE_DIR", str(tmp_path))
        monkeypatch.setattr(
            youtube_storyboard,
            "_ytdlp_info_sync",
            lambda video_id, log_tag: info_with_duration,
        )

        sheet_bytes = _make_test_sheet()

        async def fake_download(client, url, log_tag):
            return sheet_bytes

        monkeypatch.setattr(youtube_storyboard, "_download_sheet", fake_download)

        result = await youtube_storyboard.extract_storyboard_frames(
            "dQw4w9WgXcQ", duration_hint=99999.0
        )
        assert result is not None
        # yt-dlp duration (30s) wins, pas le hint (99999s)
        assert result.duration_s == 30.0
        result.cleanup()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 maybe_enrich_with_visual — propagation duration_hint
# ═══════════════════════════════════════════════════════════════════════════════


class TestMaybeEnrichWithVisualDurationHint:
    @pytest.mark.asyncio
    async def test_duration_hint_propagated_to_extract(self, monkeypatch):
        """
        Vérifie que maybe_enrich_with_visual passe bien duration_hint
        à extract_storyboard_frames.
        """
        from videos import visual_integration as vi

        db = AsyncMock()
        user = _make_user("expert")  # Bypass quota

        captured_kwargs = {}

        async def fake_extract(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return None  # On veut juste vérifier la propagation

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)

        await vi.maybe_enrich_with_visual(
            db,
            user,
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            transcript_excerpt="hello",
            duration_hint=3600.0,
        )

        assert "duration_hint" in captured_kwargs, (
            "maybe_enrich_with_visual must forward duration_hint kwarg "
            "to extract_storyboard_frames"
        )
        assert captured_kwargs["duration_hint"] == 3600.0

    @pytest.mark.asyncio
    async def test_no_duration_hint_passes_none(self, monkeypatch):
        """Sans duration_hint → forwarded as None (pas d'effet de bord)."""
        from videos import visual_integration as vi

        db = AsyncMock()
        user = _make_user("expert")

        captured_kwargs = {}

        async def fake_extract(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return None

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)

        await vi.maybe_enrich_with_visual(
            db,
            user,
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            transcript_excerpt="hello",
        )

        # duration_hint forwarded comme None ou absent
        assert captured_kwargs.get("duration_hint") in (None, 0, 0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 enrich_and_capture_visual — propagation duration_hint
# ═══════════════════════════════════════════════════════════════════════════════


class TestEnrichAndCaptureVisualDurationHint:
    @pytest.mark.asyncio
    async def test_duration_hint_propagated_via_helper(self, monkeypatch):
        """
        Vérifie que enrich_and_capture_visual (wrapper appelé par V2/V2.1)
        forward bien duration_hint vers maybe_enrich_with_visual.
        """
        from videos import visual_integration as vi

        # Mock select() pour ne pas hit la DB pour User
        from unittest.mock import MagicMock as _MM

        db = AsyncMock()
        user_row = _make_user("expert")

        async def fake_execute(_q):
            r = _MM()
            r.scalar_one_or_none = _MM(return_value=user_row)
            return r

        db.execute = fake_execute

        captured_kwargs = {}

        async def fake_maybe_enrich(*args, **kwargs):
            captured_kwargs.update(kwargs)
            return {"status": "extract_failed"}  # peu importe pour ce test

        monkeypatch.setattr(vi, "maybe_enrich_with_visual", fake_maybe_enrich)

        await vi.enrich_and_capture_visual(
            db=db,
            user_id=1,
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            transcript_excerpt="hello",
            web_context="ctx",
            flag_enabled=True,
            log_tag="TEST",
            duration_hint=7200.0,
        )

        assert captured_kwargs.get("duration_hint") == 7200.0
