/**
 * SunflowerLayer v3.1 — inline SVG faithful to the official Tournesol logo.
 *
 * Replaces the v3 sprite WebP pipeline. 4 daily phases (dawn/day/dusk/night),
 * heliotropic CSS rotation that follows the sun, bioluminescent halo at night.
 * Two route-aware variants: hero (centered) on landing/auth, mascot (bottom-
 * right) elsewhere.
 */

import { useLocation } from "react-router-dom";
import {
  buildSunflowerSVG,
  getSunflowerPhase,
  getSunflowerRotation,
  getSunflowerOpacity,
  SUNFLOWER_HALOS,
} from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const HERO_ROUTES = ["/", "/login", "/signup", "/forgot-password"];

const TRANSITION =
  "transform 1.5s cubic-bezier(0.4,0,0.2,1), opacity 1.5s cubic-bezier(0.4,0,0.2,1)";

export function SunflowerLayer() {
  const location = useLocation();
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const isHero = HERO_ROUTES.includes(location.pathname);
  const flowerSize = isHero ? 90 : 76;
  const haloSize = Math.round(flowerSize * 1.6);

  const phase = getSunflowerPhase(preset.frameIndex);
  const rotation = getSunflowerRotation(preset.frameIndex);
  const opacity = getSunflowerOpacity(preset.frameIndex);
  const halo = SUNFLOWER_HALOS[phase];

  const containerStyle: React.CSSProperties = isHero
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: haloSize,
        height: haloSize,
        pointerEvents: "none",
        zIndex: 2,
      }
    : {
        position: "fixed",
        bottom: 22 - (haloSize - flowerSize) / 2,
        right: 22 - (haloSize - flowerSize) / 2,
        width: haloSize,
        height: haloSize,
        pointerEvents: "none",
        zIndex: 2,
      };

  return (
    <div
      aria-hidden="true"
      className={isHero ? "sunflower-hero" : "sunflower-mascot"}
      data-sunflower-phase={phase}
      style={containerStyle}
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
          __html: buildSunflowerSVG({ size: flowerSize, phase }),
        }}
      />
    </div>
  );
}

export default SunflowerLayer;
