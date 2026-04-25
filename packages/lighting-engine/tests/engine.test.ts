/**
 * @deepsight/lighting-engine — Tests unitaires
 *
 * Vitest. Run via `npm test` depuis packages/lighting-engine/.
 */

import { describe, expect, it } from "vitest";
import {
  getAmbientPreset,
  KEYFRAMES,
  validateKeyframes,
  findKeyframePair,
  seedFromDate,
  mulberry32,
  computeAngleVariation,
  computeBeamBlend,
  computeMoonPosition,
  computeSunPosition,
  rgbToCss,
  lerp,
  lerpColor,
  lerpAngle,
} from "../src/index.js";

// =============================================================================
// KEYFRAMES — sanity
// =============================================================================
describe("KEYFRAMES sanity", () => {
  it("has exactly 48 entries", () => {
    expect(KEYFRAMES).toHaveLength(48);
  });

  it("is sorted by hour ascending", () => {
    for (let i = 1; i < KEYFRAMES.length; i++) {
      expect(KEYFRAMES[i].hour).toBeGreaterThan(KEYFRAMES[i - 1].hour);
    }
  });

  it("hours are at exact 0.5 increments starting from 0", () => {
    for (let i = 0; i < KEYFRAMES.length; i++) {
      expect(KEYFRAMES[i].hour).toBe(i * 0.5);
    }
  });

  it("validates with no errors", () => {
    const v = validateKeyframes();
    expect(v.valid).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it("each keyframe has all required fields", () => {
    for (const kf of KEYFRAMES) {
      expect(kf.time).toMatch(/^\d{2}:\d{2}$/);
      expect(kf.mood).toBeTruthy();
      expect(kf.centralBeam.color).toHaveLength(3);
      expect(kf.centralBeam.opacity).toBeGreaterThanOrEqual(0);
      expect(kf.centralBeam.opacity).toBeLessThanOrEqual(1);
      expect(kf.ambient.primary).toHaveLength(3);
      expect(kf.stars.density).toBeGreaterThanOrEqual(0);
      expect(kf.stars.density).toBeLessThanOrEqual(1);
    }
  });

  it("keyframe at index N has hour N*0.5", () => {
    expect(KEYFRAMES[0].hour).toBe(0);
    expect(KEYFRAMES[24].hour).toBe(12);
    expect(KEYFRAMES[47].hour).toBe(23.5);
  });

  it("midnight keyframe has moon beam", () => {
    expect(KEYFRAMES[0].centralBeam.type).toBe("moon");
  });

  it("noon keyframe has sun beam", () => {
    expect(KEYFRAMES[24].centralBeam.type).toBe("sun");
  });
});

// =============================================================================
// findKeyframePair
// =============================================================================
describe("findKeyframePair", () => {
  it("returns identical from/to at exact keyframe time", () => {
    const { from, to, factor } = findKeyframePair(14.0); // 14:00 exact
    expect(from.hour).toBe(14);
    expect(to.hour).toBe(14.5);
    expect(factor).toBe(0);
  });

  it("returns mid-point factor at 15 min after keyframe", () => {
    const { factor } = findKeyframePair(14.25); // 14:15
    expect(factor).toBeCloseTo(0.5, 2);
  });

  it("wraps around midnight (23:59 → 00:00)", () => {
    const { from, to } = findKeyframePair(23.99);
    expect(from.hour).toBe(23.5);
    expect(to.hour).toBe(0);
  });

  it("handles hour > 24 via modulo", () => {
    const { from } = findKeyframePair(26.0); // = 02:00
    expect(from.hour).toBe(2);
  });
});

// =============================================================================
// seedFromDate / mulberry32
// =============================================================================
describe("seeded random", () => {
  it("seedFromDate is deterministic", () => {
    const d1 = new Date(2026, 3, 25, 14, 30); // April 25 2026, 14:30
    const d2 = new Date(2026, 3, 25, 23, 59);
    expect(seedFromDate(d1)).toBe(seedFromDate(d2)); // same day = same seed
  });

  it("different days have different seeds", () => {
    const d1 = new Date(2026, 3, 25);
    const d2 = new Date(2026, 3, 26);
    expect(seedFromDate(d1)).not.toBe(seedFromDate(d2));
  });

  it("mulberry32 produces values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("mulberry32 is deterministic for same seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("mulberry32 different seeds produce different sequences", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(43);
    expect(rng1()).not.toBe(rng2());
  });
});

// =============================================================================
// angle variation
// =============================================================================
describe("computeAngleVariation", () => {
  it("returns value within ± 15° (DAILY_VARIATION.angleDegRange)", () => {
    const seed = 12345;
    for (let h = 0; h < 24; h += 0.5) {
      const v = computeAngleVariation(seed, h);
      expect(v).toBeGreaterThanOrEqual(-15.001);
      expect(v).toBeLessThanOrEqual(15.001);
    }
  });

  it("is deterministic for same (seed, hour)", () => {
    const a = computeAngleVariation(12345, 14.5);
    const b = computeAngleVariation(12345, 14.5);
    expect(a).toBe(b);
  });

  it("different seeds give different variations", () => {
    const a = computeAngleVariation(12345, 14.5);
    const b = computeAngleVariation(67890, 14.5);
    expect(a).not.toBe(b);
  });

  it("smooth across consecutive hours (continuity)", () => {
    const seed = 12345;
    for (let h = 0; h < 23.5; h += 0.5) {
      const a = computeAngleVariation(seed, h);
      const b = computeAngleVariation(seed, h + 0.5);
      // Smooth = pas de saut > 5° entre 2 demi-heures
      expect(Math.abs(b - a)).toBeLessThan(5);
    }
  });
});

// =============================================================================
// trajectories
// =============================================================================
describe("moon/sun trajectories", () => {
  it("sun is invisible at midnight", () => {
    const p = computeSunPosition(0);
    expect(p.visible).toBe(false);
  });

  it("sun is visible at noon", () => {
    const p = computeSunPosition(12);
    expect(p.visible).toBe(true);
    expect(p.yPercent).toBeLessThan(15); // haut dans le ciel
  });

  it("moon is visible at midnight", () => {
    const p = computeMoonPosition(0);
    expect(p.visible).toBe(true);
  });

  it("moon is invisible at noon", () => {
    const p = computeMoonPosition(12);
    expect(p.visible).toBe(false);
  });

  it("beam blend at noon = pure sun", () => {
    const b = computeBeamBlend(12);
    expect(b.sunOpacity).toBe(1);
    expect(b.moonOpacity).toBe(0);
    expect(b.twilightFactor).toBe(0);
  });

  it("beam blend at midnight = pure moon", () => {
    const b = computeBeamBlend(0);
    expect(b.moonOpacity).toBe(1);
    expect(b.sunOpacity).toBe(0);
  });

  it("beam blend at 6h = both visible (twilight)", () => {
    const b = computeBeamBlend(6);
    expect(b.twilightFactor).toBeGreaterThan(0.5);
    expect(b.sunOpacity).toBeGreaterThan(0);
    expect(b.moonOpacity).toBeGreaterThan(0);
  });

  it("beam blend at 18h = both visible (twilight soir)", () => {
    const b = computeBeamBlend(18);
    expect(b.twilightFactor).toBeGreaterThan(0.5);
  });
});

// =============================================================================
// Interpolation utilities
// =============================================================================
describe("interpolation utilities", () => {
  it("lerp basic", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it("lerp clamps t to [0, 1]", () => {
    expect(lerp(0, 100, -1)).toBe(0);
    expect(lerp(0, 100, 2)).toBe(100);
  });

  it("lerpColor blends RGB", () => {
    const c = lerpColor([0, 0, 0], [255, 255, 255], 0.5);
    expect(c).toEqual([128, 128, 128]);
  });

  it("lerpAngle takes shortest path 350° → 10°", () => {
    const result = lerpAngle(350, 10, 0.5);
    // Shortest path crosses 0° = 0° at midpoint
    expect(result).toBeCloseTo(0, 1);
  });

  it("lerpAngle no wrap 90° → 100°", () => {
    expect(lerpAngle(90, 100, 0.5)).toBeCloseTo(95, 1);
  });

  it("rgbToCss formats correctly", () => {
    expect(rgbToCss([10, 20, 30], 0.5)).toBe("rgba(10, 20, 30, 0.500)");
  });
});

// =============================================================================
// getAmbientPreset — integration
// =============================================================================
describe("getAmbientPreset integration", () => {
  it("returns valid preset at any hour", () => {
    for (let h = 0; h < 24; h += 1) {
      const date = new Date(2026, 3, 25, h, 0);
      const p = getAmbientPreset(date);
      expect(p.hour).toBeGreaterThanOrEqual(0);
      expect(p.hour).toBeLessThan(24);
      expect(p.centralBeam.cssColor).toMatch(/^rgba\(/);
      expect(p.centralBeam.opacity).toBeGreaterThanOrEqual(0);
      expect(p.centralBeam.opacity).toBeLessThanOrEqual(1);
      expect(p.centralBeam.angleDeg).toBeGreaterThanOrEqual(0);
      expect(p.centralBeam.angleDeg).toBeLessThan(360);
    }
  });

  it("noon has sun-type beam with warm color", () => {
    const p = getAmbientPreset(new Date(2026, 3, 25, 12, 0));
    expect(p.centralBeam.type).toBe("sun");
    // Warm = R > B
    expect(p.centralBeam.rgb[0]).toBeGreaterThan(p.centralBeam.rgb[2]);
  });

  it("midnight has moon-type beam with cool color", () => {
    const p = getAmbientPreset(new Date(2026, 3, 25, 0, 0));
    expect(p.centralBeam.type).toBe("moon");
    // Cool = B >= R
    expect(p.centralBeam.rgb[2]).toBeGreaterThanOrEqual(p.centralBeam.rgb[0]);
  });

  it("twilight at 6h has type 'twilight' due to blend", () => {
    const p = getAmbientPreset(new Date(2026, 3, 25, 6, 0));
    expect(p.centralBeam.type).toBe("twilight");
  });

  it("is deterministic for same date", () => {
    const date = new Date(2026, 3, 25, 14, 30);
    const p1 = getAmbientPreset(date);
    const p2 = getAmbientPreset(date);
    expect(p1.centralBeam.angleDeg).toBe(p2.centralBeam.angleDeg);
    expect(p1.centralBeam.rgb).toEqual(p2.centralBeam.rgb);
  });

  it("varies between two consecutive days at same time", () => {
    const d1 = new Date(2026, 3, 25, 14, 0);
    const d2 = new Date(2026, 3, 26, 14, 0);
    const p1 = getAmbientPreset(d1);
    const p2 = getAmbientPreset(d2);
    // Angle base est identique mais variation seedée diffère
    expect(p1._debug.angleVariation).not.toBe(p2._debug.angleVariation);
    expect(p1.centralBeam.angleDeg).not.toBe(p2.centralBeam.angleDeg);
  });

  it("disableDailyVariation removes seed effects", () => {
    const date = new Date(2026, 3, 25, 14, 0);
    const p = getAmbientPreset(date, { disableDailyVariation: true });
    expect(p._debug.angleVariation).toBe(0);
  });

  it("intensityMul scales opacities", () => {
    const date = new Date(2026, 3, 25, 14, 0);
    const pNorm = getAmbientPreset(date, {
      intensityMul: 1,
      disableDailyVariation: true,
    });
    const pHalf = getAmbientPreset(date, {
      intensityMul: 0.5,
      disableDailyVariation: true,
    });
    expect(pHalf.centralBeam.opacity).toBeCloseTo(
      pNorm.centralBeam.opacity * 0.5,
      3,
    );
  });

  it("skipCssStrings returns empty cssColor", () => {
    const date = new Date(2026, 3, 25, 14, 0);
    const p = getAmbientPreset(date, { skipCssStrings: true });
    expect(p.centralBeam.cssColor).toBe("");
    expect(p.ambient.cssGradient).toBe("");
    // RGB tuple still populated
    expect(p.centralBeam.rgb).toHaveLength(3);
  });

  it("performance: < 1ms per call (relaxed for CI)", () => {
    const date = new Date(2026, 3, 25, 14, 0);
    const samples: number[] = [];
    for (let i = 0; i < 100; i++) {
      const p = getAmbientPreset(new Date(date.getTime() + i * 60_000));
      samples.push(p._debug.computeTimeMs);
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    // Cible PRD : < 0.2ms p99. CI relaxe à 1ms pour tolérance.
    expect(avg).toBeLessThan(1);
  });

  it("smooth transition: 14:00 → 14:01 produces minimal opacity drift", () => {
    const d1 = new Date(2026, 3, 25, 14, 0, 0);
    const d2 = new Date(2026, 3, 25, 14, 1, 0);
    const p1 = getAmbientPreset(d1, { disableDailyVariation: true });
    const p2 = getAmbientPreset(d2, { disableDailyVariation: true });
    expect(
      Math.abs(p2.centralBeam.opacity - p1.centralBeam.opacity),
    ).toBeLessThan(0.01);
  });

  it("mood is concatenated form during interpolation", () => {
    const date = new Date(2026, 3, 25, 14, 15); // mid-keyframe
    const p = getAmbientPreset(date);
    expect(p.mood).toContain("→");
  });

  it("mood is single name at exact keyframe time", () => {
    const date = new Date(2026, 3, 25, 14, 0, 0);
    const p = getAmbientPreset(date);
    expect(p.mood).not.toContain("→");
  });

  it("moon visible only at night", () => {
    const noon = getAmbientPreset(new Date(2026, 3, 25, 12, 0));
    const midnight = getAmbientPreset(new Date(2026, 3, 25, 0, 0));
    expect(noon.moon.visible).toBe(false);
    expect(midnight.moon.visible).toBe(true);
  });

  it("sun visible only during day", () => {
    const noon = getAmbientPreset(new Date(2026, 3, 25, 12, 0));
    const midnight = getAmbientPreset(new Date(2026, 3, 25, 0, 0));
    expect(noon.sun.visible).toBe(true);
    expect(midnight.sun.visible).toBe(false);
  });

  it("debug factor is in [0, 1)", () => {
    for (let m = 0; m < 60; m += 5) {
      const date = new Date(2026, 3, 25, 14, m);
      const p = getAmbientPreset(date);
      expect(p._debug.factor).toBeGreaterThanOrEqual(0);
      expect(p._debug.factor).toBeLessThan(1);
    }
  });

  it("seedOverride forces specific seed", () => {
    const date = new Date(2026, 3, 25, 14, 0);
    const p = getAmbientPreset(date, { seedOverride: 999 });
    expect(p._debug.seed).toBe(999);
  });
});

// =============================================================================
// Cross-platform invariants
// =============================================================================
describe("cross-platform invariants", () => {
  it("RGB tuples are always integers", () => {
    const date = new Date(2026, 3, 25, 14, 17);
    const p = getAmbientPreset(date);
    expect(Number.isInteger(p.centralBeam.rgb[0])).toBe(true);
    expect(Number.isInteger(p.ambient.primary[0])).toBe(true);
  });

  it("opacities are clamped to [0, 1]", () => {
    for (let h = 0; h < 24; h += 0.5) {
      const date = new Date(2026, 3, 25, Math.floor(h), (h % 1) * 60);
      const p = getAmbientPreset(date);
      expect(p.centralBeam.opacity).toBeGreaterThanOrEqual(0);
      expect(p.centralBeam.opacity).toBeLessThanOrEqual(1);
      expect(p.ambient.primaryOpacity).toBeGreaterThanOrEqual(0);
      expect(p.ambient.primaryOpacity).toBeLessThanOrEqual(1);
      expect(p.stars.opacity).toBeGreaterThanOrEqual(0);
      expect(p.stars.opacity).toBeLessThanOrEqual(1);
    }
  });

  it("xPercent always within [0, 100]", () => {
    for (let h = 0; h < 24; h += 1) {
      const date = new Date(2026, 3, 25, h, 0);
      const p = getAmbientPreset(date);
      expect(p.moon.xPercent).toBeGreaterThanOrEqual(0);
      expect(p.moon.xPercent).toBeLessThanOrEqual(100);
      expect(p.sun.xPercent).toBeGreaterThanOrEqual(0);
      expect(p.sun.xPercent).toBeLessThanOrEqual(100);
    }
  });
});
