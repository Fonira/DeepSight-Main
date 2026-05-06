"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🚩 POSTHOG FEATURE FLAGS CLIENT — Server-side (read-only)                        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE:                                                                             ║
║  • Lecture des feature flags PostHog côté serveur (flip-without-redeploy)         ║
║  • Singleton lazy-init avec timeout court (1.5s) pour ne pas bloquer requêtes     ║
║  • Fallback STRICT : si PostHog est down, lecture .env vars classiques            ║
║  • Best-effort : aucune exception ne remonte au caller                            ║
║                                                                                    ║
║  USAGE:                                                                            ║
║    from core.posthog_client import feature_enabled_with_fallback                   ║
║                                                                                    ║
║    if feature_enabled_with_fallback(                                               ║
║        flag_key="semantic-search-v1",                                              ║
║        distinct_id=str(user.id),                                                   ║
║        env_var_fallback="SEMANTIC_SEARCH_V1_ENABLED",                              ║
║        default=False,                                                              ║
║    ):                                                                              ║
║        ...                                                                         ║
║                                                                                    ║
║  NOTE — clé publique (phc_*) :                                                    ║
║  Le project_api_key PostHog (`phc_*`) est PUBLIC by design (utilisé côté client   ║
║  web/mobile/extension) et suffit pour `/decide` (lecture flags). Pas besoin de    ║
║  Personal API key. La capture d'events réutilise déjà cette clé via               ║
║  `core/analytics.py` (settings.POSTHOG_API_KEY).                                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Optional

from core.config import _settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# ⚙️ CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Court timeout : on ne veut pas que PostHog bloque une requête utilisateur si
# l'API EU est lente. 1.5s est un compromis raisonnable — au-delà, on tombe
# sur le fallback env var (qui était la source de vérité avant la migration).
_FEATURE_FLAG_TIMEOUT_SECONDS = 1.5

# Valeurs acceptées comme "true" pour le fallback env var (legacy).
_TRUTHY_ENV_VALUES = {"1", "true", "yes", "on"}

# Singleton client PostHog — initialisé lazy, thread-safe.
_posthog_client = None  # type: Optional[object]
_init_lock = threading.Lock()
_init_failed = False  # une fois échoué, on ne réessaie pas (évite spam logs)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 SINGLETON LAZY-INIT
# ═══════════════════════════════════════════════════════════════════════════════


def _get_client():
    """Retourne le client PostHog (lazy-init). Renvoie None si SDK absent
    ou config manquante."""
    global _posthog_client, _init_failed

    if _posthog_client is not None:
        return _posthog_client
    if _init_failed:
        return None

    with _init_lock:
        # Double-check après lock
        if _posthog_client is not None:
            return _posthog_client
        if _init_failed:
            return None

        api_key = _settings.POSTHOG_API_KEY
        if not api_key:
            # Sans clé, on désactive proprement le client (silencieux : c'est
            # le comportement attendu en dev / test).
            _init_failed = True
            return None

        try:
            from posthog import Posthog  # type: ignore
        except ImportError:
            logger.warning(
                "[posthog_flags] SDK 'posthog' non installé — fallback env vars only"
            )
            _init_failed = True
            return None

        try:
            host = _settings.POSTHOG_HOST or "https://eu.i.posthog.com"
            _posthog_client = Posthog(
                project_api_key=api_key,
                host=host,
                debug=False,
                # sync_mode=False : envoie les events en background (déjà géré
                # par core/analytics.py côté capture). Pour `feature_enabled`
                # le SDK fait un appel HTTP synchrone vers /decide, donc le
                # timeout est appliqué au niveau de l'appel ci-dessous.
                sync_mode=False,
            )
            # Désactive l'auto-capture : on ne veut PAS que ce client envoie
            # des events à chaque check de flag (ça doublerait les events
            # avec ceux émis par core/analytics.py).
            try:
                _posthog_client.disabled = False  # garder /decide actif
                # `feature_flags_request_timeout_seconds` est l'option officielle
                # exposée par le SDK posthog-python ≥ 3.0 ; si elle n'existe pas
                # sur la version installée, on retombe sur le timeout par défaut
                # du SDK (3s) — toujours acceptable.
                if hasattr(_posthog_client, "feature_flags_request_timeout_seconds"):
                    _posthog_client.feature_flags_request_timeout_seconds = (
                        _FEATURE_FLAG_TIMEOUT_SECONDS
                    )
            except Exception:  # pragma: no cover — robustesse
                pass

            logger.info(
                "[posthog_flags] Client initialisé (host=%s, timeout=%ss)",
                host,
                _FEATURE_FLAG_TIMEOUT_SECONDS,
            )
            return _posthog_client
        except Exception as exc:
            logger.warning(
                "[posthog_flags] init failed (fallback env vars only): %s", exc
            )
            _init_failed = True
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 FALLBACK ENV VAR
# ═══════════════════════════════════════════════════════════════════════════════


def _read_env_fallback(env_var_name: str, default: bool) -> bool:
    """Lit une env var legacy et la convertit en bool. Si non set, retourne
    `default`."""
    raw = os.getenv(env_var_name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in _TRUTHY_ENV_VALUES


# ═══════════════════════════════════════════════════════════════════════════════
# 🚩 API PUBLIQUE — feature_enabled_with_fallback
# ═══════════════════════════════════════════════════════════════════════════════


def feature_enabled_with_fallback(
    flag_key: str,
    distinct_id: str,
    env_var_fallback: str,
    default: bool = False,
) -> bool:
    """Lit un feature flag PostHog avec fallback env var safe.

    Comportement :
    1. Si le client PostHog est init et joignable → renvoie le résultat live.
    2. Si PostHog timeout / network error / SDK absent / clé non configurée
       → tombe sur `os.getenv(env_var_fallback)`.
    3. Si l'env var n'est pas set → renvoie `default`.

    Cette fonction NE LÈVE JAMAIS d'exception. Si tout échoue, on renvoie
    `default` pour préserver le comportement existant.

    Args:
        flag_key: Clé du flag PostHog (ex: "semantic-search-v1").
        distinct_id: Identifiant utilisateur PostHog (str(user.id) si user
            authentifié, "anonymous" / "server" sinon). Doit être stable
            pour bénéficier des rollouts par % et personne (PostHog hash).
        env_var_fallback: Nom de l'env var legacy à lire si PostHog échoue
            (ex: "SEMANTIC_SEARCH_V1_ENABLED").
        default: Valeur retournée si NI PostHog NI env var ne fournissent
            une réponse (ex: False pour rollouts progressifs).

    Returns:
        bool : True si le flag est activé pour ce user/contexte.
    """
    client = _get_client()

    # Tentative PostHog live
    if client is not None:
        try:
            # `feature_enabled` retourne True/False/None selon la config flag.
            # None = flag inconnu → on retombe sur fallback (un déploiement
            # qui supprime un flag PostHog ne casse pas le serveur).
            result = client.feature_enabled(flag_key, distinct_id)
            if result is None:
                logger.debug(
                    "[posthog_flags] flag '%s' returned None (unknown), using fallback",
                    flag_key,
                )
            else:
                return bool(result)
        except Exception as exc:
            # Timeout, network down, payload invalide, etc.
            logger.error(
                "[posthog_flags] flag '%s' lookup failed: %s — fallback to env var '%s'",
                flag_key,
                exc,
                env_var_fallback,
            )

    # Fallback env var legacy
    fallback_value = _read_env_fallback(env_var_fallback, default)
    logger.info(
        "[posthog_flags] flag '%s' fallback engaged (env=%s default=%s) → %s",
        flag_key,
        env_var_fallback,
        default,
        fallback_value,
    )
    return fallback_value


# ═══════════════════════════════════════════════════════════════════════════════
# 🧪 TEST HELPERS — réinitialiser le singleton (uniquement pour pytest)
# ═══════════════════════════════════════════════════════════════════════════════


def _reset_for_tests() -> None:
    """Réinitialise le singleton interne. À utiliser UNIQUEMENT depuis les
    tests pour éviter les contaminations entre cas de test."""
    global _posthog_client, _init_failed
    with _init_lock:
        _posthog_client = None
        _init_failed = False


__all__ = ["feature_enabled_with_fallback", "_reset_for_tests"]
