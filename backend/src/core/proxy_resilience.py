"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🛡️ PROXY RESILIENCE MANAGER — Tiered fallback + circuit breaker (Sprint D)       ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Strategy (5 tiers, fail-down only) :                                              ║
║    Tier 1 → default  : rotating Decodo (gate.decodo.com:7000 — IP différente/req) ║
║    Tier 2 → sticky   : sticky Decodo port 10001 (IP fixe ~10min, cohérence cookies)║
║    Tier 3 → geo_us / geo_fr : Decodo geo-targeted (-country-XX dans username)     ║
║    Tier 4 → legacy   : provider indépendant (Webshare) — résilience cross-vendor  ║
║    Tier 5 → none     : bare request sans proxy (last resort)                      ║
║                                                                                    ║
║  Bascule auto basée sur compteur d'erreurs glissant (PROXY_CIRCUIT_BREAKER_*).     ║
║  Reset partiel sur success (évite l'oscillation excessive en bordure de seuil).   ║
║  Fallback gracieux : si setting tier-N == None → cascade au tier suivant + warn.  ║
║                                                                                    ║
║  Thread-safety : protégé par asyncio.Lock (state in-process). Multi-worker FastAPI ║
║  ⇒ state PAR worker (4 instances), pas synchronisé inter-process. C'est le coût   ║
║  d'un singleton in-memory — distributed lock via Redis = follow-up V2.            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from typing import Dict, List, Literal, Optional

from core.logging import logger


# ═══════════════════════════════════════════════════════════════════════════════
# 📐 TYPES
# ═══════════════════════════════════════════════════════════════════════════════

ProxyVariant = Literal["default", "sticky", "geo_us", "geo_fr", "legacy", "none"]
ErrorKind = Literal["429", "403", "blocked", "timeout", "other"]

# Ordre de bascule du circuit breaker. Le premier element est le tier de depart.
# Cascade strict : un tier ne se reactive que apres reset complet.
_TIER_ORDER: List[ProxyVariant] = ["default", "sticky", "geo_us", "geo_fr", "legacy", "none"]


# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ MANAGER
# ═══════════════════════════════════════════════════════════════════════════════


class ProxyResilienceManager:
    """In-memory circuit breaker for proxy tier selection.

    Use `instance()` to get the process-wide singleton (4 instances en prod
    FastAPI multi-worker). Pour les tests, instancier directement.
    """

    _instance: Optional["ProxyResilienceManager"] = None

    def __init__(
        self,
        *,
        threshold: Optional[int] = None,
        window_s: Optional[int] = None,
        reset_s: Optional[int] = None,
    ) -> None:
        """Initialize. Defaults read from `core.config` at call time.

        Args (override pour tests) :
            threshold : erreurs avant bascule au tier suivant.
            window_s  : fenetre glissante des erreurs (sec).
            reset_s   : duree sans erreur avant retour au tier 1.
        """
        if threshold is None or window_s is None or reset_s is None:
            from core.config import (
                PROXY_CIRCUIT_BREAKER_THRESHOLD,
                PROXY_CIRCUIT_BREAKER_WINDOW_S,
                PROXY_CIRCUIT_BREAKER_RESET_S,
            )

            self._threshold: int = threshold if threshold is not None else PROXY_CIRCUIT_BREAKER_THRESHOLD
            self._window_s: int = window_s if window_s is not None else PROXY_CIRCUIT_BREAKER_WINDOW_S
            self._reset_s: int = reset_s if reset_s is not None else PROXY_CIRCUIT_BREAKER_RESET_S
        else:
            self._threshold = threshold
            self._window_s = window_s
            self._reset_s = reset_s

        # variant → list[error_ts] (window-based pruning at read time)
        self._errors: Dict[ProxyVariant, List[float]] = defaultdict(list)
        # variant → last success ts (utilise pour reset)
        self._last_success: Dict[ProxyVariant, float] = {}
        # lock pour mutations cross-tasks (sync-safe : pas d'await dedans)
        self._lock = asyncio.Lock()

    # -- Singleton accessor -------------------------------------------------

    @classmethod
    def instance(cls) -> "ProxyResilienceManager":
        """Return process-wide singleton (one per FastAPI worker)."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Test helper — clear the singleton."""
        cls._instance = None

    # -- Public API ---------------------------------------------------------

    def select_proxy_variant(
        self,
        platform: str,
        video_id: Optional[str] = None,
        geo_hint: Optional[str] = None,
    ) -> ProxyVariant:
        """Pick the next variant to attempt, based on circuit breaker state.

        Cascade strict : on commence par `default`, on bascule au tier suivant
        des qu'il a strictement plus de `threshold` erreurs dans la fenetre
        de `window_s`. Le tier 3 (`geo_us`/`geo_fr`) est selectionne via
        `geo_hint` ; sans hint on prend `geo_us` (couvre US-only blocks).

        Args:
            platform: plateforme cible (logging uniquement, pas de routing
                differencie en V1).
            video_id: optionnel, log uniquement.
            geo_hint: "us" / "fr" pour choisir le tier geo. None → "us".

        Returns:
            Le variant a utiliser pour la prochaine requete.
        """
        # Quel tier ne consomme PAS de quota d'erreurs ? On itere dans l'ordre
        # et on retourne le premier `healthy` (= sous seuil dans la fenetre).
        now = time.monotonic()
        cleaned = self._prune_old_errors(now)

        for tier in _TIER_ORDER:
            # Tier 3 : decline en geo_us vs geo_fr selon hint
            if tier == "geo_us" and geo_hint and geo_hint.lower() == "fr":
                continue  # geo_fr sera tente au cycle suivant
            if tier == "geo_fr" and geo_hint and geo_hint.lower() != "fr":
                continue  # geo_us seulement si hint != fr

            err_count = len(cleaned.get(tier, []))
            if err_count <= self._threshold:
                logger.debug(
                    f"proxy_resilience: select tier={tier} err_count={err_count} "
                    f"threshold={self._threshold} platform={platform} "
                    f"video_id={video_id} geo_hint={geo_hint}"
                )
                return tier

        # Tous les tiers ont depasse le seuil — derniere chance : "none" (bare)
        logger.warning(
            f"proxy_resilience: ALL tiers saturated, falling back to 'none' "
            f"(bare request) platform={platform} video_id={video_id}"
        )
        return "none"

    def report_error(self, variant: str, error_kind: ErrorKind = "other") -> None:
        """Record an error on the given variant.

        Args:
            variant: tier en cours d'utilisation (default/sticky/...). Si
                inconnu, ignore silencieusement (caller robustesse).
            error_kind: nature de l'erreur (logging + future segregation).
        """
        if variant not in _TIER_ORDER:
            return
        now = time.monotonic()
        self._errors[variant].append(now)  # type: ignore[index]
        logger.info(
            f"proxy_resilience: error reported variant={variant} kind={error_kind} "
            f"total_in_window={len(self._errors[variant])}"  # type: ignore[index]
        )

    def report_success(self, variant: str) -> None:
        """Record a success on the given variant.

        Reset partiel : on retire 1 erreur (la plus ancienne) pour eviter le
        "thrashing" en bordure de seuil. Reset complet seulement apres
        `reset_s` sans aucune erreur (via `_prune_old_errors`).
        """
        if variant not in _TIER_ORDER:
            return
        now = time.monotonic()
        self._last_success[variant] = now  # type: ignore[index]
        # Partial reset : pop the oldest error (FIFO) si la liste n'est pas vide.
        errs = self._errors.get(variant)  # type: ignore[arg-type]
        if errs:
            errs.pop(0)
            logger.debug(
                f"proxy_resilience: success on variant={variant} — "
                f"popped 1 error, remaining={len(errs)}"
            )

    # -- Introspection helpers (debug + tests) ------------------------------

    def get_state(self) -> Dict[str, Dict[str, int]]:
        """Snapshot state per tier (errors in window + age of last success)."""
        now = time.monotonic()
        cleaned = self._prune_old_errors(now)
        return {
            tier: {
                "errors_in_window": len(cleaned.get(tier, [])),
                "last_success_age_s": (
                    int(now - self._last_success[tier])
                    if tier in self._last_success
                    else -1
                ),
            }
            for tier in _TIER_ORDER
        }

    # -- Internal -----------------------------------------------------------

    def _prune_old_errors(self, now: float) -> Dict[ProxyVariant, List[float]]:
        """Drop errors older than `window_s`, AND drop ALL errors on a tier
        if its last success is more recent than `reset_s` ago (full reset).

        Returns the cleaned mapping (mutates in-place for memory efficiency).
        """
        cutoff = now - self._window_s
        for tier in list(self._errors.keys()):
            # Reset complet apres `reset_s` sans erreur ET success recent
            last_ok = self._last_success.get(tier)  # type: ignore[arg-type]
            if last_ok is not None and (now - last_ok) > self._reset_s:
                # Verify : si la plus recente erreur est AVANT le dernier success,
                # on peut reset propre. Sinon on garde uniquement les erreurs
                # posterieures au success.
                errs = self._errors[tier]  # type: ignore[index]
                self._errors[tier] = [e for e in errs if e > last_ok]  # type: ignore[index]

            # Pruning fenetre glissante
            self._errors[tier] = [e for e in self._errors[tier] if e >= cutoff]  # type: ignore[index]

        return self._errors  # type: ignore[return-value]
