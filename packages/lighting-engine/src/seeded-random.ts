/**
 * @deepsight/lighting-engine — Seeded PRNG (mulberry32)
 *
 * PRNG déterministe pour la variation jour-à-jour.
 * Garantie : même seed → même séquence de valeurs, sur tous OS / runtimes.
 *
 * mulberry32 = 32-bit state, period 2^32 — largement suffisant pour notre cas.
 * Référence : https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */

/**
 * Crée un générateur pseudo-aléatoire déterministe à partir d'un seed.
 * @param seed entier 32-bit non-signé
 * @returns fonction qui retourne un float dans [0, 1)
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calcule un seed numérique stable à partir d'une date.
 * Le seed change chaque jour à minuit local.
 *
 * Formule : (jour-de-l'année × 1009) ^ (année × 31) — primes pour bien mélanger.
 *
 * @param date Date de référence
 * @returns seed entier > 0
 */
export function seedFromDate(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000); // 1..366
  const year = date.getFullYear();
  // Primes choisies pour avalanche correcte
  return (dayOfYear * 1009) ^ (year * 31) ^ 0xc0ffee;
}

/**
 * Helper : retourne un float dans [min, max) à partir d'un PRNG.
 */
export function randomRange(
  rng: () => number,
  min: number,
  max: number,
): number {
  return min + (max - min) * rng();
}

/**
 * Helper : retourne un float dans [-amplitude, +amplitude] à partir d'un PRNG.
 * Pratique pour les variations type "± 15°".
 */
export function randomBipolar(rng: () => number, amplitude: number): number {
  return (rng() * 2 - 1) * amplitude;
}

/**
 * Helper : retourne un entier dans [min, max] inclusif.
 */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
