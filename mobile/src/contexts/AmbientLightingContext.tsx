/**
 * AmbientLightingContext (mobile RN)
 *
 * Provides the v3 `AmbientPresetV3` from @deepsight/lighting-engine to the
 * AmbientLightLayer + SunflowerLayer overlays, refreshing every 30s while the
 * app is foregrounded and pausing when backgrounded (battery + RAM friendly).
 *
 * `enabled={false}` short-circuits all subscriptions and keyframe interpolation
 * so we don't waste CPU when the user disabled the effect in Settings.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  getAmbientPresetV3,
  type AmbientPresetV3,
} from "@deepsight/lighting-engine";

interface AmbientLightingContextValue {
  preset: AmbientPresetV3;
  enabled: boolean;
}

const Ctx = createContext<AmbientLightingContextValue | null>(null);

interface ProviderProps {
  enabled?: boolean;
  children: ReactNode;
}

const REFRESH_MS = 30 * 1000;

export function AmbientLightingProvider({
  enabled = true,
  children,
}: ProviderProps) {
  const [preset, setPreset] = useState<AmbientPresetV3>(() =>
    getAmbientPresetV3(new Date()),
  );

  useEffect(() => {
    if (!enabled) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const update = () => setPreset(getAmbientPresetV3(new Date()));

    const start = () => {
      update();
      interval = setInterval(update, REFRESH_MS);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };

    start();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") start();
      else stop();
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [enabled]);

  return <Ctx.Provider value={{ preset, enabled }}>{children}</Ctx.Provider>;
}

export function useAmbientLightingContext(): AmbientLightingContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback: synthesize a preset so consumers can still render
    // (or no-op render when enabled is false).
    return { preset: getAmbientPresetV3(new Date()), enabled: false };
  }
  return v;
}
