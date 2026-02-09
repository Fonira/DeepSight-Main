/**
 * DeepSight Mobile - Color System
 * Aligned with web design system (dark first)
 *
 * Web reference: #0a0a0f bg, #3b82f6 blue, #8b5cf6 violet, #06b6d4 cyan
 * Glassmorphism: backdrop-blur bg-white/5 border-white/10
 */

export const palette = {
  // Core brand
  blue: '#3b82f6',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  indigo: '#6366f1',

  // Semantic
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  orange: '#f97316',

  // Neutrals
  white: '#ffffff',
  black: '#000000',
} as const;

export const darkColors = {
  // Backgrounds - aligned with web (#0a0a0f)
  bgPrimary: '#0a0a0f',
  bgSecondary: '#12121a',
  bgTertiary: '#1a1a25',
  bgElevated: '#1e1e2a',
  bgHover: '#252535',
  bgCard: '#15151f',

  // Glassmorphism surfaces
  glassBg: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  glassHover: 'rgba(255, 255, 255, 0.08)',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#d0d0d8',
  textTertiary: '#a0a0b0',
  textMuted: '#707080',

  // Accents
  accentPrimary: palette.blue,
  accentPrimaryLight: '#60a5fa',
  accentSecondary: palette.violet,
  accentTertiary: palette.cyan,

  // Semantic
  accentSuccess: palette.green,
  accentError: palette.red,
  accentWarning: palette.amber,
  accentInfo: palette.blue,

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  borderFocus: palette.blue,

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Semantic aliases
  background: '#0a0a0f',
  surface: '#15151f',
  surfaceSecondary: '#12121a',
  success: palette.green,
  error: palette.red,
  warning: palette.amber,
  info: palette.blue,
} as const;

export const lightColors = {
  // Backgrounds
  bgPrimary: '#ffffff',
  bgSecondary: '#f5f5f7',
  bgTertiary: '#ebebf0',
  bgElevated: '#ffffff',
  bgHover: '#f0f0f2',
  bgCard: '#ffffff',

  // Glassmorphism surfaces
  glassBg: 'rgba(0, 0, 0, 0.03)',
  glassBorder: 'rgba(0, 0, 0, 0.08)',
  glassHover: 'rgba(0, 0, 0, 0.05)',

  // Text
  textPrimary: '#1a1a1b',
  textSecondary: '#4a4a4f',
  textTertiary: '#6a6a70',
  textMuted: '#8a8a90',

  // Accents
  accentPrimary: '#2563eb',
  accentPrimaryLight: '#3b82f6',
  accentSecondary: '#7c3aed',
  accentTertiary: '#0891b2',

  // Semantic
  accentSuccess: '#059669',
  accentError: '#dc2626',
  accentWarning: '#d97706',
  accentInfo: '#2563eb',

  // Borders
  border: '#e5e5e8',
  borderLight: '#d4d4d8',
  borderFocus: '#2563eb',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.15)',

  // Semantic aliases
  background: '#ffffff',
  surface: '#ffffff',
  surfaceSecondary: '#f5f5f7',
  success: '#059669',
  error: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
} as const;

/** Theme color interface - uses string to allow both dark and light assignments */
export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgHover: string;
  bgCard: string;
  glassBg: string;
  glassBorder: string;
  glassHover: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  accentPrimary: string;
  accentPrimaryLight: string;
  accentSecondary: string;
  accentTertiary: string;
  accentSuccess: string;
  accentError: string;
  accentWarning: string;
  accentInfo: string;
  border: string;
  borderLight: string;
  borderFocus: string;
  overlay: string;
  overlayLight: string;
  background: string;
  surface: string;
  surfaceSecondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

/** Gradient presets */
export const gradients = {
  primary: ['#3b82f6', '#8b5cf6'] as const,
  secondary: ['#8b5cf6', '#06b6d4'] as const,
  accent: ['#6366f1', '#8b5cf6'] as const,
  warm: ['#f59e0b', '#ef4444'] as const,
  success: ['#10b981', '#06b6d4'] as const,
  dark: ['#0a0a0f', '#12121a'] as const,
  card: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'] as const,
} as const;
