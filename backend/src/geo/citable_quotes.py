"""Extraction de quotes citables depuis le contenu d'analyse DeepSight.

Identifie les phrases les plus susceptibles d'être reprises par un LLM
dans une réponse générée (ChatGPT, Perplexity, Gemini, etc.).
"""

import re

from .schemas import CitableQuote

# Regex pour détecter les marqueurs épistémiques dans le summary_content
_SOLID_RE = re.compile(r"[✅]\s*(?:SOLIDE|SOLID)\s*[—–\-:]\s*(.+)", re.IGNORECASE)
_PLAUSIBLE_RE = re.compile(r"[⚖️]\s*(?:PLAUSIBLE)\s*[—–\-:]\s*(.+)", re.IGNORECASE)
_UNCERTAIN_RE = re.compile(r"[❓]\s*(?:INCERTAIN|UNCERTAIN)\s*[—–\-:]\s*(.+)", re.IGNORECASE)
_VERIFY_RE = re.compile(r"[⚠️]\s*(?:À VÉRIFIER|TO VERIFY)\s*[—–\-:]\s*(.+)", re.IGNORECASE)

# Regex pour détecter la présence de statistiques / chiffres
_STATS_RE = re.compile(r"\d+[\.,]?\d*\s*[%€$£MmKkBb]|\d{2,}|\d+\s*(?:fois|percent|million|milliard)")

# Longueur min/max d'une quote citable
_MIN_QUOTE_LEN = 30
_MAX_QUOTE_LEN = 300

_MARKER_PATTERNS = [
    (_SOLID_RE, "SOLID", 1.0),
    (_PLAUSIBLE_RE, "PLAUSIBLE", 0.6),
    (_UNCERTAIN_RE, "UNCERTAIN", 0.3),
    (_VERIFY_RE, "TO_VERIFY", 0.2),
]


def _is_self_contained(text: str) -> bool:
    """Vérifie si la phrase est compréhensible hors contexte.

    Une phrase self-contained a un sujet et un verbe, et ne commence pas
    par un pronom anaphorique ("il", "elle", "cela", "this", "it").
    """
    anaphoric = re.compile(
        r"^(?:il|elle|ils|elles|cela|ceci|ce(?:tte)?|ces|"
        r"this|that|these|those|it|they|he|she)\s",
        re.IGNORECASE,
    )
    if anaphoric.match(text.strip()):
        return False
    # Doit contenir au moins un verbe conjugué (heuristique simple : longueur suffisante)
    return len(text.split()) >= 5


def _compute_hint(text: str, marker: str, has_stats: bool, is_self_contained: bool) -> str | None:
    """Génère une suggestion d'amélioration pour la citabilité."""
    if marker == "TO_VERIFY":
        return "Ajouter une source vérifiable pour transformer en claim SOLID"
    if marker == "UNCERTAIN":
        return "Étayer avec des données chiffrées ou une source experte"
    if not has_stats and marker == "SOLID":
        return "Ajouter un chiffre précis pour renforcer la citabilité"
    if not is_self_contained:
        return "Reformuler pour être compréhensible hors contexte"
    return None


def extract_citable_quotes(summary_content: str) -> list[CitableQuote]:
    """Extrait les quotes citables du contenu d'analyse.

    Parcourt le summary_content à la recherche de marqueurs épistémiques,
    puis score chaque claim trouvé sur sa citabilité.
    """
    quotes: list[CitableQuote] = []

    for pattern, marker, base_score in _MARKER_PATTERNS:
        for match in pattern.finditer(summary_content):
            text = match.group(1).strip()

            # Filtrer les phrases trop courtes ou trop longues
            if len(text) < _MIN_QUOTE_LEN or len(text) > _MAX_QUOTE_LEN:
                continue

            has_stats = bool(_STATS_RE.search(text))
            self_contained = _is_self_contained(text)

            # Score final : base + bonus stats + bonus self-contained
            score = base_score
            if has_stats:
                score = min(1.0, score + 0.15)
            if self_contained:
                score = min(1.0, score + 0.1)
            if not self_contained:
                score = max(0.0, score - 0.15)

            hint = _compute_hint(text, marker, has_stats, self_contained)

            quotes.append(
                CitableQuote(
                    text=text,
                    score=round(score, 2),
                    marker=marker,
                    has_stats=has_stats,
                    is_self_contained=self_contained,
                    improvement_hint=hint,
                )
            )

    # Trier par score décroissant, top 20
    quotes.sort(key=lambda q: q.score, reverse=True)
    return quotes[:20]
