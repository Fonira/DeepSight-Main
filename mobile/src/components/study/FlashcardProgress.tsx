/**
 * FlashcardProgress — Animated SVG circular progress ring
 *
 * Replaces flat progress bars with a smooth animated ring.
 * Uses Reanimated 3 to animate strokeDashoffset on an SVG circle.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { palette } from '@/theme/colors';
import { fontFamily, fontSize } from '@/theme/typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface FlashcardProgressProps {
  /** 0–1 progress value */
  progress: number;
  /** Ring diameter in px */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Show percentage text in center */
  showLabel?: boolean;
  /** Custom label (overrides default percentage) */
  label?: string;
}

export const FlashcardProgress: React.FC<FlashcardProgressProps> = ({
  progress,
  size = 64,
  strokeWidth = 5,
  showLabel = true,
  label,
}) => {
  const { colors } = useTheme();
  const animatedProgress = useSharedValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(1, Math.max(0, progress)), {
      duration: 600,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  const displayLabel = label ?? `${Math.round(progress * 100)}%`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated progress arc */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={palette.indigo}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {displayLabel}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
  },
});

export default FlashcardProgress;
