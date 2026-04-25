/**
 * useAmbientLightingFeatureFlag — Wrapper PostHog pour le rollout v2.
 *
 * Lit le feature flag `ambient-lighting-v2` depuis PostHog.
 * Permet un rollout progressif (10% → 50% → 100%) sans déploiement.
 *
 * Fallback si PostHog absent ou pas chargé : enabled = true.
 * Override URL `?force-ambient-v2=1` pour forcer activation (QA).
 * Override URL `?force-ambient-v2=0` pour forcer désactivation.
 *
 * Usage :
 *   const enabled = useAmbientLightingFeatureFlag();
 *   if (!enabled) return null;
 *   return <AmbientLightLayer />;
 */

import { useEffect, useState } from "react";
import posthog from "posthog-js";

const FEATURE_FLAG_KEY = "ambient-lighting-v2";

function readUrlOverride(): boolean | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const v = params.get("force-ambient-v2");
  if (v === "1") return true;
  if (v === "0") return false;
  return null;
}

export function useAmbientLightingFeatureFlag(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const override = readUrlOverride();
    if (override !== null) return override;
    // Default ON jusqu'au check PostHog
    return true;
  });

  useEffect(() => {
    const override = readUrlOverride();
    if (override !== null) {
      setEnabled(override);
      return;
    }

    // PostHog : check le flag dès qu'il est chargé
    const checkFlag = () => {
      try {
        const result = posthog.isFeatureEnabled?.(FEATURE_FLAG_KEY);
        // PostHog retourne undefined si pas chargé / pas de flag → on garde true
        if (typeof result === "boolean") {
          setEnabled(result);
        }
      } catch {
        // PostHog non initialisé — on garde le default
      }
    };

    // Check immédiat
    checkFlag();

    // Re-check quand PostHog signale que les flags sont chargés
    try {
      posthog.onFeatureFlags?.(checkFlag);
    } catch {
      // ignore
    }
  }, []);

  return enabled;
}
