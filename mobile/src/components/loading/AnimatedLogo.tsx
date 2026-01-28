/**
 * AnimatedLogo - Wrapper for DeepSightSpinner
 *
 * This component provides a consistent loading animation interface
 * using the native DeepSightSpinner (rotating rudder logo).
 *
 * Features:
 * - Rotating DeepSight logo animation
 * - Native Animated API for 60fps performance
 * - Optional pulsing glow effect
 * - Multiple size presets
 * - Fallback to ActivityIndicator
 */

import React from 'react';
import { View, StyleSheet, ImageSourcePropType } from 'react-native';
import { DeepSightSpinner } from '../ui/DeepSightSpinner';

// Size presets matching DeepSightSpinner
const SIZE_PRESETS = {
  sm: 24,
  md: 48,
  lg: 80,
  xl: 120,
} as const;

type SizePreset = keyof typeof SIZE_PRESETS;
type SpeedPreset = 'slow' | 'normal' | 'fast';

interface AnimatedLogoProps {
  /** Size of the animation - number or preset ('sm', 'md', 'lg', 'xl') */
  size?: number | SizePreset;
  /** Whether to loop the animation (always true for spinner) */
  loop?: boolean;
  /** Whether to auto-play the animation */
  autoPlay?: boolean;
  /** Animation speed - 'slow', 'normal', 'fast' or number (legacy, ignored) */
  speed?: SpeedPreset | number;
  /** Optional custom image source */
  source?: ImageSourcePropType;
  /** Show pulsing glow effect */
  showGlow?: boolean;
  /** Custom color for the spinner */
  color?: string;
  /** Callback when animation completes (not used for infinite loop) */
  onAnimationFinish?: () => void;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 'lg',
  loop = true,
  autoPlay = true,
  speed = 'normal',
  source,
  showGlow = false,
  color,
  onAnimationFinish,
}) => {
  // Convert legacy numeric speed to preset
  const resolvedSpeed: SpeedPreset = typeof speed === 'number'
    ? speed > 1.5 ? 'fast' : speed < 0.8 ? 'slow' : 'normal'
    : speed;

  // Resolve size from preset or number
  const resolvedSize = typeof size === 'number' ? size : SIZE_PRESETS[size];

  return (
    <View style={[styles.container, { width: resolvedSize, height: resolvedSize }]}>
      <DeepSightSpinner
        size={resolvedSize}
        speed={resolvedSpeed}
        showGlow={showGlow}
        source={source}
        color={color}
        isAnimating={autoPlay && loop}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnimatedLogo;
