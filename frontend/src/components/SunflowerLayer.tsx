/**
 * SunflowerLayer v3.1 — full sunflower (stem + leaves + heliotropic head).
 *
 * Mascot bottom-right. Le SVG inline contient maintenant la tige verte
 * courbée + 2 feuilles + la tête qui pivote autour de son point d'attache
 * à la tige (vraie héliotropie : la tige reste plantée, la tête s'incline).
 * 4 phases (dawn/day/dusk/night) + halo bioluminescent pulsant la nuit.
 */

import {
  buildSunflowerSVG,
  getSunflowerPhase,
  getSunflowerRotation,
  getSunflowerOpacity,
  SUNFLOWER_HALOS,
} from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const FLOWER_WIDTH = 88;
const SVG_HEIGHT = Math.round((FLOWER_WIDTH * 280) / 200); // 123 — ratio viewBox
const HALO_SIZE = Math.round(FLOWER_WIDTH * 1.6); // 141
// Centre la tête au milieu du halo (la tête est à ~36% de la hauteur du SVG)
const HEAD_Y_IN_SVG = (SVG_HEIGHT * 100) / 280;
const SVG_TOP = HALO_SIZE / 2 - HEAD_Y_IN_SVG;

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const phase = getSunflowerPhase(preset.frameIndex);
  const rotation = getSunflowerRotation(preset.frameIndex);
  const opacity = getSunflowerOpacity(preset.frameIndex);
  const halo = SUNFLOWER_HALOS[phase];

  return (
    <div
      aria-hidden="true"
      className="sunflower-mascot"
      data-sunflower-phase={phase}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: HALO_SIZE,
        height: HALO_SIZE,
        pointerEvents: "none",
        zIndex: 2,
        overflow: "visible",
      }}
    >
      <div
        className={
          halo.pulse
            ? "ds-sunflower-halo ds-sunflower-halo--pulse"
            : "ds-sunflower-halo"
        }
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: halo.gradient,
          transition: "background 1.5s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: SVG_TOP,
          left: "50%",
          transform: "translateX(-50%)",
          width: FLOWER_WIDTH,
          height: SVG_HEIGHT,
          opacity: opacity * preset.beam.opacity,
          transition: "opacity 1.5s cubic-bezier(0.4,0,0.2,1)",
        }}
        dangerouslySetInnerHTML={{
          __html: buildSunflowerSVG({
            size: FLOWER_WIDTH,
            phase,
            rotation,
          }),
        }}
      />
    </div>
  );
}

export default SunflowerLayer;
