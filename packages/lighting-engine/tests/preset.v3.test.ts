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

  it("isReducedMotion true freezes the angle to its current value", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: q.includes("reduce") }),
    });
    const preset = getAmbientPresetV3(new Date("2026-04-26T12:00:00"));
    expect(preset.isReducedMotion).toBe(true);
    vi.unstubAllGlobals();
  });

  it("interpolates between 06h00 and 06h30 keyframes", () => {
    const at0615 = getAmbientPresetV3(new Date("2026-04-26T06:15:00"));
    expect(at0615.beam.angleDeg).toBeGreaterThan(-55);
    expect(at0615.beam.angleDeg).toBeLessThan(-40);
  });
});
