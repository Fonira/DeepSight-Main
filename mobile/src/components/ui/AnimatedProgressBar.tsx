import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';

interface AnimatedProgressBarProps {
  /** Current value */
  value: number;
  /** Maximum value */
  max: number;
  /** Label (left side) */
  label: string;
  /** Whether to show value text (right side) */
  showValue?: boolean;
  /** Gradient colors for the bar fill */
  gradientColors?: readonly [string, string, ...string[]];
  /** Height of the bar */
  height?: number;
  /** Animation delay in ms */
  animationDelay?: number;
  /** Style override */
  style?: object;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  value,
  max,
  label,
  showValue = true,
  gradientColors,
  height = 8,
  animationDelay = 300,
  style,
}) => {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  useEffect(() => {
    opacity.value = withDelay(animationDelay, withTiming(1, { duration: 300 }));
    progress.value = withDelay(
      animationDelay + 100,
      withTiming(percentage, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [percentage, animationDelay, progress, opacity]);

  const barAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%` as any,
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const defaultGradient: readonly [string, string, ...string[]] =
    gradientColors || [colors.accentPrimary, colors.accentSecondary];

  // Determine color based on percentage
  const getBarColor = (): readonly [string, string, ...string[]] => {
    if (percentage >= 90) return ['#ef4444', '#f87171'];
    if (percentage >= 70) return ['#f59e0b', '#fbbf24'];
    return defaultGradient;
  };

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle, style]}>
      {(label || showValue) && (
        <View style={styles.header}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {label}
          </Text>
          {showValue && (
            <Text style={[styles.value, { color: colors.textPrimary }]}>
              {value}/{max}
            </Text>
          )}
        </View>
      )}
      <View
        style={[
          styles.track,
          { backgroundColor: colors.glassBg, height, borderRadius: height / 2 },
        ]}
      >
        <Animated.View style={[styles.fillContainer, { height, borderRadius: height / 2 }, barAnimatedStyle]}>
          <LinearGradient
            colors={[...getBarColor()]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { height, borderRadius: height / 2 }]}
          />
        </Animated.View>
        {/* Shimmer overlay for active progress */}
        {percentage > 0 && percentage < 100 && (
          <Animated.View
            style={[
              styles.fillContainer,
              { height, borderRadius: height / 2, opacity: 0.3 },
              barAnimatedStyle,
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { height, borderRadius: height / 2 }]}
            />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: sp.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
  },
  value: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bodySemiBold,
  },
  track: {
    overflow: 'hidden',
    position: 'relative',
  },
  fillContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
});

export default AnimatedProgressBar;
