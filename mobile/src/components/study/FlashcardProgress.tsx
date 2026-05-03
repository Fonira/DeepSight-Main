/**
 * FlashcardProgress — Animated SVG circular progress ring
 *
 * Replaces flat progress bars with a smooth animated ring.
 * Uses Reanimated 3 to animate strokeDashoffset on an SVG circle.
 * Supports count labels (e.g., "3/10") or percentage display.
 */

import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSpring,
  Easing,
  useAnimatedStyle,
  interpolateColor,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { palette } from "../../theme/colors";
import { fontFamily, fontSize } from "../../theme/typography";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface FlashcardProgressProps {
  /** 0-1 progress value */
  progress: number;
  /** Ring diameter in px */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Show text label in center */
  showLabel?: boolean;
  /** Custom label (overrides default percentage). Use for count format e.g. "3/10" */
  label?: string;
  /** Active stroke color (defaults to indigo, shifts toward green at 100%) */
  strokeColor?: string;
}

const FlashcardProgressComponent: React.FC<FlashcardProgressProps> = ({
  progress,
  size = 64,
  strokeWidth = 5,
  showLabel = true,
  label,
  strokeColor,
}) => {
  const { colors } = useTheme();
  const animatedProgress = useSharedValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Scale font based on ring size so count labels like "3/10" fit comfortably
  const labelFontSize = Math.max(10, Math.round(size * 0.2));

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(1, Math.max(0, progress)), {
      duration: 600,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  // Gentle pulse when progress reaches 100%
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (progress >= 1) {
      pulseScale.value = withSpring(
        1.08,
        { damping: 8, stiffness: 200 },
        () => {
          pulseScale.value = withSpring(1, { damping: 12, stiffness: 150 });
        },
      );
    }
  }, [progress, pulseScale]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Color shifts from indigo toward green as progress completes
  const labelAnimStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      animatedProgress.value,
      [0, 0.8, 1],
      [colors.textPrimary, colors.textPrimary, palette.green],
    );
    return { color };
  });

  const displayLabel = label ?? `${Math.round(progress * 100)}%`;
  const activeStroke = strokeColor ?? palette.indigo;

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size },
        containerAnimStyle,
      ]}
    >
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
          stroke={activeStroke}
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
          <Animated.Text
            style={[styles.label, { fontSize: labelFontSize }, labelAnimStyle]}
          >
            {displayLabel}
          </Animated.Text>
        </View>
      )}
    </Animated.View>
  );
};

export const FlashcardProgress = React.memo(FlashcardProgressComponent);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  labelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
  },
});

export default FlashcardProgress;
