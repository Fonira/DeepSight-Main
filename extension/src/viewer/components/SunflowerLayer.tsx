/**
 * SunflowerLayer v3.1 — extension viewer mascot.
 *
 * Mascot positionné au coin opposé au soleil. Identique au sidepanel mais
 * branché sur le Context viewer (entry webpack distincte).
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

function pickCorner(
  sunX: number,
  sunVisible: boolean,
  moonX: number,
): "left" | "right" {
  const x = sunVisible ? sunX : moonX;
  return x > 50 ? "left" : "right";
}

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const phase = getSunflowerPhase(preset.frameIndex);
  const rotation = getSunflowerRotation(preset.frameIndex);
  const opacity = getSunflowerOpacity(preset.frameIndex);
  const halo = SUNFLOWER_HALOS[phase];
  const corner = pickCorner(preset.sun.x, preset.sun.visible, preset.moon.x);
  const edgeOffset = 14 - (HALO_SIZE - FLOWER_SIZE) / 2;

  return (
    <div
      aria-hidden="true"
      className="sunflower-mascot"
      data-sunflower-phase={phase}
      data-sunflower-corner={corner}
      style={{
        position: "fixed",
        bottom: edgeOffset,
        ...(corner === "left" ? { left: edgeOffset } : { right: edgeOffset }),
        width: HALO_SIZE,
        height: HALO_SIZE,
        pointerEvents: "none",
        zIndex: 2,
        transition:
          "left 2s cubic-bezier(0.4,0,0.2,1), right 2s cubic-bezier(0.4,0,0.2,1)",
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
