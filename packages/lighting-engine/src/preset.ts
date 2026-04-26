// Main API: getAmbientPreset(date, opts) — interpolate between keyframes

import { KEYFRAMES } from "./keyframes";
import { KEYFRAMES_V3 } from "./keyframes.v3";
import type {
  AmbientPreset,
  AmbientPresetV3,
  Keyframe,
  PresetOptions,
  PresetOptionsV3,
  RGB,
  BeamType,
} from "./types";
import { lerp, lerpColor, lerpAngle, rgbToCss, clamp } from "./interpolate";
import { seedFromDate } from "./seeded-random";
import { computeAngleVariation } from "./angle-variation";
import { getMoonState } from "./moon-trajectory";
import { getSunState } from "./sun-trajectory";
import { getSpriteFrameIndex } from "./sprite-frame";
import {
  detectReducedMotion,
  detectHighContrast,
  getReadingZoneCap,
} from "./accessibility";

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

// =====================================================================
// v3 — getAmbientPresetV3 (added alongside v2 — does not modify v2)
// =====================================================================

// === v3 brand & layout constants ===
/** Sun & moon screen position for v3 (top-center, fixed). */
const V3_SOURCE_POSITION = { x: 50, y: 20 } as const;
/** Brand indigo-500 — emitted as the tertiary palette color. */
const V3_BRAND_TERTIARY: RGB = [99, 102, 241];
/** Brand indigo-300 — emitted as the accent palette color. */
const V3_BRAND_ACCENT: RGB = [165, 180, 252];
/** Multiplier applied to the capped intensity for the primary ambient layer. */
const V3_AMBIENT_PRIMARY_MUL = 0.3;
/** Multiplier applied to the capped intensity for the secondary ambient layer. */
const V3_AMBIENT_SECONDARY_MUL = 0.2;
/** Multiplier applied to the capped intensity for the tertiary ambient layer. */
const V3_AMBIENT_TERTIARY_MUL = 0.1;
/** Cap applied to the intensity when high-contrast is active. */
const V3_HIGH_CONTRAST_INTENSITY_CAP = 0.3;

/**
 * Find the 2 v3 keyframes surrounding a given hour + interpolation factor.
 * v3 keyframes are also at exact 0.5h increments (48 entries from 0..23.5),
 * but this implementation does an explicit search to remain robust to any
 * future spacing tweak.
 */
function findKeyframeV3Pair(hour: number): {
  fromIdx: number;
  toIdx: number;
  factor: number;
} {
  const exact = KEYFRAMES_V3.findIndex((k) => k.hour === hour);
  if (exact !== -1) return { fromIdx: exact, toIdx: exact, factor: 0 };

  const upperIdx = KEYFRAMES_V3.findIndex((k) => k.hour > hour);
  if (upperIdx === -1) {
    // Wrap : on est entre 23h30 et 00h00
    return { fromIdx: 47, toIdx: 0, factor: (hour - 23.5) / 0.5 };
  }
  if (upperIdx === 0) {
    // hour < 0 : ne devrait pas arriver, fallback safe
    return { fromIdx: 0, toIdx: 0, factor: 0 };
  }
  const fromIdx = upperIdx - 1;
  const from = KEYFRAMES_V3[fromIdx];
  const to = KEYFRAMES_V3[upperIdx];
  const factor = (hour - from.hour) / (to.hour - from.hour);
  return { fromIdx, toIdx: upperIdx, factor };
}

/**
 * v3 — Compute the full ambient preset at a given Date with the v3 palette.
 * Extends v2 with frameIndex (sunflower sprite), nightMode, accessibility
 * flags (reduced-motion, high-contrast), readingZoneIntensityCap, and
 * brand halo accents (haloAccentColor).
 *
 * Important: this is added alongside the v2 `getAmbientPreset` and does not
 * modify it. Consumers should migrate progressively.
 */
export function getAmbientPresetV3(
  date: Date,
  opts: PresetOptionsV3 = {},
): AmbientPresetV3 {
  // forceTime overrides the date argument (testing / dev panel).
  const effectiveDate = opts.forceTime ?? date;
  const totalHour = effectiveDate.getHours() + effectiveDate.getMinutes() / 60;

  // Trouver les 2 keyframes encadrants
  const { fromIdx, toIdx, factor } = findKeyframeV3Pair(totalHour);
  const from = KEYFRAMES_V3[fromIdx];
  const to = KEYFRAMES_V3[toIdx];

  // Détection accessibilité
  const isReducedMotion = detectReducedMotion();
  const isHighContrast = detectHighContrast();

  // Si reduced-motion, geler sur la keyframe la plus proche
  const f = isReducedMotion ? Math.round(factor) : factor;

  // Interpoler
  // v3 angles stay within [-55, +55] (no horizontal wrap needed),
  // so we use plain `lerp` to preserve sign — `lerpAngle` would wrap to [0, 360).
  const angleDeg = lerp(from.beamAngleDeg, to.beamAngleDeg, f);
  const beamRgb = lerpColor(from.beamColor, to.beamColor, f);
  const haloRgb = lerpColor(from.haloPrimary, to.haloPrimary, f);
  const opacity =
    lerp(from.beamOpacity, to.beamOpacity, f) * (opts.intensityMul ?? 1);
  const intensity =
    lerp(from.intensity, to.intensity, f) * (opts.intensityMul ?? 1);

  // Cap intensity en haute-contraste (s'applique aux ambient layers)
  const cappedIntensity = isHighContrast
    ? Math.min(intensity, V3_HIGH_CONTRAST_INTENSITY_CAP)
    : intensity;

  // nightMode : prendre la keyframe la plus proche (pas d'interpolation pour énum).
  // forceNightMode overrides the computed value (testing / dev panel).
  const computedNightMode = factor < 0.5 ? from.nightMode : to.nightMode;
  const nightMode =
    opts.forceNightMode !== undefined ? opts.forceNightMode : computedNightMode;

  // haloAccentColor : si l'une des 2 keyframes en a, garder celle de la plus proche
  const haloAccentColor =
    factor < 0.5 ? from.haloAccentColor : to.haloAccentColor;

  const skipCss = opts.skipCssStrings ?? false;

  return {
    hour: totalHour,
    mood: f < 0.5 ? from.mood : to.mood,
    beam: {
      type: nightMode === "glowing" ? "moon" : "sun",
      color: beamRgb,
      cssColor: skipCss ? undefined : rgbToCss(beamRgb, opacity),
      angleDeg,
      opacity,
    },
    sun: {
      visible: nightMode === null,
      opacity: nightMode === null ? opacity : 0,
      x: V3_SOURCE_POSITION.x,
      y: V3_SOURCE_POSITION.y,
    },
    moon: {
      visible: nightMode !== null,
      opacity: nightMode !== null ? opacity : 0,
      x: V3_SOURCE_POSITION.x,
      y: V3_SOURCE_POSITION.y,
    },
    ambient: {
      primary: V3_AMBIENT_PRIMARY_MUL * cappedIntensity,
      secondary: V3_AMBIENT_SECONDARY_MUL * cappedIntensity,
      tertiary: V3_AMBIENT_TERTIARY_MUL * cappedIntensity,
    },
    starOpacityMul: nightMode !== null ? 1 : 0,
    starDensity: nightMode !== null ? "dense" : "sparse",
    haloX: V3_SOURCE_POSITION.x,
    haloY: V3_SOURCE_POSITION.y,
    colors: {
      primary: haloRgb,
      secondary: beamRgb,
      tertiary: V3_BRAND_TERTIARY,
      rays: beamRgb,
      accent: V3_BRAND_ACCENT,
    },
    // === v3 fields ===
    frameIndex: getSpriteFrameIndex(effectiveDate),
    nightMode,
    haloAccentColor,
    isReducedMotion,
    isHighContrast,
    readingZoneIntensityCap: getReadingZoneCap(intensity, isHighContrast),
  };
}
