/**
 * AmbientLightingContext (extension sidepanel)
 *
 * Fournit le preset v3 calculé via @deepsight/lighting-engine et un flag
 * `enabled` (driven par les préférences utilisateur — ambient_lighting_enabled).
 *
 * Refresh toutes les 30s pour rester en phase avec la trajectoire soleil/lune
 * et le sprite tournesol (1 frame / heure).
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

interface Value {
  preset: AmbientPresetV3;
  enabled: boolean;
}

const Ctx = createContext<Value | null>(null);

interface ProviderProps {
  enabled?: boolean;
  children: ReactNode;
}

/**
 * AmbientLightingProvider — wrap App entries (sidepanel/viewer).
 *
 * @param enabled  Driven par la pref `ambient_lighting_enabled` (default true).
 *                 Quand `false`, les consumers ne rendent rien (overlay invisible).
 */
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
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [enabled]);

  return <Ctx.Provider value={{ preset, enabled }}>{children}</Ctx.Provider>;
}

/**
 * Hook consumer — retourne preset + enabled. Si pas de provider monté,
 * retourne un fallback (preset frais + enabled=false) pour éviter les crashs
 * en tests / contextes orphelins.
 */
export function useAmbientLightingContext(): Value {
  const v = useContext(Ctx);
  if (!v) return { preset: getAmbientPresetV3(new Date()), enabled: false };
  return v;
}
