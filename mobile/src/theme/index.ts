/**
 * DeepSight Mobile - Theme System
 * Central export for all design tokens
 */

export { palette, darkColors, lightColors, gradients } from './colors';
export type { ThemeColors } from './colors';

export { fontFamily, fontSize, lineHeight, letterSpacing, textStyles } from './typography';

export { spacing, sp, borderRadius, screenPadding } from './spacing';

export { shadows, applyShadow } from './shadows';

export { duration, springs, timings } from './animations';

// Re-export legacy names for backward compatibility during migration
export { sp as Spacing, borderRadius as BorderRadius } from './spacing';
export { fontFamily as FontFamily, fontSize as FontSize } from './typography';
export { shadows as Shadows } from './shadows';
