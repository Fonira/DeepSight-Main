/**
 * SunflowerLayer v3.1 — extension viewer mascot (56×56).
 *
 * Inline SVG fidèle au logo Tournesol officiel. 4 phases (dawn/day/dusk/
 * night), rotation héliotrope CSS, halo bioluminescent la nuit. Identique
 * au sidepanel mais branché sur le Context viewer (entry webpack distincte).
 */

import {
  buildSunflowerSVG,
  getSunflowerPhase,
  getSunflowerRotation,
  getSunflowerOpacity,
  SUNFLOWER_HALOS,
} from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const FLOWER_SIZE = 56;
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
        bottom: 14 - (HALO_SIZE - FLOWER_SIZE) / 2,
        right: 14 - (HALO_SIZE - FLOWER_SIZE) / 2,
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
