/**
 * @deepsight/lighting-engine — Angle Variation
 *
 * Calcule la variation seedée appliquée à l'angle base d'une keyframe.
 * Le but : que 2 jours consécutifs n'aient pas exactement le même angle de
 * lumière à la même heure, mais que ça reste déterministe (reload = pareil).
 */

import { mulberry32, randomBipolar } from "./seeded-random.js";
import { DAILY_VARIATION } from "./tokens.js";

/**
 * Calcule la variation d'angle pour une heure donnée et un seed donné.
 *
 * La variation oscille lentement au cours de la journée pour créer un sentiment
 * de mouvement continu plutôt que d'angles aléatoires saccadés.
 *
 * Algorithme :
 *   1. Hash (seed, hourBucket) en pseudo-random [-1, 1]
 *   2. Multiplie par DAILY_VARIATION.angleDegRange (default ± 15°)
 *   3. Lisse avec une sinusoïde de période 6h pour éviter les sauts
 *
 * @param seed seed du jour (issu de seedFromDate)
 * @param hourDecimal heure 0..24 (peut être fractionnel)
 * @returns variation en degrés, dans [-angleDegRange, +angleDegRange]
 */
export function computeAngleVariation(
  seed: number,
  hourDecimal: number,
): number {
  // Hash du seed pour 4 buckets de la journée (matin/après-midi/soir/nuit)
  const rng = mulberry32(seed);
  const offsets = [rng(), rng(), rng(), rng()].map((v) => (v - 0.5) * 2); // [-1, 1]

  // Sinusoïde sur la journée pour transition douce entre les 4 offsets
  const phase = (hourDecimal / 24) * Math.PI * 2;
  // Combine les 4 offsets via 4 phases différentes — créé un mouvement organique
  const wave =
    offsets[0] * Math.sin(phase) +
    offsets[1] * Math.cos(phase * 1.5) * 0.6 +
    offsets[2] * Math.sin(phase * 2.3) * 0.3 +
    offsets[3] * Math.cos(phase * 0.7) * 0.4;

  // Normalise dans [-1, 1] (somme des amplitudes = 1 + 0.6 + 0.3 + 0.4 = 2.3)
  const normalized = wave / 2.3;

  return normalized * DAILY_VARIATION.angleDegRange;
}

/**
 * Variation X% pour position lune/soleil. Plus subtile que l'angle.
 */
export function computePositionVariation(
  seed: number,
  hourDecimal: number,
  rangeBipolar: number,
): number {
  const rng = mulberry32(seed ^ 0x5a5a5a5a); // sub-seed différent de l'angle
  const offset = randomBipolar(rng, 1);
  const phase = (hourDecimal / 24) * Math.PI * 2;
  return Math.sin(phase + offset) * rangeBipolar;
}

/**
 * Multiplicateur de densité d'étoiles seedé.
 * Retourne un float dans [DAILY_VARIATION.starDensityMin, starDensityMax].
 */
export function computeStarDensityMul(seed: number): number {
  const rng = mulberry32(seed ^ 0xa5a5a5a5);
  const range = DAILY_VARIATION.starDensityMax - DAILY_VARIATION.starDensityMin;
  return DAILY_VARIATION.starDensityMin + rng() * range;
}

/**
 * Shift de teinte HSL en degrés pour la journée.
 * Utilisé sur les couleurs ambient (plus discret que sur le centralBeam).
 */
export function computeHueShift(seed: number): number {
  const rng = mulberry32(seed ^ 0x12345678);
  return randomBipolar(rng, DAILY_VARIATION.hueShiftRange);
}
