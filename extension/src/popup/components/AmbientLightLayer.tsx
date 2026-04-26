/**
 * AmbientLightLayer (extension popup) — version compacte 380×600px.
 *
 * - Pas de PostHog feature flag (l'extension ne l'utilise pas)
 * - Pas de DoodleBackground (extension n'inclut pas le composant)
 * - Beam mince + soleil/lune discret (popup lisible avant tout)
 * - Refresh toutes les 60s (pas de batterie sur extension mais on évite les renders inutiles)
 *
 * Utilise getAmbientPreset() de @deepsight/lighting-engine directement, sans
 * dépendre de hooks externes pour réduire la taille du bundle.
 */

import React, { useEffect, useState } from "react";
import {
  getAmbientPreset,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

const REFRESH_INTERVAL_MS = 60_000;

interface AmbientLightLayerProps {
  /** Densité globale (multiplicateur d'opacités). Défaut "soft". */
  intensity?: "soft" | "normal";
}

const INTENSITY_MUL: Record<NonNullable<AmbientLightLayerProps["intensity"]>, number> = {
  soft: 0.6,
  normal: 0.85,
};

const TRANSITION_MS = 1500;

// Cap pour rester lisible dans le popup
const BEAM_OPACITY_CAP = 0.22;

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "soft",
}) => {
  const intensityMul = INTENSITY_MUL[intensity];
  const [preset, setPreset] = useState<AmbientPreset>(() =>
    getAmbientPreset(new Date(), { intensityMul })
  );

  useEffect(() => {
    const tick = () =>
      setPreset(getAmbientPreset(new Date(), { intensityMul }));
    tick();
    const id = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [intensityMul]);

  const beamOpacity = Math.min(BEAM_OPACITY_CAP, preset.beam.opacity);
  const moonOpacity = Math.min(0.65, preset.moon.opacity);
  const sunOpacity = Math.min(0.4, preset.sun.opacity);

  const rgba = (rgb: [number, number, number], a: number) =>
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

  const transitionStyle: React.CSSProperties = {
    transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  };

  const beamColor = preset.beam.color;
  const beamGradient = `linear-gradient(${preset.beam.angleDeg}deg, transparent 35%, ${rgba(beamColor, beamOpacity * 0.5)} 48%, ${rgba(beamColor, beamOpacity)} 50%, ${rgba(beamColor, beamOpacity * 0.5)} 52%, transparent 65%)`;

  return (
    <>
      {/* Beam mince qui traverse */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        style={{
          background: beamGradient,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Soleil — visible le jour */}
      {preset.sun.visible && sunOpacity > 0.05 && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-0"
          style={{
            top: `${preset.sun.y}%`,
            left: `${preset.sun.x}%`,
            width: 40,
            height: 40,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            background:
              "radial-gradient(circle at 50% 50%, #fff8d4 0%, #fde68a 50%, #fbbf24 80%, transparent 100%)",
            boxShadow: "0 0 30px 5px rgba(253,224,71,0.3)",
            opacity: sunOpacity,
            ...transitionStyle,
          }}
        />
      )}

      {/* Lune blanche pure — visible la nuit */}
      {preset.moon.visible && moonOpacity > 0.05 && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-0"
          style={{
            top: `${preset.moon.y}%`,
            left: `${preset.moon.x}%`,
            width: 32,
            height: 32,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            background:
              "radial-gradient(circle at 38% 38%, #ffffff 0%, #f1f5f9 65%, transparent 100%)",
            boxShadow: "0 0 25px 6px rgba(255,255,255,0.3)",
            opacity: moonOpacity,
            ...transitionStyle,
          }}
        />
      )}
    </>
  );
};

export default AmbientLightLayer;
