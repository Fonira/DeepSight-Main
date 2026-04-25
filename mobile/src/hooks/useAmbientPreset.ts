/**
 * useAmbientPreset (mobile) — Hook React Native qui consomme @deepsight/lighting-engine.
 *
 * Recalcule l'AmbientPreset toutes les 60 secondes.
 * Recompute aussi sur app focus/resume (cas appli en background long).
 *
 * Adapté OLED : si le device est OLED on baisse l'intensityMul à 0.7 par défaut
 * pour économiser la batterie ET améliorer le contraste.
 *
 * Usage :
 *   const { preset, prefersReducedMotion } = useAmbientPreset();
 */

import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  type AppStateStatus,
  Platform,
} from "react-native";
import {
  getAmbientPreset,
  ENGINE_CONFIG,
  type AmbientPreset,
  type AmbientPresetOptions,
} from "@deepsight/lighting-engine";

interface UseAmbientPresetOptions {
  /** Multiplicateur d'intensité explicite. Default : auto (0.7 sur OLED iOS, 1 sinon). */
  intensityMul?: number;
}

interface UseAmbientPresetReturn {
  preset: AmbientPreset;
  prefersReducedMotion: boolean;
}

/**
 * Heuristique simple "OLED suspecté" pour modulation d'opacité.
 * iPhone X et + sont OLED. Android : on n'a pas l'info fiable, on garde 1.
 * Une heuristique plus précise nécessiterait expo-device + listing modèles.
 */
function getDefaultIntensityMul(): number {
  if (Platform.OS === "ios") {
    // iOS récent = OLED probable. -30% pour confort.
    return 0.7;
  }
  return 1;
}

export function useAmbientPreset(
  opts: UseAmbientPresetOptions = {},
): UseAmbientPresetReturn {
  const intensityMul = opts.intensityMul ?? getDefaultIntensityMul();

  const buildOptions = (): AmbientPresetOptions => ({
    intensityMul,
    // Mobile : skip CSS strings (on consomme rgb tuples directement)
    skipCssStrings: true,
  });

  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), buildOptions()),
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Tick toutes les 60s + recompute on app foreground
  useEffect(() => {
    const tick = () => {
      setPreset(getAmbientPreset(new Date(), buildOptions()));
    };

    const intervalId = setInterval(tick, ENGINE_CONFIG.RECOMPUTE_INTERVAL_MS);

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        // App revient au premier plan → recalcul immédiat
        tick();
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensityMul]);

  // Reduced motion (RN AccessibilityInfo)
  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setPrefersReducedMotion(value);
    });

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setPrefersReducedMotion(v),
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return { preset, prefersReducedMotion };
}
