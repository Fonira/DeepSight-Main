"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🔍 SUMMARY EXTRACTOR — Extraction condensée pour l'extension Chrome              ║
║  Parse le markdown de l'analyse complète pour produire un JSON léger.             ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import re
from typing import Any, Dict, Optional

from .schemas import ExtensionKeyPoint, ExtensionSummary, ExtensionSummaryResponse

# ═══════════════════════════════════════════════════════════════════════════════
# 📌 CONSTANTES
# ═══════════════════════════════════════════════════════════════════════════════

WEBAPP_BASE_URL = "https://www.deepsightsynthesis.com"
MAX_POINT_LENGTH = 80
MAX_KEY_POINTS = 6
MAX_TAGS = 8

# Patterns pour les marqueurs épistémiques
_SOLID_RE = re.compile(
    r"[✅]\s*(?:SOLIDE|SOLID)\s*[—–-]\s*(.+)",
    re.IGNORECASE,
)
_PLAUSIBLE_RE = re.compile(
    r"[⚖️]\s*(?:PLAUSIBLE)\s*[—–-]\s*(.+)",
    re.IGNORECASE,
)
_UNCERTAIN_RE = re.compile(
    r"[❓]\s*(?:INCERTAIN|UNCERTAIN)\s*[—–-]\s*(.+)",
    re.IGNORECASE,
)
_VERIFY_RE = re.compile(
    r"[⚠️]\s*(?:À VÉRIFIER|TO VERIFY)\s*[—–-]\s*(.+)",
    re.IGNORECASE,
)

# Pattern générique pour les bullet points épistémiques (fallback)
_EPISTEMIC_BULLET_RE = re.compile(
    r"^[\s*•\-]\s*([✅⚖️❓⚠️])\s*(.+)",
    re.MULTILINE,
)

# Patterns pour les sections conclusion
_CONCLUSION_RE = re.compile(
    r"#+\s*(?:Conclusion|Verdict|Synthèse|En résumé|Summary|Bilan|Notre avis|"
    r"Final Thoughts|Key Takeaway|À retenir)\s*\n([\s\S]*?)(?=\n#|\Z)",
    re.IGNORECASE,
)

# Pattern pour les concepts [[Term]]
_CONCEPT_RE = re.compile(r"\[\[([^\]]+)\]\]")

# Pattern pour nettoyer le markdown
_MARKDOWN_CLEAN_RE = re.compile(r"[*_`#>\[\]]")
_TIMECODE_RE = re.compile(r"\[\d{1,2}:\d{2}\]")
_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")


def _clean_text(text: str) -> str:
    """Nettoie un texte markdown en texte brut."""
    text = _LINK_RE.sub(r"\1", text)
    text = _TIMECODE_RE.sub("", text)
    text = _MARKDOWN_CLEAN_RE.sub("", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _truncate(text: str, max_length: int = MAX_POINT_LENGTH) -> str:
    """Tronque un texte proprement à max_length caractères."""
    text = _clean_text(text)
    if len(text) <= max_length:
        return text
    return text[: max_length - 1].rsplit(" ", 1)[0] + "…"


def _extract_verdict(markdown: str) -> str:
    """
    Extrait le verdict depuis la section Conclusion du markdown.

    Cherche la section Conclusion/Verdict, puis prend la première phrase
    substantielle comme verdict.
    """
    match = _CONCLUSION_RE.search(markdown)
    if match:
        conclusion_text = match.group(1).strip()
        # Prendre la première phrase non-vide
        for line in conclusion_text.split("\n"):
            line = _clean_text(line)
            if len(line) > 15:
                return _truncate(line, 120)

    # Fallback: dernière section non-vide
    sections = re.split(r"\n#{1,3}\s+", markdown)
    if sections:
        last_section = _clean_text(sections[-1])
        first_sentence = last_section.split(".")[0]
        if len(first_sentence) > 15:
            return _truncate(first_sentence, 120)

    return "Analyse disponible"


def _extract_key_points(markdown: str) -> list[ExtensionKeyPoint]:
    """
    Extrait les points clés depuis les marqueurs épistémiques du markdown.

    Cherche les marqueurs ✅ SOLIDE, ⚖️ PLAUSIBLE, ❓ INCERTAIN, ⚠️ À VÉRIFIER
    et les convertit en ExtensionKeyPoint.
    """
    points: list[ExtensionKeyPoint] = []
    icon_map = {"✅": "strong", "⚖️": "insight", "❓": "insight", "⚠️": "weak"}

    # Stratégie 1 : patterns spécifiques
    for pattern, point_type, icon in [
        (_SOLID_RE, "strong", "✅"),
        (_VERIFY_RE, "weak", "⚠️"),
        (_PLAUSIBLE_RE, "insight", "💡"),
        (_UNCERTAIN_RE, "insight", "❓"),
    ]:
        for m in pattern.finditer(markdown):
            text = _truncate(m.group(1))
            if text and len(text) > 10:
                points.append(ExtensionKeyPoint(type=point_type, icon=icon, text=text))
            if len(points) >= MAX_KEY_POINTS:
                return points

    # Stratégie 2 (fallback) : bullets génériques avec emoji
    if len(points) < 3:
        for m in _EPISTEMIC_BULLET_RE.finditer(markdown):
            emoji = m.group(1).strip()
            text = _truncate(m.group(2))
            ptype = icon_map.get(emoji, "data")
            if text and len(text) > 10:
                points.append(ExtensionKeyPoint(type=ptype, icon=emoji, text=text))
            if len(points) >= MAX_KEY_POINTS:
                return points

    # Stratégie 3 (dernier recours) : extraire des bullet points standards
    if len(points) < 2:
        bullet_re = re.compile(r"^[\s]*[-•*]\s+(.{15,})", re.MULTILINE)
        for m in bullet_re.finditer(markdown):
            text = _truncate(m.group(1))
            if text:
                points.append(ExtensionKeyPoint(type="data", icon="📊", text=text))
            if len(points) >= 4:
                break

    return points[:MAX_KEY_POINTS]


def _extract_tags(
    markdown: str,
    tags_field: Optional[str] = None,
    category: str = "general",
) -> list[str]:
    """
    Extrait les tags thématiques.

    Sources (par priorité) :
    1. Le champ `tags` existant (comma-separated)
    2. Les concepts [[Term]] dans le markdown
    3. La catégorie comme fallback
    """
    tags: list[str] = []

    # Source 1: champ tags existant
    if tags_field:
        for tag in tags_field.split(","):
            tag = tag.strip().lower()
            if tag and tag not in tags:
                tags.append(tag)
                if len(tags) >= MAX_TAGS:
                    return tags

    # Source 2: concepts [[Term]]
    for m in _CONCEPT_RE.finditer(markdown):
        tag = m.group(1).strip().lower()
        if tag and tag not in tags and len(tag) < 40:
            tags.append(tag)
            if len(tags) >= MAX_TAGS:
                return tags

    # Fallback: au moins la catégorie
    if not tags:
        tags.append(category)

    return tags


def extract_extension_summary(
    summary_id: int,
    summary_content: str,
    video_title: str,
    category: str = "general",
    reliability_score: Optional[float] = None,
    tags: Optional[str] = None,
    visual_analysis: Optional[Dict[str, Any]] = None,
) -> ExtensionSummaryResponse:
    """
    Extrait un résumé condensé pour l'extension Chrome à partir du markdown complet.

    Cette fonction est fault-tolerant : si un champ ne peut pas être extrait,
    une valeur par défaut raisonnable est retournée.

    Args:
        summary_id: ID du résumé en base.
        summary_content: Markdown complet de l'analyse.
        video_title: Titre de la vidéo YouTube.
        category: Catégorie détectée.
        reliability_score: Score de fiabilité (0.0-1.0), optionnel.
        tags: Tags comma-separated depuis la base, optionnel.

    Returns:
        ExtensionSummaryResponse avec le JSON condensé.
    """
    # Valeurs par défaut sûres
    content = summary_content or ""
    title = video_title or "Vidéo sans titre"

    # Extraire le verdict
    verdict = _extract_verdict(content)

    # Score de confiance : convertir reliability_score (0-1) → (0-100)
    if reliability_score is not None:
        confidence_score = max(0, min(100, int(reliability_score * 100)))
    else:
        # Heuristique basée sur le contenu
        confidence_score = 50
        if len(content) > 3000:
            confidence_score += 15
        if "✅" in content:
            confidence_score += 10
        if "⚠️" in content:
            confidence_score -= 5
        confidence_score = max(0, min(100, confidence_score))

    # Extraire les points clés
    key_points = _extract_key_points(content)

    # Extraire les tags
    extracted_tags = _extract_tags(content, tags, category)

    # Construire l'URL complète
    full_analysis_url = f"{WEBAPP_BASE_URL}/analysis/{summary_id}"

    return ExtensionSummaryResponse(
        extension_summary=ExtensionSummary(
            verdict=verdict,
            confidence_score=confidence_score,
            category=category,
            key_points=key_points,
            tags=extracted_tags,
            video_title=title,
            full_analysis_url=full_analysis_url,
            visual_analysis=visual_analysis,
        )
    )
