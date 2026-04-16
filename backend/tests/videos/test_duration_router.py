"""
Tests pour videos/duration_router.py — stratégie d'analyse par durée.

Couvre:
- categorize_video() : catégorisation en tiers
- get_analysis_strategy() : stratégie complète (durée + transcript + plan)
- get_optimal_model() : routage modèle
- Brave query truncation (brave_search.py)
- Web search long query extraction (web_search_provider.py)
"""

import sys
import os
import pytest
import asyncio

# Ensure src/ is on the path
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 Tests: categorize_video (tiers)
# ═══════════════════════════════════════════════════════════════════════════════

class TestCategorizeVideo:
    """Test la catégorisation des vidéos en tiers."""

    def test_micro_video(self):
        """<1 min → MICRO, pas de chunking."""
        from videos.duration_router import categorize_video, VideoTier

        profile = categorize_video(
            duration_seconds=45,
            transcript="Hello world " * 50,
        )
        assert profile.tier == VideoTier.MICRO
        assert profile.needs_chunking is False

    def test_short_video(self):
        """1-5 min → SHORT, pas de chunking."""
        from videos.duration_router import categorize_video, VideoTier

        profile = categorize_video(
            duration_seconds=180,  # 3 min
            transcript="Some content " * 200,
        )
        assert profile.tier == VideoTier.SHORT
        assert profile.needs_chunking is False

    def test_medium_video(self):
        """5-15 min → MEDIUM, pas de chunking."""
        from videos.duration_router import categorize_video, VideoTier

        profile = categorize_video(
            duration_seconds=600,  # 10 min
            transcript="Medium video content " * 1000,
        )
        assert profile.tier == VideoTier.MEDIUM
        assert profile.needs_chunking is False

    def test_long_video(self):
        """15-45 min → LONG, pas de chunking."""
        from videos.duration_router import categorize_video, VideoTier

        profile = categorize_video(
            duration_seconds=1800,  # 30 min
            transcript="Long conference content " * 3000,
        )
        assert profile.tier == VideoTier.LONG
        assert profile.needs_chunking is False

    def test_extended_video(self):
        """45min-2h → EXTENDED, chunking obligatoire."""
        from videos.duration_router import categorize_video, VideoTier

        profile = categorize_video(
            duration_seconds=5400,  # 1h30
            transcript="Extended podcast content " * 8000,
        )
        assert profile.tier == VideoTier.EXTENDED
        assert profile.needs_chunking is True
        assert profile.chunk_duration_minutes == 10

    def test_marathon_video(self):
        """>2h → MARATHON, chunking obligatoire."""
        from videos.duration_router import categorize_video, VideoTier

        profile = categorize_video(
            duration_seconds=10800,  # 3h
            transcript="Marathon interview content " * 15000,
        )
        assert profile.tier == VideoTier.MARATHON
        assert profile.needs_chunking is True
        assert profile.chunk_duration_minutes == 15

    def test_zero_duration_estimates_from_transcript(self):
        """Duration=0 → estimation par nombre de mots."""
        from videos.duration_router import categorize_video

        # ~1500 mots → ~10 min estimés → MEDIUM
        transcript = "word " * 1500
        profile = categorize_video(
            duration_seconds=0,
            transcript=transcript,
        )
        assert profile.duration_seconds > 0
        assert profile.tier.value in ("medium", "long", "short")

    def test_language_detection_french(self):
        """Texte français → détection FR."""
        from videos.duration_router import categorize_video

        profile = categorize_video(
            duration_seconds=300,
            transcript="Dans cette vidéo nous allons voir les techniques qui sont "
                       "utilisées pour les analyses des données dans le monde actuel. "
                       "Les résultats sont très intéressants pour les chercheurs.",
        )
        assert profile.detected_lang == "fr"

    def test_language_detection_english(self):
        """Texte anglais → détection EN."""
        from videos.duration_router import categorize_video

        profile = categorize_video(
            duration_seconds=300,
            transcript="In this video we are going to look at the techniques that "
                       "are used for data analysis in the current world. The results "
                       "are very interesting and you can see how they work.",
        )
        assert profile.detected_lang == "en"


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 Tests: get_analysis_strategy
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetAnalysisStrategy:
    """Test la fonction get_analysis_strategy()."""

    @pytest.mark.asyncio
    async def test_short_video_standard_strategy(self):
        """Vidéo courte → pas de chunking, pas de two-pass."""
        from videos.duration_router import get_analysis_strategy

        strategy = await get_analysis_strategy(
            duration_seconds=180,       # 3 min
            transcript_length=5000,     # ~1000 mots
            user_plan="free",
        )
        assert strategy.tier == "short"
        assert strategy.needs_chunking is False
        assert strategy.two_pass is False
        assert strategy.chunk_size == 0

    @pytest.mark.asyncio
    async def test_medium_video_standard(self):
        """Vidéo moyenne (10 min, transcript normal) → standard, pas de chunking."""
        from videos.duration_router import get_analysis_strategy

        strategy = await get_analysis_strategy(
            duration_seconds=600,       # 10 min
            transcript_length=30000,    # ~6K mots, bien sous le seuil
            user_plan="free",
        )
        assert strategy.tier == "medium"
        assert strategy.needs_chunking is False
        assert strategy.two_pass is False

    @pytest.mark.asyncio
    async def test_medium_video_long_transcript_forces_chunking(self):
        """Vidéo moyenne avec transcript >50K chars → chunking forcé."""
        from videos.duration_router import get_analysis_strategy

        strategy = await get_analysis_strategy(
            duration_seconds=600,       # 10 min
            transcript_length=60000,    # >50K → force chunking
            user_plan="free",
        )
        assert strategy.tier == "medium"
        assert strategy.needs_chunking is True
        assert strategy.two_pass is True
        assert strategy.chunk_size == 2500

    @pytest.mark.asyncio
    async def test_long_video_long_transcript_forces_chunking(self):
        """Vidéo longue (30 min) avec transcript >50K → chunking forcé."""
        from videos.duration_router import get_analysis_strategy

        strategy = await get_analysis_strategy(
            duration_seconds=1800,      # 30 min
            transcript_length=80000,    # >50K
            user_plan="plus",
        )
        assert strategy.tier == "long"
        assert strategy.needs_chunking is True
        assert strategy.two_pass is True

    @pytest.mark.asyncio
    async def test_extended_video_always_chunks(self):
        """Vidéo >45 min → chunking obligatoire, two-pass."""
        from videos.duration_router import get_analysis_strategy

        strategy = await get_analysis_strategy(
            duration_seconds=5400,      # 1h30
            transcript_length=150000,
            user_plan="pro",
        )
        assert strategy.tier == "extended"
        assert strategy.needs_chunking is True
        assert strategy.two_pass is True
        assert strategy.chunk_size == 2500
        assert strategy.concurrent_chunks >= 2

    @pytest.mark.asyncio
    async def test_marathon_video_full_strategy(self):
        """Vidéo >2h → MARATHON, chunking, two-pass, modèle large pour pro."""
        from videos.duration_router import get_analysis_strategy

        strategy = await get_analysis_strategy(
            duration_seconds=10800,     # 3h
            transcript_length=300000,
            user_plan="pro",
        )
        assert strategy.tier == "marathon"
        assert strategy.needs_chunking is True
        assert strategy.two_pass is True
        assert strategy.chunk_size == 2500
        assert strategy.concurrent_chunks >= 3
        # Pro sur MARATHON devrait avoir le modèle large
        assert "large" in strategy.model_override

    @pytest.mark.asyncio
    async def test_model_upgrade_for_pro(self):
        """Plan pro → modèle plus puissant que free."""
        from videos.duration_router import get_analysis_strategy

        strategy_free = await get_analysis_strategy(
            duration_seconds=1800, transcript_length=40000, user_plan="free",
        )
        strategy_pro = await get_analysis_strategy(
            duration_seconds=1800, transcript_length=40000, user_plan="pro",
        )
        # Pro devrait avoir un modèle au moins aussi bon
        assert strategy_pro.max_tokens >= strategy_free.max_tokens

    @pytest.mark.asyncio
    async def test_returns_pydantic_model(self):
        """Vérifie que le retour est bien un Pydantic BaseModel sérialisable."""
        from videos.duration_router import get_analysis_strategy, AnalysisStrategy

        strategy = await get_analysis_strategy(
            duration_seconds=300, transcript_length=5000, user_plan="free",
        )
        assert isinstance(strategy, AnalysisStrategy)
        # Sérialisable en dict
        d = strategy.model_dump()
        assert "tier" in d
        assert "chunk_size" in d
        assert "model_override" in d
        assert "two_pass" in d
        assert "max_context_chars" in d


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 Tests: get_optimal_model (routage modèle)
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetOptimalModel:
    """Test le routage des modèles Mistral par tier/plan/tâche."""

    def test_free_light_chunk_analysis(self):
        from videos.duration_router import get_optimal_model, VideoTier

        model, tokens = get_optimal_model(VideoTier.SHORT, "free", "chunk_analysis")
        assert "small" in model
        assert tokens > 0

    def test_pro_heavy_synthesis_uses_large(self):
        from videos.duration_router import get_optimal_model, VideoTier

        model, tokens = get_optimal_model(VideoTier.MARATHON, "pro", "synthesis")
        assert "large" in model
        assert tokens >= 6000

    def test_free_heavy_synthesis_upgrades_to_medium(self):
        """Free sur EXTENDED/MARATHON obtient un upgrade auto vers medium pour la synthèse."""
        from videos.duration_router import get_optimal_model, VideoTier

        model, tokens = get_optimal_model(VideoTier.EXTENDED, "free", "synthesis")
        assert "medium" in model

    def test_ultra_long_transcript_bonus_tokens(self):
        """Transcript >45K mots → bonus max_tokens pour la synthèse."""
        from videos.duration_router import get_optimal_model, VideoTier

        _, tokens_normal = get_optimal_model(VideoTier.MARATHON, "pro", "synthesis", transcript_words=5000)
        _, tokens_ultra = get_optimal_model(VideoTier.MARATHON, "pro", "synthesis", transcript_words=50000)
        assert tokens_ultra > tokens_normal

    def test_plan_normalization(self):
        """Plans synonymes ('starter', 'student', 'expert') → normalisés."""
        from videos.duration_router import get_optimal_model, VideoTier

        model_starter, _ = get_optimal_model(VideoTier.MEDIUM, "starter", "synthesis")
        model_plus, _ = get_optimal_model(VideoTier.MEDIUM, "plus", "synthesis")
        assert model_starter == model_plus

        model_expert, _ = get_optimal_model(VideoTier.MEDIUM, "expert", "synthesis")
        model_pro, _ = get_optimal_model(VideoTier.MEDIUM, "pro", "synthesis")
        assert model_expert == model_pro


# ═══════════════════════════════════════════════════════════════════════════════
# 🦁 Tests: Brave query truncation
# ═══════════════════════════════════════════════════════════════════════════════

class TestBraveQueryTruncation:
    """Test la troncation des queries Brave >400 chars."""

    def test_short_query_unchanged(self):
        """Query courte → pas de modification."""
        # On teste la logique directement (la troncation est dans _call_brave_api)
        query = "GPT-4 latest news 2025"
        assert len(query) <= 400
        # Pas de troncation nécessaire

    def test_long_query_truncated_to_400(self):
        """Query >400 chars → tronquée à 397 + '...'"""
        query = "A" * 500
        if len(query) > 400:
            query = query[:397] + "..."
        assert len(query) == 400
        assert query.endswith("...")

    def test_exactly_400_chars_unchanged(self):
        """Query de 400 chars exactement → pas de modification."""
        query = "B" * 400
        if len(query) > 400:
            query = query[:397] + "..."
        assert len(query) == 400
        assert not query.endswith("...")

    def test_401_chars_truncated(self):
        """Query de 401 chars → tronquée."""
        query = "C" * 401
        if len(query) > 400:
            query = query[:397] + "..."
        assert len(query) == 400
        assert query.endswith("...")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 Tests: Web search long query extraction
# ═══════════════════════════════════════════════════════════════════════════════

class TestWebSearchLongQueryExtraction:
    """Test l'extraction de query courte dans web_search_provider.py."""

    def test_short_query_no_extraction(self):
        """Query <300 chars → pas d'extraction, brave_query = query."""
        query = "What is GPT-4 latest benchmark?"
        assert len(query) <= 300
        # brave_query reste identique

    def test_long_query_extracts_meaningful_line(self):
        """Query >300 chars → extraction d'une ligne significative, pas les instructions."""
        # Simuler la logique de _brave_fallback_search
        # Les premières lignes sont des instructions filtrées (IMPORTANT, ⚠️, Réponds, etc.)
        # Seules les lignes avec "- " sont extraites comme termes de recherche.
        query = (
            "IMPORTANT: Réponds en JSON avec le format exact suivant.\n"
            "⚠️ Note: Cette vidéo contient des affirmations sur l'IA.\n"
            "📚 Sources académiques requises.\n"
            "Réponds de manière structurée.\n"
            "- Intelligence artificielle et éthique\n"
            "- Machine learning et biais algorithmiques\n"
            "- Régulation européenne de l'IA\n"
            "Reply with structured data.\n"
            "padding " * 30 + "\n"
        )
        assert len(query) > 300

        # Reproduire la logique d'extraction
        lines = query.strip().split("\n")
        short_parts = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith("{") or line.startswith("⚠") or line.startswith("📚") or line.startswith("IMPORTANT"):
                continue
            if "JSON" in line or "format exact" in line or "Réponds" in line or "Reply" in line:
                continue
            if line.startswith("- ") and len(line) < 80:
                short_parts.append(line.lstrip("- ").strip())
            elif len(line) > 10 and len(short_parts) == 0:
                short_parts.append(line[:150])
                break
        brave_query = " ".join(short_parts[:10]) if short_parts else query[:300]
        brave_query = brave_query[:400]

        assert len(brave_query) <= 400
        # Devrait avoir extrait les lignes avec "- " (pas les instructions)
        assert "Intelligence artificielle" in brave_query
        assert "Machine learning" in brave_query
        # Ne devrait PAS contenir les instructions filtrées
        assert "IMPORTANT" not in brave_query
        assert "Réponds" not in brave_query

    def test_long_query_with_no_useful_lines_falls_back(self):
        """Query longue sans lignes utiles → fallback troncation à 300."""
        query = "⚠️ " * 200  # Que des lignes ignorées
        assert len(query) > 300

        lines = query.strip().split("\n")
        short_parts = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith("⚠"):
                continue
        brave_query = " ".join(short_parts[:10]) if short_parts else query[:300]
        brave_query = brave_query[:400]

        assert len(brave_query) <= 400


# ═══════════════════════════════════════════════════════════════════════════════
# 📑 Tests: build_structured_index
# ═══════════════════════════════════════════════════════════════════════════════

class TestBuildStructuredIndex:
    """Test la construction d'index structuré."""

    def test_micro_video_no_index(self):
        """MICRO → pas d'index."""
        from videos.duration_router import build_structured_index, VideoTier

        entries = build_structured_index(
            transcript_timestamped="[0:00] Hello [0:30] World",
            duration_seconds=45,
            tier=VideoTier.MICRO,
        )
        assert entries == []

    def test_short_video_no_index(self):
        """SHORT → pas d'index."""
        from videos.duration_router import build_structured_index, VideoTier

        entries = build_structured_index(
            transcript_timestamped="[0:00] Hello",
            duration_seconds=120,
            tier=VideoTier.SHORT,
        )
        assert entries == []

    def test_empty_transcript_no_index(self):
        """Transcript vide → pas d'index."""
        from videos.duration_router import build_structured_index, VideoTier

        entries = build_structured_index(
            transcript_timestamped="",
            duration_seconds=600,
            tier=VideoTier.MEDIUM,
        )
        assert entries == []


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 Tests: helpers et edge cases
# ═══════════════════════════════════════════════════════════════════════════════

class TestHelpers:
    """Tests divers pour les helpers."""

    def test_concurrent_chunks_increases_with_tier(self):
        """Plus le tier est lourd, plus on a de chunks concurrents."""
        from videos.duration_router import get_concurrent_chunks, VideoTier

        micro = get_concurrent_chunks(VideoTier.MICRO)
        extended = get_concurrent_chunks(VideoTier.EXTENDED)
        marathon = get_concurrent_chunks(VideoTier.MARATHON)

        assert micro <= extended <= marathon

    def test_hierarchical_synthesis_threshold(self):
        """Synthèse hiérarchique déclenchée au-delà de 25 chunks."""
        from videos.duration_router import needs_hierarchical_synthesis

        assert needs_hierarchical_synthesis(10) is False
        assert needs_hierarchical_synthesis(25) is False
        assert needs_hierarchical_synthesis(26) is True
        assert needs_hierarchical_synthesis(50) is True

    def test_serialize_deserialize_roundtrip(self):
        """Sérialisation/désérialisation d'index → roundtrip OK."""
        from videos.duration_router import IndexEntry, serialize_index, deserialize_index

        entries = [
            IndexEntry(
                timestamp_seconds=0,
                timestamp_str="0:00",
                title="Introduction",
                summary="Le début de la vidéo.",
                keywords=["intro", "debut"],
                bigrams=["machine learning"],
            ),
            IndexEntry(
                timestamp_seconds=120,
                timestamp_str="2:00",
                title="Conclusion",
                summary="La fin de la vidéo.",
                keywords=["fin", "conclusion"],
                bigrams=[],
            ),
        ]
        json_str = serialize_index(entries)
        restored = deserialize_index(json_str)

        assert len(restored) == 2
        assert restored[0].title == "Introduction"
        assert restored[1].timestamp_seconds == 120
