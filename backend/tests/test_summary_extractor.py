"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — summary_extractor (format condensé pour l'extension Chrome)           ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import pytest
from videos.summary_extractor import (
    extract_extension_summary,
    _extract_verdict,
    _extract_key_points,
    _extract_tags,
    _truncate,
    _clean_text,
)
from videos.schemas import ExtensionSummaryResponse, ExtensionKeyPoint


# ═══════════════════════════════════════════════════════════════════════════════
# 📝 FIXTURES
# ═══════════════════════════════════════════════════════════════════════════════

FULL_ANALYSIS_MARKDOWN = """\
# 🔬 Analyse : Mon avis sur l'Oppo Reno 15F — Le design avant tout ?

## Contexte

Cette vidéo de FrAndroid passe en revue le smartphone Oppo Reno 15F,
un appareil milieu de gamme qui mise beaucoup sur son design.

## Points clés

### Design et finitions

✅ SOLIDE — Le cadre en aluminium et les bords plats offrent une prise en main premium
⚖️ PLAUSIBLE — Le design Aurora Vitality serait une nouvelle direction pour Oppo
❓ INCERTAIN — La durabilité à long terme du dos en verre reste à confirmer

### Performances

✅ SOLIDE — Le processeur [[MediaTek Dimensity 7300]] assure une fluidité correcte au quotidien
⚠️ À VÉRIFIER — L'autonomie annoncée de 2 jours semble optimiste selon les premiers retours

### Appareil photo

⚖️ PLAUSIBLE — Le capteur 108 MP produit de bons clichés en conditions de lumière normale
⚠️ À VÉRIFIER — Le mode nuit serait en retrait par rapport aux concurrents directs

## Conclusion

Un smartphone au design séduisant qui fait des concessions sur les performances lourdes.
Le rapport qualité-prix est intéressant pour un usage quotidien classique, mais les
gamers et photographes exigeants devront regarder ailleurs.

Verdict : bon rapport qualité-prix malgré des concessions sur l'usage intensif.
"""

MINIMAL_ANALYSIS_MARKDOWN = """\
# Résumé rapide

Quelques points sur la vidéo.

- Premier point intéressant de la vidéo concernant le sujet principal
- Deuxième point avec des détails supplémentaires importants
- Troisième point qui conclut l'analyse de manière satisfaisante
"""

EMPTY_ANALYSIS = ""


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — extract_extension_summary (cas complet)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestExtractExtensionSummaryFull:
    """Tests avec une analyse markdown complète et bien formatée."""

    def test_returns_extension_summary_response(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Mon avis sur l'Oppo Reno 15F",
            category="tech",
            reliability_score=0.73,
            tags="smartphone,design,oppo",
        )
        assert isinstance(result, ExtensionSummaryResponse)

    def test_verdict_extracted_from_conclusion(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Mon avis sur l'Oppo Reno 15F",
            category="tech",
            reliability_score=0.73,
        )
        verdict = result.extension_summary.verdict
        assert len(verdict) > 15
        assert len(verdict) <= 120

    def test_confidence_score_from_reliability(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
            reliability_score=0.73,
        )
        assert result.extension_summary.confidence_score == 73

    def test_category_passed_through(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
        )
        assert result.extension_summary.category == "tech"

    def test_key_points_extracted(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
        )
        key_points = result.extension_summary.key_points
        assert len(key_points) >= 2
        # Vérifie les types de points
        types = {kp.type for kp in key_points}
        assert "strong" in types or "weak" in types or "insight" in types

    def test_key_points_truncated(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
        )
        for kp in result.extension_summary.key_points:
            assert len(kp.text) <= 80

    def test_tags_from_field(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
            tags="smartphone,design,oppo",
        )
        tags = result.extension_summary.tags
        assert "smartphone" in tags
        assert "design" in tags
        assert "oppo" in tags

    def test_tags_from_concepts_when_no_field(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
            tags=None,
        )
        tags = result.extension_summary.tags
        # [[MediaTek Dimensity 7300]] est dans le markdown
        assert any("mediatek" in t for t in tags)

    def test_full_analysis_url(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
        )
        assert result.extension_summary.full_analysis_url == "https://www.deepsightsynthesis.com/analysis/42"

    def test_video_title_passed_through(self):
        result = extract_extension_summary(
            summary_id=42,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Mon avis sur l'Oppo Reno 15F",
            category="tech",
        )
        assert result.extension_summary.video_title == "Mon avis sur l'Oppo Reno 15F"


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — extract_extension_summary (cas dégradé / malformé)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestExtractExtensionSummaryMalformed:
    """Tests avec des analyses incomplètes, vides ou malformées."""

    def test_empty_content_does_not_crash(self):
        result = extract_extension_summary(
            summary_id=1,
            summary_content="",
            video_title="Test",
            category="general",
        )
        assert isinstance(result, ExtensionSummaryResponse)
        assert result.extension_summary.verdict == "Analyse disponible"

    def test_none_content_does_not_crash(self):
        result = extract_extension_summary(
            summary_id=1,
            summary_content=None,
            video_title="Test",
            category="general",
        )
        assert isinstance(result, ExtensionSummaryResponse)

    def test_no_epistemic_markers_still_returns_points(self):
        result = extract_extension_summary(
            summary_id=1,
            summary_content=MINIMAL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="general",
        )
        # Should fallback to bullet point extraction
        key_points = result.extension_summary.key_points
        assert len(key_points) >= 1

    def test_no_conclusion_section(self):
        md = "# Titre\n\nJuste du texte sans section conclusion ni verdict clair.\n\n- Point A\n- Point B"
        result = extract_extension_summary(
            summary_id=1,
            summary_content=md,
            video_title="Test",
            category="general",
        )
        # Should still have a verdict (fallback)
        assert len(result.extension_summary.verdict) > 0

    def test_no_reliability_score_heuristic(self):
        result = extract_extension_summary(
            summary_id=1,
            summary_content=FULL_ANALYSIS_MARKDOWN,
            video_title="Test",
            category="tech",
            reliability_score=None,
        )
        score = result.extension_summary.confidence_score
        assert 0 <= score <= 100

    def test_no_tags_uses_category_fallback(self):
        result = extract_extension_summary(
            summary_id=1,
            summary_content="Short text only.",
            video_title="Test",
            category="science",
            tags=None,
        )
        assert "science" in result.extension_summary.tags

    def test_none_video_title_fallback(self):
        result = extract_extension_summary(
            summary_id=1,
            summary_content="Content",
            video_title=None,
            category="general",
        )
        assert result.extension_summary.video_title == "Vidéo sans titre"

    def test_reliability_score_clamped(self):
        result = extract_extension_summary(
            summary_id=1,
            summary_content="Content",
            video_title="Test",
            category="general",
            reliability_score=1.5,
        )
        assert result.extension_summary.confidence_score == 100

        result2 = extract_extension_summary(
            summary_id=1,
            summary_content="Content",
            video_title="Test",
            category="general",
            reliability_score=-0.2,
        )
        assert result2.extension_summary.confidence_score == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TESTS — Fonctions utilitaires internes
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestUtilityFunctions:

    def test_truncate_short_text_unchanged(self):
        assert _truncate("Short text") == "Short text"

    def test_truncate_long_text_adds_ellipsis(self):
        long_text = "A" * 100
        result = _truncate(long_text, 50)
        assert len(result) <= 50
        assert result.endswith("…")

    def test_clean_text_removes_markdown(self):
        assert _clean_text("**bold** and *italic*") == "bold and italic"

    def test_clean_text_removes_timecodes(self):
        assert _clean_text("At [4:32] something happens") == "At something happens"

    def test_clean_text_resolves_links(self):
        assert _clean_text("[Google](https://google.com)") == "Google"

    def test_extract_verdict_from_conclusion_section(self):
        md = "## Conclusion\n\nThis is a really great verdict about the video content.\n\n## Other"
        verdict = _extract_verdict(md)
        assert "verdict" in verdict.lower() or len(verdict) > 15

    def test_extract_tags_deduplication(self):
        tags = _extract_tags("[[Python]] and [[python]] again", tags_field="python,data", category="tech")
        assert tags.count("python") == 1

    def test_extract_tags_max_limit(self):
        many_concepts = " ".join([f"[[concept{i}]]" for i in range(20)])
        tags = _extract_tags(many_concepts, category="tech")
        assert len(tags) <= 8
