import { describe, expect, it } from "vitest";
import type { AmbientPreset, NightMode } from "../src/types";

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
