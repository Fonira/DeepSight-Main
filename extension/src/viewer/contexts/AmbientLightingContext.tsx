/**
 * AmbientLightingContext (extension viewer)
 *
 * Duplicate du Context sidepanel — viewer.tsx est une entry webpack distincte
 * (page autonome chrome-extension://.../viewer.html) qui ne partage pas le
 * runtime React avec sidepanel.
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

export function useAmbientLightingContext(): Value {
  const v = useContext(Ctx);
  if (!v) return { preset: getAmbientPresetV3(new Date()), enabled: false };
  return v;
}
