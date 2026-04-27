/**
 * SunflowerLayer — Route-aware sunflower mascot that follows the sun trajectory.
 *
 * Two variants based on the current route:
 *   - hero    (on landing/auth routes): centered, larger sprite (90×90)
 *   - mascot  (everywhere else):        bottom-right corner, smaller (76×76)
 *
 * Uses sprite sheet driven by AmbientPresetV3.frameIndex (0..23 → 24 frames
 * laid out 6×4 in a 1536×1024 webp). Day/night variant chosen by preset.
 */

import { useLocation } from "react-router-dom";
import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const HERO_ROUTES = ["/", "/login", "/signup", "/forgot-password"];
const GRID_COLS = 6;

function getSpritePosition(frameIndex: number, displaySize: number): string {
  const col = frameIndex % GRID_COLS;
  const row = Math.floor(frameIndex / GRID_COLS);
  return `-${col * displaySize}px -${row * displaySize}px`;
}

export function SunflowerLayer() {
  const location = useLocation();
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const isHero = HERO_ROUTES.includes(location.pathname);
  const sprite =
    preset.nightMode === "glowing"
      ? "sunflower-night.webp"
      : "sunflower-day.webp";
  const url = `/assets/ambient/${sprite}`;
  const displaySize = isHero ? 90 : 76;
  const position = getSpritePosition(preset.frameIndex, displaySize);

  if (isHero) {
    return (
      <div
        aria-hidden="true"
        className="sunflower-hero"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: displaySize,
          height: displaySize,
          backgroundImage: `url(${url})`,
          backgroundSize: `${displaySize * GRID_COLS}px auto`,
          backgroundPosition: position,
          backgroundRepeat: "no-repeat",
          backgroundClip: "border-box",
          imageRendering: "crisp-edges",
          pointerEvents: "none",
          zIndex: 2,
          opacity: preset.beam.opacity * 0.9,
          transition: "opacity 4s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="sunflower-mascot"
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        width: displaySize,
        height: displaySize,
        backgroundImage: `url(${url})`,
        backgroundSize: `${displaySize * GRID_COLS}px auto`,
        backgroundPosition: position,
        backgroundRepeat: "no-repeat",
        pointerEvents: "none",
        zIndex: 2,
        opacity: preset.beam.opacity,
        transition:
          "opacity 4s cubic-bezier(0.4,0,0.2,1), background-position 4s",
      }}
    />
  );
}

export default SunflowerLayer;
