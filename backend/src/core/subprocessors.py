"""
Sous-traitants RGPD — source de vérité backend.

Règle : un fournisseur ne reçoit des données que s'il est déclaré publiquement
sur /legal/sub-processors (frontend/src/pages/LegalSubProcessors.tsx).

- DECLARED_SUBPROCESSORS : noms exacts affichés sur la page légale.
  Un test (tests/test_subprocessors.py) vérifie que les deux listes concordent.
- BLOCKED_PROVIDER_ENV_KEYS : fournisseurs NON déclarés. Leurs clés sont
  neutralisées au démarrage (os.environ + settings), même si elles sont
  présentes dans .env ou dans l'environnement Docker. Aucun appel possible.

Pour activer un nouveau fournisseur :
  1. le retirer de BLOCKED_PROVIDER_ENV_KEYS,
  2. l'ajouter à DECLARED_SUBPROCESSORS,
  3. l'ajouter à la page LegalSubProcessors.tsx (+ registre des traitements).
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterable, MutableMapping
from typing import Any, Final

logger = logging.getLogger(__name__)

DECLARED_SUBPROCESSORS: Final[tuple[str, ...]] = (
    "OVHcloud",
    "Cloudflare R2",
    "AWS S3",
    "Stripe",
    "Mistral AI",
    "Supadata",
    "Brave Search",
    "Perplexity AI",
    "ElevenLabs",
    "Resend",
    "Google Cloud",
    "Sentry",
    "PostHog",
)

BLOCKED_PROVIDER_ENV_KEYS: Final[dict[str, tuple[str, ...]]] = {
    "DeepSeek": ("DEEPSEEK_API_KEY",),
    "Groq": ("GROQ_API_KEY",),
    "OpenAI": ("OPENAI_API_KEY",),
    "Anthropic": ("ANTHROPIC_API_KEY",),
    "Google Gemini": ("GEMINI_API_KEY",),
    "Together AI": ("TOGETHER_API_KEY",),
    "Fal": ("FAL_API_KEY",),
    "Deepgram": ("DEEPGRAM_API_KEY",),
    "AssemblyAI": ("ASSEMBLYAI_API_KEY",),
    "Decodo": ("DECODO_SCRAPING_API_KEY",),
    "Miro": ("MIRO_API_TOKEN",),
    "Semantic Scholar": ("SEMANTIC_SCHOLAR_API_KEY",),
    "Axiom": ("AXIOM_TOKEN",),
}


def blocked_env_keys() -> tuple[str, ...]:
    """Toutes les variables d'environnement à neutraliser."""
    return tuple(key for keys in BLOCKED_PROVIDER_ENV_KEYS.values() for key in keys)


def enforce_on_environ(environ: MutableMapping[str, str] | None = None) -> list[str]:
    """
    Retire de l'environnement les clés des fournisseurs non déclarés.

    À appeler AVANT l'instanciation des settings et avant l'import des modules
    qui lisent os.environ directement. Retourne la liste des clés retirées.
    """
    env = os.environ if environ is None else environ
    removed: list[str] = []
    for key in blocked_env_keys():
        if env.get(key):
            removed.append(key)
        env.pop(key, None)
    if removed:
        logger.warning(
            "RGPD: clés de sous-traitants non déclarés ignorées: %s",
            ", ".join(removed),
        )
    return removed


def enforce_on_settings(settings: Any, keys: Iterable[str] | None = None) -> list[str]:
    """
    Neutralise les champs correspondants d'un objet settings (pydantic-settings
    lit aussi le fichier .env, que enforce_on_environ ne couvre pas).
    """
    cleared: list[str] = []
    for key in keys if keys is not None else blocked_env_keys():
        if hasattr(settings, key) and getattr(settings, key):
            setattr(settings, key, "")
            cleared.append(key)
    if cleared:
        logger.warning(
            "RGPD: clés de sous-traitants non déclarés lues depuis .env et neutralisées: %s",
            ", ".join(cleared),
        )
    return cleared
