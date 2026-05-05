/**
 * Sunflower v3.1 — phase + heliotrope helpers (SVG vector approach).
 *
 * Replaces the v3 sprite WebP pipeline. The sunflower is now an inline SVG
 * faithful to the official Tournesol logo, with 4 distinct daily phases
 * (dawn / day / dusk / night) and a CSS-driven heliotropic rotation that
 * follows the sun across the sky.
 */
export type SunflowerPhase = "dawn" | "day" | "dusk" | "night";
export interface SunflowerPalette {
  petalOuter: string;
  petalInner: string;
  core: string;
  coreShadow: string;
  seed: string;
  stroke: string;
}
export declare const SUNFLOWER_PALETTES: Record<
  SunflowerPhase,
  SunflowerPalette
>;
/** Petal cluster scale per phase (1.0 = open, 0.6 = curled up at night). */
export declare const SUNFLOWER_PETAL_SCALE: Record<SunflowerPhase, number>;
export interface SunflowerHalo {
  /** CSS gradient string, or "transparent" for no halo. */
  gradient: string;
  /** Whether the halo should pulse (bioluminescent night effect). */
  pulse: boolean;
}
export declare const SUNFLOWER_HALOS: Record<SunflowerPhase, SunflowerHalo>;
/**
 * Map a 24h frameIndex (0..23) to one of 4 phases.
 *   5h-6h59 → dawn
 *   7h-16h59 → day
 *   17h-19h59 → dusk
 *   20h-4h59 → night
 */
export declare function getSunflowerPhase(frameIndex: number): SunflowerPhase;
/**
 * Heliotropic rotation in degrees for the SVG `transform: rotate(...)`.
 *
 *   midi (12h) → 0° (vertical, head up)
 *   matin (7h) → -85° (leans east / right, head almost horizontal)
 *   soir (17h) → +85° (leans west / left, head almost horizontal)
 *   nuit/extrême → 175° (head down, sleeping)
 *   aube/crépuscule → smooth lift / fall between sleep and active angles
 *
 * Amplitude ±85° = courbure héliotropique très visible, le tournesol penche
 * franchement de gauche à droite au fil de la journée (au lieu de juste
 * frémir comme avec ±75°).
 */
export declare function getSunflowerRotation(frameIndex: number): number;
/** Global opacity multiplier driven by the daily curve. */
export declare function getSunflowerOpacity(frameIndex: number): number;
