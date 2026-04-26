// Main API: getAmbientPreset(date, opts) — interpolate between keyframes

import { KEYFRAMES } from "./keyframes";
import type {
  AmbientPreset,
  Keyframe,
  PresetOptions,
  RGB,
  BeamType,
} from "./types";
import { lerp, lerpColor, lerpAngle, rgbToCss, clamp } from "./interpolate";
import { seedFromDate } from "./seeded-random";
import { computeAngleVariation } from "./angle-variation";
import { getMoonState } from "./moon-trajectory";
import { getSunState } from "./sun-trajectory";

/**
 * Find the two keyframes surrounding a given hour, with wrap-around.
 * Returns { from, to, factor } where factor is in [0, 1).
 */
export function findKeyframePair(hour: number): {
  from: Keyframe;
  to: Keyframe;
  factor: number;
} {
  const h = ((hour % 24) + 24) % 24;
  const slot = h / 0.5; // 0..47.999
  const i = Math.floor(slot) % 48;
  const next = (i + 1) % 48;
  const factor = slot - Math.floor(slot);
  return { from: KEYFRAMES[i], to: KEYFRAMES[next], factor };
}

/**
 * Choose a beam type when from→to are different (twilight when they differ).
 */
function blendBeamType(from: BeamType, to: BeamType, factor: number): BeamType {
  if (from === to) return from;
  // Mid-blend: anything between sun & moon (or with twilight) → twilight
  if (factor < 0.05) return from;
  if (factor > 0.95) return to;
  return "twilight";
}

/**
 * Compute the full ambient preset at a given Date.
 */
export function getAmbientPreset(
  date: Date = new Date(),
  opts: PresetOptions = {},
): AmbientPreset {
  const intensityMul = opts.intensityMul ?? 1;
  const skipCss = opts.skipCssStrings ?? false;
  const disableVariation = opts.disableDailyVariation ?? false;
  const seed = opts.seedOverride ?? seedFromDate(date);

  const hour =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const { from, to, factor } = findKeyframePair(hour);

  // Angle variation — daily seed
  const angleVar = disableVariation ? 0 : computeAngleVariation(seed, hour);

  // Beam
  const beamType = blendBeamType(from.beamType, to.beamType, factor);
  const beamColor: RGB = lerpColor(from.beamColor, to.beamColor, factor);
  const baseAngle = lerpAngle(from.beamAngleDeg, to.beamAngleDeg, factor);
  const beamAngleDeg = (baseAngle + angleVar + 360) % 360;
  const beamOpacity = clamp(
    lerp(from.beamOpacity, to.beamOpacity, factor) * intensityMul,
  );

  // Discs — use trajectory functions for smooth motion
  const sunState = getSunState(hour);
  const moonState = getMoonState(hour);

  // Ambient layers
  const ambientPrimary = clamp(
    lerp(from.ambientPrimary, to.ambientPrimary, factor) * intensityMul,
  );
  const ambientSecondary = clamp(
    lerp(from.ambientSecondary, to.ambientSecondary, factor) * intensityMul,
  );
  const ambientTertiary = clamp(
    lerp(from.ambientTertiary, to.ambientTertiary, factor) * intensityMul,
  );

  // Stars
  const starOpacityMul =
    lerp(from.starOpacityMul, to.starOpacityMul, factor) * intensityMul;
  const starDensity = factor < 0.5 ? from.starDensity : to.starDensity;

  // Halo center
  const haloX = lerp(from.haloX, to.haloX, factor);
  const haloY = lerp(from.haloY, to.haloY, factor);

  // Colors palette
  const primary = lerpColor(from.colors.primary, to.colors.primary, factor);
  const secondary = lerpColor(
    from.colors.secondary,
    to.colors.secondary,
    factor,
  );
  const tertiary = lerpColor(from.colors.tertiary, to.colors.tertiary, factor);
  const rays = lerpColor(from.colors.rays, to.colors.rays, factor);
  const accent = lerpColor(from.colors.accent, to.colors.accent, factor);

  // Mood
  const mood =
    factor < 0.05
      ? from.mood
      : factor > 0.95
        ? to.mood
        : `${from.mood} → ${to.mood}`;

  const preset: AmbientPreset = {
    hour,
    mood,
    beam: {
      type: beamType,
      color: beamColor,
      angleDeg: beamAngleDeg,
      opacity: beamOpacity,
    },
    sun: {
      visible: sunState.visible,
      opacity: clamp(sunState.opacity * intensityMul),
      x: sunState.x,
      y: sunState.y,
    },
    moon: {
      visible: moonState.visible,
      opacity: clamp(moonState.opacity * intensityMul),
      x: moonState.x,
      y: moonState.y,
    },
    ambient: {
      primary: ambientPrimary,
      secondary: ambientSecondary,
      tertiary: ambientTertiary,
    },
    starOpacityMul,
    starDensity,
    haloX,
    haloY,
    colors: {
      primary,
      secondary,
      tertiary,
      rays,
      accent,
    },
    debug: {
      factor,
      fromMood: from.mood,
      toMood: to.mood,
      seed,
      angleVariation: angleVar,
    },
  };

  if (!skipCss) {
    preset.beam.cssColor = rgbToCss(beamColor, beamOpacity);
    preset.colors.cssPrimary = rgbToCss(primary, ambientPrimary);
    preset.colors.cssSecondary = rgbToCss(secondary, ambientSecondary);
    preset.colors.cssTertiary = rgbToCss(tertiary, ambientTertiary);
    preset.colors.cssRays = rgbToCss(rays, beamOpacity);
    preset.colors.cssAccent = rgbToCss(accent, 0.7);
  }

  return preset;
}
