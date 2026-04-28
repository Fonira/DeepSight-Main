/**
 * AmbientLightLayer v3 — Slim ambient lighting layer driven by AmbientPresetV3.
 *
 * Consumes the live preset from AmbientLightingContext (refresh every 30s).
 * Renders two layers (no DOM if provider is disabled):
 *   1. Halo — soft radial gradient on the upper-left, optionally with an accent
 *      gradient stop for twilight transitions.
 *   2. Beam — thin, bright "sun ray" rotated by preset.beam.angleDeg.
 *
 * Backward-compatible props (intensity, doodle, doodleOpacity, fixed) are
 * accepted but currently ignored — the v3 engine drives all visual output.
 * The `fixed` prop is honored to keep prior callers working.
 */

import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";
import { rgbToCss } from "@deepsight/lighting-engine";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  /** Deprecated — kept for backward compat with v2 callers. */
  intensity?: Intensity;
  /** Deprecated — kept for backward compat with v2 callers. */
  doodle?: "default" | "video" | "academic" | "analysis" | "tech" | "creative";
  /** Deprecated — kept for backward compat with v2 callers. */
  doodleOpacity?: number;
  /** When true (default) the layer is fixed to the viewport. */
  fixed?: boolean;
}

export function AmbientLightLayer(_props: AmbientLightLayerProps = {}) {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
  const haloColor = rgbToCss(preset.colors.primary, preset.beam.opacity * 0.5);
  const accentColor = preset.haloAccentColor;

  return (
    <div
      data-ambient="layer"
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
      {/* Halo source — soft radial gradient with optional accent stop */}
      <div
        className="ambient-halo"
        style={{
          position: "absolute",
          top: -150,
          left: -150,
          width: 500,
          height: 500,
          background: accentColor
            ? `radial-gradient(circle, ${haloColor} 0%, ${accentColor} 40%, transparent 70%)`
            : `radial-gradient(circle, ${haloColor}, transparent 60%)`,
          filter: "blur(40px)",
          mixBlendMode: "screen",
          transition: "background 4s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Beam — thin linear gradient with halo glow */}
      <div
        className="ambient-beam"
        style={{
          position: "absolute",
          top: "50%",
          left: "-15%",
          width: "130%",
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${beamColor} 50%, transparent)`,
          boxShadow: `0 0 12px ${beamColor}, 0 0 32px ${beamColor}, 0 0 80px ${beamColor}`,
          transform: `rotate(${preset.beam.angleDeg}deg)`,
          transformOrigin: "center",
          transition:
            "transform 4s cubic-bezier(0.4,0,0.2,1), background 4s, box-shadow 4s",
        }}
      />
    </div>
  );
}

export default AmbientLightLayer;
