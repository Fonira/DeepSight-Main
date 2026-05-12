"""
DeepSight - Watermark helper for free-plan exports.

Centralise le gating Free vs payant + i18n FR/EN + dispatch par format.

Pour les formats texte (txt/md/csv) : retourne directement le contenu modifie.
Pour les formats binaires (docx/xlsx/pdf) : retourne un dict marqueur que le
caller utilisera pour injecter le watermark via la lib appropriee
(python-docx / openpyxl / Jinja2 template).
"""

from __future__ import annotations

from typing import Optional, Union

from billing.plan_config import normalize_plan_id


# ============================================================================
# CONSTANTS
# ============================================================================

# Pendant la transition v0 -> v2 (cf. plan pricing-v2 separe), les plans payants
# couvrent les trois IDs possibles. Quand pricing-v2 sera merge ET la migration
# 011 appliquee en prod, retirer "plus" de la set.
PAID_PLANS: frozenset[str] = frozenset({"plus", "pro", "expert"})

WATERMARK_URL = "www.deepsightsynthesis.com"
WATERMARK_URL_HTTPS = "https://www.deepsightsynthesis.com"

# Texte i18n
WATERMARK_TEXTS: dict[str, dict[str, str]] = {
    "fr": {
        "tagline": "Analyse avec DeepSight - IA souveraine europeenne",
        "tagline_display": "Analysé avec DeepSight — IA souveraine européenne",
        "short": "Analysé avec DeepSight",
        "name": "DeepSight",
    },
    "en": {
        "tagline": "Analyzed with DeepSight - European sovereign AI",
        "tagline_display": "Analyzed with DeepSight — European sovereign AI",
        "short": "Analyzed with DeepSight",
        "name": "DeepSight",
    },
}


# ============================================================================
# CORE
# ============================================================================


def _resolve_language(user_language: Optional[str]) -> str:
    """Resout la langue : fr par defaut, en si 'en', sinon fallback fr."""
    if not user_language:
        return "fr"
    lang = user_language.lower().strip()
    if lang in WATERMARK_TEXTS:
        return lang
    return "fr"


def _should_apply_watermark(user_plan: Optional[str]) -> bool:
    """Determine si le watermark doit etre applique.

    Regle : watermark si plan normalise NOT in PAID_PLANS (donc Free + plans inconnus).
    """
    if not user_plan:
        return True  # Free fallback
    normalized = normalize_plan_id(user_plan)
    return normalized not in PAID_PLANS


def add_watermark(
    content: Union[str, bytes, dict, None],
    format: str,
    user_plan: Optional[str],
    user_language: str = "fr",
) -> Union[str, dict]:
    """
    Ajoute un watermark de branding sur un export en plan Free.

    Pour les formats texte (txt, md, csv), retourne le contenu modifie directement.
    Pour les formats binaires (docx, xlsx, pdf), retourne un dict marqueur :

        {
            "needs_watermark": bool,
            "text": str,           # Texte tagline (display, avec accents)
            "short": str,          # Texte court ("Analysé avec DeepSight")
            "url": str,            # "www.deepsightsynthesis.com"
            "url_https": str,      # "https://www.deepsightsynthesis.com"
            "language": str,       # "fr" | "en"
        }

    Le caller utilisera ce dict pour injecter le watermark via la lib appropriee
    (python-docx footer, openpyxl cell, Jinja2 template var).

    Args:
        content: contenu original (texte ou marqueur dict pour binaires)
        format: "txt" | "md" | "csv" | "docx" | "xlsx" | "pdf"
        user_plan: plan id (free, plus, pro, expert, etudiant, team, ...) -- sera normalise
        user_language: "fr" | "en" (defaut: "fr"), tout autre code -> fallback "fr"

    Returns:
        Le contenu modifie (str) pour txt/md/csv, ou un dict marqueur pour docx/xlsx/pdf.
    """
    apply = _should_apply_watermark(user_plan)
    lang = _resolve_language(user_language)
    texts = WATERMARK_TEXTS[lang]

    # Format binaire : dict marqueur (toujours retourne -- needs_watermark decide)
    if format in ("docx", "xlsx", "pdf"):
        return {
            "needs_watermark": apply,
            "text": texts["tagline_display"],
            "short": texts["short"],
            "url": WATERMARK_URL,
            "url_https": WATERMARK_URL_HTTPS,
            "language": lang,
        }

    # Pas de watermark pour les payants -> contenu inchange
    if not apply:
        return content if content is not None else ""

    # Format texte : injection du marqueur en fin de contenu
    if format == "txt":
        return f"{content}\n\n---\n{texts['tagline_display']} ({WATERMARK_URL})\n"

    if format == "md":
        # Tagline avec lien markdown : remplace "DeepSight" par "[DeepSight](url)"
        tagline_with_link = texts["tagline_display"].replace(
            "DeepSight",
            f"[DeepSight]({WATERMARK_URL_HTTPS})",
            1,
        )
        return f"{content}\n\n---\n*{tagline_with_link}*\n"

    if format == "csv":
        # Commentaire en derniere ligne (les parsers CSV standards ignorent les '#')
        return f"{str(content).rstrip()}\n# {texts['tagline_display']} ({WATERMARK_URL})\n"

    # Format inconnu : passthrough sans modification (securite)
    return content if content is not None else ""
