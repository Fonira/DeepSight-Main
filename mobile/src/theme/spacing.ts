/**
 * DeepSight Mobile - Spacing System
 * 4px base grid (identical to web)
 */

export const spacing = {
  0: 0,
  px: 1,
  '0.5': 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
} as const;

/** Semantic spacing aliases */
export const sp = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
  '5xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

/** Screen-level padding */
export const screenPadding = {
  horizontal: sp.lg,
  vertical: sp.lg,
} as const;
