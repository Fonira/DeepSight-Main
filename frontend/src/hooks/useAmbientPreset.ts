/**
 * useAmbientPreset — Hook web qui consomme @deepsight/lighting-engine.
 *
 * Recalcule l'AmbientPreset toutes les 60 secondes (au lieu de 5 min v1).
 *
 * Support param URL `?debug-time=14:30` pour forcer une heure (QA/dev only).
 *
 * Usage :
 *   const { preset, prefersReducedMotion } = useAmbientPreset();
 */

import { useEffect, useState } from "react";
import {
  getAmbientPreset,
  ENGINE_CONFIG,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

interface UseAmbientPresetReturn {
  preset: AmbientPreset;
  prefersReducedMotion: boolean;
  /** Si une heure debug est forcée via ?debug-time=HH:MM */
  debugTimeOverride: Date | null;
}

/**
 * Parse `?debug-time=14:30` depuis window.location.
 * Retourne une Date du jour avec l'heure forcée, ou null.
 */
function parseDebugTime(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("debug-time");
    if (!raw) return null;
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  } catch {
    return null;
  }
}

/**
 * Détecte la préférence prefers-reduced-motion.
 */
function detectReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAmbientPreset(): UseAmbientPresetReturn {
  const [debugTimeOverride] = useState<Date | null>(() => parseDebugTime());
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(debugTimeOverride ?? new Date()),
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () => detectReducedMotion(),
  );

  useEffect(() => {
    // Si debug-time, on fige le preset (pas de recompute)
    if (debugTimeOverride) {
      return;
    }

    const tick = () => {
      setPreset(getAmbientPreset(new Date()));
    };

    // Tick toutes les 60s (RECOMPUTE_INTERVAL_MS du moteur)
    const intervalId = window.setInterval(
      tick,
      ENGINE_CONFIG.RECOMPUTE_INTERVAL_MS,
    );

    // Recalcul immédiat au focus (cas onglet inactif)
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [debugTimeOverride]);

  // Listener prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { preset, prefersReducedMotion, debugTimeOverride };
}
