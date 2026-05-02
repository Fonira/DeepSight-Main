"""
Tests for plan-aware STT duration routing (Mistral-First Phase 1, Task 1.2).

Verifies that get_max_stt_duration() returns the correct cap per plan tier:
- free / starter      → 1200s (20 min)
- student / pro       → 2400s (40 min)
- expert              → 3600s (60 min)
- unknown / None / "" → falls back to free
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))


class TestGetMaxSttDuration:
    """Plan-aware duration cap routing for Voxtral STT."""

    def test_free_plan_returns_1200(self):
        from core.config import get_max_stt_duration

        assert get_max_stt_duration("free") == 1200

    def test_starter_plan_returns_1200(self):
        from core.config import get_max_stt_duration

        # Legacy starter tier is mapped to free duration cap
        assert get_max_stt_duration("starter") == 1200

    def test_student_plan_returns_2400(self):
        from core.config import get_max_stt_duration

        # Student promo plan benefits from Pro-level duration cap
        assert get_max_stt_duration("student") == 2400

    def test_pro_plan_returns_2400(self):
        from core.config import get_max_stt_duration

        assert get_max_stt_duration("pro") == 2400

    def test_expert_plan_returns_3600(self):
        from core.config import get_max_stt_duration

        assert get_max_stt_duration("expert") == 3600

    def test_unknown_plan_falls_back_to_free(self):
        from core.config import get_max_stt_duration

        assert get_max_stt_duration("enterprise") == 1200
        assert get_max_stt_duration("foobar") == 1200

    def test_none_falls_back_to_free(self):
        from core.config import get_max_stt_duration

        assert get_max_stt_duration(None) == 1200

    def test_empty_string_falls_back_to_free(self):
        from core.config import get_max_stt_duration

        assert get_max_stt_duration("") == 1200

    def test_case_insensitive(self):
        from core.config import get_max_stt_duration

        assert get_max_stt_duration("PRO") == 2400
        assert get_max_stt_duration("Expert") == 3600
        assert get_max_stt_duration("FREE") == 1200

    def test_constants_exposed(self):
        """Constants should be accessible at module level for direct override."""
        from core.config import (
            MAX_DURATION_FOR_STT_EXPERT,
            MAX_DURATION_FOR_STT_FREE,
            MAX_DURATION_FOR_STT_PRO,
        )

        assert MAX_DURATION_FOR_STT_FREE == 1200
        assert MAX_DURATION_FOR_STT_PRO == 2400
        assert MAX_DURATION_FOR_STT_EXPERT == 3600

    def test_pro_is_double_free(self):
        """Document the policy: Pro = 2x Free duration cap."""
        from core.config import MAX_DURATION_FOR_STT_FREE, MAX_DURATION_FOR_STT_PRO

        assert MAX_DURATION_FOR_STT_PRO == MAX_DURATION_FOR_STT_FREE * 2

    def test_expert_is_triple_free(self):
        """Document the policy: Expert = 3x Free duration cap."""
        from core.config import MAX_DURATION_FOR_STT_EXPERT, MAX_DURATION_FOR_STT_FREE

        assert MAX_DURATION_FOR_STT_EXPERT == MAX_DURATION_FOR_STT_FREE * 3


# =============================================================================
# Phase 1.5 short-circuit (Voxtral before Phase 2 yt-dlp when no captions)
# =============================================================================


class TestVoxtralShortCircuit:
    """Verify that Voxtral STT is attempted as Phase 1.5 short-circuit, before
    Phase 2 yt-dlp methods, when Supadata + Phase 1 parallel methods all fail."""

    def test_short_circuit_present_in_source(self):
        """The Phase 1.5 block must exist between Phase 1 and Phase 2."""
        import inspect

        from transcripts import youtube

        source = inspect.getsource(youtube._get_transcript_with_timestamps_inner)
        assert "PHASE 1.5" in source, "Phase 1.5 short-circuit block not found"
        assert "short-circuit" in source.lower(), "short-circuit keyword missing in source"

    def test_short_circuit_runs_before_phase2(self):
        """Phase 1.5 (Voxtral short-circuit) must appear before Phase 2 yt-dlp."""
        import inspect

        from transcripts import youtube

        source = inspect.getsource(youtube._get_transcript_with_timestamps_inner)
        sc_pos = source.find("PHASE 1.5")
        phase2_pos = source.find("PHASE 2: yt-dlp")
        assert sc_pos > 0, "Phase 1.5 not found"
        assert phase2_pos > 0, "Phase 2 yt-dlp marker not found"
        assert sc_pos < phase2_pos, "Phase 1.5 short-circuit must run BEFORE Phase 2 yt-dlp"

    def test_short_circuit_logs_no_captions_message(self):
        """The short-circuit must log explicitly that captions are missing."""
        import inspect

        from transcripts import youtube

        source = inspect.getsource(youtube._get_transcript_with_timestamps_inner)
        assert "No captions detected by Supadata" in source

    def test_short_circuit_uses_plan_aware_cap(self):
        """Phase 1.5 must respect the plan-aware duration cap (not always run)."""
        import inspect

        from transcripts import youtube

        source = inspect.getsource(youtube._get_transcript_with_timestamps_inner)
        # The short-circuit block must use _get_max_stt_duration (plan-aware)
        assert "_get_max_stt_duration" in source

    def test_get_transcript_with_timestamps_accepts_user_plan(self):
        """Public API must accept optional user_plan kwarg (backward compat)."""
        import inspect

        from transcripts.youtube import get_transcript_with_timestamps

        sig = inspect.signature(get_transcript_with_timestamps)
        assert "user_plan" in sig.parameters, "user_plan kwarg missing from public function"
        # Must default to None for backward compat with existing callers
        assert sig.parameters["user_plan"].default is None
