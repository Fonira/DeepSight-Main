/**
 * DoodleRefreshControl — Branded pull-to-refresh with animated doodle
 *
 * Shows a rotating + scaling DeepSight eye/sparkle icon during refresh
 * on both iOS and Android, replacing the generic spinner.
 * Animated sparkle rays pulse outward, iris bounces with spring physics.
 */

import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  RefreshControl,
  RefreshControlProps,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  interpolate,
} from "react-native-reanimated";
import Svg, { Circle, Path, G } from "react-native-svg";
import { useTheme } from "@/contexts/ThemeContext";
import { palette } from "@/theme/colors";
import { sp } from "@/theme/spacing";

interface DoodleRefreshControlProps extends Omit<
  RefreshControlProps,
  "tintColor" | "colors"
> {
  /** Accent color for the doodle (defaults to brand indigo) */
  accentColor?: string;
}

/** SVG size constant */
const ICON_SIZE = 36;

/** Animated SVG DeepSight eye doodle with sparkle rays */
const RefreshDoodle: React.FC<{ spinning: boolean }> = ({ spinning }) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0.7);
  const irisScale = useSharedValue(1);
  const sparkleOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (spinning) {
      // Main rotation: continuous slow spin
      rotation.value = withRepeat(
        withTiming(360, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
      // Overall scale: gentle breathing
      scale.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 500, easing: Easing.out(Easing.ease) }),
          withTiming(0.9, { duration: 500, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      );
      // Iris pulse: spring bounce on each beat
      irisScale.value = withRepeat(
        withSequence(
          withSpring(1.3, { damping: 6, stiffness: 200 }),
          withDelay(200, withSpring(1.0, { damping: 12, stiffness: 150 })),
        ),
        -1,
        false,
      );
      // Sparkle rays fade in/out
      sparkleOpacity.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 400, easing: Easing.out(Easing.ease) }),
          withTiming(0.3, { duration: 400, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      cancelAnimation(scale);
      cancelAnimation(irisScale);
      cancelAnimation(sparkleOpacity);
      rotation.value = withSpring(0, { damping: 15 });
      scale.value = withSpring(0.7, { damping: 15 });
      irisScale.value = withSpring(1, { damping: 15 });
      sparkleOpacity.value = withTiming(0.4, { duration: 200 });
    }
  }, [spinning, rotation, scale, irisScale, sparkleOpacity]);

  /** Container: rotates + scales the entire doodle */
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
    opacity: interpolate(scale.value, [0.7, 0.9], [0.6, 1.0]),
  }));

  /** Sparkle rays: animated opacity overlay */
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
  }));

  /** Iris: animated scale pulse */
  const irisStyle = useAnimatedStyle(() => ({
    transform: [{ scale: irisScale.value }],
  }));

  return (
    <Animated.View style={[styles.doodleContainer, containerStyle]}>
      {/* Layer 1: Sparkle rays (animated opacity) */}
      <Animated.View style={[styles.svgLayer, sparkleStyle]}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 36 36">
          <G fill="none" strokeLinecap="round">
            {/* Cardinal sparkle rays */}
            <Path d="M18 1 L18 5" stroke={palette.violet} strokeWidth={1.5} />
            <Path d="M18 31 L18 35" stroke={palette.violet} strokeWidth={1.5} />
            <Path d="M1 18 L5 18" stroke={palette.violet} strokeWidth={1.5} />
            <Path d="M31 18 L35 18" stroke={palette.violet} strokeWidth={1.5} />
            {/* Diagonal sparkles */}
            <Path d="M6.5 6.5 L9 9" stroke={palette.indigo} strokeWidth={1} />
            <Path
              d="M27 27 L29.5 29.5"
              stroke={palette.indigo}
              strokeWidth={1}
            />
            <Path d="M29.5 6.5 L27 9" stroke={palette.indigo} strokeWidth={1} />
            <Path d="M9 27 L6.5 29.5" stroke={palette.indigo} strokeWidth={1} />
          </G>
        </Svg>
      </Animated.View>

      {/* Layer 2: Eye shape (static within the rotating container) */}
      <View style={styles.svgLayer}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 36 36">
          <G fill="none" strokeLinecap="round" strokeLinejoin="round">
            <Path
              d="M4 18 C4 18 10 8 18 8 C26 8 32 18 32 18 C32 18 26 28 18 28 C10 28 4 18 4 18Z"
              stroke={palette.indigo}
              strokeWidth={1.8}
            />
          </G>
        </Svg>
      </View>

      {/* Layer 3: Iris (animated scale) */}
      <Animated.View style={[styles.svgLayer, irisStyle]}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 36 36">
          <Circle
            cx={18}
            cy={18}
            r={4.5}
            fill={`${palette.violet}50`}
            stroke={palette.violet}
            strokeWidth={1.5}
          />
          {/* Pupil */}
          <Circle cx={18} cy={18} r={2} fill={palette.indigo} />
          {/* Highlight dot */}
          <Circle cx={16.5} cy={16.5} r={1} fill="white" opacity={0.7} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

export const DoodleRefreshControl: React.FC<DoodleRefreshControlProps> = ({
  refreshing,
  accentColor,
  ...rest
}) => {
  const { colors } = useTheme();
  const color = accentColor || colors.accentPrimary;

  return (
    <>
      <RefreshControl
        refreshing={refreshing}
        tintColor={Platform.OS === "ios" ? "transparent" : "transparent"}
        colors={[color]}
        progressBackgroundColor="transparent"
        {...rest}
      />
      {refreshing && (
        <View
          style={[styles.doodleOverlay, { backgroundColor: colors.bgPrimary }]}
        >
          <RefreshDoodle spinning={refreshing} />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  doodleContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  svgLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  doodleOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp.lg,
    zIndex: 10,
  },
});

export default DoodleRefreshControl;
