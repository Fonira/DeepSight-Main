import { describe, expect, it } from "vitest";
import { getAmbientPresetV3 } from "../src/preset";
import type { AmbientPreset, AmbientPresetV3, NightMode } from "../src/types";

describe("AmbientPreset v3 type extensions", () => {
  it("accepts frameIndex 0-23", () => {
    const preset: AmbientPreset = {
      hour: 12,
      mood: "noon-zenith",
      beam: {
        type: "sun",
        color: [255, 250, 225],
        angleDeg: -3,
        opacity: 0.95,
      },
      sun: { visible: true, opacity: 0.8, x: 50, y: 20 },
      moon: { visible: false, opacity: 0, x: 0, y: 0 },
      ambient: { primary: 0.3, secondary: 0.2, tertiary: 0.1 },
      starOpacityMul: 0,
      starDensity: "sparse",
      haloX: 50,
      haloY: 20,
      colors: {
        primary: [255, 200, 140],
        secondary: [255, 250, 225],
        tertiary: [99, 102, 241],
        rays: [255, 240, 200],
        accent: [165, 180, 252],
      },
      frameIndex: 23,
      nightMode: null,
      haloAccentColor: "rgba(99,102,241,0.30)",
      isReducedMotion: false,
      isHighContrast: false,
      readingZoneIntensityCap: 0.5,
    };
    expect(preset.frameIndex).toBe(23);
  });

  it("NightMode type accepts asleep | glowing | null", () => {
    const a: NightMode = "asleep";
    const g: NightMode = "glowing";
    expect(a).toBe("asleep");
    expect(g).toBe("glowing");
  });
});

describe("AmbientPresetV3 (required v3 fields)", () => {
  it("getAmbientPresetV3 always returns the required v3 fields", () => {
    // This test asserts the runtime shape — the type guarantee is enforced
    // by the compiler via the AmbientPresetV3 return type of getAmbientPresetV3.
    const preset: AmbientPresetV3 = getAmbientPresetV3(
      new Date("2026-04-26T12:00:00"),
    );

    // frameIndex must be a number, not undefined
    expect(typeof preset.frameIndex).toBe("number");
    expect(preset.frameIndex).toBeGreaterThanOrEqual(0);
    expect(preset.frameIndex).toBeLessThanOrEqual(23);

    // nightMode must be present (null is a valid required value, but not undefined)
    expect(
      preset.nightMode === null || typeof preset.nightMode === "string",
    ).toBe(true);
    expect(preset).toHaveProperty("nightMode");

    // accessibility flags must be booleans, not undefined
    expect(typeof preset.isReducedMotion).toBe("boolean");
    expect(typeof preset.isHighContrast).toBe("boolean");

    // readingZoneIntensityCap must be a number, not undefined
    expect(typeof preset.readingZoneIntensityCap).toBe("number");
  });

  it("AmbientPresetV3 extends AmbientPreset (assignable upwards)", () => {
    const v3: AmbientPresetV3 = getAmbientPresetV3(
      new Date("2026-04-26T12:00:00"),
    );
    // Should be assignable to a v2-shaped variable since AmbientPresetV3 extends AmbientPreset
    const v2: AmbientPreset = v3;
    expect(v2.hour).toBe(v3.hour);
  });
});
