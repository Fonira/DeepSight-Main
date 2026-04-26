import { describe, expect, it, vi } from "vitest";
import { getAmbientPresetV3 } from "../src/preset";

describe("getAmbientPresetV3", () => {
  it("returns frameIndex matching the hour", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:30:00"));
    expect(preset.frameIndex).toBe(12);
  });

  it('returns nightMode "glowing" at midnight', () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T00:00:00"));
    expect(preset.nightMode).toBe("glowing");
  });

  it("returns nightMode null at noon", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.nightMode).toBeNull();
  });

  it("exposes haloAccentColor at sunset (18h)", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T18:00:00"));
    expect(preset.haloAccentColor).toBeDefined();
    expect(preset.haloAccentColor).toMatch(/rgba/);
  });

  it("does NOT expose haloAccentColor at noon (12h)", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.haloAccentColor).toBeUndefined();
  });

  it("readingZoneIntensityCap is 0.5 by default", () => {
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.readingZoneIntensityCap).toBe(0.5);
  });

  it("readingZoneIntensityCap is 0.3 when high contrast", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("more") }),
    });
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.readingZoneIntensityCap).toBe(0.3);
    expect(preset.isHighContrast).toBe(true);
    vi.unstubAllGlobals();
  });

  it("isReducedMotion true exposes the flag", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("reduce") }),
    });
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.isReducedMotion).toBe(true);
    vi.unstubAllGlobals();
  });

  it("isReducedMotion snaps the angle to the nearest keyframe", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("reduce") }),
    });
    // KEYFRAMES_V3: 12h00 → angle -3°, 12h30 → angle 0°.
    // 12:14 → factor 14/30 ≈ 0.467 → Math.round(0.467) = 0 → snap to "from" keyframe (12:00 → -3°).
    const at12_14 = getAmbientPresetV3(new Date("2026-04-26T12:14:00"));
    expect(at12_14.beam.angleDeg).toBeCloseTo(-3, 1);
    // 12:15 → factor 15/30 = 0.5 → Math.round(0.5) = 1 (banker's tie up) → snap to "to" keyframe (12:30 → 0°).
    const at12_15 = getAmbientPresetV3(new Date("2026-04-26T12:15:00"));
    expect(at12_15.beam.angleDeg).toBeCloseTo(0, 1);
    vi.unstubAllGlobals();
  });

  it("without reduced motion, the angle interpolates between keyframes", () => {
    // Sanity check: when reduced motion is OFF, 12:14 should interpolate
    // between 12:00 (-3°) and 12:30 (0°) → ~-3 + 0.467*3 ≈ -1.6°.
    // This guards against the snap test above being a no-op.
    const at12_14 = getAmbientPresetV3(new Date("2026-04-26T12:14:00"));
    expect(at12_14.isReducedMotion).toBe(false);
    expect(at12_14.beam.angleDeg).toBeGreaterThan(-3);
    expect(at12_14.beam.angleDeg).toBeLessThan(0);
  });

  it("interpolates between 06h00 and 06h30 keyframes", () => {
    const at0615 = getAmbientPresetV3(new Date("2026-04-26T06:15:00"));
    expect(at0615.beam.angleDeg).toBeGreaterThan(-55);
    expect(at0615.beam.angleDeg).toBeLessThan(-40);
  });
});
