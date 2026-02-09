/**
 * DeepSight Mobile - Animation System
 * Reanimated 3 spring/timing presets
 * Web reference: 200ms cubic-bezier(0.4, 0, 0.2, 1)
 */
import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/** Duration presets (ms) */
export const duration = {
  instant: 100,
  fast: 150,
  base: 200,
  slow: 300,
  slower: 500,
  slowest: 700,
} as const;

/** Spring presets for Reanimated */
export const springs: Record<string, WithSpringConfig> = {
  /** Snappy button press feedback */
  button: {
    damping: 15,
    stiffness: 400,
    mass: 0.5,
  },
  /** Smooth card animations */
  gentle: {
    damping: 20,
    stiffness: 120,
    mass: 1,
  },
  /** Bouncy entry animations */
  bouncy: {
    damping: 12,
    stiffness: 180,
    mass: 0.8,
  },
  /** Quick scale feedback */
  scale: {
    damping: 18,
    stiffness: 350,
    mass: 0.4,
  },
  /** Tab indicator slide */
  slide: {
    damping: 22,
    stiffness: 250,
    mass: 0.6,
  },
  /** Bottom sheet snapping */
  sheet: {
    damping: 30,
    stiffness: 300,
    mass: 1,
  },
} as const;

/** Timing presets for Reanimated */
export const timings: Record<string, WithTimingConfig> = {
  /** Standard easing (matches web cubic-bezier(0.4, 0, 0.2, 1)) */
  standard: {
    duration: duration.base,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  /** Ease-in for exits */
  exit: {
    duration: duration.fast,
    easing: Easing.bezier(0.4, 0, 1, 1),
  },
  /** Ease-out for entries */
  enter: {
    duration: duration.slow,
    easing: Easing.bezier(0, 0, 0.2, 1),
  },
  /** Fade in/out */
  fade: {
    duration: duration.base,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
  /** Shimmer animation */
  shimmer: {
    duration: 1200,
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  },
} as const;
