/**
 * SunflowerLayer (extension viewer — v3)
 *
 * Affiche le tournesol mascot bottom-right (56×56), animé par le sprite
 * v3 (24 frames, 1/h). Lit le frame index + nightMode via le Context viewer.
 *
 * Sprite path : /assets/ambient/sunflower-{day,night}.webp
 */

import { useAmbientLightingContext } from "../contexts/AmbientLightingContext";

const GRID_COLS = 6;
const DISPLAY_SIZE = 56;

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const sprite =
    preset.nightMode === "glowing"
      ? "sunflower-night.webp"
      : "sunflower-day.webp";
  const col = (preset.frameIndex ?? 0) % GRID_COLS;
  const row = Math.floor((preset.frameIndex ?? 0) / GRID_COLS);

  return (
    <div
      aria-hidden="true"
      className="sunflower-mascot"
      style={{
        position: "fixed",
        bottom: 14,
        right: 14,
        width: DISPLAY_SIZE,
        height: DISPLAY_SIZE,
        backgroundImage: `url(/assets/ambient/${sprite})`,
        backgroundSize: `${DISPLAY_SIZE * GRID_COLS}px auto`,
        backgroundPosition: `-${col * DISPLAY_SIZE}px -${row * DISPLAY_SIZE}px`,
        backgroundRepeat: "no-repeat",
        zIndex: 2,
        pointerEvents: "none",
        opacity: preset.beam.opacity,
        transition:
          "opacity 4s cubic-bezier(0.4,0,0.2,1), background-position 4s",
      }}
    />
  );
}
