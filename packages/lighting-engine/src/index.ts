// Public API of @deepsight/lighting-engine

export {
  getAmbientPreset,
  findKeyframePair,
  getAmbientPresetV3,
} from "./preset";
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
export {
  detectReducedMotion,
  detectHighContrast,
  getReadingZoneCap,
} from "./accessibility";
export { getSpriteFrameIndex } from "./sprite-frame";
export { KEYFRAMES_V3 } from "./keyframes.v3";
export type { KeyframeV3 } from "./keyframes.v3";

export type {
  RGB,
  StarDensity,
  BeamType,
  NightMode,
  Keyframe,
  KeyframeColors,
  BeamPreset,
  DiscPreset,
  AmbientLayerPreset,
  ColorPalettePreset,
  AmbientPreset,
  AmbientPresetV3,
  PresetOptions,
  PresetOptionsV3,
} from "./types";
