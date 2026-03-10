/**
 * DoodleRefreshControl — Branded pull-to-refresh with animated doodle
 *
 * Shows a rotating + scaling DeepSight eye/sparkle icon during refresh
 * instead of the generic iOS/Android spinner.
 */

import React from 'react';
import { View, StyleSheet, RefreshControl, RefreshControlProps, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  useAnimatedReaction,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { palette } from '../theme/colors';

interface DoodleRefreshControlProps extends Omit<RefreshControlProps, 'tintColor' | 'colors'> {
  /** Accent color for the doodle (defaults to brand indigo) */
  accentColor?: string;
}

/** Animated SVG DeepSight eye doodle */
const RefreshDoodle: React.FC<{ spinning: boolean }> = ({ spinning }) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useAnimatedReaction(
    () => spinning,
    (isSpinning) => {
      if (isSpinning) {
        rotation.value = withRepeat(
          withTiming(360, { duration: 1200, easing: Easing.linear }),
          -1,
          false
        );
        scale.value = withRepeat(
          withTiming(1.1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        );
      } else {
        cancelAnimation(rotation);
        cancelAnimation(scale);
        rotation.value = withSpring(0, { damping: 15 });
        scale.value = withSpring(0.8, { damping: 15 });
      }
    },
    [spinning]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.doodleContainer, animatedStyle]}>
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <G fill="none" stroke={palette.indigo} strokeWidth={1.5} strokeLinecap="round">
          {/* Eye shape */}
          <Path d="M4 16 C4 16 10 6 16 6 C22 6 28 16 28 16 C28 16 22 26 16 26 C10 26 4 16 4 16Z" />
          {/* Iris */}
          <Circle cx={16} cy={16} r={4} fill={`${palette.violet}40`} stroke={palette.violet} />
          {/* Sparkle rays */}
          <Path d="M16 2 L16 5" stroke={palette.violet} strokeWidth={1.2} />
          <Path d="M16 27 L16 30" stroke={palette.violet} strokeWidth={1.2} />
          <Path d="M2 16 L5 16" stroke={palette.violet} strokeWidth={1.2} />
          <Path d="M27 16 L30 16" stroke={palette.violet} strokeWidth={1.2} />
        </G>
      </Svg>
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
    <RefreshControl
      refreshing={refreshing}
      tintColor={Platform.OS === 'ios' ? 'transparent' : color}
      colors={[color]}
      progressBackgroundColor={colors.bgSecondary}
      {...rest}
    >
      {Platform.OS === 'ios' && refreshing && (
        <View style={styles.iosOverlay}>
          <RefreshDoodle spinning={refreshing} />
        </View>
      )}
    </RefreshControl>
  );
};

const styles = StyleSheet.create({
  doodleContainer: {
    width: 32,
    height: 32,
  },
  iosOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});

export default DoodleRefreshControl;
