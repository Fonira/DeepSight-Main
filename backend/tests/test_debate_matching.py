"""
Tests unitaires + E2E mocked + alembic round-trip pour le module debate.matching.

Sprint Débat IA v2 — Wave 2 A finalisation (PR #311).

Couvre :
- score_candidate : combinaisons de filtres (durée, channel, audience, freshness, relevance)
- _apply_duration_filter : format-aware short/medium/long, rejet si bucket différent
- _apply_channel_quality_filter : trash patterns, edu bonus, signaux ch_ctx
- _apply_audience_filter : 'opposite'/'complement'/'nuance' avec règles distinctes
- _apply_freshness_weight : pondération ±12 mois
- _generate_queries_for_relation : queries adaptées au type de relation
- _search_perspective_video : E2E mocké (cache hit/miss, no match)
- alembic 016 upgrade/downgrade round-trip sur SQLite
"""

import importlib.util
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine, inspect


# ─────────────────────────────────────────────────────────────────────────────
# 📦 Imports du module sous test
# ─────────────────────────────────────────────────────────────────────────────
from debate.matching import (
    DEFAULT_WEIGHTS,
    PerspectiveCandidate,
    PerspectiveFilters,
    _apply_audience_filter,
    _apply_channel_quality_filter,
    _apply_duration_filter,
    _apply_freshness_weight,
    _detect_audience,
    _generate_queries_for_relation,
    _normalize_brave_result,
    _query_relevance_score,
    _search_perspective_video,
    compute_candidates_cache_key,
    score_candidate,
    tier_from_duration,
)


# ═══════════════════════════════════════════════════════════════════════════════
# 🪪 1. tier_from_duration
# ═══════════════════════════════════════════════════════════════════════════════


class TestTierFromDuration:
    def test_zero_or_negative_returns_medium(self):
        assert tier_from_duration(0) == "medium"
        assert tier_from_duration(-10) == "medium"

    def test_short_threshold(self):
        assert tier_from_duration(30) == "short"
        assert tier_from_duration(59) == "short"

    def test_medium_threshold(self):
        assert tier_from_duration(60) == "medium"
        assert tier_from_duration(600) == "medium"
        assert tier_from_duration(1199) == "medium"

    def test_long_threshold(self):
        assert tier_from_duration(1200) == "long"
        assert tier_from_duration(3600) == "long"
        assert tier_from_duration(7200) == "long"


# ═══════════════════════════════════════════════════════════════════════════════
# ⏱️ 2. _apply_duration_filter (format-aware, rejet si bucket mismatch)
# ═══════════════════════════════════════════════════════════════════════════════


class TestApplyDurationFilter:
    def test_same_bucket_short_score_one(self):
        # 30s vs 45s : both short
        assert _apply_duration_filter(30, 45) == 1.0

    def test_same_bucket_medium_score_one(self):
        # 5min vs 10min : both medium
        assert _apply_duration_filter(300, 600) == 1.0

    def test_same_bucket_long_score_one(self):
        # 30min vs 1h : both long
        assert _apply_duration_filter(1800, 3600) == 1.0

    def test_short_vs_long_score_zero(self):
        # 30s candidate vs 1h target : different buckets
        assert _apply_duration_filter(30, 3600) == 0.0

    def test_short_vs_medium_score_zero(self):
        # 30s vs 5min
        assert _apply_duration_filter(30, 300) == 0.0

    def test_medium_vs_long_score_zero(self):
        # 5min vs 30min
        assert _apply_duration_filter(300, 1800) == 0.0

    def test_zero_target_treated_as_medium(self):
        # Target 0 → bucket medium ; medium candidate scores 1
        assert _apply_duration_filter(600, 0) == 1.0
        # short candidate vs unknown medium target → 0
        assert _apply_duration_filter(30, 0) == 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# 📺 3. _apply_channel_quality_filter
# ═══════════════════════════════════════════════════════════════════════════════


class TestApplyChannelQualityFilter:
    def test_neutral_baseline(self):
        score = _apply_channel_quality_filter("Random Channel", None)
        assert 0.45 <= score <= 0.55  # ≈ baseline 0.5

    def test_trash_pattern_clickbait_reduced(self):
        score = _apply_channel_quality_filter("Best Clickbait Channel 2025", None)
        # baseline 0.5 - 0.4 (clickbait) = 0.1
        assert score < 0.2

    def test_trash_pattern_top_n_shocking(self):
        score = _apply_channel_quality_filter("Top 10 Shocking Truths", None)
        assert score < 0.2

    def test_trash_pattern_compilation_year(self):
        # "compilation 2024" matches the regex
        score = _apply_channel_quality_filter("Best Compilation 2024", None)
        assert score < 0.2

    def test_edu_channel_bonus(self):
        # ScienceEtonnante is in EDU_CHANNEL_BONUS
        score = _apply_channel_quality_filter("ScienceEtonnante", None)
        # baseline 0.5 + 0.3 = 0.8
        assert score >= 0.75

    def test_kurzgesagt_bonus(self):
        score = _apply_channel_quality_filter("Kurzgesagt – In a Nutshell", None)
        assert score >= 0.75

    def test_only_one_edu_bonus_applied(self):
        # Multiple edu names should still produce only one bonus (not stacked)
        # Using a name that contains both 'kurzgesagt' and 'veritasium'
        score = _apply_channel_quality_filter("Kurzgesagt Veritasium", None)
        # 0.5 + 0.3 (one bonus) = 0.8, capped well below 1.1
        assert score <= 0.85

    def test_channel_context_chapters_bonus(self):
        ctx = {"has_chapters_pct": 0.8, "avg_video_duration_seconds": 800}
        score = _apply_channel_quality_filter("Some Channel", ctx)
        # baseline 0.5 + 0.1 (chapters) + 0.05 (avg_dur) = 0.65
        assert score >= 0.6

    def test_channel_context_ignored_when_invalid(self):
        ctx = {"has_chapters_pct": "not-a-number", "avg_video_duration_seconds": None}
        score = _apply_channel_quality_filter("Some Channel", ctx)
        # Should fall back to neutral 0.5
        assert 0.45 <= score <= 0.55

    def test_score_clamped_zero_to_one(self):
        # Multiple trash patterns should still floor at 0
        score = _apply_channel_quality_filter("Clickbait Reupload Fake", None)
        assert score >= 0.0
        assert score <= 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 📅 4. _apply_freshness_weight (pondéré ±12 mois)
# ═══════════════════════════════════════════════════════════════════════════════


class TestApplyFreshnessWeight:
    def test_none_returns_neutral(self):
        assert _apply_freshness_weight(None) == 0.5

    def test_invalid_string_returns_neutral(self):
        assert _apply_freshness_weight("not-a-date") == 0.5

    def test_recent_video_under_12_months(self):
        recent = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        assert _apply_freshness_weight(recent) == 1.0

    def test_iso_with_z_suffix(self):
        recent = (
            datetime.now(timezone.utc) - timedelta(days=15)
        ).isoformat().replace("+00:00", "Z")
        assert _apply_freshness_weight(recent) == 1.0

    def test_video_18_months_old(self):
        old = (datetime.now(timezone.utc) - timedelta(days=18 * 30)).isoformat()
        # 18 months : > 12 but < 24 → 0.7
        assert _apply_freshness_weight(old) == 0.7

    def test_video_3_years_old(self):
        old = (datetime.now(timezone.utc) - timedelta(days=3 * 365)).isoformat()
        # 36 months : > 24 but < 60 → 0.4
        assert _apply_freshness_weight(old) == 0.4

    def test_video_6_years_old(self):
        old = (datetime.now(timezone.utc) - timedelta(days=6 * 365)).isoformat()
        # 72 months : > 60 → 0.2
        assert _apply_freshness_weight(old) == 0.2

    def test_future_dated_treated_as_fresh(self):
        future = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
        assert _apply_freshness_weight(future) == 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 👥 5. _detect_audience + _apply_audience_filter
# ═══════════════════════════════════════════════════════════════════════════════


class TestDetectAudience:
    def test_vulgar_marker_french(self):
        cand = {"title": "La physique quantique pour les nuls"}
        assert _detect_audience(cand, None) == "vulgarisation"

    def test_vulgar_marker_english(self):
        cand = {"title": "Quantum physics explained for beginners"}
        assert _detect_audience(cand, None) == "vulgarisation"

    def test_expert_marker(self):
        cand = {"title": "Deep dive into quantum field theory PhD lecture"}
        assert _detect_audience(cand, None) == "expert"

    def test_expert_paper(self):
        cand = {"title": "Recent paper on string theory research"}
        assert _detect_audience(cand, None) == "expert"

    def test_unknown_default(self):
        cand = {"title": "Some random video about physics"}
        assert _detect_audience(cand, None) == "unknown"

    def test_channel_context_long_avg_dur_expert(self):
        cand = {"title": "Some random video"}
        ctx = {"avg_video_duration_seconds": 2400}  # > 1800 = expert
        assert _detect_audience(cand, ctx) == "expert"

    def test_channel_context_short_avg_dur_unknown(self):
        cand = {"title": "Some random video"}
        ctx = {"avg_video_duration_seconds": 600}
        assert _detect_audience(cand, ctx) == "unknown"


class TestApplyAudienceFilter:
    def test_opposite_neutral_score(self):
        # 'opposite' : aucune préférence
        assert _apply_audience_filter("vulgarisation", "opposite", set()) == 0.5
        assert _apply_audience_filter("expert", "opposite", set()) == 0.5
        assert _apply_audience_filter("unknown", "opposite", set()) == 0.5

    def test_complement_prefers_uncovered(self):
        # 'complement' : légère pref pour audience pas encore couverte
        assert _apply_audience_filter(
            "expert", "complement", {"vulgarisation"}
        ) == 0.75
        # déjà couvert → neutre
        assert _apply_audience_filter(
            "vulgarisation", "complement", {"vulgarisation"}
        ) == 0.6

    def test_complement_unknown_baseline(self):
        assert _apply_audience_filter("unknown", "complement", set()) == 0.6

    def test_nuance_bonus_diversity(self):
        # 'nuance' : bonus si audience candidate diffère des excluded
        assert _apply_audience_filter("expert", "nuance", {"vulgarisation"}) == 1.0

    def test_nuance_unknown_low(self):
        assert _apply_audience_filter("unknown", "nuance", set()) == 0.4

    def test_nuance_already_covered_neutral(self):
        # candidate audience déjà dans excluded → 0.5
        assert _apply_audience_filter(
            "vulgarisation", "nuance", {"vulgarisation"}
        ) == 0.5


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 6. _query_relevance_score
# ═══════════════════════════════════════════════════════════════════════════════


class TestQueryRelevanceScore:
    def test_first_position(self):
        assert _query_relevance_score(0, 10) == pytest.approx(1.0, abs=0.01)

    def test_decay(self):
        # exp(-5/8) ≈ 0.535 / exp(-10/8) ≈ 0.286
        s_5 = _query_relevance_score(5, 15)
        s_10 = _query_relevance_score(10, 15)
        assert s_5 > s_10
        assert 0.5 < s_5 < 0.7
        assert 0.2 < s_10 < 0.4

    def test_zero_total(self):
        # safety fallback
        assert _query_relevance_score(0, 0) == 0.5

    def test_negative_rank(self):
        assert _query_relevance_score(-1, 10) == 0.5


# ═══════════════════════════════════════════════════════════════════════════════
# 🧮 7. score_candidate (composite)
# ═══════════════════════════════════════════════════════════════════════════════


class TestScoreCandidate:
    def _make_filters(self, target_dur=600, excluded_audience=None):
        return PerspectiveFilters(
            video_a_id="vidA",
            video_a_title="Title A",
            video_a_channel="Channel A",
            video_a_duration_seconds=target_dur,
            excluded_video_ids={"vidA"},
            excluded_audience_levels=excluded_audience or set(),
            user_plan="pro",
        )

    def test_duration_mismatch_returns_neg_inf(self):
        # candidate short, target medium → bucket mismatch → -inf
        cand = {"duration_seconds": 30, "title": "X", "channel": "C"}
        filters = self._make_filters(target_dur=600)  # medium
        score = score_candidate(cand, filters, "opposite")
        assert score == float("-inf")

    def test_score_in_unit_range(self):
        cand = {
            "duration_seconds": 600,  # medium
            "title": "Quantum physics explained",
            "channel": "ScienceEtonnante",
            "published_at": (
                datetime.now(timezone.utc) - timedelta(days=30)
            ).isoformat(),
        }
        filters = self._make_filters(target_dur=600)
        score = score_candidate(cand, filters, "opposite")
        assert 0.0 <= score <= 1.0

    def test_high_score_optimal_candidate(self):
        # All factors maxed
        cand = {
            "duration_seconds": 600,
            "title": "Quantum physics explained for beginners",
            "channel": "Veritasium",
            "published_at": (
                datetime.now(timezone.utc) - timedelta(days=30)
            ).isoformat(),
        }
        filters = self._make_filters(target_dur=600, excluded_audience={"expert"})
        # nuance + audience vulgarisation (different from excluded expert) → bonus
        score = score_candidate(
            cand, filters, "nuance", rank_in_results=0, total_results=10
        )
        # duration 1.0 * 0.30 + ch 0.8 * 0.20 + fresh 1.0 * 0.15 + audience 1.0 * 0.20 + relevance 1.0 * 0.15
        # = 0.30 + 0.16 + 0.15 + 0.20 + 0.15 = 0.96
        assert score > 0.85

    def test_low_score_trash_channel(self):
        cand = {
            "duration_seconds": 600,
            "title": "Some random video",
            "channel": "Top 10 Shocking Reveal",
            "published_at": "2018-05-01T00:00:00+00:00",
        }
        filters = self._make_filters(target_dur=600)
        score = score_candidate(cand, filters, "opposite")
        # trash channel → low ch_quality, old → low freshness
        # but score should still be in [0, 1] range or clamped
        assert 0.0 <= score <= 0.6

    def test_custom_weights(self):
        cand = {
            "duration_seconds": 600,
            "title": "Random",
            "channel": "Random Channel",
            "published_at": (
                datetime.now(timezone.utc) - timedelta(days=15)
            ).isoformat(),
        }
        filters = self._make_filters(target_dur=600)
        # Custom weights putting all weight on duration
        custom = {
            "duration_match": 1.0,
            "channel_quality": 0.0,
            "freshness": 0.0,
            "audience": 0.0,
            "query_relevance": 0.0,
        }
        score = score_candidate(
            cand, filters, "opposite", weights=custom
        )
        # duration 1.0 * 1.0 = 1.0
        assert score == 1.0


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 8. _normalize_brave_result
# ═══════════════════════════════════════════════════════════════════════════════


class TestNormalizeBraveResult:
    def test_valid_youtube_url(self):
        result = {
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "Rick Astley - Never Gonna Give You Up - YouTube",
            "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            "duration_seconds": 213,
        }
        cand = _normalize_brave_result(result, "test query")
        assert cand is not None
        assert cand["video_id"] == "dQw4w9WgXcQ"
        assert cand["platform"] == "youtube"
        assert "YouTube" not in cand["title"]  # suffix stripped
        assert cand["duration_seconds"] == 213
        assert cand["raw_query"] == "test query"

    def test_non_youtube_url_returns_none(self):
        result = {"url": "https://example.com/page", "title": "Random"}
        assert _normalize_brave_result(result, "q") is None

    def test_invalid_duration_falls_back_to_zero(self):
        result = {
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "Test",
            "duration_seconds": "not-a-number",
        }
        cand = _normalize_brave_result(result, "q")
        assert cand is not None
        assert cand["duration_seconds"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 9. compute_candidates_cache_key
# ═══════════════════════════════════════════════════════════════════════════════


class TestCacheKey:
    def test_deterministic(self):
        k1 = compute_candidates_cache_key("Climate change", "opposite", "fr", 600)
        k2 = compute_candidates_cache_key("Climate change", "opposite", "fr", 600)
        assert k1 == k2

    def test_different_relations_yield_different_keys(self):
        k1 = compute_candidates_cache_key("X", "opposite", "fr", 600)
        k2 = compute_candidates_cache_key("X", "complement", "fr", 600)
        assert k1 != k2

    def test_bucket_collapse(self):
        # 5min and 10min are both 'medium' → same key
        k1 = compute_candidates_cache_key("X", "opposite", "fr", 300)
        k2 = compute_candidates_cache_key("X", "opposite", "fr", 600)
        assert k1 == k2

    def test_different_lang_yields_different_keys(self):
        k1 = compute_candidates_cache_key("X", "opposite", "fr", 600)
        k2 = compute_candidates_cache_key("X", "opposite", "en", 600)
        assert k1 != k2

    def test_topic_normalized_lowercase(self):
        k1 = compute_candidates_cache_key("Climate Change", "opposite", "fr", 600)
        k2 = compute_candidates_cache_key("climate change", "opposite", "fr", 600)
        assert k1 == k2

    def test_sha256_hex_format(self):
        k = compute_candidates_cache_key("X", "opposite", "fr", 600)
        assert len(k) == 64
        assert all(c in "0123456789abcdef" for c in k)


# ═══════════════════════════════════════════════════════════════════════════════
# 🎬 10. _generate_queries_for_relation
# ═══════════════════════════════════════════════════════════════════════════════


class TestGenerateQueriesForRelation:
    @pytest.mark.asyncio
    async def test_opposite_invokes_mistral_with_critical_keywords(self):
        captured_messages = []

        async def fake_mistral(messages, model, temperature, json_mode):
            captured_messages.extend(messages)
            return json.dumps({
                "query_primary": "climate change myth debunked",
                "query_alternative": "climate change critique",
            })

        def fake_extract_json(raw):
            return json.loads(raw)

        queries = await _generate_queries_for_relation(
            topic="Climate change",
            thesis_a="Humans cause climate change",
            relation_type="opposite",
            title_to_avoid="Climate Change Truth",
            lang="en",
            model="mistral-small-2603",
            call_mistral_fn=fake_mistral,
            extract_json_fn=fake_extract_json,
        )

        assert len(queries) == 2
        assert "myth debunked" in queries[0]
        # Vérifier que le system prompt contient les mots-clés "opposite"
        sys_msg = next(m for m in captured_messages if m["role"] == "system")
        assert "CONTREDIT" in sys_msg["content"] or "OPPOSE" in sys_msg["content"]

    @pytest.mark.asyncio
    async def test_complement_uses_complement_instructions(self):
        captured_messages = []

        async def fake_mistral(messages, model, temperature, json_mode):
            captured_messages.extend(messages)
            return json.dumps({
                "query_primary": "deep dive case study",
                "query_alternative": "behind the scenes insider",
            })

        queries = await _generate_queries_for_relation(
            topic="X",
            thesis_a="Y",
            relation_type="complement",
            title_to_avoid="Z",
            lang="fr",
            model="m",
            call_mistral_fn=fake_mistral,
            extract_json_fn=lambda r: json.loads(r),
        )
        sys_msg = next(m for m in captured_messages if m["role"] == "system")
        assert "COMPLÈTE" in sys_msg["content"] or "ÉTEND" in sys_msg["content"]
        assert len(queries) == 2

    @pytest.mark.asyncio
    async def test_nuance_uses_nuance_instructions(self):
        captured_messages = []

        async def fake_mistral(messages, model, temperature, json_mode):
            captured_messages.extend(messages)
            return json.dumps({
                "query_primary": "depends on context",
                "query_alternative": "edge cases when does X work",
            })

        queries = await _generate_queries_for_relation(
            topic="X",
            thesis_a="Y",
            relation_type="nuance",
            title_to_avoid="Z",
            lang="fr",
            model="m",
            call_mistral_fn=fake_mistral,
            extract_json_fn=lambda r: json.loads(r),
        )
        sys_msg = next(m for m in captured_messages if m["role"] == "system")
        assert "NUANCE" in sys_msg["content"] or "conditionnelle" in sys_msg["content"]
        assert len(queries) == 2

    @pytest.mark.asyncio
    async def test_empty_mistral_response_returns_empty_list(self):
        async def fake_mistral(messages, model, temperature, json_mode):
            return ""

        queries = await _generate_queries_for_relation(
            topic="X",
            thesis_a="Y",
            relation_type="opposite",
            title_to_avoid="Z",
            lang="fr",
            model="m",
            call_mistral_fn=fake_mistral,
            extract_json_fn=lambda r: {},
        )
        assert queries == []

    @pytest.mark.asyncio
    async def test_malformed_json_returns_empty_list(self):
        async def fake_mistral(messages, model, temperature, json_mode):
            return "{not valid json"

        def fake_extract(raw):
            return None  # extract_json_fn returns None on failure

        queries = await _generate_queries_for_relation(
            topic="X",
            thesis_a="Y",
            relation_type="opposite",
            title_to_avoid="Z",
            lang="fr",
            model="m",
            call_mistral_fn=fake_mistral,
            extract_json_fn=fake_extract,
        )
        assert queries == []

    @pytest.mark.asyncio
    async def test_lang_fr_vs_en_different_instruction(self):
        captured_fr = []
        captured_en = []

        async def fake_fr(messages, model, temperature, json_mode):
            captured_fr.extend(messages)
            return json.dumps({"query_primary": "a", "query_alternative": "b"})

        async def fake_en(messages, model, temperature, json_mode):
            captured_en.extend(messages)
            return json.dumps({"query_primary": "a", "query_alternative": "b"})

        await _generate_queries_for_relation(
            topic="X", thesis_a="Y", relation_type="opposite",
            title_to_avoid="", lang="fr", model="m",
            call_mistral_fn=fake_fr, extract_json_fn=lambda r: json.loads(r),
        )
        await _generate_queries_for_relation(
            topic="X", thesis_a="Y", relation_type="opposite",
            title_to_avoid="", lang="en", model="m",
            call_mistral_fn=fake_en, extract_json_fn=lambda r: json.loads(r),
        )
        sys_fr = next(m for m in captured_fr if m["role"] == "system")["content"]
        sys_en = next(m for m in captured_en if m["role"] == "system")["content"]
        assert "français" in sys_fr.lower() or "francais" in sys_fr.lower()
        assert "english" in sys_en.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 11. _search_perspective_video — E2E mocked
# ═══════════════════════════════════════════════════════════════════════════════


def _make_filters(target_dur=600):
    return PerspectiveFilters(
        video_a_id="vidA",
        video_a_title="Climate Change Truth",
        video_a_channel="Channel A",
        video_a_duration_seconds=target_dur,
        excluded_video_ids={"vidA"},
        excluded_audience_levels=set(),
        user_plan="pro",
    )


def _make_brave_result(video_id="abc12345678", title="Test video", duration=600):
    return {
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": title,
        "thumbnail": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        "duration_seconds": duration,
        "channel": "Test Channel",
        "published_at": (
            datetime.now(timezone.utc) - timedelta(days=30)
        ).isoformat(),
    }


class TestSearchPerspectiveVideoE2E:
    @pytest.mark.asyncio
    async def test_nominal_finds_candidate(self):
        """Cas nominal — Brave retourne un résultat valide → top-1 sélectionné."""

        async def fake_mistral(messages, model, temperature, json_mode):
            return json.dumps({
                "query_primary": "climate myth",
                "query_alternative": "climate critique",
            })

        async def fake_brave(query, key, count):
            # Retourne un résultat YouTube valide pour chaque query
            return [_make_brave_result(video_id="vidB1234567")]

        with patch(
            "debate.matching.get_brave_key", create=True, return_value="fake-key"
        ) as _, patch(
            "core.config.get_brave_key", return_value="fake-key"
        ):
            chosen = await _search_perspective_video(
                topic="Climate change",
                thesis_a="Humans cause climate change",
                relation="opposite",
                filters=_make_filters(target_dur=600),
                lang="en",
                db=None,  # disable cache
                model="mistral-small",
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: json.loads(r),
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        assert chosen is not None
        assert chosen.video_id == "vidB1234567"
        assert chosen.platform == "youtube"
        assert chosen.score > 0.0

    @pytest.mark.asyncio
    async def test_no_brave_results_returns_none(self):
        async def fake_mistral(messages, model, temperature, json_mode):
            return json.dumps({"query_primary": "q1", "query_alternative": "q2"})

        async def fake_brave(query, key, count):
            return []

        with patch("core.config.get_brave_key", return_value="fake-key"):
            chosen = await _search_perspective_video(
                topic="X",
                thesis_a="Y",
                relation="opposite",
                filters=_make_filters(target_dur=600),
                lang="fr",
                db=None,
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: json.loads(r),
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        assert chosen is None

    @pytest.mark.asyncio
    async def test_no_brave_key_returns_none(self):
        """Si pas de clé Brave configurée, retourne None proprement."""
        async def fake_mistral(messages, model, temperature, json_mode):
            return json.dumps({"query_primary": "q1", "query_alternative": "q2"})

        async def fake_brave(query, key, count):
            return [_make_brave_result()]

        with patch("core.config.get_brave_key", return_value=""):
            chosen = await _search_perspective_video(
                topic="X",
                thesis_a="Y",
                relation="opposite",
                filters=_make_filters(target_dur=600),
                lang="fr",
                db=None,
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: json.loads(r),
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        assert chosen is None

    @pytest.mark.asyncio
    async def test_no_queries_returns_none(self):
        """Si Mistral renvoie 0 query, on n'appelle pas Brave et on retourne None."""
        brave_called = []

        async def fake_mistral(messages, model, temperature, json_mode):
            return ""

        async def fake_brave(query, key, count):
            brave_called.append(query)
            return [_make_brave_result()]

        with patch("core.config.get_brave_key", return_value="fake-key"):
            chosen = await _search_perspective_video(
                topic="X",
                thesis_a="Y",
                relation="opposite",
                filters=_make_filters(target_dur=600),
                lang="fr",
                db=None,
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: None,
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        assert chosen is None
        assert brave_called == []

    @pytest.mark.asyncio
    async def test_excluded_ids_filtered(self):
        """Les video_ids dans excluded_video_ids ne doivent pas être candidats."""
        async def fake_mistral(messages, model, temperature, json_mode):
            return json.dumps({"query_primary": "q1", "query_alternative": "q2"})

        async def fake_brave(query, key, count):
            return [
                _make_brave_result(video_id="excludedVid"),
                _make_brave_result(video_id="okVideo1234"),
            ]

        filters = PerspectiveFilters(
            video_a_id="vidA",
            video_a_title="T",
            video_a_channel="C",
            video_a_duration_seconds=600,
            excluded_video_ids={"vidA", "excludedVid"},
            excluded_audience_levels=set(),
            user_plan="pro",
        )

        with patch("core.config.get_brave_key", return_value="fake-key"):
            chosen = await _search_perspective_video(
                topic="X",
                thesis_a="Y",
                relation="opposite",
                filters=filters,
                lang="fr",
                db=None,
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: json.loads(r),
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        assert chosen is not None
        assert chosen.video_id == "okVideo1234"

    @pytest.mark.asyncio
    async def test_duration_mismatch_rejected(self):
        """Toutes les vidéos avec bucket différent doivent être rejetées."""
        async def fake_mistral(messages, model, temperature, json_mode):
            return json.dumps({"query_primary": "q1", "query_alternative": "q2"})

        async def fake_brave(query, key, count):
            # All candidates are short (30s) but target is medium (600s)
            return [
                _make_brave_result(video_id="vidShort1A1", duration=30),
                _make_brave_result(video_id="vidShort2B2", duration=20),
            ]

        with patch("core.config.get_brave_key", return_value="fake-key"):
            chosen = await _search_perspective_video(
                topic="X",
                thesis_a="Y",
                relation="opposite",
                filters=_make_filters(target_dur=600),  # medium target
                lang="fr",
                db=None,
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: json.loads(r),
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        # All candidates rejected → None
        assert chosen is None

    @pytest.mark.asyncio
    async def test_cache_hit_skips_brave_call(self):
        """Si le cache retourne des candidats, Brave n'est pas appelé."""
        brave_calls = []
        mistral_calls = []

        async def fake_mistral(messages, model, temperature, json_mode):
            mistral_calls.append(messages)
            return json.dumps({"query_primary": "q1", "query_alternative": "q2"})

        async def fake_brave(query, key, count):
            brave_calls.append(query)
            return [_make_brave_result()]

        # Mock _get_cached_candidates to return a cached result
        cached_data = [{
            "video_id": "cachedVid12",
            "platform": "youtube",
            "title": "Cached video",
            "channel": "Cached Channel",
            "thumbnail": "thumb.jpg",
            "duration_seconds": 600,
            "published_at": None,
            "audience_level": "unknown",
            "channel_quality_score": 0.5,
            "raw_query": "cached q",
            "score": 0.85,
        }]

        mock_db = AsyncMock()

        with patch(
            "debate.matching._get_cached_candidates",
            AsyncMock(return_value=cached_data),
        ), patch("core.config.get_brave_key", return_value="fake-key"):
            chosen = await _search_perspective_video(
                topic="X",
                thesis_a="Y",
                relation="opposite",
                filters=_make_filters(target_dur=600),
                lang="fr",
                db=mock_db,
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: json.loads(r),
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        assert chosen is not None
        assert chosen.video_id == "cachedVid12"
        # Brave should NOT have been called when cache hit
        assert brave_calls == []
        assert mistral_calls == []

    @pytest.mark.asyncio
    async def test_cache_miss_calls_brave_then_caches(self):
        """Cache miss → Brave appelé → résultat persisté en cache."""
        brave_calls = []
        cache_writes = []

        async def fake_mistral(messages, model, temperature, json_mode):
            return json.dumps({"query_primary": "q1", "query_alternative": "q2"})

        async def fake_brave(query, key, count):
            brave_calls.append(query)
            return [_make_brave_result(video_id="missVidB123")]

        async def fake_put_cache(*args, **kwargs):
            cache_writes.append((args, kwargs))

        mock_db = AsyncMock()

        with patch(
            "debate.matching._get_cached_candidates", AsyncMock(return_value=None)
        ), patch(
            "debate.matching._put_cached_candidates", AsyncMock(side_effect=fake_put_cache)
        ), patch("core.config.get_brave_key", return_value="fake-key"):
            chosen = await _search_perspective_video(
                topic="X",
                thesis_a="Y",
                relation="opposite",
                filters=_make_filters(target_dur=600),
                lang="fr",
                db=mock_db,
                call_mistral_fn=fake_mistral,
                extract_json_fn=lambda r: json.loads(r),
                brave_search_fn=fake_brave,
                channel_context_fn=AsyncMock(return_value=None),
            )

        assert chosen is not None
        assert chosen.video_id == "missVidB123"
        # Brave was called
        assert len(brave_calls) >= 1
        # Cache write was triggered
        assert len(cache_writes) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# 🗄️ 12. Migration alembic 016 — round-trip SQLite
# ═══════════════════════════════════════════════════════════════════════════════


_BACKEND_DIR = Path(__file__).resolve().parents[1]
_MIGRATION_016_PATH = (
    _BACKEND_DIR / "alembic" / "versions" / "016_debate_v2_video_b_candidates_cache.py"
)


def _load_migration_016():
    """Charger le module migration 016 par chemin absolu."""
    spec = importlib.util.spec_from_file_location("mig_016", _MIGRATION_016_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _ensure_real_alembic_for_016():
    """Pareil que test_migration_007 — replace shadowing alembic package."""
    backend_str = str(_BACKEND_DIR)
    backend_alt = backend_str.replace("\\", "/")
    for key in list(sys.modules):
        if key == "alembic" or key.startswith("alembic."):
            mod = sys.modules[key]
            f = (getattr(mod, "__file__", "") or "").replace("\\", "/")
            spath = (
                getattr(mod, "__spec__", None).origin
                if getattr(mod, "__spec__", None)
                else ""
            ) or ""
            spath = spath.replace("\\", "/")
            if (
                "site-packages" not in f
                and ("/backend/alembic" in f or "/backend/alembic" in spath or f == "")
            ):
                del sys.modules[key]
    sys.path[:] = [
        p
        for p in sys.path
        if p.replace("\\", "/").rstrip("/") not in (backend_alt.rstrip("/"),)
    ]
    if os.getcwd().replace("\\", "/").rstrip("/") == backend_alt.rstrip("/"):
        sys.path[:] = [p for p in sys.path if p not in ("", ".")]


def _run_migration_016(db_url: str, direction: str) -> None:
    _ensure_real_alembic_for_016()
    from alembic.operations import Operations
    from alembic.runtime.migration import MigrationContext
    from alembic import op as _op_module

    sync_engine = create_engine(db_url)
    mig = _load_migration_016()

    with sync_engine.begin() as connection:
        ctx = MigrationContext.configure(connection)
        op_proxy = Operations(ctx)
        old_proxy = getattr(_op_module, "_proxy", None)
        _op_module._proxy = op_proxy
        try:
            if direction == "upgrade":
                mig.upgrade()
            elif direction == "downgrade":
                mig.downgrade()
            else:
                raise ValueError(direction)
        finally:
            _op_module._proxy = old_proxy

    sync_engine.dispose()


@pytest.fixture
def fresh_sqlite_for_016():
    tmpdir = tempfile.mkdtemp(prefix="ds_alembic_016_")
    db_path = os.path.join(tmpdir, "test.db")
    db_url = f"sqlite:///{db_path}"
    yield db_url
    try:
        os.remove(db_path)
        os.rmdir(tmpdir)
    except OSError:
        pass


class TestMigration016:
    def test_upgrade_creates_table_and_indexes(self, fresh_sqlite_for_016):
        db_url = fresh_sqlite_for_016
        _run_migration_016(db_url, "upgrade")

        engine = create_engine(db_url)
        inspector = inspect(engine)

        # Table exists
        assert "debate_video_b_candidates" in inspector.get_table_names()

        # Required columns
        columns = {c["name"]: c for c in inspector.get_columns("debate_video_b_candidates")}
        assert "id" in columns
        assert "cache_key" in columns
        assert "topic_normalized" in columns
        assert "relation_type" in columns
        assert "lang" in columns
        assert "duration_bucket" in columns
        assert "candidates_json" in columns
        assert "created_at" in columns
        assert "expires_at" in columns

        # Required NOT NULL constraints
        assert columns["cache_key"]["nullable"] is False
        assert columns["relation_type"]["nullable"] is False
        assert columns["lang"]["nullable"] is False
        assert columns["duration_bucket"]["nullable"] is False
        assert columns["candidates_json"]["nullable"] is False
        assert columns["expires_at"]["nullable"] is False

        # topic_normalized is nullable
        assert columns["topic_normalized"]["nullable"] is True

        # Indexes
        indexes = {ix["name"] for ix in inspector.get_indexes("debate_video_b_candidates")}
        assert "idx_debate_video_b_candidates_key" in indexes
        assert "idx_debate_video_b_candidates_expires" in indexes

        # Unique constraint on cache_key
        uniques = inspector.get_unique_constraints("debate_video_b_candidates")
        unique_names = {u["name"] for u in uniques}
        assert "uq_debate_video_b_candidates_key" in unique_names

        engine.dispose()

    def test_downgrade_drops_table(self, fresh_sqlite_for_016):
        db_url = fresh_sqlite_for_016
        _run_migration_016(db_url, "upgrade")
        _run_migration_016(db_url, "downgrade")

        engine = create_engine(db_url)
        inspector = inspect(engine)
        assert "debate_video_b_candidates" not in inspector.get_table_names()
        engine.dispose()

    def test_round_trip_idempotent(self, fresh_sqlite_for_016):
        """Upgrade puis downgrade laisse la DB clean."""
        db_url = fresh_sqlite_for_016

        _run_migration_016(db_url, "upgrade")
        engine = create_engine(db_url)
        inspector = inspect(engine)
        assert "debate_video_b_candidates" in inspector.get_table_names()
        engine.dispose()

        _run_migration_016(db_url, "downgrade")
        engine = create_engine(db_url)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert "debate_video_b_candidates" not in tables
        engine.dispose()

    def test_revision_metadata(self):
        """Verify revision id and down_revision for chain integrity."""
        mig = _load_migration_016()
        assert mig.revision == "016_debate_v2_video_b_candidates_cache"
        assert mig.down_revision == "015_add_search_index_tables"
