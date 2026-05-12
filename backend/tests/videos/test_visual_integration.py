"""
Tests pour videos/visual_integration.py — Phase 2 backend integration.

Couvre :
- Helpers purs : _current_period, get_quota_for_plan, format_visual_context_for_prompt
- can_consume : Free refusé, Expert OK illimité, Pro avec/sans quota dépassé
- maybe_enrich_with_visual : flag off, not_youtube, plan_not_allowed, happy path
- Mode ultra opt-in (Sprint C 2026-05-11) : grille adaptative + select_mode
- Logs WARNING explicites sur tous les silent skips (Sprint C 2026-05-11)
"""

import logging
import os
import sys
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ Helpers purs
# ═══════════════════════════════════════════════════════════════════════════════


class TestCurrentPeriod:
    def test_format_yyyy_mm(self):
        from videos.visual_integration import _current_period

        period = _current_period()
        assert len(period) == 7
        assert period[4] == "-"
        year, month = period.split("-")
        assert 2024 <= int(year) <= 2030
        assert 1 <= int(month) <= 12


class TestGetQuotaForPlan:
    def test_free_returns_zero(self):
        from videos.visual_integration import get_quota_for_plan

        assert get_quota_for_plan("free") == 0
        assert get_quota_for_plan("FREE") == 0
        assert get_quota_for_plan("") == 0
        assert get_quota_for_plan(None) == 0

    def test_pro_returns_30(self):
        from videos.visual_integration import get_quota_for_plan

        assert get_quota_for_plan("pro") == 30

    def test_expert_returns_none_unlimited(self):
        from videos.visual_integration import get_quota_for_plan

        assert get_quota_for_plan("expert") is None

    def test_legacy_aliases(self):
        from videos.visual_integration import get_quota_for_plan

        assert get_quota_for_plan("starter") == 30
        assert get_quota_for_plan("plus") == 30


class TestFormatVisualContextForPrompt:
    def test_status_not_ok_returns_empty(self):
        from videos.visual_integration import (
            STATUS_PLAN_NOT_ALLOWED,
            format_visual_context_for_prompt,
        )

        assert format_visual_context_for_prompt({"status": STATUS_PLAN_NOT_ALLOWED}) == ""
        assert format_visual_context_for_prompt({}) == ""

    def test_ok_with_full_analysis(self):
        from videos.visual_integration import STATUS_OK, format_visual_context_for_prompt

        result = {
            "status": STATUS_OK,
            "analysis": {
                "visual_hook": "Plan large lumineux",
                "visual_structure": "talking_head",
                "summary_visual": "Vidéo posée plan unique",
                "key_moments": [
                    {"timestamp_s": 1.0, "description": "Entrée écran", "type": "hook"},
                    {"timestamp_s": 12.5, "description": "Reveal", "type": "reveal"},
                ],
                "visible_text": "DeepSight",
            },
        }
        out = format_visual_context_for_prompt(result)
        assert "COUCHE VISUELLE" in out
        assert "Plan large lumineux" in out
        assert "talking_head" in out
        assert "DeepSight" in out
        assert "[1.0s][hook]" in out
        assert "[12.5s][reveal]" in out

    def test_caps_at_8_moments(self):
        from videos.visual_integration import STATUS_OK, format_visual_context_for_prompt

        moments = [
            {"timestamp_s": float(i), "description": f"m{i}", "type": "peak"}
            for i in range(20)
        ]
        result = {
            "status": STATUS_OK,
            "analysis": {"key_moments": moments, "visual_hook": "x"},
        }
        out = format_visual_context_for_prompt(result)
        # m0..m7 présents, m8+ absents
        assert "m0" in out
        assert "m7" in out
        assert "m8" not in out


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 can_consume — plan gating + quota
# ═══════════════════════════════════════════════════════════════════════════════


def _make_user(plan: str, user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    return user


def _make_db_with_quota(count_value):
    """Mock AsyncSession qui renvoie une row quota avec count=count_value."""
    db = AsyncMock()
    quota_row = SimpleNamespace(user_id=1, period="2026-05", count=count_value)

    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=quota_row)

    db.execute = AsyncMock(return_value=result_mock)
    db.flush = AsyncMock()
    return db


def _make_db_with_no_quota_row():
    """Mock qui renvoie None la première fois (création requise), puis row avec count=0."""
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=None)
    db.execute = AsyncMock(return_value=result_mock)
    db.flush = AsyncMock()
    return db


class TestCanConsume:
    @pytest.mark.asyncio
    async def test_free_refused(self):
        from videos.visual_integration import STATUS_PLAN_NOT_ALLOWED, can_consume

        db = AsyncMock()
        user = _make_user("free")
        allowed, reason = await can_consume(db, user)
        assert allowed is False
        assert reason == STATUS_PLAN_NOT_ALLOWED

    @pytest.mark.asyncio
    async def test_expert_unlimited_no_db_check(self):
        from videos.visual_integration import STATUS_OK, can_consume

        db = AsyncMock()
        user = _make_user("expert")
        allowed, reason = await can_consume(db, user)
        assert allowed is True
        assert reason == STATUS_OK
        # Pas d'appel DB pour Expert (illimité)
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_pro_under_quota_allowed(self):
        from videos.visual_integration import STATUS_OK, can_consume

        db = _make_db_with_quota(count_value=10)
        user = _make_user("pro")
        allowed, reason = await can_consume(db, user)
        assert allowed is True
        assert reason == STATUS_OK

    @pytest.mark.asyncio
    async def test_pro_at_quota_limit_refused(self):
        from videos.visual_integration import STATUS_QUOTA_EXCEEDED, can_consume

        db = _make_db_with_quota(count_value=30)  # Pile au cap
        user = _make_user("pro")
        allowed, reason = await can_consume(db, user)
        assert allowed is False
        assert reason == STATUS_QUOTA_EXCEEDED

    @pytest.mark.asyncio
    async def test_pro_no_row_yet_allowed(self):
        from videos.visual_integration import STATUS_OK, can_consume

        db = _make_db_with_no_quota_row()
        user = _make_user("pro")
        allowed, reason = await can_consume(db, user)
        assert allowed is True
        assert reason == STATUS_OK


# ═══════════════════════════════════════════════════════════════════════════════
# 🔌 maybe_enrich_with_visual — failure & happy paths
# ═══════════════════════════════════════════════════════════════════════════════


class TestMaybeEnrichWithVisual:
    @pytest.mark.asyncio
    async def test_flag_off_returns_disabled(self):
        from videos.visual_integration import (
            STATUS_DISABLED,
            maybe_enrich_with_visual,
        )

        db = AsyncMock()
        user = _make_user("pro")
        result = await maybe_enrich_with_visual(
            db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", flag_enabled=False
        )
        assert result["status"] == STATUS_DISABLED

    @pytest.mark.asyncio
    async def test_free_plan_returns_plan_not_allowed(self):
        from videos.visual_integration import (
            STATUS_PLAN_NOT_ALLOWED,
            maybe_enrich_with_visual,
        )

        db = AsyncMock()
        user = _make_user("free")
        result = await maybe_enrich_with_visual(
            db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )
        assert result["status"] == STATUS_PLAN_NOT_ALLOWED

    @pytest.mark.asyncio
    async def test_unsupported_platform_returns_not_supported(self, monkeypatch):
        """Vimeo (et tout host non YouTube/TikTok) → STATUS_NOT_SUPPORTED."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_NOT_SUPPORTED

        db = AsyncMock()
        user = _make_user("expert")  # Bypass quota
        result = await vi.maybe_enrich_with_visual(
            db, user, "https://vimeo.com/123456789"
        )
        assert result["status"] == STATUS_NOT_SUPPORTED

    @pytest.mark.asyncio
    async def test_quota_exceeded(self):
        from videos.visual_integration import (
            STATUS_QUOTA_EXCEEDED,
            maybe_enrich_with_visual,
        )

        db = _make_db_with_quota(count_value=30)
        user = _make_user("pro")
        result = await maybe_enrich_with_visual(
            db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )
        assert result["status"] == STATUS_QUOTA_EXCEEDED

    @pytest.mark.asyncio
    async def test_extract_failed(self, monkeypatch):
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_EXTRACT_FAILED

        db = AsyncMock()
        user = _make_user("expert")

        async def fake_extract(*args, **kwargs):
            return None

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)

        result = await vi.maybe_enrich_with_visual(
            db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )
        assert result["status"] == STATUS_EXTRACT_FAILED
        assert result["video_id"] == "dQw4w9WgXcQ"

    @pytest.mark.asyncio
    async def test_happy_path(self, monkeypatch):
        """Expert plan → mode='expert', credits=3, max_frames_cap=64."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_OK
        from videos.frame_extractor import FrameExtractionResult
        from videos.visual_analyzer import VisualAnalysis

        db = _make_db_with_no_quota_row()
        user = _make_user("expert")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake",
            frame_paths=["/tmp/fake/f1.jpg", "/tmp/fake/f2.jpg"],
            frame_timestamps=[1.0, 2.0],
            duration_s=120.0,
            fps_used=0.5,
            frame_count=2,
            width=320,
            long_video_warning=False,
        )

        extract_kwargs = {}

        async def fake_extract(*args, **kwargs):
            extract_kwargs.update(kwargs)
            return fake_extraction

        fake_extraction.cleanup = MagicMock()

        analyze_kwargs = {}

        async def fake_analyze(*args, **kwargs):
            analyze_kwargs.update(kwargs)
            return VisualAnalysis(
                visual_hook="hook visuel test",
                visual_structure="talking_head",
                key_moments=[{"timestamp_s": 1.0, "description": "x", "type": "hook"}],
                visible_text="text",
                summary_visual="résumé test",
                model_used="pixtral-large-2411",
                frames_analyzed=2,
                frames_downsampled=False,
            )

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        result = await vi.maybe_enrich_with_visual(
            db,
            user,
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            transcript_excerpt="Hello world",
        )

        assert result["status"] == STATUS_OK
        assert result["video_id"] == "dQw4w9WgXcQ"
        assert result["platform"] == "youtube"
        assert result["visual_mode"] == "expert"
        assert result["frame_count"] == 2
        assert result["model_used"] == "pixtral-large-2411"
        assert result["credits_consumed"] == 3
        assert result["analysis"]["visual_structure"] == "talking_head"
        assert "elapsed_s" in result
        # Mode 'expert' propagé à l'extraction storyboard et au cap analyzer
        assert extract_kwargs.get("mode") == "expert"
        assert analyze_kwargs.get("max_frames_cap") == 64
        fake_extraction.cleanup.assert_called_once()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 _detect_visual_platform — routing par URL
# ═══════════════════════════════════════════════════════════════════════════════


class TestDetectVisualPlatform:
    def test_youtube_watch_url(self):
        from videos.visual_integration import _detect_visual_platform

        assert _detect_visual_platform("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "youtube"

    def test_youtube_short_url(self):
        from videos.visual_integration import _detect_visual_platform

        assert _detect_visual_platform("https://youtu.be/dQw4w9WgXcQ") == "youtube"

    def test_youtube_shorts_url(self):
        from videos.visual_integration import _detect_visual_platform

        assert _detect_visual_platform("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "youtube"

    def test_tiktok_canonical_url(self):
        from videos.visual_integration import _detect_visual_platform

        assert _detect_visual_platform("https://www.tiktok.com/@user/video/12345") == "tiktok"

    def test_tiktok_short_url(self):
        from videos.visual_integration import _detect_visual_platform

        assert _detect_visual_platform("https://vm.tiktok.com/ABCDE/") == "tiktok"

    def test_vimeo_returns_unknown(self):
        from videos.visual_integration import _detect_visual_platform

        assert _detect_visual_platform("https://vimeo.com/123456") == "unknown"

    def test_empty_url_returns_unknown(self):
        from videos.visual_integration import _detect_visual_platform

        assert _detect_visual_platform("") == "unknown"


# ═══════════════════════════════════════════════════════════════════════════════
# 🎵 maybe_enrich_with_visual — branche TikTok
# ═══════════════════════════════════════════════════════════════════════════════


class TestMaybeEnrichWithVisualTiktok:
    @pytest.mark.asyncio
    async def test_tiktok_extract_failed(self, monkeypatch):
        """Si _extract_tiktok_visual_frames retourne None (download/ffmpeg KO) → EXTRACT_FAILED."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_EXTRACT_FAILED

        db = AsyncMock()
        user = _make_user("expert")

        async def fake_tiktok_extract(*args, **kwargs):
            return None

        monkeypatch.setattr(vi, "_extract_tiktok_visual_frames", fake_tiktok_extract)

        result = await vi.maybe_enrich_with_visual(
            db, user, "https://www.tiktok.com/@khaby.lame/video/7459716872551976210"
        )
        assert result["status"] == STATUS_EXTRACT_FAILED
        assert result["platform"] == "tiktok"

    @pytest.mark.asyncio
    async def test_tiktok_happy_path(self, monkeypatch):
        """TikTok download + frame extraction OK → analyse Mistral → STATUS_OK avec platform=tiktok."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_OK
        from videos.frame_extractor import FrameExtractionResult
        from videos.visual_analyzer import VisualAnalysis

        db = _make_db_with_no_quota_row()
        user = _make_user("expert")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake_tk",
            frame_paths=["/tmp/fake_tk/f1.jpg", "/tmp/fake_tk/f2.jpg", "/tmp/fake_tk/f3.jpg"],
            frame_timestamps=[0.5, 5.0, 12.0],
            duration_s=15.0,
            fps_used=0.2,
            frame_count=3,
            width=512,
            long_video_warning=False,
        )
        fake_extraction.cleanup = MagicMock()

        async def fake_tiktok_extract(*args, **kwargs):
            return fake_extraction

        async def fake_analyze(*args, **kwargs):
            return VisualAnalysis(
                visual_hook="Plan TikTok punchy",
                visual_structure="vertical_pov",
                key_moments=[{"timestamp_s": 0.5, "description": "Reveal", "type": "hook"}],
                visible_text="learnfromkhaby",
                summary_visual="Vidéo verticale comique sans dialogue",
                model_used="pixtral-large-2411",
                frames_analyzed=3,
                frames_downsampled=False,
            )

        monkeypatch.setattr(vi, "_extract_tiktok_visual_frames", fake_tiktok_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        result = await vi.maybe_enrich_with_visual(
            db,
            user,
            "https://www.tiktok.com/@khaby.lame/video/7459716872551976210",
            transcript_excerpt="(comédie silencieuse)",
        )

        assert result["status"] == STATUS_OK
        assert result["platform"] == "tiktok"
        assert result["frame_count"] == 3
        assert result["model_used"] == "pixtral-large-2411"
        assert result["analysis"]["visual_structure"] == "vertical_pov"
        fake_extraction.cleanup.assert_called_once()

    @pytest.mark.asyncio
    async def test_tiktok_extract_uses_id_from_url(self, monkeypatch):
        """Vérifie que l'extraction reçoit bien l'ID vidéo TikTok depuis l'URL."""
        from videos import visual_integration as vi

        db = AsyncMock()
        user = _make_user("expert")

        captured = {}

        async def fake_tiktok_extract(url, video_id, *, mode="default", log_tag=""):
            captured["url"] = url
            captured["video_id"] = video_id
            captured["mode"] = mode
            return None  # Trigger EXTRACT_FAILED, peu importe ici

        monkeypatch.setattr(vi, "_extract_tiktok_visual_frames", fake_tiktok_extract)

        await vi.maybe_enrich_with_visual(
            db, user, "https://www.tiktok.com/@khaby.lame/video/7459716872551976210"
        )

        assert captured["url"] == "https://www.tiktok.com/@khaby.lame/video/7459716872551976210"
        assert captured["video_id"] == "7459716872551976210"
        assert captured["mode"] == "expert"  # User Expert → mode expert propagé


# ═══════════════════════════════════════════════════════════════════════════════
# 🎚️ Mode par plan + crédits différenciés
# ═══════════════════════════════════════════════════════════════════════════════


class TestVisualModeByPlan:
    """Vérifie que le plan utilisateur sélectionne le bon mode + bon cap + bons crédits."""

    def test_select_mode_for_plan_helper(self):
        from videos.visual_integration import _select_mode_for_plan

        assert _select_mode_for_plan("expert") == "expert"
        assert _select_mode_for_plan("EXPERT") == "expert"
        assert _select_mode_for_plan("pro") == "default"
        assert _select_mode_for_plan("starter") == "default"
        assert _select_mode_for_plan("plus") == "default"
        assert _select_mode_for_plan(None) == "default"
        assert _select_mode_for_plan("free") == "default"  # Free filtré en amont par can_consume

    def test_constants_consistency(self):
        from videos.visual_integration import (
            MAX_FRAMES_CAP_BY_MODE,
            VISUAL_CREDITS_COST,
            VISUAL_CREDITS_COST_BY_MODE,
        )

        assert MAX_FRAMES_CAP_BY_MODE["default"] == 24
        assert MAX_FRAMES_CAP_BY_MODE["expert"] == 64
        assert VISUAL_CREDITS_COST_BY_MODE["default"] == 2
        assert VISUAL_CREDITS_COST_BY_MODE["expert"] == 3
        # Rétro-compat : VISUAL_CREDITS_COST pointe sur la valeur 'default'
        assert VISUAL_CREDITS_COST == VISUAL_CREDITS_COST_BY_MODE["default"]

    @pytest.mark.asyncio
    async def test_pro_uses_default_mode_and_low_cap(self, monkeypatch):
        """Pro plan → mode='default', credits=2, max_frames_cap=24."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_OK
        from videos.frame_extractor import FrameExtractionResult
        from videos.visual_analyzer import VisualAnalysis

        db = _make_db_with_no_quota_row()
        user = _make_user("pro")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake_pro",
            frame_paths=["/tmp/fake_pro/f1.jpg"],
            frame_timestamps=[0.5],
            duration_s=60.0,
            fps_used=0.2,
            frame_count=1,
            width=320,
            long_video_warning=False,
        )
        fake_extraction.cleanup = MagicMock()

        extract_kwargs = {}
        analyze_kwargs = {}

        async def fake_extract(*args, **kwargs):
            extract_kwargs.update(kwargs)
            return fake_extraction

        async def fake_analyze(*args, **kwargs):
            analyze_kwargs.update(kwargs)
            return VisualAnalysis(
                visual_hook="pro hook",
                visual_structure="talking_head",
                model_used="pixtral-large-2411",
                frames_analyzed=1,
            )

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        result = await vi.maybe_enrich_with_visual(
            db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )

        assert result["status"] == STATUS_OK
        assert result["visual_mode"] == "default"
        assert result["credits_consumed"] == 2
        assert extract_kwargs.get("mode") == "default"
        assert analyze_kwargs.get("max_frames_cap") == 24

    @pytest.mark.asyncio
    async def test_legacy_starter_uses_default_mode(self, monkeypatch):
        """Plan legacy 'starter' (pré-pricing v2) → mode='default'."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_OK
        from videos.frame_extractor import FrameExtractionResult
        from videos.visual_analyzer import VisualAnalysis

        db = _make_db_with_quota(count_value=10)  # sous quota 30
        user = _make_user("starter")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake_starter",
            frame_paths=["/tmp/fake_starter/f1.jpg"],
            frame_timestamps=[0.5],
            duration_s=30.0,
            fps_used=0.2,
            frame_count=1,
            width=320,
            long_video_warning=False,
        )
        fake_extraction.cleanup = MagicMock()

        async def fake_extract(*args, **kwargs):
            return fake_extraction

        async def fake_analyze(*args, **kwargs):
            return VisualAnalysis(model_used="pixtral-large-2411", frames_analyzed=1)

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        result = await vi.maybe_enrich_with_visual(
            db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )

        assert result["status"] == STATUS_OK
        assert result["visual_mode"] == "default"
        assert result["credits_consumed"] == 2


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 Mode ULTRA opt-in (Sprint C 2026-05-11)
# ═══════════════════════════════════════════════════════════════════════════════


class TestUltraModeConstants:
    """Vérifie que le mode ultra est correctement câblé dans les constantes."""

    def test_ultra_in_credits_cost_map(self):
        from videos.visual_integration import VISUAL_CREDITS_COST_BY_MODE

        assert VISUAL_CREDITS_COST_BY_MODE["ultra"] == 4
        assert (
            VISUAL_CREDITS_COST_BY_MODE["default"]
            < VISUAL_CREDITS_COST_BY_MODE["expert"]
            < VISUAL_CREDITS_COST_BY_MODE["ultra"]
        )

    def test_ultra_in_max_frames_cap_map(self):
        from videos.visual_integration import MAX_FRAMES_CAP_BY_MODE

        assert MAX_FRAMES_CAP_BY_MODE["ultra"] == 96
        assert (
            MAX_FRAMES_CAP_BY_MODE["default"]
            < MAX_FRAMES_CAP_BY_MODE["expert"]
            < MAX_FRAMES_CAP_BY_MODE["ultra"]
        )

    def test_ultra_grid_present_in_frame_extractor(self):
        from videos.frame_extractor import FRAME_BUDGET_GRID

        assert "ultra" in FRAME_BUDGET_GRID
        ultra = FRAME_BUDGET_GRID["ultra"]
        # 7 paliers documentés
        assert len(ultra) == 7
        durations = [d for d, _ in ultra]
        frames = [f for _, f in ultra]
        assert durations == [
            1800.0,
            3600.0,
            7200.0,
            10800.0,
            14400.0,
            21600.0,
            float("inf"),
        ]
        assert frames == [16, 24, 32, 48, 64, 80, 96]

    def test_ultra_grid_compute_frame_budget_2h(self):
        """Vidéo 2h exactement → 32 frames en mode ultra."""
        from videos.frame_extractor import compute_frame_budget

        _, target_frames, _ = compute_frame_budget(7200.0, mode="ultra")
        assert target_frames == 32

    def test_ultra_grid_compute_frame_budget_3h(self):
        """Vidéo 3h → palier 48 frames en mode ultra."""
        from videos.frame_extractor import compute_frame_budget

        _, target_frames, _ = compute_frame_budget(10000.0, mode="ultra")
        assert target_frames == 48

    def test_ultra_grid_compute_frame_budget_7h(self):
        """Vidéo 7h → cap 96 frames en mode ultra (palier float inf)."""
        from videos.frame_extractor import compute_frame_budget

        _, target_frames, _ = compute_frame_budget(25200.0, mode="ultra")
        assert target_frames == 96


class TestSelectModeForPlanUltra:
    """Logique d'activation du mode ultra."""

    def test_expert_long_video_flag_off_stays_expert(self, monkeypatch):
        """Expert + vidéo 3h + flag OFF → reste en 'expert'."""
        monkeypatch.setattr("core.config.VISUAL_ULTRA_ENABLED", False, raising=False)
        from videos.visual_integration import _select_mode_for_plan

        assert _select_mode_for_plan("expert", duration_s=10800.0) == "expert"

    def test_expert_long_video_flag_on_returns_ultra(self, monkeypatch):
        """Expert + vidéo >2h + flag ON → 'ultra'."""
        monkeypatch.setattr("core.config.VISUAL_ULTRA_ENABLED", True, raising=False)
        from videos.visual_integration import _select_mode_for_plan

        assert _select_mode_for_plan("expert", duration_s=7300.0) == "ultra"
        assert _select_mode_for_plan("EXPERT", duration_s=14400.0) == "ultra"

    def test_expert_short_video_flag_on_stays_expert(self, monkeypatch):
        """Expert + vidéo ≤2h + flag ON → 'expert' (sous le seuil ultra)."""
        monkeypatch.setattr("core.config.VISUAL_ULTRA_ENABLED", True, raising=False)
        from videos.visual_integration import _select_mode_for_plan

        # Pile au seuil → reste expert (strict supérieur requis)
        assert _select_mode_for_plan("expert", duration_s=7200.0) == "expert"
        assert _select_mode_for_plan("expert", duration_s=3600.0) == "expert"

    def test_expert_no_duration_hint_stays_expert(self, monkeypatch):
        """Expert sans duration_s connue → 'expert' (back-compat)."""
        monkeypatch.setattr("core.config.VISUAL_ULTRA_ENABLED", True, raising=False)
        from videos.visual_integration import _select_mode_for_plan

        assert _select_mode_for_plan("expert", duration_s=None) == "expert"
        assert _select_mode_for_plan("expert") == "expert"

    def test_pro_long_video_flag_on_stays_default(self, monkeypatch):
        """Pro + vidéo très longue + flag ON → 'default' (jamais ultra pour Pro)."""
        monkeypatch.setattr("core.config.VISUAL_ULTRA_ENABLED", True, raising=False)
        from videos.visual_integration import _select_mode_for_plan

        assert _select_mode_for_plan("pro", duration_s=14400.0) == "default"

    def test_ultra_min_duration_threshold_constant(self):
        from videos.visual_integration import ULTRA_MIN_DURATION_S

        # 2 heures = seuil documenté
        assert ULTRA_MIN_DURATION_S == 7200.0


class TestMaybeEnrichUltraPath:
    """Bout-en-bout du flow avec mode ultra activé."""

    @pytest.mark.asyncio
    async def test_ultra_propagates_to_extraction_and_analyzer(self, monkeypatch):
        """Plan Expert + vidéo 3h + flag ON + duration_hint → mode='ultra', cap=96, credits=4."""
        monkeypatch.setattr("core.config.VISUAL_ULTRA_ENABLED", True, raising=False)
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_OK
        from videos.frame_extractor import FrameExtractionResult
        from videos.visual_analyzer import VisualAnalysis

        db = _make_db_with_no_quota_row()
        user = _make_user("expert")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake_ultra",
            frame_paths=[f"/tmp/fake_ultra/f{i}.jpg" for i in range(10)],
            frame_timestamps=[float(i * 1080) for i in range(10)],
            duration_s=10800.0,
            fps_used=0.001,
            frame_count=10,
            width=320,
            long_video_warning=True,
        )
        fake_extraction.cleanup = MagicMock()

        extract_kwargs = {}
        analyze_kwargs = {}

        async def fake_extract(*args, **kwargs):
            extract_kwargs.update(kwargs)
            return fake_extraction

        async def fake_analyze(*args, **kwargs):
            analyze_kwargs.update(kwargs)
            return VisualAnalysis(
                visual_hook="ultra hook",
                visual_structure="long_lecture",
                model_used="pixtral-large-2411",
                frames_analyzed=10,
            )

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        result = await vi.maybe_enrich_with_visual(
            db,
            user,
            "https://www.youtube.com/watch?v=longvideoid1",
            duration_hint=10800.0,
        )

        assert result["status"] == STATUS_OK
        assert result["visual_mode"] == "ultra"
        assert result["credits_consumed"] == 4
        assert extract_kwargs.get("mode") == "ultra"
        assert analyze_kwargs.get("max_frames_cap") == 96

    @pytest.mark.asyncio
    async def test_no_duration_hint_falls_back_to_expert(self, monkeypatch):
        """Pas de duration_hint → expert (pas ultra) même si flag ON."""
        monkeypatch.setattr("core.config.VISUAL_ULTRA_ENABLED", True, raising=False)
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_OK
        from videos.frame_extractor import FrameExtractionResult
        from videos.visual_analyzer import VisualAnalysis

        db = _make_db_with_no_quota_row()
        user = _make_user("expert")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake_no_hint",
            frame_paths=["/tmp/fake_no_hint/f1.jpg"],
            frame_timestamps=[0.0],
            duration_s=10800.0,
            fps_used=0.001,
            frame_count=1,
            width=320,
            long_video_warning=True,
        )
        fake_extraction.cleanup = MagicMock()

        extract_kwargs = {}

        async def fake_extract(*args, **kwargs):
            extract_kwargs.update(kwargs)
            return fake_extraction

        async def fake_analyze(*args, **kwargs):
            return VisualAnalysis(model_used="pixtral-large-2411", frames_analyzed=1)

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        result = await vi.maybe_enrich_with_visual(
            db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )

        assert result["status"] == STATUS_OK
        assert result["visual_mode"] == "expert"
        assert result["credits_consumed"] == 3
        assert extract_kwargs.get("mode") == "expert"


# ═══════════════════════════════════════════════════════════════════════════════
# 📢 Logs WARNING explicites sur tous les silent skips (Sprint C 2026-05-11)
# ═══════════════════════════════════════════════════════════════════════════════


class TestSilentSkipsLogWarning:
    """Vérifie que chaque branche return-silent émet désormais un log WARNING."""

    @pytest.mark.asyncio
    async def test_flag_disabled_logs_warning(self, caplog):
        from videos.visual_integration import (
            STATUS_DISABLED,
            maybe_enrich_with_visual,
        )

        db = AsyncMock()
        user = _make_user("pro")
        with caplog.at_level(logging.WARNING, logger="videos.visual_integration"):
            result = await maybe_enrich_with_visual(
                db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", flag_enabled=False
            )
        assert result["status"] == STATUS_DISABLED
        assert any(
            "reason=disabled" in rec.message
            for rec in caplog.records
            if rec.levelno == logging.WARNING
        )

    @pytest.mark.asyncio
    async def test_free_plan_logs_warning(self, caplog):
        from videos.visual_integration import (
            STATUS_PLAN_NOT_ALLOWED,
            maybe_enrich_with_visual,
        )

        db = AsyncMock()
        user = _make_user("free")
        with caplog.at_level(logging.WARNING, logger="videos.visual_integration"):
            result = await maybe_enrich_with_visual(
                db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            )
        assert result["status"] == STATUS_PLAN_NOT_ALLOWED
        assert any(
            "plan_not_allowed" in rec.message
            for rec in caplog.records
            if rec.levelno == logging.WARNING
        )

    @pytest.mark.asyncio
    async def test_unsupported_platform_logs_warning(self, caplog):
        """Vimeo → STATUS_NOT_SUPPORTED + WARNING émis."""
        from videos.visual_integration import (
            STATUS_NOT_SUPPORTED,
            maybe_enrich_with_visual,
        )

        db = AsyncMock()
        user = _make_user("expert")
        with caplog.at_level(logging.WARNING, logger="videos.visual_integration"):
            result = await maybe_enrich_with_visual(
                db, user, "https://vimeo.com/123456789"
            )
        assert result["status"] == STATUS_NOT_SUPPORTED
        assert any(
            "reason=not_supported" in rec.message
            for rec in caplog.records
            if rec.levelno == logging.WARNING
        )

    @pytest.mark.asyncio
    async def test_extract_failed_logs_warning(self, caplog, monkeypatch):
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_EXTRACT_FAILED

        db = AsyncMock()
        user = _make_user("expert")

        async def fake_extract(*args, **kwargs):
            return None

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)

        with caplog.at_level(logging.WARNING, logger="videos.visual_integration"):
            result = await vi.maybe_enrich_with_visual(
                db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            )
        assert result["status"] == STATUS_EXTRACT_FAILED
        assert any(
            "reason=extract_failed" in rec.message
            for rec in caplog.records
            if rec.levelno == logging.WARNING
        )

    @pytest.mark.asyncio
    async def test_vision_failed_includes_error_field_and_logs(
        self, caplog, monkeypatch
    ):
        """analyze_frames retourne None → STATUS_VISION_FAILED + dict contient
        'frames_attempted' et 'error' + WARNING explicite."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_VISION_FAILED
        from videos.frame_extractor import FrameExtractionResult

        db = _make_db_with_no_quota_row()
        user = _make_user("expert")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake_vf",
            frame_paths=["/tmp/fake_vf/f1.jpg", "/tmp/fake_vf/f2.jpg"],
            frame_timestamps=[1.0, 2.0],
            duration_s=120.0,
            fps_used=0.5,
            frame_count=2,
            width=320,
            long_video_warning=False,
        )
        fake_extraction.cleanup = MagicMock()

        async def fake_extract(*args, **kwargs):
            return fake_extraction

        async def fake_analyze(*args, **kwargs):
            return None

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        with caplog.at_level(logging.WARNING, logger="videos.visual_integration"):
            result = await vi.maybe_enrich_with_visual(
                db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            )

        assert result["status"] == STATUS_VISION_FAILED
        assert result["frames_attempted"] == 2
        assert result["error"] == "all_batches_failed"
        assert any(
            "reason=vision_failed" in rec.message
            for rec in caplog.records
            if rec.levelno == logging.WARNING
        )

    @pytest.mark.asyncio
    async def test_vision_raised_exception_includes_error_message(
        self, caplog, monkeypatch
    ):
        """analyze_frames lève une exception → capturée + propagée dans le dict."""
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_VISION_FAILED
        from videos.frame_extractor import FrameExtractionResult

        db = _make_db_with_no_quota_row()
        user = _make_user("expert")

        fake_extraction = FrameExtractionResult(
            workdir="/tmp/fake_ex",
            frame_paths=["/tmp/fake_ex/f1.jpg"],
            frame_timestamps=[0.5],
            duration_s=10.0,
            fps_used=0.1,
            frame_count=1,
            width=320,
            long_video_warning=False,
        )
        fake_extraction.cleanup = MagicMock()

        async def fake_extract(*args, **kwargs):
            return fake_extraction

        async def fake_analyze(*args, **kwargs):
            raise RuntimeError("Mistral 503 retry exhausted")

        monkeypatch.setattr(vi, "extract_storyboard_frames", fake_extract)
        monkeypatch.setattr(vi, "analyze_frames", fake_analyze)

        with caplog.at_level(logging.WARNING, logger="videos.visual_integration"):
            result = await vi.maybe_enrich_with_visual(
                db, user, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            )

        assert result["status"] == STATUS_VISION_FAILED
        assert "Mistral 503" in result.get("error", "")
        assert result["frames_attempted"] == 1
        fake_extraction.cleanup.assert_called_once()
