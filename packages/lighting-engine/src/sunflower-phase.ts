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

export const SUNFLOWER_PALETTES: Record<SunflowerPhase, SunflowerPalette> = {
  dawn: {
    petalOuter: "#FFB347",
    petalInner: "#FFD580",
    core: "#A0522D",
    coreShadow: "#7A3D1F",
    seed: "#1A1A1A",
    stroke: "#1A1A1A",
  },
  day: {
    petalOuter: "#F3BE00",
    petalInner: "#FFD60A",
    core: "#BF5F06",
    coreShadow: "#9C4A00",
    seed: "#1A1A1A",
    stroke: "#1A1A1A",
  },
  dusk: {
    petalOuter: "#FF8C42",
    petalInner: "#FFA76B",
    core: "#8B3A0F",
    coreShadow: "#6B2A08",
    seed: "#1A1A1A",
    stroke: "#1A1A1A",
  },
  night: {
    petalOuter: "#6B5A1F",
    petalInner: "#8A7220",
    core: "#3D1E02",
    coreShadow: "#2A1402",
    seed: "#0A0A0A",
    stroke: "#0F0F0F",
  },
};

/** Petal cluster scale per phase (1.0 = open, 0.6 = curled up at night). */
export const SUNFLOWER_PETAL_SCALE: Record<SunflowerPhase, number> = {
  dawn: 0.88,
  day: 1.0,
  dusk: 0.88,
  night: 0.6,
};

export interface SunflowerHalo {
  /** CSS gradient string, or "transparent" for no halo. */
  gradient: string;
  /** Whether the halo should pulse (bioluminescent night effect). */
  pulse: boolean;
}

export const SUNFLOWER_HALOS: Record<SunflowerPhase, SunflowerHalo> = {
  dawn: {
    gradient:
      "radial-gradient(circle, rgba(255,179,71,0.32) 0%, rgba(255,179,71,0.1) 40%, transparent 70%)",
    pulse: false,
  },
  day: { gradient: "transparent", pulse: false },
  dusk: {
    gradient:
      "radial-gradient(circle, rgba(255,140,66,0.32) 0%, rgba(244,114,182,0.18) 40%, transparent 70%)",
    pulse: false,
  },
  night: {
    gradient:
      "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(99,102,241,0.28) 35%, rgba(99,102,241,0.08) 60%, transparent 80%)",
    pulse: true,
  },
};

/**
 * Map a 24h frameIndex (0..23) to one of 4 phases.
 *   5h-6h59 → dawn
 *   7h-16h59 → day
 *   17h-19h59 → dusk
 *   20h-4h59 → night
 */
export function getSunflowerPhase(frameIndex: number): SunflowerPhase {
  const h = ((frameIndex % 24) + 24) % 24;
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

/**
 * Heliotropic rotation in degrees for the SVG `transform: rotate(...)`.
 *
 *   midi (12h) → 0° (vertical, head up)
 *   matin (7h) → -75° (leans east / right)
 *   soir (17h) → +75° (leans west / left)
 *   nuit/extrême → 175° (head down, sleeping)
 *   aube/crépuscule → smooth lift / fall between sleep and active angles
 */
export function getSunflowerRotation(frameIndex: number): number {
  const h = ((frameIndex % 24) + 24) % 24;
  if (h < 5 || h >= 20) return 175;
  if (h < 7) {
    const t = (h - 5) / 2;
    return 175 - t * 250;
  }
  if (h >= 17) {
    const t = (h - 17) / 3;
    return 75 + t * 100;
  }
  return ((h - 12) / 5) * 75;
}

/** Global opacity multiplier driven by the daily curve. */
export function getSunflowerOpacity(frameIndex: number): number {
  const h = ((frameIndex % 24) + 24) % 24;
  const phase = getSunflowerPhase(h);
  if (phase === "night") return 0.55;
  if (phase === "dawn") return 0.6 + ((h - 5) / 2) * 0.3;
  if (phase === "dusk") return 0.9 - ((h - 17) / 3) * 0.4;
  const distFromNoon = Math.abs(h - 12);
  return Math.max(0.85, 1 - distFromNoon * 0.03);
}
