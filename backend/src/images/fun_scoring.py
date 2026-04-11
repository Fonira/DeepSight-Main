"""
Fun Scoring — Priorise les mots-clés les plus intéressants visuellement.
Score 0.0–1.0 détermine l'ordre de génération d'images (pas si on génère ou non).
"""

import re

# Base score par catégorie
CATEGORY_SCORES: dict[str, float] = {
    "cognitive_bias": 0.9,
    "paradox": 0.9,
    "philosophy": 0.8,
    "psychology": 0.8,
    "science": 0.75,
    "concept": 0.7,
    "culture": 0.65,
    "history": 0.6,
    "economics": 0.6,
    "art": 0.6,
    "nature": 0.55,
    "technology": 0.5,
    "event": 0.45,
    "place": 0.4,
    "misc": 0.4,
    "person": 0.3,
    "company": 0.2,
}

# Mots-clés qui rendent un terme plus "fun" visuellement
BONUS_PATTERNS = [
    "effet", "paradox", "biais", "syndrome", "loi de",
    "illusion", "dilemme", "principe", "théorème", "sophisme",
    "erreur", "piège", "fallac", "heuristique",
]

# Termes génériques / marques → score minimal
GENERIC_TERMS = {
    "youtube", "google", "facebook", "twitter", "instagram",
    "tiktok", "amazon", "apple", "microsoft", "netflix",
    "spotify", "wikipedia", "reddit", "linkedin", "snapchat",
}


def calculate_fun_score(term: str, category: str | None = None) -> float:
    """Calcule un score de 'fun' 0.0–1.0 pour prioriser la génération d'images."""
    term_lower = term.lower().strip()

    # Termes génériques → score minimal
    if term_lower in GENERIC_TERMS:
        return 0.1

    # Base par catégorie
    score = CATEGORY_SCORES.get(category or "misc", 0.4)

    # Bonus si le terme contient des patterns intéressants
    for pattern in BONUS_PATTERNS:
        if pattern in term_lower:
            score = min(score + 0.2, 1.0)
            break

    # Pénalité pour noms propres courts (1 mot, commence par majuscule)
    words = term.strip().split()
    if len(words) == 1 and term[0].isupper() and category in ("person", "company", "place"):
        score *= 0.6

    return round(min(max(score, 0.0), 1.0), 2)
