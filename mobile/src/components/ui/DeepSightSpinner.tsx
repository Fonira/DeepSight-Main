/**
 * DeepSightSpinner - Animated Logo Spinner Component
 *
 * Features:
 * - Rotating DeepSight rudder logo
 * - Native Animated API for 60fps performance
 * - Optional pulsing glow effect
 * - Multiple size presets
 * - Fallback to ActivityIndicator
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  ImageSourcePropType,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

// Size presets
const SIZE_PRESETS = {
  sm: 24,
  md: 48,
  lg: 80,
  xl: 120,
} as const;

// Speed presets (rotation duration in ms)
const SPEED_PRESETS = {
  slow: 2000,
  normal: 1200,
  fast: 800,
} as const;

type SizePreset = keyof typeof SIZE_PRESETS;
type SpeedPreset = keyof typeof SPEED_PRESETS;

interface DeepSightSpinnerProps {
  /** Size - number or preset ('sm', 'md', 'lg', 'xl') */
  size?: number | SizePreset;
  /** Rotation speed - 'slow', 'normal', 'fast' */
  speed?: SpeedPreset;
  /** Show pulsing glow effect */
  showGlow?: boolean;
  /** Custom image source (defaults to DeepSight icon) */
  source?: ImageSourcePropType;
  /** Custom color for fallback and glow */
  color?: string;
  /** Whether animation is active */
  isAnimating?: boolean;
}

// Default spinner image - uses the app icon
const defaultSpinnerSource = require('../../assets/images/icon.png');

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  speed = 'normal',
  showGlow = false,
  source,
  color,
  isAnimating = true,
}) => {
  const { colors } = useTheme();
  const [imageError, setImageError] = useState(false);

  // Animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  // Resolve size
  const resolvedSize = typeof size === 'number' ? size : SIZE_PRESETS[size];
  const resolvedDuration = SPEED_PRESETS[speed];
  const resolvedColor = color || colors.accentPrimary;

  // Rotation animation
  useEffect(() => {
    if (!isAnimating) {
      rotateAnim.setValue(0);
      return;
    }

    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: resolvedDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    rotationLoop.start();

    return () => {
      rotationLoop.stop();
    };
  }, [rotateAnim, resolvedDuration, isAnimating]);

  // Glow pulse animation
  useEffect(() => {
    if (!showGlow || !isAnimating) {
      glowAnim.setValue(0.4);
      return;
    }

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    glowLoop.start();

    return () => {
      glowLoop.stop();
    };
  }, [glowAnim, showGlow, isAnimating]);

  // Interpolate rotation value to degrees
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Handle image load error
  const handleImageError = () => {
    console.warn('[DeepSightSpinner] Image failed to load, falling back to ActivityIndicator');
    setImageError(true);
  };

  // Fallback to ActivityIndicator
  if (imageError) {
    return (
      <View style={[styles.container, { width: resolvedSize, height: resolvedSize }]}>
        <ActivityIndicator
          size={resolvedSize > 40 ? 'large' : 'small'}
          color={resolvedColor}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: resolvedSize, height: resolvedSize }]}>
      {/* Glow layer (behind the spinner) */}
      {showGlow && (
        <Animated.View
          style={[
            styles.glowLayer,
            {
              width: resolvedSize * 1.4,
              height: resolvedSize * 1.4,
              borderRadius: resolvedSize * 0.7,
              backgroundColor: resolvedColor,
              opacity: glowAnim,
            },
          ]}
        />
      )}

      {/* Rotating spinner */}
      <Animated.Image
        source={source || defaultSpinnerSource}
        style={[
          styles.spinner,
          {
            width: resolvedSize,
            height: resolvedSize,
            transform: [{ rotate }],
          },
        ]}
        resizeMode="contain"
        onError={handleImageError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowLayer: {
    position: 'absolute',
  },
  spinner: {
    zIndex: 1,
  },
});

export default DeepSightSpinner;
