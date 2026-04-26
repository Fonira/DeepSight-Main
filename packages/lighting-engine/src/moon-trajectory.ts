// Moon trajectory: visible from ~17h to ~07h, position % across viewport

import { lerp } from "./interpolate";

export interface MoonState {
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
}

export function getMoonState(hour: number): MoonState {
  const isNight = hour >= 17 || hour < 7;
  if (!isNight) {
    return { visible: false, opacity: 0, x: 50, y: 30 };
  }

  let np: number;
  if (hour >= 17) {
    np = (hour - 17) / 14;
  } else {
    np = (hour + 7) / 14;
  }

  let opacity: number;
  if (hour >= 17 && hour < 19) {
    opacity = lerp(0, 1, (hour - 17) / 2);
  } else if (hour >= 5 && hour < 7) {
    opacity = lerp(1, 0, (hour - 5) / 2);
  } else {
    opacity = 1;
  }

  const x = lerp(80, 15, np);
  const arcLow = 40;
  const arcHigh = 12;
  const arc = arcLow - (arcLow - arcHigh) * (1 - Math.pow(2 * np - 1, 2));
  const y = arc;

  return { visible: opacity > 0.01, opacity, x, y };
}
