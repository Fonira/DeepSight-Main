/**
 * SunflowerLayer v3.1 — inline SVG faithful to the official Tournesol logo.
 *
 * Toujours rendu en mascot bottom-right (jamais centré). 4 phases (dawn /
 * day / dusk / night), rotation héliotrope CSS qui suit le soleil ±85°,
 * halo bioluminescent pulsant la nuit.
 */

import {
  buildSunflowerSVG,
  getSunflowerPhase,
  getSunflowerRotation,
  getSunflowerOpacity,
  SUNFLOWER_HALOS,
} from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const FLOWER_SIZE = 88;
const HALO_SIZE = Math.round(FLOWER_SIZE * 1.6);
const TRANSITION =
  "transform 1.5s cubic-bezier(0.4,0,0.2,1), opacity 1.5s cubic-bezier(0.4,0,0.2,1)";

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
        bottom: 24 - (HALO_SIZE - FLOWER_SIZE) / 2,
        right: 24 - (HALO_SIZE - FLOWER_SIZE) / 2,
        width: HALO_SIZE,
        height: HALO_SIZE,
        pointerEvents: "none",
        zIndex: 2,
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
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          opacity: opacity * preset.beam.opacity,
          transition: TRANSITION,
        }}
        dangerouslySetInnerHTML={{
          __html: buildSunflowerSVG({ size: FLOWER_SIZE, phase }),
        }}
      />
    </div>
  );
}

export default SunflowerLayer;
