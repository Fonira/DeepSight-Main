/**
 * AmbientLightLayer (extension sidepanel — v3)
 *
 * Overlay décoratif (beam + halo) consommant le preset v3 via
 * AmbientLightingContext. Rend uniquement quand `enabled=true`.
 *
 * Caractéristiques v3 :
 * - Halo soft top-left (gradient radial avec accent twilight)
 * - Beam fin diagonal (rotation = preset.beam.angleDeg)
 * - mix-blend-mode: screen pour s'intégrer aux fonds sombres
 * - Transitions 4s pour un changement progressif
 */

import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";
import { rgbToCss } from "@deepsight/lighting-engine";

export function AmbientLightLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
  const haloColor = rgbToCss(preset.colors.primary, preset.beam.opacity * 0.5);
  const accentColor = preset.haloAccentColor;

  return (
    <div
      aria-hidden="true"
      className="ambient-light-layer"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 360,
          height: 360,
          background: accentColor
            ? `radial-gradient(circle, ${haloColor} 0%, ${accentColor} 40%, transparent 70%)`
            : `radial-gradient(circle, ${haloColor}, transparent 60%)`,
          filter: "blur(30px)",
          mixBlendMode: "screen",
          transition: "background 4s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "-15%",
          width: "130%",
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${beamColor} 50%, transparent)`,
          boxShadow: `0 0 12px ${beamColor}, 0 0 32px ${beamColor}`,
          transform: `rotate(${preset.beam.angleDeg}deg)`,
          transition:
            "transform 4s cubic-bezier(0.4,0,0.2,1), background 4s, box-shadow 4s",
        }}
      />
    </div>
  );
}
