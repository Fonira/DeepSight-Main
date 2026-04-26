import { describe, it, expect } from "vitest";
import {
  getAmbientPreset,
  findKeyframePair,
  KEYFRAMES,
  seedFromDate,
  mulberry32,
  computeAngleVariation,
  DAILY_VARIATION,
  getMoonState,
  getSunState,
  lerp,
  lerpColor,
  lerpAngle,
  rgbToCss,
} from "../src/index";

describe("KEYFRAMES sanity", () => {
  it("has exactly 48 entries", () => {
    expect(KEYFRAMES.length).toBe(48);
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
    KEYFRAMES.forEach((k) => {
      expect(k.beamColor.length).toBe(3);
      expect(k.colors.primary.length).toBe(3);
      expect(k.beamOpacity).toBeGreaterThanOrEqual(0);
      expect(k.beamOpacity).toBeLessThanOrEqual(1);
    });
  });

  it("each keyframe has all required fields", () => {
    KEYFRAMES.forEach((k) => {
      expect(k).toHaveProperty("hour");
      expect(k).toHaveProperty("mood");
      expect(k).toHaveProperty("beamType");
      expect(k).toHaveProperty("beamColor");
      expect(k).toHaveProperty("beamAngleDeg");
      expect(k).toHaveProperty("beamOpacity");
      expect(k).toHaveProperty("colors");
    });
  });

  it("keyframe at index N has hour N*0.5", () => {
    for (let i = 0; i < KEYFRAMES.length; i++) {
      expect(KEYFRAMES[i].hour).toBe(i * 0.5);
    }
  });

  it("midnight keyframe has moon beam", () => {
    expect(KEYFRAMES[0].beamType).toBe("moon");
  });

  it("noon keyframe has sun beam", () => {
    const noon = KEYFRAMES[24];
    expect(noon.hour).toBe(12);
    expect(noon.beamType).toBe("sun");
  });
});

describe("findKeyframePair", () => {
  it("returns identical from/to at exact keyframe time", () => {
    const { from, to, factor } = findKeyframePair(12);
    expect(from.hour).toBe(12);
    expect(to.hour).toBe(12.5);
    expect(factor).toBe(0);
  });

  it("returns mid-point factor at 15 min after keyframe", () => {
    const { factor } = findKeyframePair(12.25); // 15 min into 30-min slot
    expect(factor).toBeCloseTo(0.5, 5);
  });

  it("wraps around midnight (23:59 → 00:00)", () => {
    const { from, to } = findKeyframePair(23.999);
    expect(from.hour).toBe(23.5);
    expect(to.hour).toBe(0);
  });

  it("handles hour > 24 via modulo", () => {
    const { from } = findKeyframePair(25);
    expect(from.hour).toBe(1);
  });
});

describe("seeded random", () => {
  it("seedFromDate is deterministic", () => {
    const d1 = new Date(2026, 3, 15, 10, 30); // April 15 2026
    const d2 = new Date(2026, 3, 15, 23, 59);
    expect(seedFromDate(d1)).toBe(seedFromDate(d2));
  });

  it("different days have different seeds", () => {
    const d1 = new Date(2026, 3, 15);
    const d2 = new Date(2026, 3, 16);
    expect(seedFromDate(d1)).not.toBe(seedFromDate(d2));
  });

  it("mulberry32 produces values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("mulberry32 is deterministic for same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it("mulberry32 different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});

describe("computeAngleVariation", () => {
  it("returns value within ± 15° (DAILY_VARIATION.angleDegRange)", () => {
    for (let h = 0; h < 24; h += 0.25) {
      const v = computeAngleVariation(12345, h);
      expect(v).toBeGreaterThanOrEqual(-DAILY_VARIATION.angleDegRange);
      expect(v).toBeLessThanOrEqual(DAILY_VARIATION.angleDegRange);
    }
  });

  it("is deterministic for same (seed, hour)", () => {
    expect(computeAngleVariation(99, 14.5)).toBe(
      computeAngleVariation(99, 14.5),
    );
  });

  it("different seeds give different variations", () => {
    expect(computeAngleVariation(1, 12)).not.toBe(
      computeAngleVariation(999, 12),
    );
  });

  it("smooth across consecutive hours (continuity)", () => {
    const seed = 42;
    for (let h = 0; h < 23; h += 0.5) {
      const a = computeAngleVariation(seed, h);
      const b = computeAngleVariation(seed, h + 0.01);
      expect(Math.abs(a - b)).toBeLessThan(1); // less than 1° drift in 36s
    }
  });
});

describe("moon/sun trajectories", () => {
  it("sun is invisible at midnight", () => {
    expect(getSunState(0).visible).toBe(false);
  });

  it("sun is visible at noon", () => {
    expect(getSunState(12).visible).toBe(true);
  });

  it("moon is visible at midnight", () => {
    expect(getMoonState(0).visible).toBe(true);
  });

  it("moon is invisible at noon", () => {
    expect(getMoonState(12).visible).toBe(false);
  });

  it("beam blend at noon = pure sun", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 12, 0));
    expect(p.beam.type).toBe("sun");
  });

  it("beam blend at midnight = pure moon", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 0, 0));
    expect(p.beam.type).toBe("moon");
  });

  it("beam blend at 6h = both visible (twilight)", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 6, 0));
    expect(p.beam.type).toBe("twilight");
  });

  it("beam blend at 18h = both visible (twilight soir)", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 18, 0));
    expect(p.beam.type).toBe("twilight");
  });
});

describe("interpolation utilities", () => {
  it("lerp basic", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("lerp clamps t to [0, 1]", () => {
    expect(lerp(0, 100, -1)).toBe(0);
    expect(lerp(0, 100, 5)).toBe(100);
  });

  it("lerpColor blends RGB", () => {
    const c = lerpColor([0, 0, 0], [100, 200, 50], 0.5);
    expect(c).toEqual([50, 100, 25]);
  });

  it("lerpAngle takes shortest path 350° → 10°", () => {
    const a = lerpAngle(350, 10, 0.5);
    expect(a).toBeCloseTo(0, 5);
  });

  it("lerpAngle no wrap 90° → 100°", () => {
    expect(lerpAngle(90, 100, 0.5)).toBeCloseTo(95, 5);
  });

  it("rgbToCss formats correctly", () => {
    expect(rgbToCss([255, 100, 50], 0.5)).toBe("rgba(255,100,50,0.500)");
  });
});

describe("getAmbientPreset integration", () => {
  it("returns valid preset at any hour", () => {
    for (let h = 0; h < 24; h += 0.25) {
      const d = new Date(2026, 5, 21, Math.floor(h), Math.round((h % 1) * 60));
      const p = getAmbientPreset(d);
      expect(p.beam.opacity).toBeGreaterThanOrEqual(0);
      expect(p.beam.opacity).toBeLessThanOrEqual(1);
      expect(p.haloX).toBeGreaterThanOrEqual(0);
      expect(p.haloX).toBeLessThanOrEqual(100);
    }
  });

  it("noon has sun-type beam with warm color", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 12, 0));
    expect(p.beam.type).toBe("sun");
    // Warm: R > B
    expect(p.beam.color[0]).toBeGreaterThan(p.beam.color[2]);
  });

  it("midnight has moon-type beam with cool color", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 0, 0));
    expect(p.beam.type).toBe("moon");
    // Cool: B > R
    expect(p.beam.color[2]).toBeGreaterThan(p.beam.color[0]);
  });

  it('twilight at 6h has type "twilight" due to blend', () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 6, 30));
    expect(p.beam.type).toBe("twilight");
  });

  it("is deterministic for same date", () => {
    const d = new Date(2026, 5, 21, 14, 32);
    const p1 = getAmbientPreset(d);
    const p2 = getAmbientPreset(d);
    expect(p1.beam.angleDeg).toBe(p2.beam.angleDeg);
    expect(p1.beam.color).toEqual(p2.beam.color);
  });

  it("varies between two consecutive days at same time", () => {
    const d1 = new Date(2026, 5, 21, 14, 0);
    const d2 = new Date(2026, 5, 22, 14, 0);
    const p1 = getAmbientPreset(d1);
    const p2 = getAmbientPreset(d2);
    // Angle should differ (daily variation)
    expect(p1.beam.angleDeg).not.toBe(p2.beam.angleDeg);
  });

  it("disableDailyVariation removes seed effects", () => {
    const d1 = new Date(2026, 5, 21, 14, 0);
    const d2 = new Date(2026, 5, 22, 14, 0);
    const p1 = getAmbientPreset(d1, { disableDailyVariation: true });
    const p2 = getAmbientPreset(d2, { disableDailyVariation: true });
    expect(p1.beam.angleDeg).toBe(p2.beam.angleDeg);
  });

  it("intensityMul scales opacities", () => {
    const d = new Date(2026, 5, 21, 12, 0);
    const full = getAmbientPreset(d, { intensityMul: 1 });
    const half = getAmbientPreset(d, { intensityMul: 0.5 });
    expect(half.beam.opacity).toBeCloseTo(full.beam.opacity * 0.5, 4);
    expect(half.ambient.primary).toBeCloseTo(full.ambient.primary * 0.5, 4);
  });

  it("skipCssStrings returns empty cssColor", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 12), {
      skipCssStrings: true,
    });
    expect(p.beam.cssColor).toBeUndefined();
    expect(p.colors.cssPrimary).toBeUndefined();
  });

  it("performance: < 1ms per call (relaxed for CI)", () => {
    const d = new Date();
    const start = performance.now();
    const N = 100;
    for (let i = 0; i < N; i++) getAmbientPreset(d);
    const avg = (performance.now() - start) / N;
    expect(avg).toBeLessThan(1);
  });

  it("smooth transition: 14:00 → 14:01 produces minimal opacity drift", () => {
    const a = getAmbientPreset(new Date(2026, 5, 21, 14, 0, 0));
    const b = getAmbientPreset(new Date(2026, 5, 21, 14, 1, 0));
    expect(Math.abs(a.beam.opacity - b.beam.opacity)).toBeLessThan(0.01);
  });

  it("mood is concatenated form during interpolation", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 14, 15));
    expect(p.mood).toContain("→");
  });

  it("mood is single name at exact keyframe time", () => {
    const p = getAmbientPreset(new Date(2026, 5, 21, 14, 0));
    expect(p.mood).not.toContain("→");
  });

  it("moon visible only at night", () => {
    const noon = getAmbientPreset(new Date(2026, 5, 21, 12, 0));
    const midnight = getAmbientPreset(new Date(2026, 5, 21, 0, 0));
    expect(noon.moon.visible).toBe(false);
    expect(midnight.moon.visible).toBe(true);
  });

  it("sun visible only during day", () => {
    const noon = getAmbientPreset(new Date(2026, 5, 21, 12, 0));
    const midnight = getAmbientPreset(new Date(2026, 5, 21, 0, 0));
    expect(noon.sun.visible).toBe(true);
    expect(midnight.sun.visible).toBe(false);
  });

  it("debug factor is in [0, 1)", () => {
    for (let h = 0; h < 24; h += 0.5) {
      const d = new Date(2026, 5, 21, Math.floor(h), Math.round((h % 1) * 60));
      const p = getAmbientPreset(d);
      expect(p.debug?.factor).toBeGreaterThanOrEqual(0);
      expect(p.debug?.factor).toBeLessThan(1);
    }
  });

  it("seedOverride forces specific seed", () => {
    const d1 = new Date(2026, 5, 21, 14, 0);
    const d2 = new Date(2026, 5, 22, 14, 0);
    const p1 = getAmbientPreset(d1, { seedOverride: 42 });
    const p2 = getAmbientPreset(d2, { seedOverride: 42 });
    expect(p1.beam.angleDeg).toBe(p2.beam.angleDeg);
  });
});

describe("cross-platform invariants", () => {
  it("RGB tuples are always integers", () => {
    KEYFRAMES.forEach((k) => {
      k.beamColor.forEach((v) => expect(Number.isInteger(v)).toBe(true));
      k.colors.primary.forEach((v) => expect(Number.isInteger(v)).toBe(true));
    });
  });

  it("opacities are clamped to [0, 1]", () => {
    for (let h = 0; h < 24; h += 0.25) {
      const d = new Date(2026, 5, 21, Math.floor(h), Math.round((h % 1) * 60));
      const p = getAmbientPreset(d, { intensityMul: 2 }); // would otherwise overflow
      expect(p.beam.opacity).toBeLessThanOrEqual(1);
      expect(p.ambient.primary).toBeLessThanOrEqual(1);
      expect(p.sun.opacity).toBeLessThanOrEqual(1);
      expect(p.moon.opacity).toBeLessThanOrEqual(1);
    }
  });

  it("xPercent always within [0, 100]", () => {
    for (let h = 0; h < 24; h += 0.25) {
      const d = new Date(2026, 5, 21, Math.floor(h), Math.round((h % 1) * 60));
      const p = getAmbientPreset(d);
      expect(p.haloX).toBeGreaterThanOrEqual(0);
      expect(p.haloX).toBeLessThanOrEqual(100);
      expect(p.sun.x).toBeGreaterThanOrEqual(0);
      expect(p.sun.x).toBeLessThanOrEqual(100);
      expect(p.moon.x).toBeGreaterThanOrEqual(0);
      expect(p.moon.x).toBeLessThanOrEqual(100);
    }
  });
});
