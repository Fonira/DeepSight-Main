/**
 * DeepSight Spinner — 2-layer cosmic wheel (matches web version)
 *
 * Layer 1: spinner-cosmic.jpg — fixed cosmic flames background
 * Layer 2: spinner-wheel.jpg — rotating wheel overlay
 * Both masked into a circle via borderRadius.
 */

import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet, Text } from 'react-native';

const cosmicSource = require('../../../assets/images/spinner-cosmic.jpg');
const wheelSource = require('../../../assets/images/spinner-wheel.jpg');

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpeedPreset = 'slow' | 'normal' | 'fast';

const speedMap: Record<SpeedPreset, number> = {
  slow: 8000,
  normal: 5000,
  fast: 2000,
};

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  label?: string;
  showLabel?: boolean;
  /** Full rotation duration in ms */
  duration?: number;
  /** Speed preset — alternative to duration */
  speed?: SpeedPreset;
  /** Kept for backward compatibility (unused) */
  color?: string;
  /** Show glow is now ignored (no gradient), kept for API compat */
  showGlow?: boolean;
  /** Custom image source for the wheel layer */
  source?: any;
  /** Control animation */
  isAnimating?: boolean;
  style?: object;
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  label = 'Chargement...',
  showLabel = false,
  duration,
  speed,
  color: _color,
  showGlow: _showGlow,
  source,
  isAnimating = true,
  style,
}) => {
  const resolvedDuration = duration ?? (speed ? speedMap[speed] : 5000);
  const pixelSize = sizeMap[size];
  const wheelSize = Math.round(pixelSize * 0.92);

  const spinValue = useRef(new Animated.Value(0)).current;
  const labelPulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!isAnimating) return;

    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: resolvedDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(labelPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(labelPulse, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    if (showLabel) pulseAnimation.start();

    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
    };
  }, [resolvedDuration, isAnimating, showLabel]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      <View
        style={{
          width: pixelSize,
          height: pixelSize,
          borderRadius: pixelSize / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Layer 1: Cosmic flames — FIXED */}
        <Image
          source={cosmicSource}
          style={{
            ...StyleSheet.absoluteFillObject,
            width: pixelSize,
            height: pixelSize,
          }}
          resizeMode="cover"
        />

        {/* Layer 2: Wheel — ROTATES */}
        <Animated.Image
          source={source || wheelSource}
          style={{
            width: wheelSize,
            height: wheelSize,
            opacity: 0.85,
            transform: [{ rotate: spin }],
          }}
          resizeMode="cover"
        />
      </View>

      {showLabel && (
        <Animated.Text style={[styles.label, { opacity: labelPulse }]}>
          {label}
        </Animated.Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

export const DeepSightSpinnerSmall: React.FC<{ style?: object }> = (props) => (
  <DeepSightSpinner size="sm" {...props} />
);

export const DeepSightSpinnerLarge: React.FC<{ style?: object; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

export default DeepSightSpinner;
