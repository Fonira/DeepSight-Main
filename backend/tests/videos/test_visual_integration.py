"""
Tests pour videos/visual_integration.py — Phase 2 backend integration.

Couvre :
- Helpers purs : _current_period, get_quota_for_plan, format_visual_context_for_prompt
- can_consume : Free refusé, Expert OK illimité, Pro avec/sans quota dépassé
- maybe_enrich_with_visual : flag off, not_youtube, plan_not_allowed, happy path
"""

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
    async def test_non_youtube_url_returns_not_youtube(self, monkeypatch):
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_NOT_YOUTUBE

        db = AsyncMock()
        user = _make_user("expert")  # Bypass quota
        result = await vi.maybe_enrich_with_visual(
            db, user, "https://www.tiktok.com/@user/video/123"
        )
        assert result["status"] == STATUS_NOT_YOUTUBE

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
        from videos import visual_integration as vi
        from videos.visual_integration import STATUS_OK
        from videos.frame_extractor import FrameExtractionResult
        from videos.visual_analyzer import VisualAnalysis

        db = _make_db_with_no_quota_row()
        user = _make_user("expert")  # Pas de quota check besides initial allowed

        # Mock extraction
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

        async def fake_extract(*args, **kwargs):
            return fake_extraction

        # Patch cleanup pour ne pas tenter de supprimer un dossier inexistant
        fake_extraction.cleanup = MagicMock()

        async def fake_analyze(*args, **kwargs):
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
        assert result["frame_count"] == 2
        assert result["model_used"] == "pixtral-large-2411"
        assert result["credits_consumed"] == 2
        assert result["analysis"]["visual_structure"] == "talking_head"
        assert "elapsed_s" in result
        # cleanup a été appelé pour purger les frames
        fake_extraction.cleanup.assert_called_once()
