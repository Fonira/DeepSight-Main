/**
 * useAmbientPreset (mobile) — wrapper React Native autour de l'engine.
 *
 * Refresh toutes les 60 secondes (mobile = batterie). Pas de matchMedia,
 * on lit AccessibilityInfo pour reduce-motion (RN).
 *
 * skipCssStrings: true par défaut (RN n'utilise pas de CSS strings).
 * intensityMul: 0.5 par défaut (mobile = sobriété + perfs).
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import {
  getAmbientPreset,
  type AmbientPreset,
  type PresetOptions,
} from "@deepsight/lighting-engine";

const REFRESH_INTERVAL_MS = 60_000; // 1 min sur mobile

export interface UseAmbientPresetResult {
  preset: AmbientPreset;
  reduceMotion: boolean;
}

export function useAmbientPreset(opts?: PresetOptions): UseAmbientPresetResult {
  const merged: PresetOptions = {
    skipCssStrings: true,
    intensityMul: 0.5,
    ...opts,
  };

  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), merged),
  );

  const [reduceMotion, setReduceMotion] = useState(false);

  const optsKey = JSON.stringify(merged);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      setPreset(getAmbientPreset(new Date(), merged));
    };
    tick();
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optsKey]);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (!cancelled) setReduceMotion(Boolean(v));
      })
      .catch(() => {
        // Some platforms don't implement; default false
      });

    if (Platform.OS === "ios" || Platform.OS === "android") {
      const sub = AccessibilityInfo.addEventListener?.(
        "reduceMotionChanged",
        (v: boolean) => setReduceMotion(v),
      );
      return () => {
        cancelled = true;
        sub?.remove?.();
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return { preset, reduceMotion };
}
