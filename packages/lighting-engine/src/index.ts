/**
 * @deepsight/lighting-engine — Public API
 *
 * Point d'entrée unique : `getAmbientPreset(date)` → AmbientPreset complet.
 *
 * Usage :
 *   ```ts
 *   import { getAmbientPreset } from "@deepsight/lighting-engine";
 *   const preset = getAmbientPreset(new Date());
 *   // preset.centralBeam.cssColor → "rgba(210, 220, 240, 0.18)"
 *   // preset.centralBeam.angleDeg → 132.5 (avec variation seedée)
 *   ```
 */

import type { AmbientPreset, AmbientPresetOptions, RGB } from "./types.js";
import { findKeyframePair, validateKeyframes } from "./keyframes.js";
import {
  clamp,
  clamp01,
  lerp,
  lerpAngle,
  lerpBoolean,
  lerpColor,
  lerpEased,
  rgbToCss,
  shiftHue,
} from "./interpolate.js";
import { seedFromDate } from "./seeded-random.js";
import {
  computeAngleVariation,
  computeHueShift,
  computePositionVariation,
  computeStarDensityMul,
} from "./angle-variation.js";
import {
  computeBeamBlend,
  computeMoonPosition,
  computeSunPosition,
} from "./moon-trajectory.js";
import { DAILY_VARIATION } from "./tokens.js";

// Re-exports publics
export type {
  AmbientPreset,
  AmbientPresetOptions,
  Keyframe,
  RGB,
  BeamType,
} from "./types.js";
export { KEYFRAMES, findKeyframePair, validateKeyframes } from "./keyframes.js";
export { PALETTES, EASINGS, ENGINE_CONFIG, DAILY_VARIATION } from "./tokens.js";
export { mulberry32, seedFromDate } from "./seeded-random.js";
export {
  computeAngleVariation,
  computePositionVariation,
  computeStarDensityMul,
  computeHueShift,
} from "./angle-variation.js";
export {
  computeMoonPosition,
  computeSunPosition,
  computeBeamBlend,
} from "./moon-trajectory.js";
export {
  rgbToCss,
  rgbToHsl,
  hslToRgb,
  shiftHue,
  lerp,
  lerpColor,
  lerpAngle,
} from "./interpolate.js";

/**
 * Cœur du moteur : calcule l'AmbientPreset pour un instant donné.
 *
 * @param date — instant cible (default: now)
 * @param options — overrides pour testing/debug
 * @returns AmbientPreset prêt à consommer côté UI
 */
export function getAmbientPreset(
  date: Date = new Date(),
  options: AmbientPresetOptions = {},
): AmbientPreset {
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const {
    intensityMul = 1,
    seedOverride,
    disableDailyVariation = false,
    skipCssStrings = false,
  } = options;

  // 1. Heure décimale
  const hourDecimal =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  // 2. Trouver les 2 keyframes encadrantes + facteur d'interpolation
  const { from, to, factor } = findKeyframePair(hourDecimal);

  // 3. Seed du jour
  const seed = seedOverride ?? seedFromDate(date);

  // 4. Variations seedées
  const angleVariation = disableDailyVariation
    ? 0
    : computeAngleVariation(seed, hourDecimal);
  const hueShift = disableDailyVariation ? 0 : computeHueShift(seed);
  const starDensityMul = disableDailyVariation
    ? 1
    : computeStarDensityMul(seed);

  // 5. Cross-fade sun/moon pendant twilight
  const beamBlend = computeBeamBlend(hourDecimal);

  // 6. Interpolation entre les 2 keyframes
  const beamColor = lerpColor(
    from.centralBeam.color,
    to.centralBeam.color,
    factor,
  );
  const beamColorShifted = disableDailyVariation
    ? beamColor
    : shiftHue(beamColor, hueShift);
  const beamAngleBase = lerpAngle(
    from.centralBeam.angleDeg,
    to.centralBeam.angleDeg,
    factor,
  );
  const beamAngle = (beamAngleBase + angleVariation + 360) % 360;
  const beamOpacity =
    lerpEased(
      from.centralBeam.opacity,
      to.centralBeam.opacity,
      factor,
      "easeInOutSine",
    ) * intensityMul;
  const beamBlur = lerp(from.centralBeam.blurPx, to.centralBeam.blurPx, factor);

  // Type de beam : prend celui de la keyframe la plus proche, sauf en twilight
  // → on respecte computeBeamBlend()
  const beamType: AmbientPreset["centralBeam"]["type"] =
    beamBlend.twilightFactor > 0.1
      ? "twilight"
      : factor < 0.5
        ? from.centralBeam.type
        : to.centralBeam.type;

  // 7. Ambient (3 couches)
  const ambientPrimary = lerpColor(
    from.ambient.primary,
    to.ambient.primary,
    factor,
  );
  const ambientSecondary = lerpColor(
    from.ambient.secondary,
    to.ambient.secondary,
    factor,
  );
  const ambientTertiary = lerpColor(
    from.ambient.tertiary,
    to.ambient.tertiary,
    factor,
  );
  const ambientPrimaryOpacity =
    lerpEased(
      from.ambient.primaryOpacity,
      to.ambient.primaryOpacity,
      factor,
      "easeInOutCubic",
    ) * intensityMul;
  const ambientSecondaryOpacity =
    lerpEased(
      from.ambient.secondaryOpacity,
      to.ambient.secondaryOpacity,
      factor,
      "easeInOutCubic",
    ) * intensityMul;
  const ambientTertiaryOpacity =
    lerpEased(
      from.ambient.tertiaryOpacity,
      to.ambient.tertiaryOpacity,
      factor,
      "easeInOutCubic",
    ) * intensityMul;

  const ambientPrimaryShifted = disableDailyVariation
    ? ambientPrimary
    : shiftHue(ambientPrimary, hueShift);

  // 8. Stars
  const starsDensityRaw = lerp(from.stars.density, to.stars.density, factor);
  const starsDensity = clamp01(starsDensityRaw * starDensityMul);
  const starsOpacity = clamp01(
    lerp(from.stars.opacity, to.stars.opacity, factor) * intensityMul,
  );

  // 9. Moon position — utilise la trajectoire calculée + variation seedée
  const moonTraj = computeMoonPosition(hourDecimal);
  const moonXVariation = disableDailyVariation
    ? 0
    : computePositionVariation(
        seed,
        hourDecimal,
        DAILY_VARIATION.moonXPercentRange,
      );
  const moonInterpVisible = lerpBoolean(
    from.moon.visible,
    to.moon.visible,
    factor,
  );
  const moonOpacityKf = lerp(from.moon.opacity, to.moon.opacity, factor);
  // Final visibility = AND entre keyframe et trajectoire
  const moonVisible = moonInterpVisible && moonTraj.visible;
  const moonOpacity = clamp01(
    moonOpacityKf * (moonTraj.visible ? 1 : 0) * intensityMul,
  );

  // 10. Sun position
  const sunTraj = computeSunPosition(hourDecimal);
  const sunXVariation = disableDailyVariation
    ? 0
    : computePositionVariation(
        seed ^ 0x12,
        hourDecimal,
        DAILY_VARIATION.sunXPercentRange,
      );
  const sunInterpVisible = lerpBoolean(
    from.sun.visible,
    to.sun.visible,
    factor,
  );
  const sunOpacityKf = lerp(from.sun.opacity, to.sun.opacity, factor);
  const sunVisible = sunInterpVisible && sunTraj.visible;
  const sunOpacity = clamp01(
    sunOpacityKf * (sunTraj.visible ? 1 : 0) * intensityMul,
  );

  // 11. Ray halo
  const rayHaloOpacity =
    lerp(from.rayHalo.topOpacity, to.rayHalo.topOpacity, factor) * intensityMul;

  // 12. CSS strings (skippable pour perf)
  const beamCssColor = skipCssStrings
    ? ""
    : rgbToCss(beamColorShifted, clamp01(beamOpacity));

  const ambientCssGradient = skipCssStrings
    ? ""
    : buildAmbientGradient(
        ambientPrimaryShifted,
        ambientSecondary,
        ambientTertiary,
        ambientPrimaryOpacity,
        ambientSecondaryOpacity,
        ambientTertiaryOpacity,
      );

  // 13. Compose le mood interpolé
  const mood =
    factor < 0.05
      ? from.mood
      : factor > 0.95
        ? to.mood
        : `${from.mood} → ${to.mood}`;

  const t1 =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    hour: hourDecimal,
    mood,
    centralBeam: {
      type: beamType,
      cssColor: beamCssColor,
      rgb: beamColorShifted,
      opacity: clamp01(beamOpacity),
      angleDeg: beamAngle,
      blurPx: clamp(beamBlur, 0, 40),
    },
    ambient: {
      primary: ambientPrimaryShifted,
      secondary: ambientSecondary,
      tertiary: ambientTertiary,
      primaryOpacity: clamp01(ambientPrimaryOpacity),
      secondaryOpacity: clamp01(ambientSecondaryOpacity),
      tertiaryOpacity: clamp01(ambientTertiaryOpacity),
      cssGradient: ambientCssGradient,
    },
    stars: {
      density: starsDensity,
      opacity: starsOpacity,
    },
    moon: {
      visible: moonVisible,
      xPercent: clamp(moonTraj.xPercent + moonXVariation, 0, 100),
      yPercent: moonTraj.yPercent,
      opacity: moonOpacity,
    },
    sun: {
      visible: sunVisible,
      xPercent: clamp(sunTraj.xPercent + sunXVariation, 0, 100),
      yPercent: sunTraj.yPercent,
      opacity: sunOpacity,
    },
    rayHalo: {
      topOpacity: clamp01(rayHaloOpacity),
    },
    _debug: {
      fromKeyframe: from.mood,
      toKeyframe: to.mood,
      factor,
      seed,
      angleVariation,
      computeTimeMs: t1 - t0,
    },
  };
}

/**
 * Construit le gradient CSS complet à 3 couches (radial gradients superposés).
 * Format adapté pour `background:` côté web.
 */
function buildAmbientGradient(
  primary: RGB,
  secondary: RGB,
  tertiary: RGB,
  pOp: number,
  sOp: number,
  tOp: number,
): string {
  const p = rgbToCss(primary, clamp01(pOp));
  const s = rgbToCss(secondary, clamp01(sOp));
  const t = rgbToCss(tertiary, clamp01(tOp));
  return [
    `radial-gradient(ellipse 80% 50% at 50% 0%, ${p} 0%, transparent 60%)`,
    `radial-gradient(ellipse 45% 35% at 10% 100%, ${s} 0%, transparent 50%)`,
    `radial-gradient(ellipse 50% 40% at 90% 90%, ${t} 0%, transparent 50%)`,
  ].join(", ");
}

/**
 * Helper : check le moteur est correctement configuré au boot.
 * À appeler une fois (ex: dans un useEffect au mount), throw si invalid.
 */
export function assertEngineHealthy(): void {
  const v = validateKeyframes();
  if (!v.valid) {
    throw new Error(
      `[lighting-engine] Invalid keyframes: ${v.errors.join("; ")}`,
    );
  }
}
