/**
 * DeepSight Mobile - Legacy Theme Exports
 * Bridges old imports to new theme system in src/theme/
 * All colors now aligned with web design system
 */

import { darkColors, lightColors, gradients } from '../theme/colors';
import { fontFamily, fontSize, lineHeight } from '../theme/typography';
import { sp, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { duration } from '../theme/animations';

export const Colors = {
  // Dark theme (default) - aligned with web
  ...darkColors,

  // Gradients
  gradientPrimary: gradients.primary,
  gradientSecondary: gradients.warm,
  gradientDark: gradients.dark,
  gradientAccent: gradients.accent,
  gradientCard: gradients.card,

  // Light theme
  light: { ...lightColors },
};

export const Spacing = {
  xs: sp.xs,
  sm: sp.sm,
  md: sp.md,
  lg: sp.lg,
  xl: sp.xl,
  xxl: sp['2xl'],
  xxxl: sp['3xl'],
};

export const BorderRadius = {
  sm: borderRadius.sm,
  md: borderRadius.md,
  lg: borderRadius.lg,
  xl: borderRadius.xl,
  xxl: borderRadius['2xl'],
  full: borderRadius.full,
};

export const Typography = {
  fontFamily,
  fontSize: {
    xs: fontSize.xs,
    sm: fontSize.sm,
    base: fontSize.base,
    lg: fontSize.lg,
    xl: fontSize.xl,
    xxl: fontSize['2xl'],
    '2xl': fontSize['2xl'],
    '3xl': fontSize['3xl'],
    '4xl': fontSize['4xl'],
  },
  lineHeight,
};

export const Shadows = {
  sm: shadows.sm,
  md: shadows.md,
  lg: shadows.lg,
  xl: shadows.xl,
};

export const Animation = {
  fast: duration.fast,
  base: duration.base,
  slow: duration.slow,
  slower: duration.slower,
};

export default {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
  Animation,
};
