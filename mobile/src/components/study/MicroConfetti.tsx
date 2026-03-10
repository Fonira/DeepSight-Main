/**
 * MicroConfetti — Subtle 6-particle confetti burst
 *
 * Design: small indigo/violet particles rise then fall with gravity.
 * Not explosive — just a satisfying micro-celebration.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { palette } from '../../theme/colors';

const PARTICLES = [
  { color: palette.indigo, dx: -30, delay: 0 },
  { color: palette.violet, dx: -15, delay: 40 },
  { color: palette.blue, dx: 0, delay: 80 },
  { color: palette.indigo, dx: 15, delay: 50 },
  { color: palette.violet, dx: 30, delay: 20 },
  { color: palette.cyan, dx: 8, delay: 60 },
];

interface MicroConfettiProps {
  /** Set to true to fire the burst */
  trigger: boolean;
  /** Called when animation completes */
  onComplete?: () => void;
}

const Particle: React.FC<{
  color: string;
  dx: number;
  delay: number;
  trigger: boolean;
}> = ({ color, dx, delay, trigger }) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    if (!trigger) return;

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(300, withTiming(0, { duration: 250 }))
    ));

    translateY.value = withDelay(delay, withSequence(
      // Rise
      withTiming(-40 - Math.random() * 20, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
      // Fall with gravity
      withTiming(10, {
        duration: 350,
        easing: Easing.in(Easing.quad),
      })
    ));

    translateX.value = withDelay(delay,
      withTiming(dx + (Math.random() - 0.5) * 10, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      })
    );

    scale.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(250, withTiming(0.3, { duration: 200 }))
    ));
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: color },
        style,
      ]}
    />
  );
};

export const MicroConfetti: React.FC<MicroConfettiProps> = ({ trigger, onComplete }) => {
  useEffect(() => {
    if (trigger && onComplete) {
      const timer = setTimeout(onComplete, 700);
      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!trigger) return null;

  return (
    <Animated.View style={styles.container} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} trigger={trigger} />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    width: 0,
    height: 0,
    zIndex: 100,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default MicroConfetti;
