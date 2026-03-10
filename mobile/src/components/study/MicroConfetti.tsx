/**
 * MicroConfetti — Subtle 6-particle confetti burst
 *
 * Design: small indigo/violet particles rise then fall with gravity.
 * Not explosive — just a satisfying micro-celebration.
 * Particles have varied shapes (round + rectangular) and spin during flight.
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
} from 'react-native-reanimated';
import { palette } from '../../theme/colors';

type ParticleShape = 'circle' | 'rect';

interface ParticleConfig {
  color: string;
  dx: number;
  delay: number;
  shape: ParticleShape;
  /** Rise height randomizer seed (-40 base + extra) */
  riseExtra: number;
  /** Rotation direction: 1 = clockwise, -1 = counter-clockwise */
  spinDir: 1 | -1;
}

const PARTICLES: ParticleConfig[] = [
  { color: palette.indigo, dx: -28, delay: 0, shape: 'circle', riseExtra: 18, spinDir: 1 },
  { color: palette.violet, dx: -12, delay: 40, shape: 'rect', riseExtra: 10, spinDir: -1 },
  { color: palette.blue, dx: 3, delay: 80, shape: 'circle', riseExtra: 24, spinDir: 1 },
  { color: palette.indigo, dx: 16, delay: 50, shape: 'rect', riseExtra: 14, spinDir: -1 },
  { color: palette.violet, dx: 30, delay: 20, shape: 'circle', riseExtra: 20, spinDir: 1 },
  { color: palette.cyan, dx: 7, delay: 60, shape: 'rect', riseExtra: 8, spinDir: -1 },
];

interface MicroConfettiProps {
  /** Set to true to fire the burst */
  trigger: boolean;
  /** Called when animation completes */
  onComplete?: () => void;
}

const Particle: React.FC<{
  config: ParticleConfig;
  trigger: boolean;
}> = ({ config, trigger }) => {
  const { color, dx, delay, shape, riseExtra, spinDir } = config;

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (!trigger) {
      // Reset for next trigger
      translateY.value = 0;
      translateX.value = 0;
      opacity.value = 0;
      scale.value = 0.5;
      rotate.value = 0;
      return;
    }

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(320, withTiming(0, { duration: 280 }))
    ));

    translateY.value = withDelay(delay, withSequence(
      // Rise phase
      withTiming(-40 - riseExtra - Math.random() * 10, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      }),
      // Fall with gravity
      withTiming(14, {
        duration: 380,
        easing: Easing.in(Easing.quad),
      })
    ));

    translateX.value = withDelay(delay,
      withTiming(dx + (Math.random() - 0.5) * 12, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      })
    );

    scale.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(280, withTiming(0.2, { duration: 220 }))
    ));

    // Spin during flight
    rotate.value = withDelay(delay,
      withTiming(spinDir * (180 + Math.random() * 180), {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const shapeStyle = shape === 'rect' ? styles.particleRect : styles.particleCircle;

  return (
    <Animated.View
      style={[
        shapeStyle,
        { backgroundColor: color },
        style,
      ]}
    />
  );
};

export const MicroConfetti: React.FC<MicroConfettiProps> = ({ trigger, onComplete }) => {
  useEffect(() => {
    if (trigger && onComplete) {
      const timer = setTimeout(onComplete, 750);
      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!trigger) return null;

  return (
    <Animated.View style={styles.container} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Particle key={i} config={p} trigger={trigger} />
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
  particleCircle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  particleRect: {
    position: 'absolute',
    width: 7,
    height: 4,
    borderRadius: 1.5,
  },
});

export default MicroConfetti;
