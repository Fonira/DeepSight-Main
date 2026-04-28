/**
 * Detect whether the user has requested reduced motion.
 * Used to snap interpolation to nearest keyframe (no in-between morphing).
 */
export declare function detectReducedMotion(): boolean;
/**
 * Detect whether the user has requested higher contrast.
 * Used to lower the reading-zone luminosity cap from 0.5 to 0.3.
 */
export declare function detectHighContrast(): boolean;
/**
 * Cap the reading-zone intensity so text remains legible.
 * - Default cap: 0.5
 * - High-contrast cap: 0.3
 *
 * If the base intensity is already below the cap, it is returned unchanged.
 */
export declare function getReadingZoneCap(baseIntensity: number, highContrast?: boolean): number;
