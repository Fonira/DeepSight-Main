/**
 * DeepSight Mobile - Color System
 * Aligned with web design system (dark first)
 *
 * Web reference: #0a0a0f bg, #3b82f6 blue info, #9B6B4A warm-amber, #C48B7C sunset
 * Anti-AI-slop: surfaces solides, palette or gouvernail, pas de glassmorphism
 */

export const palette = {
  // Core brand
  blue: "#3b82f6",
  violet: "#9B6B4A", // ambre chaud (ancien #8b5cf6)
  cyan: "#C48B7C", // sunset rosé (ancien #06b6d4)
  indigo: "#C8903A", // or gouvernail (ancien #6366f1)

  // Semantic
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  orange: "#f97316",

  // Neutrals
  white: "#ffffff",
  black: "#000000",

  // New warm palette
  gold: "#C8903A",
  goldLight: "#D4A054",
  goldDark: "#B07D2E",
  sunset: "#C48B7C",
  warmAmber: "#9B6B4A",
  ivoryWhite: "#F5F0E8",
  warmBeige: "#B5A89B",
} as const;

export const darkColors = {
  // Backgrounds - aligned with web (#0a0a0f)
  bgPrimary: "#0a0a0f",
  bgSecondary: "#12121a",
  bgTertiary: "#1a1a25",
  bgElevated: "#1e1e2a",
  bgHover: "#252535",
  bgCard: "#15151f",

  // Glassmorphism surfaces - warm palette
  glassBg: "rgba(200, 144, 58, 0.05)",
  glassBorder: "rgba(200, 144, 58, 0.10)",
  glassHover: "rgba(200, 144, 58, 0.08)",

  // Text - ambient lighting v3 slate palette
  textPrimary: "#ffffff",
  textSecondary: "#f1f5f9", // slate-100 (was #D4CCC4)
  textTertiary: "#cbd5e1", // slate-300 (was #B5A89B)
  textMuted: "#e2e8f0", // slate-200 (was #7A7068)
  textDisabled: "rgba(255, 255, 255, 0.45)",
  textMeta: "#cbd5e1", // slate-300

  // Accents - warm palette
  accentPrimary: "#C8903A", // or gouvernail
  accentPrimaryLight: "#D4A054",
  accentSecondary: "#9B6B4A", // ambre chaud
  accentTertiary: "#C48B7C", // sunset rosé
  accentInfo: "#3b82f6", // blue kept as info

  // Semantic
  accentSuccess: palette.green,
  accentError: palette.red,
  accentWarning: palette.amber,

  // Borders - warm palette
  border: "rgba(200, 144, 58, 0.08)",
  borderLight: "rgba(200, 144, 58, 0.15)",
  borderFocus: "#C8903A",

  // Overlays
  overlay: "rgba(0, 0, 0, 0.6)",
  overlayLight: "rgba(0, 0, 0, 0.3)",

  // Semantic aliases
  background: "#0a0a0f",
  surface: "#15151f",
  surfaceSecondary: "#12121a",
  success: palette.green,
  error: palette.red,
  warning: palette.amber,
  info: "#3b82f6",
} as const;

export const lightColors = {
  // Backgrounds - warm palette
  bgPrimary: "#FAF7F2",
  bgSecondary: "#F5F0E8",
  bgTertiary: "#EDE7DD",
  bgElevated: "#FAF7F2",
  bgHover: "#F0EADF",
  bgCard: "#FAF7F2",

  // Glassmorphism surfaces - warm palette
  glassBg: "rgba(200, 144, 58, 0.04)",
  glassBorder: "rgba(200, 144, 58, 0.10)",
  glassHover: "rgba(200, 144, 58, 0.06)",

  // Text - warm palette (light mode keeps warm tones for readability on light bg)
  textPrimary: "#2A2420",
  textSecondary: "#5A4F45",
  textTertiary: "#7A6F65",
  textMuted: "#9A8F85",
  textDisabled: "rgba(0, 0, 0, 0.45)",
  textMeta: "#71717a", // zinc-500

  // Accents - warm palette
  accentPrimary: "#A67828",
  accentPrimaryLight: "#B88E3E",
  accentSecondary: "#8B5E3A",
  accentTertiary: "#A67850",
  accentInfo: "#3b82f6", // blue kept as info

  // Semantic
  accentSuccess: "#059669",
  accentError: "#dc2626",
  accentWarning: "#d97706",

  // Borders - warm palette
  border: "#D4CCC4",
  borderLight: "#E5DDD5",
  borderFocus: "#A67828",

  // Overlays
  overlay: "rgba(0, 0, 0, 0.4)",
  overlayLight: "rgba(0, 0, 0, 0.15)",

  // Semantic aliases
  background: "#FAF7F2",
  surface: "#FAF7F2",
  surfaceSecondary: "#F5F0E8",
  success: "#059669",
  error: "#dc2626",
  warning: "#d97706",
  info: "#3b82f6",
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
  textDisabled: string;
  textMeta: string;
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

/**
 * Ambient lighting v3 — semantic text tokens (white-cast on dark surfaces)
 * Used by components reading `colors.text.*` directly (independent of Theme switching).
 * Designed for max readability over animated ambient lighting backgrounds.
 */
export const colors = {
  text: {
    primary: "#ffffff",
    secondary: "#f1f5f9",
    muted: "#e2e8f0",
    disabled: "rgba(255,255,255,0.45)",
    meta: "#cbd5e1",
  },
} as const;

/** Gradient presets */
export const gradients = {
  primary: ["#C8903A", "#9B6B4A"] as const, // or → ambre
  secondary: ["#9B6B4A", "#C48B7C"] as const, // ambre → sunset
  accent: ["#C8903A", "#D4A054"] as const, // or → or clair
  warm: ["#f59e0b", "#ef4444"] as const,
  success: ["#10b981", "#C48B7C"] as const,
  dark: ["#0a0a0f", "#12121a"] as const,
  card: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"] as const,
} as const;
