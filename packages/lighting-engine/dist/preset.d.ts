import type { AmbientPreset, AmbientPresetV3, Keyframe, PresetOptions, PresetOptionsV3 } from "./types.js";
/**
 * Find the two keyframes surrounding a given hour, with wrap-around.
 * Returns { from, to, factor } where factor is in [0, 1).
 */
export declare function findKeyframePair(hour: number): {
    from: Keyframe;
    to: Keyframe;
    factor: number;
};
/**
 * Compute the full ambient preset at a given Date.
 */
export declare function getAmbientPreset(date?: Date, opts?: PresetOptions): AmbientPreset;
/**
 * v3 — Compute the full ambient preset at a given Date with the v3 palette.
 * Extends v2 with frameIndex (sunflower sprite), nightMode, accessibility
 * flags (reduced-motion, high-contrast), readingZoneIntensityCap, and
 * brand halo accents (haloAccentColor).
 *
 * Important: this is added alongside the v2 `getAmbientPreset` and does not
 * modify it. Consumers should migrate progressively.
 */
export declare function getAmbientPresetV3(date: Date, opts?: PresetOptionsV3): AmbientPresetV3;
