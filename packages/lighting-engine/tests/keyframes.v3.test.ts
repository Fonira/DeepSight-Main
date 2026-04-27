import { describe, expect, it } from "vitest";
import { KEYFRAMES_V3 } from "../src/keyframes.v3";

describe("KEYFRAMES_V3", () => {
  it("has exactly 48 entries (every 30 min)", () => {
    expect(KEYFRAMES_V3).toHaveLength(48);
  });

  it("starts at hour 0 and ends at hour 23.5", () => {
    expect(KEYFRAMES_V3[0].hour).toBe(0);
    expect(KEYFRAMES_V3[47].hour).toBe(23.5);
  });

  it("has nightMode set to glowing for all night keyframes (22h-05h)", () => {
    const nightKeyframes = KEYFRAMES_V3.filter(
      (k) => k.hour >= 22 || k.hour < 5,
    );
    expect(nightKeyframes.every((k) => k.nightMode === "glowing")).toBe(true);
  });

  it("has nightMode null for daytime keyframes (07h-19h)", () => {
    const dayKeyframes = KEYFRAMES_V3.filter((k) => k.hour >= 7 && k.hour < 19);
    expect(dayKeyframes.every((k) => k.nightMode === null)).toBe(true);
  });

  it("has haloAccentColor (indigo/violet) at twilights (06h, 19h, 20h)", () => {
    const twilights = KEYFRAMES_V3.filter((k) =>
      [6, 6.5, 19, 19.5, 20].includes(k.hour),
    );
    expect(twilights.every((k) => k.haloAccentColor !== undefined)).toBe(true);
  });

  it("has angle close to -50° at sunrise (06h00)", () => {
    const sunrise = KEYFRAMES_V3.find((k) => k.hour === 6)!;
    expect(sunrise.beamAngleDeg).toBeGreaterThanOrEqual(-55);
    expect(sunrise.beamAngleDeg).toBeLessThanOrEqual(-40);
  });

  it("has angle close to -3° at noon (12h00)", () => {
    const noon = KEYFRAMES_V3.find((k) => k.hour === 12)!;
    expect(noon.beamAngleDeg).toBeGreaterThanOrEqual(-10);
    expect(noon.beamAngleDeg).toBeLessThanOrEqual(5);
  });

  it("has angle close to +48° at sunset (18h00)", () => {
    const sunset = KEYFRAMES_V3.find((k) => k.hour === 18)!;
    expect(sunset.beamAngleDeg).toBeGreaterThanOrEqual(40);
    expect(sunset.beamAngleDeg).toBeLessThanOrEqual(55);
  });
});
