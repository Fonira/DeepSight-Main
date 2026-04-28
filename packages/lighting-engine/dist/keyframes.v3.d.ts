import type { NightMode, RGB } from "./types.js";
export interface KeyframeV3 {
    hour: number;
    mood: string;
    beamColor: RGB;
    beamAngleDeg: number;
    beamOpacity: number;
    haloPrimary: RGB;
    haloAccentColor?: string;
    intensity: number;
    nightMode: NightMode | null;
}
/**
 * 48 keyframes v3 — 1 toutes les 30 minutes.
 * Palette : mix réaliste (doré matin / blanc midi / orange couchant / argent nuit)
 *           + accents indigo/violet brand DeepSight aux twilights et nuit.
 */
export declare const KEYFRAMES_V3: KeyframeV3[];
