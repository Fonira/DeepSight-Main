/**
 * @deepsight/lighting-engine — Design Tokens
 *
 * Palette de couleurs partagée. Référencée par les 48 keyframes.
 * Si tu veux changer l'identité visuelle, c'est le seul fichier à toucher.
 */

import type { RGB } from "./types.js";

/**
 * Palettes nommées — utilisables directement dans keyframes.ts.
 * Toutes les valeurs sont en sRGB 0..255.
 */
export const PALETTES = {
  // === Lune (nuit) ===
  /** Argenté froid, lune haute */
  moonSilver: [210, 220, 240] as RGB,
  /** Bleu lune profond, minuit */
  moonDeep: [180, 195, 230] as RGB,
  /** Cyan glacé, heure bleue */
  moonIce: [186, 230, 253] as RGB,
  /** Argent chaud, lune basse couchant */
  moonWarm: [220, 215, 230] as RGB,

  // === Soleil (jour) ===
  /** Or chaud lever de soleil */
  sunRise: [255, 215, 160] as RGB,
  /** Or matinal */
  sunMorning: [255, 220, 170] as RGB,
  /** Blanc-or zénith */
  sunNoon: [255, 235, 195] as RGB,
  /** Or apres-midi doré */
  sunGolden: [255, 200, 130] as RGB,
  /** Or chaud descendant */
  sunWarm: [240, 180, 110] as RGB,

  // === Twilight (transitions) ===
  /** Rose terracotta aube */
  twilightDawn: [240, 175, 165] as RGB,
  /** Magic hour orangé */
  twilightOrange: [251, 146, 60] as RGB,
  /** Magenta crépuscule */
  twilightMagenta: [220, 130, 170] as RGB,
  /** Violet nocturne */
  twilightViolet: [168, 132, 220] as RGB,
  /** Indigo soir */
  twilightIndigo: [99, 102, 241] as RGB,

  // === Ambient secondaires ===
  /** Cyan signature DeepSight */
  signatureCyan: [6, 182, 212] as RGB,
  /** Indigo signature DeepSight */
  signatureIndigo: [99, 102, 241] as RGB,
  /** Violet signature DeepSight */
  signatureViolet: [139, 92, 246] as RGB,

  // === Surfaces sombres ===
  /** Fond ambient nuit profond */
  ambientNight: [12, 18, 35] as RGB,
  /** Fond ambient jour */
  ambientDay: [25, 30, 45] as RGB,
} as const;

export type PaletteKey = keyof typeof PALETTES;

/**
 * Mapping easing de transitions.
 * Utilisé par interpolate.ts.
 */
export const EASINGS = {
  linear: (t: number): number => t,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
} as const;

/**
 * Bornes de variation seedée jour-à-jour.
 * Modifier ces valeurs change l'amplitude de la variation.
 */
export const DAILY_VARIATION = {
  /** Angle base ± deg */
  angleDegRange: 15,
  /** Position X moon ± % */
  moonXPercentRange: 5,
  /** Position X sun ± % */
  sunXPercentRange: 8,
  /** Star count multiplier range */
  starDensityMin: 0.7,
  starDensityMax: 1.3,
  /** Hue shift HSL ± deg */
  hueShiftRange: 3,
} as const;

/**
 * Configuration globale du moteur.
 */
export const ENGINE_CONFIG = {
  /** Nombre de keyframes / 24h (DOIT être 48 pour le PRD v2) */
  KEYFRAME_COUNT: 48,
  /** Intervalle entre keyframes en minutes */
  KEYFRAME_INTERVAL_MIN: 30,
  /** Recalcul recommandé toutes les N millisecondes côté UI */
  RECOMPUTE_INTERVAL_MS: 60_000,
} as const;
