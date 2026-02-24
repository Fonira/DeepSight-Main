/**
 * DEEP SIGHT v9.0 — Design Tokens (TypeScript)
 * Single source of truth for the design system.
 * CSS custom properties remain in index.css for runtime theming;
 * this file provides typed constants for JS/TS usage (Framer Motion, inline styles, etc.).
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const colors = {
  bg: {
    primary: 'var(--bg-primary)',
    secondary: 'var(--bg-secondary)',
    tertiary: 'var(--bg-tertiary)',
    elevated: 'var(--bg-elevated)',
    hover: 'var(--bg-hover)',
    active: 'var(--bg-active)',
    surface: 'var(--bg-surface)',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    tertiary: 'var(--text-tertiary)',
    muted: 'var(--text-muted)',
    inverse: 'var(--text-inverse)',
  },
  accent: {
    primary: '#6366f1',
    primaryHover: '#818cf8',
    primaryMuted: 'rgba(99, 102, 241, 0.12)',
    primaryGlow: 'rgba(99, 102, 241, 0.35)',
    primaryStrong: '#4f46e5',
    violet: '#8b5cf6',
    violetMuted: 'rgba(139, 92, 246, 0.12)',
    violetGlow: 'rgba(139, 92, 246, 0.3)',
    cyan: '#06b6d4',
    cyanMuted: 'rgba(6, 182, 212, 0.12)',
    cyanGlow: 'rgba(6, 182, 212, 0.3)',
  },
  semantic: {
    success: '#10b981',
    successMuted: 'rgba(16, 185, 129, 0.12)',
    warning: '#f59e0b',
    warningMuted: 'rgba(245, 158, 11, 0.12)',
    error: '#ef4444',
    errorMuted: 'rgba(239, 68, 68, 0.12)',
  },
  plan: {
    free: { color: '#6b6b80', bg: 'rgba(107, 107, 128, 0.12)' },
    etudiant: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
    starter: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    pro: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
    // Aliases pour rétrocompat
    student: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
    team: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
    expert: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  },
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const fonts = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const fontSizes = {
  'display-lg': 'clamp(2.5rem, 6vw, 4rem)',
  display: 'clamp(2rem, 5vw, 3rem)',
  'display-sm': 'clamp(1.5rem, 3vw, 2rem)',
  'body-lg': '1.0625rem',
  body: '0.9375rem',
  'body-sm': '0.8125rem',
  caption: '0.75rem',
  overline: '0.6875rem',
} as const;

// ─── Spacing (4px grid) ─────────────────────────────────────────────────────

export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const radius = {
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const shadows = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.4)',
  sm: '0 2px 4px rgba(0, 0, 0, 0.4)',
  md: '0 4px 16px rgba(0, 0, 0, 0.5)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.6)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.7)',
  glow: `0 0 40px rgba(99, 102, 241, 0.35)`,
  glowSm: `0 0 20px rgba(99, 102, 241, 0.35)`,
  glowViolet: `0 0 40px rgba(139, 92, 246, 0.3)`,
  glowCyan: `0 0 40px rgba(6, 182, 212, 0.3)`,
} as const;

// ─── Z-index ─────────────────────────────────────────────────────────────────

export const zIndex = {
  dropdown: 50,
  sticky: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
} as const;

// ─── Breakpoints ─────────────────────────────────────────────────────────────

export const breakpoints = {
  mobile: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ─── Animation / Motion ──────────────────────────────────────────────────────

export const easings = {
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
  spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  decelerate: [0, 0, 0.2, 1] as [number, number, number, number],
  accelerate: [0.4, 0, 1, 1] as [number, number, number, number],
  overshoot: [0.68, -0.6, 0.32, 1.6] as [number, number, number, number],
};

export const durations = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
  slower: 0.5,
  page: 0.35,
} as const;

export const springConfig = {
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
  bouncy: { type: 'spring' as const, stiffness: 350, damping: 25 },
  layout: { type: 'spring' as const, stiffness: 350, damping: 30 },
};

/** Standard stagger delay between list items (ms) */
export const staggerDelay = 0.05; // 50ms

/** Framer Motion variant presets */
export const motionPresets = {
  fadeInUp: {
    hidden: { opacity: 0, y: 16 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: durations.slow, ease: easings.smooth, delay: i * staggerDelay },
    }),
    exit: { opacity: 0, y: -8, transition: { duration: durations.fast } },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: durations.base, ease: easings.smooth } },
    exit: { opacity: 0, transition: { duration: durations.fast } },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: durations.base, ease: easings.spring } },
    exit: { opacity: 0, scale: 0.97, transition: { duration: durations.fast } },
  },
  slideInRight: {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0, transition: { duration: durations.slow, ease: easings.smooth } },
    exit: { opacity: 0, x: -12, transition: { duration: durations.base } },
  },
  slideInLeft: {
    hidden: { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0, transition: { duration: durations.slow, ease: easings.smooth } },
    exit: { opacity: 0, x: 12, transition: { duration: durations.base } },
  },
  pageTransition: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: durations.page, ease: easings.smooth } },
    exit: { opacity: 0, y: -4, transition: { duration: durations.base } },
  },
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: staggerDelay, delayChildren: 0.08 },
    },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: easings.smooth } },
  },
  modalBackdrop: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: durations.base } },
    exit: { opacity: 0, transition: { duration: durations.fast } },
  },
  modalContent: {
    hidden: { opacity: 0, scale: 0.96, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, scale: 0.98, y: 10, transition: { duration: durations.fast } },
  },
  toastSlideIn: {
    hidden: { opacity: 0, x: 50, scale: 0.95 },
    visible: { opacity: 1, x: 0, scale: 1, transition: { duration: durations.slow, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: 30, scale: 0.97, transition: { duration: durations.base } },
  },
} as const;

// ─── Gradients ───────────────────────────────────────────────────────────────

export const gradients = {
  primary: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  primaryToViolet: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  primaryToCyan: 'linear-gradient(135deg, #6366f1, #06b6d4)',
  cyanToViolet: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
  multi: 'linear-gradient(135deg, #06b6d4, #6366f1, #8b5cf6)',
  warm: 'linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)',
  mesh: `
    radial-gradient(at 40% 20%, rgba(99, 102, 241, 0.08) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.06) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(6, 182, 212, 0.04) 0px, transparent 50%),
    radial-gradient(at 80% 80%, rgba(99, 102, 241, 0.04) 0px, transparent 50%)
  `,
  subtle: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
} as const;

// ─── Glassmorphism presets ───────────────────────────────────────────────────

export const glass = {
  light: {
    background: 'rgba(17, 17, 24, 0.6)',
    backdropFilter: 'blur(20px) saturate(150%)',
  },
  medium: {
    background: 'rgba(17, 17, 24, 0.75)',
    backdropFilter: 'blur(24px) saturate(150%)',
  },
  strong: {
    background: 'rgba(17, 17, 24, 0.85)',
    backdropFilter: 'blur(32px) saturate(180%)',
  },
} as const;

// ─── Component-level tokens ──────────────────────────────────────────────────

export const sidebar = {
  widthExpanded: 240,
  widthCollapsed: 60,
  headerHeight: 56, // 14 * 4
} as const;

export const toast = {
  maxWidth: 400,
  defaultDuration: 4000,
} as const;

export const modal = {
  maxWidths: {
    sm: '24rem',
    md: '28rem',
    lg: '32rem',
    xl: '42rem',
    '2xl': '48rem',
    full: '100%',
  },
} as const;
