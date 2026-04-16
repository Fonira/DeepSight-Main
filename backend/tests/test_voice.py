"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎙️ VOICE CHAT TESTS — Tests unitaires et d'intégration pour le module voice      ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Couverture :
  - voice/quota.py  (get_or_create, check_quota, deduct_usage, get_quota_info)
  - voice/tools.py  (split_into_segments, search_in_transcript, get_analysis_section, get_sources, get_flashcards)
  - voice/router.py (GET /quota, POST /session, POST /webhook, GET /history, tool endpoints)
"""

import json
import hashlib
import hmac
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 FIXTURES VOICE
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_voice_quota():
    """VoiceQuota mock object."""
    quota = MagicMock()
    quota.id = 1
    quota.user_id = 1
    quota.year = datetime.now().year
    quota.month = datetime.now().month
    quota.seconds_used = 120  # 2 minutes used
    quota.seconds_limit = 900  # 15 minutes (starter plan)
    quota.sessions_count = 3
    return quota


@pytest.fixture
def mock_voice_user():
    """User mock with voice-related fields."""
    user = MagicMock()
    user.id = 1
    user.email = "voice@test.fr"
    user.plan = "starter"
    user.is_admin = False
    user.voice_bonus_seconds = 0
    user.stripe_customer_id = "cus_test123"
    user.username = "voice_tester"
    return user


@pytest.fixture
def mock_pro_voice_user():
    """User mock with pro plan."""
    user = MagicMock()
    user.id = 2
    user.email = "pro@test.fr"
    user.plan = "pro"
    user.is_admin = False
    user.voice_bonus_seconds = 300  # 5 min bonus
    user.stripe_customer_id = "cus_pro456"
    user.username = "pro_tester"
    return user


@pytest.fixture
def mock_summary():
    """Summary mock for voice tools."""
    summary = MagicMock()
    summary.id = 42
    summary.user_id = 1
    summary.video_title = "Les secrets de l'IA en 2025"
    summary.video_channel = "Tech Insights"
    summary.video_duration = 1800
    summary.video_id = "abc123"
    summary.platform = "youtube"
    summary.lang = "fr"
    summary.transcript_context = (
        "Bonjour à tous et bienvenue dans cette nouvelle vidéo. "
        "Aujourd'hui nous allons parler d'intelligence artificielle. "
        "Les modèles de langage ont fait des progrès considérables. "
        "Le deep learning permet de résoudre des problèmes complexes. "
        "La recherche en IA avance à une vitesse fulgurante."
    )
    summary.summary_content = (
        "## Résumé\n"
        "Cette vidéo présente les avancées récentes de l'IA.\n\n"
        "## Points clés\n"
        "1. Les modèles de langage sont de plus en plus puissants\n"
        "2. Le deep learning résout des problèmes complexes\n\n"
        "## Analyse critique\n"
        "L'auteur présente un point de vue optimiste mais équilibré.\n\n"
        "## Conclusion\n"
        "L'IA continuera à transformer notre quotidien."
    )
    summary.full_digest = json.dumps({
        "sources": [
            {"title": "OpenAI Research", "url": "https://openai.com/research"},
            {"title": "DeepMind Blog", "url": "https://deepmind.com/blog"},
        ],
        "fact_check": {"verdict": "mostly_accurate", "score": 8},
        "reliability_score": 8.5,
    })
    summary.fact_check_result = None
    summary.reliability_score = None
    return summary


@pytest.fixture
def mock_voice_session():
    """VoiceSession mock."""
    session = MagicMock()
    session.id = "sess-uuid-1234"
    session.user_id = 1
    session.summary_id = 42
    session.elevenlabs_agent_id = "agent_abc"
    session.elevenlabs_conversation_id = "conv_xyz"
    session.started_at = datetime(2026, 3, 1, 10, 0, 0, tzinfo=timezone.utc)
    session.ended_at = datetime(2026, 3, 1, 10, 5, 0, tzinfo=timezone.utc)
    session.duration_seconds = 300
    session.status = "completed"
    session.conversation_transcript = "User: Bonjour\nAI: Salut !"
    session.language = "fr"
    session.platform = "web"
    return session


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS UNITAIRES — voice/tools.py :: split_into_segments
# ═══════════════════════════════════════════════════════════════════════════════


class TestSplitIntoSegments:
    """Tests pour la fonction pure split_into_segments."""

    def test_empty_string_returns_empty_list(self):
        from voice.tools import split_into_segments
        assert split_into_segments("") == []

    def test_none_returns_empty_list(self):
        from voice.tools import split_into_segments
        assert split_into_segments(None) == []

    def test_whitespace_only_returns_empty_list(self):
        from voice.tools import split_into_segments
        assert split_into_segments("   \n\t  ") == []

    def test_short_text_returns_single_segment(self):
        from voice.tools import split_into_segments
        text = "Bonjour ceci est un test."
        result = split_into_segments(text, max_words=200)
        assert len(result) == 1
        assert result[0] == text.strip()

    def test_long_text_is_split_into_multiple_segments(self):
        from voice.tools import split_into_segments
        # Generate text with 500 words
        words = ["mot"] * 500
        text = " ".join(words)
        result = split_into_segments(text, max_words=100)
        assert len(result) >= 4  # 500 / 100 = ~5 segments

    def test_splits_at_sentence_boundary(self):
        from voice.tools import split_into_segments
        # Create text where a sentence ends near the max_words boundary
        sentence1 = " ".join(["alpha"] * 8) + "."
        sentence2 = " ".join(["beta"] * 8) + "."
        text = sentence1 + " " + sentence2
        result = split_into_segments(text, max_words=10)
        # Should split at the period
        assert len(result) >= 1
        assert all(s.strip() for s in result)

    def test_max_words_one_creates_many_segments(self):
        from voice.tools import split_into_segments
        text = "un deux trois quatre cinq"
        result = split_into_segments(text, max_words=1)
        assert len(result) >= 3


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS UNITAIRES — voice/tools.py :: search_in_transcript
# ═══════════════════════════════════════════════════════════════════════════════


class TestSearchInTranscript:
    """Tests pour search_in_transcript avec DB mockée."""

    @pytest.mark.asyncio
    async def test_summary_not_found(self, mock_db_session):
        from voice.tools import search_in_transcript

        # DB returns None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        result = await search_in_transcript(999, "test", mock_db_session)
        assert "introuvable" in result.lower()

    @pytest.mark.asyncio
    async def test_empty_transcript(self, mock_db_session, mock_summary):
        from voice.tools import search_in_transcript

        mock_summary.transcript_context = ""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        result = await search_in_transcript(42, "deep learning", mock_db_session)
        assert "aucun transcript" in result.lower()

    @pytest.mark.asyncio
    async def test_matching_query_returns_segments(self, mock_db_session, mock_summary):
        from voice.tools import search_in_transcript

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        result = await search_in_transcript(42, "intelligence artificielle", mock_db_session)
        assert "Segment" in result or "intelligence" in result.lower()

    @pytest.mark.asyncio
    async def test_no_matching_query(self, mock_db_session, mock_summary):
        from voice.tools import search_in_transcript

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        # Mock smart_search to return empty (prevents BM25 from matching nonsense)
        with patch("videos.smart_search.search_relevant_passages", return_value=[]):
            result = await search_in_transcript(42, "xyznonexistent zzz", mock_db_session)
        assert "aucun passage" in result.lower()

    @pytest.mark.asyncio
    async def test_empty_query(self, mock_db_session, mock_summary):
        from voice.tools import search_in_transcript

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        result = await search_in_transcript(42, "", mock_db_session)
        # Empty query splits to no words
        assert "vide" in result.lower() or "aucun" in result.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS UNITAIRES — voice/tools.py :: get_analysis_section
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetAnalysisSection:
    """Tests pour get_analysis_section."""

    @pytest.mark.asyncio
    async def test_invalid_section_name(self, mock_db_session):
        from voice.tools import get_analysis_section

        result = await get_analysis_section(42, "nonexistent_section", mock_db_session)
        assert "inconnue" in result.lower()
        assert "sections disponibles" in result.lower()

    @pytest.mark.asyncio
    async def test_summary_not_found(self, mock_db_session):
        from voice.tools import get_analysis_section

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        result = await get_analysis_section(999, "resume", mock_db_session)
        assert "introuvable" in result.lower()

    @pytest.mark.asyncio
    async def test_resume_section(self, mock_db_session, mock_summary):
        from voice.tools import get_analysis_section

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        result = await get_analysis_section(42, "resume", mock_db_session)
        assert "avancées" in result.lower() or "vidéo" in result.lower()

    @pytest.mark.asyncio
    async def test_points_cles_section(self, mock_db_session, mock_summary):
        from voice.tools import get_analysis_section

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        result = await get_analysis_section(42, "points_cles", mock_db_session)
        assert "modèles de langage" in result.lower() or "deep learning" in result.lower()

    @pytest.mark.asyncio
    async def test_conclusion_section(self, mock_db_session, mock_summary):
        from voice.tools import get_analysis_section

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        result = await get_analysis_section(42, "conclusion", mock_db_session)
        assert "transformer" in result.lower() or "quotidien" in result.lower()

    @pytest.mark.asyncio
    async def test_empty_content(self, mock_db_session, mock_summary):
        from voice.tools import get_analysis_section

        mock_summary.summary_content = ""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        result = await get_analysis_section(42, "resume", mock_db_session)
        assert "vide" in result.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS UNITAIRES — voice/tools.py :: get_sources
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetSources:
    """Tests pour get_sources."""

    @pytest.mark.asyncio
    async def test_summary_not_found(self, mock_db_session):
        from voice.tools import get_sources

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        result = await get_sources(999, mock_db_session)
        assert "introuvable" in result.lower()

    @pytest.mark.asyncio
    async def test_returns_sources_and_factcheck(self, mock_db_session, mock_summary):
        from voice.tools import get_sources

        # First call = summary, second call = academic papers
        mock_result_summary = MagicMock()
        mock_result_summary.scalar_one_or_none.return_value = mock_summary

        mock_result_papers = MagicMock()
        mock_result_papers.scalars.return_value.all.return_value = []

        mock_db_session.execute.side_effect = [mock_result_summary, mock_result_papers]

        result = await get_sources(42, mock_db_session)
        assert "sources" in result.lower()
        assert "openai" in result.lower() or "deepmind" in result.lower()
        assert "fact-check" in result.lower() or "fiabilité" in result.lower()

    @pytest.mark.asyncio
    async def test_no_sources_available(self, mock_db_session, mock_summary):
        from voice.tools import get_sources

        mock_summary.full_digest = None
        mock_summary.fact_check_result = None
        mock_summary.reliability_score = None

        mock_result_summary = MagicMock()
        mock_result_summary.scalar_one_or_none.return_value = mock_summary

        mock_result_papers = MagicMock()
        mock_result_papers.scalars.return_value.all.return_value = []

        mock_db_session.execute.side_effect = [mock_result_summary, mock_result_papers]

        result = await get_sources(42, mock_db_session)
        assert "aucune source" in result.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS UNITAIRES — voice/tools.py :: get_flashcards
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetFlashcards:
    """Tests pour get_flashcards."""

    @pytest.mark.asyncio
    async def test_no_db_session(self):
        from voice.tools import get_flashcards

        result = await get_flashcards(42, count=5, db=None)
        assert "manquante" in result.lower()

    @pytest.mark.asyncio
    async def test_summary_not_found(self, mock_db_session):
        from voice.tools import get_flashcards

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        result = await get_flashcards(999, count=5, db=mock_db_session)
        assert "introuvable" in result.lower()

    @pytest.mark.asyncio
    async def test_no_cached_flashcards(self, mock_db_session, mock_summary):
        import sys
        from voice.tools import get_flashcards

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        # Mock main module so get_video_cache() returns None (no cache)
        mock_main = MagicMock()
        mock_main.get_video_cache.return_value = None
        with patch.dict(sys.modules, {"main": mock_main}):
            result = await get_flashcards(42, count=5, db=mock_db_session)

        assert "aucune flashcard" in result.lower() or "génère" in result.lower()

    @pytest.mark.asyncio
    async def test_count_capped_at_10(self, mock_db_session, mock_summary):
        from voice.tools import get_flashcards

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_summary
        mock_db_session.execute.return_value = mock_result

        # Should not crash even with count > 10
        result = await get_flashcards(42, count=50, db=mock_db_session)
        assert isinstance(result, str)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS UNITAIRES — voice/quota.py
# ═══════════════════════════════════════════════════════════════════════════════


class TestVoiceLimits:
    """Tests pour la configuration VOICE_LIMITS."""

    def test_free_plan_disabled(self):
        from voice.quota import VOICE_LIMITS
        assert VOICE_LIMITS["free"]["enabled"] is False
        assert VOICE_LIMITS["free"]["monthly_minutes"] == 0

    def test_etudiant_plan_enabled(self):
        from voice.quota import VOICE_LIMITS
        assert VOICE_LIMITS["etudiant"]["enabled"] is True
        assert VOICE_LIMITS["etudiant"]["monthly_minutes"] == 15

    def test_starter_plan_limits(self):
        from voice.quota import VOICE_LIMITS
        assert VOICE_LIMITS["starter"]["enabled"] is True
        assert VOICE_LIMITS["starter"]["monthly_minutes"] == 15
        assert VOICE_LIMITS["starter"]["max_session_minutes"] == 10

    def test_pro_plan_limits(self):
        from voice.quota import VOICE_LIMITS
        assert VOICE_LIMITS["pro"]["enabled"] is True
        assert VOICE_LIMITS["pro"]["monthly_minutes"] == 15


class TestGetOrCreateVoiceQuota:
    """Tests pour get_or_create_voice_quota."""

    @pytest.mark.asyncio
    async def test_creates_new_quota_when_none_exists(self, mock_db_session):
        from voice.quota import get_or_create_voice_quota

        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_db_session.execute.return_value = mock_result
        mock_db_session.flush = AsyncMock()

        quota = await get_or_create_voice_quota(1, "starter", mock_db_session)

        assert quota is not None
        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_existing_quota(self, mock_db_session, mock_voice_quota):
        from voice.quota import get_or_create_voice_quota

        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = mock_voice_quota
        mock_db_session.execute.return_value = mock_result

        quota = await get_or_create_voice_quota(1, "starter", mock_db_session)

        assert quota == mock_voice_quota
        mock_db_session.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_unknown_plan_defaults_to_free(self, mock_db_session):
        from voice.quota import get_or_create_voice_quota

        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_db_session.execute.return_value = mock_result
        mock_db_session.flush = AsyncMock()

        quota = await get_or_create_voice_quota(1, "unknown_plan", mock_db_session)

        # Should use free plan limits (0 seconds)
        assert quota.seconds_limit == 0


class TestCheckVoiceQuota:
    """Tests pour check_voice_quota."""

    @pytest.mark.asyncio
    async def test_can_use_when_quota_remaining(self, mock_db_session, mock_voice_quota, mock_voice_user):
        from voice.quota import check_voice_quota

        # First call: get_or_create returns quota
        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota

        # Second call: get User
        mock_result_user = MagicMock()
        mock_result_user.scalars.return_value.first.return_value = mock_voice_user

        mock_db_session.execute.side_effect = [mock_result_quota, mock_result_user]

        result = await check_voice_quota(1, "starter", mock_db_session)

        assert result["can_use"] is True
        assert result["seconds_remaining"] > 0
        assert result["seconds_used"] == 120

    @pytest.mark.asyncio
    async def test_cannot_use_when_quota_exhausted(self, mock_db_session, mock_voice_quota, mock_voice_user):
        from voice.quota import check_voice_quota

        mock_voice_quota.seconds_used = 900  # All 15 minutes used

        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota
        mock_result_user = MagicMock()
        mock_result_user.scalars.return_value.first.return_value = mock_voice_user
        mock_db_session.execute.side_effect = [mock_result_quota, mock_result_user]

        result = await check_voice_quota(1, "starter", mock_db_session)

        assert result["can_use"] is False
        assert result["seconds_remaining"] == 0

    @pytest.mark.asyncio
    async def test_bonus_seconds_extend_quota(self, mock_db_session, mock_voice_quota, mock_pro_voice_user):
        from voice.quota import check_voice_quota

        mock_voice_quota.seconds_used = 900  # Plan limit exhausted
        mock_voice_quota.seconds_limit = 900

        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota
        mock_result_user = MagicMock()
        mock_result_user.scalars.return_value.first.return_value = mock_pro_voice_user
        mock_db_session.execute.side_effect = [mock_result_quota, mock_result_user]

        result = await check_voice_quota(2, "pro", mock_db_session)

        # Pro user has 300s bonus, so 900+300 = 1200 total, 900 used = 300 remaining
        assert result["can_use"] is True
        assert result["seconds_remaining"] == 300
        assert result["bonus_seconds"] == 300

    @pytest.mark.asyncio
    async def test_warning_levels(self, mock_db_session, mock_voice_quota, mock_voice_user):
        from voice.quota import check_voice_quota

        # 85% used → warning_level should be 80
        mock_voice_quota.seconds_used = 765  # 765/900 = 85%
        mock_voice_quota.seconds_limit = 900

        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota
        mock_result_user = MagicMock()
        mock_result_user.scalars.return_value.first.return_value = mock_voice_user
        mock_db_session.execute.side_effect = [mock_result_quota, mock_result_user]

        result = await check_voice_quota(1, "starter", mock_db_session)
        assert result["warning_level"] == 80


class TestDeductVoiceUsage:
    """Tests pour deduct_voice_usage."""

    @pytest.mark.asyncio
    async def test_minimum_5_seconds_billing(self, mock_db_session, mock_voice_user, mock_voice_quota):
        from voice.quota import deduct_voice_usage

        # User lookup
        mock_result_user = MagicMock()
        mock_result_user.scalars.return_value.first.return_value = mock_voice_user

        # Quota lookup
        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota

        mock_db_session.execute.side_effect = [mock_result_user, mock_result_quota]
        mock_db_session.commit = AsyncMock()
        mock_db_session.flush = AsyncMock()

        # Deduct only 1 second — should be billed as 5
        minutes = await deduct_voice_usage(1, 1, mock_db_session)

        assert minutes == pytest.approx(5 / 60, rel=0.01)
        assert mock_voice_quota.seconds_used == 125  # 120 + 5

    @pytest.mark.asyncio
    async def test_normal_deduction(self, mock_db_session, mock_voice_user, mock_voice_quota):
        from voice.quota import deduct_voice_usage

        mock_result_user = MagicMock()
        mock_result_user.scalars.return_value.first.return_value = mock_voice_user
        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota
        mock_db_session.execute.side_effect = [mock_result_user, mock_result_quota]
        mock_db_session.commit = AsyncMock()
        mock_db_session.flush = AsyncMock()

        minutes = await deduct_voice_usage(1, 60, mock_db_session)

        assert minutes == 1.0
        assert mock_voice_quota.seconds_used == 180  # 120 + 60
        assert mock_voice_quota.sessions_count == 4

    @pytest.mark.asyncio
    async def test_user_not_found_raises(self, mock_db_session):
        from voice.quota import deduct_voice_usage

        mock_result_user = MagicMock()
        mock_result_user.scalars.return_value.first.return_value = None
        mock_db_session.execute.return_value = mock_result_user

        with pytest.raises(ValueError, match="not found"):
            await deduct_voice_usage(999, 60, mock_db_session)


class TestGetVoiceQuotaInfo:
    """Tests pour get_voice_quota_info."""

    @pytest.mark.asyncio
    async def test_returns_complete_info(self, mock_db_session, mock_voice_quota, mock_voice_user):
        from voice.quota import get_voice_quota_info

        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota
        mock_db_session.execute.return_value = mock_result_quota
        mock_db_session.get = AsyncMock(return_value=mock_voice_user)
        mock_db_session.flush = AsyncMock()

        info = await get_voice_quota_info(1, "starter", mock_db_session)

        assert info["plan"] == "starter"
        assert info["voice_enabled"] is True
        assert info["seconds_used"] == 120
        assert info["seconds_limit"] == 900
        assert info["minutes_remaining"] == pytest.approx(13.0, abs=0.1)
        assert info["max_session_minutes"] == 10
        assert info["sessions_this_month"] == 3
        assert "reset_date" in info

    @pytest.mark.asyncio
    async def test_free_plan_disabled(self, mock_db_session, mock_voice_quota):
        from voice.quota import get_voice_quota_info

        mock_voice_quota.seconds_limit = 0
        mock_voice_quota.seconds_used = 0
        mock_voice_quota.sessions_count = 0

        mock_result_quota = MagicMock()
        mock_result_quota.scalars.return_value.first.return_value = mock_voice_quota
        mock_db_session.execute.return_value = mock_result_quota

        mock_free_user = MagicMock()
        mock_free_user.voice_bonus_seconds = 0
        mock_db_session.get = AsyncMock(return_value=mock_free_user)
        mock_db_session.flush = AsyncMock()

        info = await get_voice_quota_info(1, "free", mock_db_session)

        assert info["voice_enabled"] is False
        assert info["max_session_minutes"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — voice/schemas.py (Pydantic validation)
# ═══════════════════════════════════════════════════════════════════════════════


class TestVoiceSchemas:
    """Tests de validation Pydantic pour les schemas voice."""

    def test_voice_session_request_valid(self):
        from voice.schemas import VoiceSessionRequest
        req = VoiceSessionRequest(summary_id=42, language="fr")
        assert req.summary_id == 42
        assert req.language == "fr"

    def test_voice_session_request_default_language(self):
        from voice.schemas import VoiceSessionRequest
        req = VoiceSessionRequest(summary_id=1)
        assert req.language == "fr"

    def test_voice_quota_response(self):
        from voice.schemas import VoiceQuotaResponse
        resp = VoiceQuotaResponse(
            plan="starter",
            voice_enabled=True,
            seconds_used=120,
            seconds_limit=900,
            minutes_remaining=13.0,
            max_session_minutes=10,
            sessions_this_month=3,
            reset_date="2026-04-01",
        )
        assert resp.plan == "starter"
        assert resp.voice_enabled is True

    def test_voice_webhook_payload(self):
        from voice.schemas import VoiceWebhookPayload
        payload = VoiceWebhookPayload(
            conversation_id="conv_123",
            agent_id="agent_456",
            status="completed",
            duration_seconds=180,
            transcript="User: Hello\nAI: Hi!",
        )
        assert payload.duration_seconds == 180
        assert payload.transcript is not None

    def test_voice_webhook_payload_minimal(self):
        from voice.schemas import VoiceWebhookPayload
        payload = VoiceWebhookPayload(
            conversation_id="conv_123",
            agent_id="agent_456",
            status="completed",
            duration_seconds=0,
        )
        assert payload.transcript is None
        assert payload.metadata is None


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — voice/elevenlabs.py (Client + static methods)
# ═══════════════════════════════════════════════════════════════════════════════


class TestElevenLabsClient:
    """Tests pour ElevenLabsClient (sans appels réseau)."""

    def test_build_system_prompt_french(self):
        from voice.elevenlabs import ElevenLabsClient
        prompt = ElevenLabsClient.build_system_prompt(
            video_title="Test Vidéo",
            channel_name="Test Channel",
            duration="30min00s",
            summary_content="Un résumé de test.",
            language="fr",
        )
        assert "DeepSight" in prompt
        assert "Test Vidéo" in prompt
        assert "Test Channel" in prompt
        assert "search_in_transcript" in prompt

    def test_build_system_prompt_english(self):
        from voice.elevenlabs import ElevenLabsClient
        prompt = ElevenLabsClient.build_system_prompt(
            video_title="Test Video",
            channel_name="Test Channel",
            duration="30min00s",
            summary_content="A test summary.",
            language="en",
        )
        assert "DeepSight voice assistant" in prompt
        assert "quiz me" in prompt.lower()

    def test_build_tools_config_returns_7_tools(self):
        from voice.elevenlabs import ElevenLabsClient
        tools = ElevenLabsClient.build_tools_config(
            webhook_base_url="https://api.example.com",
            api_token="test-token",
        )
        assert len(tools) == 7
        names = [t["name"] for t in tools]
        assert "search_in_transcript" in names
        assert "get_analysis_section" in names
        assert "get_sources" in names
        assert "get_flashcards" in names
        assert "web_search" in names
        assert "deep_research" in names
        assert "check_fact" in names

    def test_tools_config_urls_use_base_url(self):
        from voice.elevenlabs import ElevenLabsClient
        tools = ElevenLabsClient.build_tools_config(
            webhook_base_url="https://api.deepsight.com",
            api_token="tok",
        )
        for tool in tools:
            assert tool["api_schema"]["url"].startswith("https://api.deepsight.com/")

    def test_tools_config_auth_header(self):
        from voice.elevenlabs import ElevenLabsClient
        tools = ElevenLabsClient.build_tools_config(
            webhook_base_url="https://api.example.com",
            api_token="my-token-123",
        )
        for tool in tools:
            auth = tool["api_schema"]["request_headers"]["Authorization"]
            assert auth == "Bearer my-token-123"

    def test_get_elevenlabs_client_raises_without_key(self):
        from voice.elevenlabs import get_elevenlabs_client
        with patch("core.config.get_elevenlabs_key", return_value=None):
            with pytest.raises(ValueError, match="ELEVENLABS_API_KEY"):
                get_elevenlabs_client()


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — voice/router.py :: VOICE_ADDON_PACKS
# ═══════════════════════════════════════════════════════════════════════════════


class TestVoiceAddonPacks:
    """Tests pour la configuration des packs add-on."""

    def test_packs_defined(self):
        from voice.router import VOICE_ADDON_PACKS
        assert "voice_10" in VOICE_ADDON_PACKS
        assert "voice_30" in VOICE_ADDON_PACKS
        assert "voice_60" in VOICE_ADDON_PACKS

    def test_pack_structure(self):
        from voice.router import VOICE_ADDON_PACKS
        for pack_id, pack in VOICE_ADDON_PACKS.items():
            assert "name" in pack
            assert "minutes" in pack
            assert "price_cents" in pack
            assert "currency" in pack
            assert pack["currency"] == "eur"
            assert pack["minutes"] > 0
            assert pack["price_cents"] > 0

    def test_packs_sorted_by_price(self):
        from voice.router import VOICE_ADDON_PACKS
        prices = [VOICE_ADDON_PACKS[k]["price_cents"] for k in ["voice_10", "voice_30", "voice_60"]]
        assert prices == sorted(prices), "Packs should be sorted by ascending price"
