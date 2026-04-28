/**
 * SunflowerLayer v3.1 — extension viewer mascot.
 *
 * SVG inline avec tige + 2 feuilles + tête héliotrope. Identique au sidepanel
 * mais branché sur le Context viewer (entry webpack distincte).
 */

import {
  buildSunflowerSVG,
  getSunflowerPhase,
  getSunflowerRotation,
  getSunflowerOpacity,
  SUNFLOWER_HALOS,
} from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const FLOWER_WIDTH = 60;
const SVG_HEIGHT = Math.round((FLOWER_WIDTH * 280) / 200);
const HALO_SIZE = Math.round(FLOWER_WIDTH * 1.6);
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
        bottom: 14,
        right: 14,
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
