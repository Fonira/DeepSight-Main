/**
 * useAmbientPreset — React hook qui retourne le preset ambient temps réel.
 *
 * Re-render toutes les 30 secondes (suffisant car les transitions sont
 * smoothées via CSS transition de 1.5-2s sur les couches DOM).
 *
 * Le preset est calculé à partir de `new Date()` et dérive automatiquement
 * du moment de la journée. La variation seedée par jour change l'angle du
 * beam principal de ± 15° d'un jour à l'autre.
 *
 * Options optionnelles passées à `getAmbientPreset` :
 * - intensityMul: multiplicateur global d'opacités (défaut 1)
 * - disableDailyVariation: désactive la variation seedée
 *
 * Respect prefers-reduced-motion : retourné séparément pour que les composants
 * adaptent leurs transitions CSS (durée 0 si reduced-motion).
 */

import { useEffect, useState } from "react";
import {
  getAmbientPreset,
  type AmbientPreset,
  type PresetOptions,
} from "@deepsight/lighting-engine";

const REFRESH_INTERVAL_MS = 30_000; // 30s — assez fin pour smoother visuellement

export interface UseAmbientPresetResult {
  preset: AmbientPreset;
  prefersReducedMotion: boolean;
}

export function useAmbientPreset(opts?: PresetOptions): UseAmbientPresetResult {
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), opts),
  );

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
  );

  // Stable opts deps — JSON stringify keeps it cheap and stable
  const optsKey = JSON.stringify(opts ?? {});

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      setPreset(getAmbientPreset(new Date(), opts));
    };
    tick();
    const id = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    // Safari < 14 fallback
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  return { preset, prefersReducedMotion };
}
