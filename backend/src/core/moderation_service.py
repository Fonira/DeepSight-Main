"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🛡️ MODERATION SERVICE — Phase 2 Mistral-First Migration                          ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Wrapper autour de l'API mistral-moderation-latest pour modérer le contenu        ║
║  utilisateur (chat, analyse vidéo, débat) AVANT envoi aux LLMs principaux.        ║
║                                                                                    ║
║  Modes :                                                                           ║
║  • log_only (défaut) : calcule les scores et les log, mais laisse passer.         ║
║    Permet de calibrer les seuils sans bloquer les utilisateurs (faux positifs).   ║
║  • enforce          : bloque les contenus flagged (raise HTTP côté router).       ║
║                                                                                    ║
║  Fail-open : si l'API Mistral plante (timeout, 5xx, etc.), on laisse passer       ║
║  pour ne PAS bloquer le service. La modération est un filet de sécurité, pas      ║
║  un point de défaillance critique.                                                 ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

import httpx

from core.config import (
    MISTRAL_MODERATION_MODEL,
    MODERATION_ENABLED,
    MODERATION_MODE,
    get_mistral_key,
)
from core.posthog_client import feature_enabled_with_fallback

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MISTRAL_MODERATION_URL = "https://api.mistral.ai/v1/moderations"
MODERATION_TIMEOUT_SECONDS = 10.0

# Seuils de blocage (mode enforce). Seuls les scores >= seuil flag la catégorie.
# Calibrage : sexuel/violence montent vite sur du langage adulte/familier français,
# donc on garde des seuils plus tolérants. Hate/dangerous/self_harm restent stricts.
THRESHOLDS: Dict[str, float] = {
    "hate": 0.5,
    "sexual": 0.7,
    "dangerous": 0.5,
    "self_harm": 0.5,
    "violence": 0.7,
}

# Mistral renvoie des catégories avec des noms longs ; on les normalise vers les
# clés courtes utilisées dans THRESHOLDS pour l'application des seuils.
_CATEGORY_ALIASES: Dict[str, str] = {
    "hate_and_discrimination": "hate",
    "hate": "hate",
    "sexual": "sexual",
    "dangerous_and_criminal_content": "dangerous",
    "dangerous": "dangerous",
    "selfharm": "self_harm",
    "self_harm": "self_harm",
    "violence_and_threats": "violence",
    "violence": "violence",
}


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 DATACLASS — Résultat de modération
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class ModerationResult:
    """Résultat d'une vérification de modération.

    Attributes:
        allowed: True si le contenu peut passer (en mode log_only, toujours True
                 sauf si MODERATION_ENABLED est False et qu'on a un appel.
                 En mode enforce, False si une catégorie dépasse son seuil).
        flagged_categories: Liste des catégories au-dessus du seuil (toujours
                            renseignée même en log_only, pour les logs).
        raw_scores: Scores bruts renvoyés par l'API Mistral.
    """

    allowed: bool
    flagged_categories: List[str] = field(default_factory=list)
    raw_scores: Dict[str, float] = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 APPEL API MISTRAL
# ═══════════════════════════════════════════════════════════════════════════════


async def _call_mistral(input_text: str) -> Dict[str, Any]:
    """Appelle l'API Mistral Moderations.

    Lève une exception si l'API plante / timeout — c'est l'appelant
    (`moderate_text`) qui gère le fail-open.
    """
    api_key = get_mistral_key()
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY not configured")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MISTRAL_MODERATION_MODEL,
        "input": input_text,
    }

    async with httpx.AsyncClient(timeout=MODERATION_TIMEOUT_SECONDS) as client:
        response = await client.post(
            MISTRAL_MODERATION_URL,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        return response.json()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 EXTRACTION DES SCORES + APPLICATION DES SEUILS
# ═══════════════════════════════════════════════════════════════════════════════


def _extract_scores_and_flags(api_response: Dict[str, Any]) -> tuple[Dict[str, float], List[str]]:
    """Extrait les scores bruts et applique les seuils pour calculer flagged_categories."""
    results = api_response.get("results") or []
    if not results:
        return {}, []

    first = results[0] if isinstance(results, list) else {}
    raw_scores: Dict[str, float] = first.get("category_scores") or {}

    flagged: List[str] = []
    seen: set[str] = set()
    for raw_cat, score in raw_scores.items():
        try:
            score_f = float(score)
        except (TypeError, ValueError):
            continue
        canonical = _CATEGORY_ALIASES.get(raw_cat, raw_cat)
        threshold = THRESHOLDS.get(canonical)
        if threshold is None:
            # Catégorie non couverte par nos seuils (ex: pii, financial, law,
            # health) — on ne flag pas, on log juste.
            continue
        if score_f >= threshold and canonical not in seen:
            flagged.append(canonical)
            seen.add(canonical)

    return raw_scores, flagged


# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ FONCTION PRINCIPALE
# ═══════════════════════════════════════════════════════════════════════════════


async def moderate_text(
    text: str,
    distinct_id: str = "server",
) -> ModerationResult:
    """Modère un texte utilisateur via Mistral Moderations.

    Comportement :
    - Si `MODERATION_ENABLED=False` → retourne immédiatement allowed=True
      sans appel HTTP.
    - Si l'API Mistral plante → fail-open (allowed=True, log warning).
    - En mode `log_only` → toujours allowed=True, mais `flagged_categories`
      est rempli pour les logs.
    - En mode `enforce` → allowed=False si au moins une catégorie est flagged.

    Le mode (log_only vs enforce) est désormais lu via le feature flag PostHog
    `moderation-enforce` (avec fallback env var `MODERATION_ENFORCE` puis
    `MODERATION_MODE`). Permet de basculer log_only → enforce sans redeploy.

    Args:
        text: Le contenu à modérer (question chat, prompt débat, etc.)
        distinct_id: PostHog distinct id (str(user.id) ou "server" / "anonymous"
            pour les contextes sans user). Stable hash pour rollouts par %.

    Returns:
        ModerationResult avec allowed, flagged_categories, raw_scores.
    """
    # Garde-fou : modération désactivée
    if not MODERATION_ENABLED:
        return ModerationResult(allowed=True, flagged_categories=[], raw_scores={})

    # Garde-fou : input vide
    if not text or not text.strip():
        return ModerationResult(allowed=True, flagged_categories=[], raw_scores={})

    # Détermination du mode :
    # 1. Default = MODERATION_MODE module-level (lu live, donc respecte
    #    `patch.object(mod, "MODERATION_MODE", "enforce")` dans les tests).
    # 2. PostHog flag `moderation-enforce` peut override sans redeploy.
    # 3. Fallback env var `MODERATION_ENFORCE` si PostHog est down.
    legacy_default = MODERATION_MODE.lower() == "enforce"
    enforce_mode = feature_enabled_with_fallback(
        flag_key="moderation-enforce",
        distinct_id=distinct_id,
        env_var_fallback="MODERATION_ENFORCE",
        default=legacy_default,
    )
    is_log_only = not enforce_mode

    # Appel API Mistral avec fail-open
    try:
        api_response = await _call_mistral(text)
    except Exception as exc:
        logger.warning(
            "[moderation] API call failed (fail-open): %s",
            exc,
            extra={"moderation_mode": "enforce" if enforce_mode else "log_only"},
        )
        return ModerationResult(allowed=True, flagged_categories=[], raw_scores={})

    # Extraction + application seuils
    raw_scores, flagged = _extract_scores_and_flags(api_response)

    # Décision selon le mode
    allowed = True if is_log_only else (len(flagged) == 0)

    # Logging structuré
    if flagged:
        prefix = "[moderation/log_only]" if is_log_only else "[moderation]"
        logger.warning(
            "%s flagged categories=%s scores=%s allowed=%s",
            prefix,
            flagged,
            {k: round(v, 3) for k, v in raw_scores.items() if k in _CATEGORY_ALIASES},
            allowed,
        )
    else:
        logger.debug(
            "[moderation] clean text scores=%s mode=%s",
            {k: round(v, 3) for k, v in raw_scores.items()},
            "enforce" if enforce_mode else "log_only",
        )

    return ModerationResult(
        allowed=allowed,
        flagged_categories=flagged,
        raw_scores=dict(raw_scores),
    )
