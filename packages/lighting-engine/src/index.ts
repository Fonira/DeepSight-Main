// Public API of @deepsight/lighting-engine

export { getAmbientPreset, findKeyframePair } from "./preset";
export { KEYFRAMES } from "./keyframes";
export { seedFromDate, mulberry32 } from "./seeded-random";
export { computeAngleVariation, DAILY_VARIATION } from "./angle-variation";
export { getMoonState } from "./moon-trajectory";
export { getSunState } from "./sun-trajectory";
export {
  lerp,
  lerpColor,
  lerpAngle,
  rgbToCss,
  rgbToHex,
  clamp,
} from "./interpolate";

export type {
  RGB,
  StarDensity,
  BeamType,
  Keyframe,
  KeyframeColors,
  BeamPreset,
  DiscPreset,
  AmbientLayerPreset,
  ColorPalettePreset,
  AmbientPreset,
  PresetOptions,
} from "./types";
