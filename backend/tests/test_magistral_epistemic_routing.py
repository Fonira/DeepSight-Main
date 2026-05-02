"""
Tests pour le routage Magistral (raisonnement épistémique) sur le tier Expert.

Phase 4 du plan de migration Mistral-First (2026-05-02).

Magistral est utilisé en OVERRIDE du modèle de synthèse pour le tier Expert
uniquement, lorsque le flag `MAGISTRAL_EPISTEMIC_ENABLED` est True. Le but
est d'améliorer la justification des marqueurs épistémiques
(SOLID/PLAUSIBLE/UNCERTAIN/À VÉRIFIER) grâce au raisonnement chain-of-thought
de Magistral.

Stratégie de routage retenue (Option A):
- Override Expert-only via `get_optimal_model()` pour `task="synthesis"`
- Pas de modification de `MISTRAL_FALLBACK_ORDER` → si Magistral fail, la
  chaîne de fallback existante (large → medium → small → DeepSeek) prend
  le relais via `llm_complete`.
- Flag par défaut OFF → les tests non patchés conservent le comportement
  pré-Phase 4.
"""

import sys
import os
from unittest.mock import patch

import pytest

# Ensure src/ is on the path
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 Tests: Routage Expert-only vers Magistral
# ═══════════════════════════════════════════════════════════════════════════════


class TestMagistralEpistemicRouting:
    """
    Vérifie le routage du modèle de synthèse selon le flag
    MAGISTRAL_EPISTEMIC_ENABLED et le plan utilisateur.
    """

    def test_expert_tier_uses_magistral_when_enabled(self):
        """Flag ON + plan="expert" → modèle Magistral pour la synthèse."""
        from videos import duration_router
        from videos.duration_router import get_optimal_model, VideoTier

        with patch.object(duration_router, "MAGISTRAL_EPISTEMIC_ENABLED", True), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_MODEL", "magistral-medium-2509"), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_TIERS", ["expert"]):
            model, tokens = get_optimal_model(
                tier=VideoTier.MEDIUM,
                user_plan="expert",
                task="synthesis",
            )
            assert model == "magistral-medium-2509", (
                f"Expected Magistral when flag ON + Expert plan, got {model}"
            )
            assert tokens > 0

    def test_expert_tier_falls_back_to_large_when_disabled(self):
        """Flag OFF + plan="expert" → modèle pré-Phase 4 (mistral-large-2512)."""
        from videos import duration_router
        from videos.duration_router import get_optimal_model, VideoTier

        with patch.object(duration_router, "MAGISTRAL_EPISTEMIC_ENABLED", False):
            # plan="expert" est normalisé en "pro" → matrix synthesis pour pro
            # tier MEDIUM → group "medium" → ("medium", "pro") → mistral-large-2512
            model, _ = get_optimal_model(
                tier=VideoTier.MEDIUM,
                user_plan="expert",
                task="synthesis",
            )
            assert model == "mistral-large-2512", (
                f"Expected mistral-large-2512 when flag OFF + Expert plan, got {model}"
            )

    def test_pro_tier_unchanged_when_flag_on(self):
        """Flag ON + plan="pro" → toujours mistral-medium-2508 (jamais Magistral)."""
        from videos import duration_router
        from videos.duration_router import get_optimal_model, VideoTier

        with patch.object(duration_router, "MAGISTRAL_EPISTEMIC_ENABLED", True), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_MODEL", "magistral-medium-2509"), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_TIERS", ["expert"]):
            # NOTE: dans le code legacy, plan="pro" est traité comme tier le plus haut.
            # Le sub-agent Phase 3 + plan migration ont confirmé que :
            # - "pro" (legacy) = tier intermédiaire mappé sur le code value "plus"
            # - "expert" (nouveau) = tier le plus élevé mappé sur le code value "pro"
            # La normalisation interne fait : "pro" → "pro" (groupe medium synthesis = large).
            # Pour le test "tier Pro 8.99 € v2", on utilise "plus" qui mappe sur medium.
            model, _ = get_optimal_model(
                tier=VideoTier.MEDIUM,
                user_plan="plus",  # legacy alias correspondant au plan Pro 8.99 € v2
                task="synthesis",
            )
            # Plan Pro v2 (alias "plus" code-side) ne doit JAMAIS recevoir Magistral
            assert "magistral" not in model.lower(), (
                f"Magistral should never route to non-Expert plans, got {model}"
            )
            assert model == "mistral-medium-2508", (
                f"Expected mistral-medium-2508 for Pro v2, got {model}"
            )

    def test_free_tier_unchanged_when_flag_on(self):
        """Flag ON + plan="free" → toujours mistral-small-2603 (jamais Magistral)."""
        from videos import duration_router
        from videos.duration_router import get_optimal_model, VideoTier

        with patch.object(duration_router, "MAGISTRAL_EPISTEMIC_ENABLED", True), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_MODEL", "magistral-medium-2509"), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_TIERS", ["expert"]):
            # Tier light (SHORT/MICRO) + free → small
            model, _ = get_optimal_model(
                tier=VideoTier.SHORT,
                user_plan="free",
                task="synthesis",
            )
            assert "magistral" not in model.lower(), (
                f"Magistral should never route to free plan, got {model}"
            )
            assert model == "mistral-small-2603", (
                f"Expected mistral-small-2603 for Free, got {model}"
            )

    def test_default_flag_is_off(self):
        """Garantie: flag par défaut OFF → comportement pré-Phase 4 préservé."""
        from videos.duration_router import (
            MAGISTRAL_EPISTEMIC_ENABLED,
            MAGISTRAL_EPISTEMIC_MODEL,
            MAGISTRAL_EPISTEMIC_TIERS,
        )

        assert MAGISTRAL_EPISTEMIC_ENABLED is False, (
            "MAGISTRAL_EPISTEMIC_ENABLED MUST default to False — activation "
            "requires manual quality validation on 10 videos."
        )
        assert MAGISTRAL_EPISTEMIC_MODEL == "magistral-medium-2509", (
            "Expected magistral-medium-2509 (v25.09 frontier) as official "
            "Mistral reasoning model name."
        )
        assert "expert" in MAGISTRAL_EPISTEMIC_TIERS

    def test_expert_tier_only_for_synthesis_task(self):
        """Magistral n'override QUE le task=synthesis, pas chunk_analysis."""
        from videos import duration_router
        from videos.duration_router import get_optimal_model, VideoTier

        with patch.object(duration_router, "MAGISTRAL_EPISTEMIC_ENABLED", True), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_MODEL", "magistral-medium-2509"), \
             patch.object(duration_router, "MAGISTRAL_EPISTEMIC_TIERS", ["expert"]):
            # chunk_analysis sur Expert → mistral-small (pas Magistral, trop cher
            # par chunk vu qu'il y a 5-50 appels par vidéo longue)
            model, _ = get_optimal_model(
                tier=VideoTier.MEDIUM,
                user_plan="expert",
                task="chunk_analysis",
            )
            assert "magistral" not in model.lower(), (
                f"chunk_analysis should NEVER use Magistral (cost), got {model}"
            )
