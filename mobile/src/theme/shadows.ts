/**
 * DeepSight Mobile - Shadow System
 * Native iOS/Android shadows
 */
import { Platform, ViewStyle } from 'react-native';

interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const createShadow = (
  offsetY: number,
  opacity: number,
  radius: number,
  elevation: number,
  color = '#000000',
): ShadowStyle => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

export const shadows = {
  none: createShadow(0, 0, 0, 0),
  xs: createShadow(1, 0.05, 1, 1),
  sm: createShadow(1, 0.08, 2, 2),
  md: createShadow(2, 0.12, 6, 4),
  lg: createShadow(4, 0.16, 12, 8),
  xl: createShadow(8, 0.2, 20, 12),
  '2xl': createShadow(12, 0.25, 30, 16),
  /** Colored glow for accent elements */
  glow: (color: string): ShadowStyle => createShadow(0, 0.4, 16, 8, color),
  /** Inner shadow approximation (use with border) */
  inner: createShadow(0, 0, 0, 0), // RN doesn't support inset shadows natively
} as const;

/** Platform-specific shadow application */
export const applyShadow = (level: keyof typeof shadows): ViewStyle => {
  if (level === 'glow' || level === 'inner') return {};
  const shadow = shadows[level];
  if (Platform.OS === 'android') {
    return { elevation: shadow.elevation };
  }
  return shadow;
};
