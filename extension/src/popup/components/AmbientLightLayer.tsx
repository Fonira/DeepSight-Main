/**
 * AmbientLightLayer (extension popup) — Version minimaliste pour popup 400×600.
 *
 * Consomme @deepsight/lighting-engine via un mini-hook intégré (Preact).
 *
 * Pas d'étoiles ni de moon/sun disque (popup trop petit) — juste :
 *   1. Ambient gradient (1 couche radial principal)
 *   2. Central beam (sun ou moon avec angle dynamique)
 *
 * Tick : 30s (popup ouvert/fermé fréquemment, on veut un état frais à la réouverture).
 * Recompute forcé à chaque mount (popup s'ouvre = nouveau composant).
 *
 * Usage :
 *   <AmbientLightLayer />
 */

import React, { useEffect, useState } from "react";
import {
  getAmbientPreset,
  rgbToCss,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

const POPUP_TICK_MS = 30_000;

export const AmbientLightLayer: React.FC = () => {
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), { intensityMul: 0.85, skipCssStrings: true }),
  );

  useEffect(() => {
    const tick = () => {
      setPreset(
        getAmbientPreset(new Date(), {
          intensityMul: 0.85,
          skipCssStrings: true,
        }),
      );
    };
    const intervalId = window.setInterval(tick, POPUP_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  // Build CSS strings on the fly (engine produces tuples to save perf)
  const ambientGradient = `radial-gradient(ellipse 90% 60% at 50% 0%, ${rgbToCss(preset.ambient.primary, preset.ambient.primaryOpacity)} 0%, transparent 70%)`;

  const beamGradient = `linear-gradient(${preset.centralBeam.angleDeg}deg, transparent 38%, ${rgbToCss(preset.centralBeam.rgb, preset.centralBeam.opacity * 0.5)} 48%, ${rgbToCss(preset.centralBeam.rgb, preset.centralBeam.opacity)} 50%, ${rgbToCss(preset.centralBeam.rgb, preset.centralBeam.opacity * 0.5)} 52%, transparent 62%)`;

  const haloGradient = `linear-gradient(180deg, ${rgbToCss(preset.centralBeam.rgb, preset.rayHalo.topOpacity)} 0%, transparent 35%)`;

  return (
    <>
      {/* Ambient gradient */}
      <div
        aria-hidden="true"
        data-mood={preset.mood}
        data-beam-type={preset.centralBeam.type}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: ambientGradient,
          mixBlendMode: "screen",
          transition: "background 1500ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
      {/* Central beam (rotated according to angleDeg) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: `${beamGradient}, ${haloGradient}`,
          mixBlendMode: "screen",
          transition: "background 1500ms cubic-bezier(0.4, 0, 0.2, 1)",
          filter:
            preset.centralBeam.blurPx > 0
              ? `blur(${preset.centralBeam.blurPx}px)`
              : undefined,
        }}
      />
    </>
  );
};

export default AmbientLightLayer;
