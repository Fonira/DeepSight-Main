// Sun trajectory: visible from ~05h30 to ~19h, position % across viewport

import { lerp } from "./interpolate";

export interface SunState {
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
}

/**
 * Get sun state at a given hour [0, 24).
 * Rises in the East (right, 75%) around 5h30, sets in the West (left, 18%) around 19h.
 * Peaks at noon (50%, top 18%).
 */
export function getSunState(hour: number): SunState {
  const isDay = hour >= 5.5 && hour < 19.5;
  if (!isDay) {
    return { visible: false, opacity: 0, x: 50, y: 50 };
  }

  // Normalize day progress 0..1 across 14h window
  const dp = (hour - 5.5) / 14;

  // Opacity: rises 5.5-7h, peaks 8-17h, fades 17-19.5h
  let opacity: number;
  if (hour < 7) {
    opacity = lerp(0, 1, (hour - 5.5) / 1.5);
  } else if (hour > 17.5) {
    opacity = lerp(1, 0, (hour - 17.5) / 2);
  } else {
    opacity = 1;
  }

  // X: 75% (East) → 18% (West)
  const x = lerp(75, 18, dp);
  // Y arc: starts at 38%, peaks at noon at 14%, ends at 36%
  const arcLow = 38;
  const arcHigh = 14;
  const arc = arcLow - (arcLow - arcHigh) * (1 - Math.pow(2 * dp - 1, 2));
  const y = arc;

  return { visible: opacity > 0.01, opacity, x, y };
}
