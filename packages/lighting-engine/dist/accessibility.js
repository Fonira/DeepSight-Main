// Accessibility helpers for the v3 ambient lighting engine.
// All helpers are SSR-safe (return `false` when `window` is unavailable)
// and resilient to matchMedia throwing on legacy browsers.
/**
 * Detect whether the user has requested reduced motion.
 * Used to snap interpolation to nearest keyframe (no in-between morphing).
 */
export function detectReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
/**
 * Detect whether the user has requested higher contrast.
 * Used to lower the reading-zone luminosity cap from 0.5 to 0.3.
 */
export function detectHighContrast() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-contrast: more)").matches;
  } catch {
    return false;
  }
}
/**
 * Cap the reading-zone intensity so text remains legible.
 * - Default cap: 0.5
 * - High-contrast cap: 0.3
 *
 * If the base intensity is already below the cap, it is returned unchanged.
 */
export function getReadingZoneCap(baseIntensity, highContrast = false) {
  const cap = highContrast ? 0.3 : 0.5;
  return Math.min(baseIntensity, cap);
}
