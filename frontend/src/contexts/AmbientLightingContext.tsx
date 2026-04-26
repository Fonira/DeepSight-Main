/**
 * AmbientLightingContext — Provides the live AmbientPresetV3 to the React tree.
 *
 * Refresh cadence: every 30 seconds (matches the engine's frame granularity
 * — 24 frames over 24h = 1 frame per hour). When the user has disabled the
 * effect (settings toggle), `enabled` is false and consumer components
 * should render nothing.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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

export function AmbientLightingProvider({
  enabled = true,
  children,
}: ProviderProps) {
  const [preset, setPreset] = useState<AmbientPresetV3>(() =>
    getAmbientPresetV3(new Date()),
  );

  useEffect(() => {
    if (!enabled) return;
    const update = () => setPreset(getAmbientPresetV3(new Date()));
    update();
    const interval = setInterval(update, 30 * 1000); // refresh every 30s
    return () => clearInterval(interval);
  }, [enabled]);

  return <Ctx.Provider value={{ preset, enabled }}>{children}</Ctx.Provider>;
}

export function useAmbientLightingContext(): AmbientLightingContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Fallback when no provider is mounted — return a live preset but mark
    // enabled=false so callers know to render nothing.
    return { preset: getAmbientPresetV3(new Date()), enabled: false };
  }
  return v;
}
