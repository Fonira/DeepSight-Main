/**
 * TypingIndicator - Bouncy spring dots (Linear-inspired)
 *
 * 3 dots that bounce with staggered spring physics,
 * not just opacity pulse. Each dot has translateY bounce.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { palette } from '../../theme/colors';

/**
 * Spring-driven bouncing dot.
 *
 * Each dot bounces vertically with a snappy spring that overshoots slightly
 * on the way up, giving a playful rubber-ball feel. A subtle scale pulse
 * and opacity shift accompany the bounce for depth.
 */
const BOUNCE_HEIGHT = -8;
const SPRING_UP = { damping: 6, stiffness: 260, mass: 0.35 };
const SPRING_DOWN = { damping: 10, stiffness: 180, mass: 0.35 };
const STAGGER_MS = 150;

const BouncyDot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(BOUNCE_HEIGHT, SPRING_UP),
          withSpring(0, SPRING_DOWN),
        ),
        -1,
        false,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(1.25, SPRING_UP),
          withSpring(1, SPRING_DOWN),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(1, SPRING_UP),
          withSpring(0.5, SPRING_DOWN),
        ),
        -1,
        false,
      ),
    );
  }, [translateY, scale, opacity, delay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, animStyle]} />
  );
};

export const TypingIndicator: React.FC = () => {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: `${colors.accentPrimary}20` }]}>
        <Ionicons name="sparkles" size={14} color={colors.accentPrimary} />
      </View>

      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.bgSecondary,
            borderColor: colors.glassBorder,
          },
        ]}
      >
        <BouncyDot delay={0} color={palette.indigo} />
        <BouncyDot delay={STAGGER_MS} color={palette.violet} />
        <BouncyDot delay={STAGGER_MS * 2} color={palette.indigo} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: sp.sm,
    paddingHorizontal: sp.xs,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sp.sm,
    marginBottom: 4,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default TypingIndicator;
