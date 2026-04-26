/**
 * useAmbientLightingFeatureFlag — wrapper PostHog pour rollout progressif de la v2.
 *
 * Flag PostHog : "ambient_lighting_v2" (boolean)
 * - true → on monte AmbientLightLayer v2 (consomme @deepsight/lighting-engine)
 * - false → fallback sur l'ancienne implémentation (gardée comme legacy)
 *
 * Si PostHog n'est pas disponible (SSR, devs sans clé), retourne true par défaut
 * pour ne pas bloquer le développement.
 */

import { useEffect, useState } from "react";

const FLAG_KEY = "ambient_lighting_v2";

declare global {
  interface Window {
    posthog?: {
      isFeatureEnabled?: (key: string) => boolean | undefined;
      onFeatureFlags?: (cb: (flags: string[]) => void) => void;
    };
  }
}

export function useAmbientLightingFeatureFlag(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const ph = window.posthog;
    if (!ph?.isFeatureEnabled) return true;
    return ph.isFeatureEnabled(FLAG_KEY) !== false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ph = window.posthog;
    if (!ph?.onFeatureFlags) return;
    const handler = () => {
      const v = ph.isFeatureEnabled?.(FLAG_KEY);
      // PostHog returns undefined when flag isn't loaded yet → keep current
      if (typeof v === "boolean") setEnabled(v);
    };
    ph.onFeatureFlags(handler);
    handler();
  }, []);

  return enabled;
}
