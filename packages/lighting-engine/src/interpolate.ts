/**
 * @deepsight/lighting-engine — Interpolation utilities
 *
 * Fonctions pures pour interpoler entre 2 keyframes.
 * Toutes les fonctions sont side-effect free.
 */

import type { RGB } from "./types.js";
import { EASINGS } from "./tokens.js";

/**
 * Interpolation linéaire scalar.
 * @param a valeur de départ
 * @param b valeur de fin
 * @param t facteur 0..1 (clampé)
 */
export function lerp(a: number, b: number, t: number): number {
  const clamped = clamp01(t);
  return a + (b - a) * clamped;
}

/**
 * Interpolation entre 2 RGB tuples.
 * Note : interpolation en RGB linéaire — pas de conversion Lab/HSL pour rester rapide.
 * Pour 30 min d'écart entre keyframes, le drift visuel est négligeable.
 */
export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  const tt = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * tt),
    Math.round(a[1] + (b[1] - a[1]) * tt),
    Math.round(a[2] + (b[2] - a[2]) * tt),
  ];
}

/**
 * Interpolation d'angles en degrés avec wrap autour de 360°.
 * Choisit toujours le chemin le plus court.
 *
 * Exemple : lerpAngle(350, 10, 0.5) → 0 (et non 180)
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const tt = clamp01(t);
  let diff = ((((b - a) % 360) + 540) % 360) - 180; // diff dans [-180, 180]
  return (a + diff * tt + 360) % 360;
}

/**
 * Interpolation avec easing custom (cubic, sine, etc.).
 */
export function lerpEased(
  a: number,
  b: number,
  t: number,
  easing: keyof typeof EASINGS = "linear",
): number {
  const eased = EASINGS[easing](clamp01(t));
  return a + (b - a) * eased;
}

/**
 * Interpolation booléenne par seuil 0.5.
 * Utile pour `moon.visible` qui doit binariser à un moment.
 */
export function lerpBoolean(a: boolean, b: boolean, t: number): boolean {
  if (a === b) return a;
  return clamp01(t) >= 0.5 ? b : a;
}

/**
 * Clamp un nombre dans [0, 1].
 */
export function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Clamp un nombre dans [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Convertit une RGB tuple en string CSS rgba(...).
 */
export function rgbToCss(rgb: RGB, alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}

/**
 * Convertit RGB → HSL (pour shifts de teinte seedés).
 * Retourne [H 0..360, S 0..1, L 0..1].
 */
export function rgbToHsl(rgb: RGB): [number, number, number] {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    case b:
      h = ((r - g) / d + 4) * 60;
      break;
  }
  return [h, s, l];
}

/**
 * HSL → RGB.
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 360;
  return [
    Math.round(hueToRgb(p, q, hk + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hk) * 255),
    Math.round(hueToRgb(p, q, hk - 1 / 3) * 255),
  ];
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/**
 * Applique un shift de teinte (en degrés) à une RGB.
 * Utile pour la variation seedée subtile jour-à-jour.
 */
export function shiftHue(rgb: RGB, hueDeg: number): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb(h + hueDeg, s, l);
}
