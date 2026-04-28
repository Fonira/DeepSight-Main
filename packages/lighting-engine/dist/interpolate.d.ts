import type { RGB } from "./types.js";
export declare function clamp(t: number, min?: number, max?: number): number;
export declare function lerp(a: number, b: number, t: number): number;
export declare function lerpColor(a: RGB, b: RGB, t: number): RGB;
export declare function lerpAngle(a: number, b: number, t: number): number;
export declare function rgbToCss(rgb: RGB, alpha?: number): string;
export declare function rgbToHex(rgb: RGB): string;
