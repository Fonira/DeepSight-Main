/**
 * AmbientLightLayer (extension viewer) — version plein écran (tab dédié).
 *
 * Le viewer est ouvert dans une nouvelle tab avec le contenu d'analyse complet.
 * On peut se permettre une version proche de la web (ambient gradient + beam +
 * lune/soleil), mais sans étoiles ni doodles (qui n'existent pas dans
 * l'extension).
 */

import React, { useEffect, useState } from "react";
import {
  getAmbientPreset,
  type AmbientPreset,
} from "@deepsight/lighting-engine";

const REFRESH_INTERVAL_MS = 30_000;

interface AmbientLightLayerProps {
  intensity?: "soft" | "normal" | "strong";
}

const INTENSITY_MUL: Record<NonNullable<AmbientLightLayerProps["intensity"]>, number> = {
  soft: 0.7,
  normal: 1,
  strong: 1.2,
};

const TRANSITION_MS = 1500;

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
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

  const rgba = (rgb: [number, number, number], a: number) =>
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

  const transitionStyle: React.CSSProperties = {
    transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  };

  const beamColor = preset.beam.color;
  const beamGradient = `linear-gradient(${preset.beam.angleDeg}deg, transparent 35%, ${rgba(beamColor, preset.beam.opacity * 0.5)} 48%, ${rgba(beamColor, preset.beam.opacity)} 50%, ${rgba(beamColor, preset.beam.opacity * 0.5)} 52%, transparent 65%)`;

  return (
    <>
      {/* Calque ambient gradient (3 spots) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background: `radial-gradient(ellipse 80% 50% at ${preset.haloX}% ${preset.haloY}%, ${rgba(preset.colors.primary, preset.ambient.primary)} 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 10% 100%, ${rgba(preset.colors.secondary, preset.ambient.secondary)} 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 90% 90%, ${rgba(preset.colors.tertiary, preset.ambient.tertiary)} 0%, transparent 50%)`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Beam */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
        style={{
          background: beamGradient,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Soleil */}
      {preset.sun.visible && preset.sun.opacity > 0.05 && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[1]"
          style={{
            top: `${preset.sun.y}%`,
            left: `${preset.sun.x}%`,
            width: 84,
            height: 84,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            background:
              "radial-gradient(circle at 50% 50%, #fff8d4 0%, #fde68a 50%, #fbbf24 80%, transparent 100%)",
            boxShadow:
              "0 0 80px 20px rgba(253,224,71,0.35), 0 0 160px 50px rgba(251,191,36,0.18)",
            opacity: preset.sun.opacity,
            ...transitionStyle,
          }}
        />
      )}

      {/* Lune */}
      {preset.moon.visible && preset.moon.opacity > 0.05 && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[1]"
          style={{
            top: `${preset.moon.y}%`,
            left: `${preset.moon.x}%`,
            width: 72,
            height: 72,
            borderRadius: "50%",
            transform: "translate(-50%, 0)",
            background:
              "radial-gradient(circle at 38% 38%, #ffffff 0%, #f1f5f9 60%, #cbd5e1 85%, transparent 100%)",
            boxShadow:
              "0 0 50px 10px rgba(255,255,255,0.35), 0 0 110px 28px rgba(186,230,253,0.18)",
            opacity: preset.moon.opacity,
            ...transitionStyle,
          }}
        />
      )}
    </>
  );
};

export default AmbientLightLayer;
