// Public API of @deepsight/lighting-engine
export { getAmbientPreset, findKeyframePair, getAmbientPresetV3, } from "./preset.js";
export { KEYFRAMES } from "./keyframes.js";
export { seedFromDate, mulberry32 } from "./seeded-random.js";
export { computeAngleVariation, DAILY_VARIATION } from "./angle-variation.js";
export { getMoonState } from "./moon-trajectory.js";
export { getSunState } from "./sun-trajectory.js";
export { lerp, lerpColor, lerpAngle, rgbToCss, rgbToHex, clamp, } from "./interpolate.js";
export { detectReducedMotion, detectHighContrast, getReadingZoneCap, } from "./accessibility.js";
export { getSpriteFrameIndex } from "./sprite-frame.js";
export { KEYFRAMES_V3 } from "./keyframes.v3.js";
export { SUNFLOWER_PALETTES, SUNFLOWER_PETAL_SCALE, SUNFLOWER_HALOS, getSunflowerPhase, getSunflowerRotation, getSunflowerOpacity, } from "./sunflower-phase.js";
export { buildSunflowerSVG, SUNFLOWER_GEOMETRY } from "./sunflower-svg.js";
