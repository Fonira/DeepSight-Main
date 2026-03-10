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
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { palette } from '../../theme/colors';

const BOUNCE_HEIGHT = -6;
const SPRING_CONFIG = { damping: 8, stiffness: 200, mass: 0.4 };

const BouncyDot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(BOUNCE_HEIGHT, SPRING_CONFIG),
          withSpring(0, SPRING_CONFIG),
        ),
        -1,
        false,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(1.2, SPRING_CONFIG),
          withSpring(1, SPRING_CONFIG),
        ),
        -1,
        false,
      ),
    );
  }, [translateY, scale, delay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
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
        <BouncyDot delay={120} color={palette.violet} />
        <BouncyDot delay={240} color={palette.indigo} />
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
