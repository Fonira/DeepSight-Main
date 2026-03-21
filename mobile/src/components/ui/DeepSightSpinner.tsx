/**
 * DeepSight Spinner — Real DeepSight logo (cosmic compass/helm)
 * with animated flame particles rotating around it.
 *
 * Uses the actual app icon (spinner-cosmic.jpg) at center,
 * with 4 colored flame particles orbiting + pulsing.
 */

import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { fontFamily, fontSize } from '../../theme/typography';

// Real DeepSight logo asset
const LOGO_SOURCE = require('../../../assets/images/spinner-cosmic.jpg');

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpeedPreset = 'slow' | 'normal' | 'fast';

const sizeMap: Record<SpinnerSize, number> = {
  xs: 28,
  sm: 40,
  md: 56,
  lg: 80,
  xl: 120,
};

const speedMap: Record<SpeedPreset, number> = {
  slow: 4000,
  normal: 2500,
  fast: 1500,
};

const FLAME_COLORS = ['#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444'] as const;

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  label?: string;
  showLabel?: boolean;
  duration?: number;
  speed?: SpeedPreset;
  /** Backward compat — ignored */
  color?: string;
  /** Backward compat — ignored */
  showGlow?: boolean;
  /** Backward compat — ignored */
  source?: any;
  isAnimating?: boolean;
  style?: object;
}

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  label = 'Chargement...',
  showLabel = false,
  duration,
  speed,
  isAnimating = true,
  style,
}) => {
  const { colors } = useTheme();
  const resolvedDuration = duration ?? (speed ? speedMap[speed] : 2500);
  const pixelSize = sizeMap[size];

  const rotation = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const scales = [
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
  ];
  const labelOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (!isAnimating) return;

    // Continuous rotation of flame ring
    rotation.value = withRepeat(
      withTiming(360, { duration: resolvedDuration, easing: Easing.linear }),
      -1,
      false,
    );

    // Gentle logo pulse (breathe effect)
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Pulsing flames — each offset by 150ms
    scales.forEach((scale, i) => {
      setTimeout(() => {
        scale.value = withRepeat(
          withSequence(
            withTiming(1.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.7, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          true,
        );
      }, i * 150);
    });

    // Label pulse
    if (showLabel) {
      labelOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating, resolvedDuration, showLabel]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  // Outer container is larger to accommodate the orbiting flames
  const outerSize = pixelSize * 1.6;
  const logoSize = pixelSize;
  const flameRadius = pixelSize * 0.7;
  const flameSize = Math.max(pixelSize * 0.14, 5);

  return (
    <View style={[styles.container, style]}>
      <View style={{ width: outerSize, height: outerSize, alignItems: 'center', justifyContent: 'center' }}>
        {/* Real DeepSight Logo at center — round with glow */}
        <Animated.View style={[styles.logoWrapper, logoAnimStyle]}>
          <Image
            source={LOGO_SOURCE}
            style={[
              styles.logo,
              {
                width: logoSize,
                height: logoSize,
                borderRadius: logoSize / 2,
              },
            ]}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Rotating flames ring */}
        <Animated.View
          style={[
            {
              width: outerSize,
              height: outerSize,
              position: 'absolute',
            },
            rotationStyle,
          ]}
        >
          {FLAME_COLORS.map((color, i) => {
            const angle = (i / 4) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * flameRadius + outerSize / 2 - flameSize / 2;
            const y = Math.sin(angle) * flameRadius + outerSize / 2 - flameSize / 2;

            return (
              <FlameParticle
                key={i}
                color={color}
                x={x}
                y={y}
                particleSize={flameSize}
                scaleValue={scales[i]}
              />
            );
          })}
        </Animated.View>
      </View>

      {showLabel && (
        <Animated.Text style={[styles.label, { color: colors.textTertiary }, labelStyle]}>
          {label}
        </Animated.Text>
      )}
    </View>
  );
};

interface FlameParticleProps {
  color: string;
  x: number;
  y: number;
  particleSize: number;
  scaleValue: SharedValue<number>;
}

const FlameParticle: React.FC<FlameParticleProps> = ({
  color,
  x,
  y,
  particleSize,
  scaleValue,
}) => {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: color,
          // Glow effect via shadow
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: particleSize,
          elevation: 6,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    zIndex: 1,
    // Glow effect around the logo
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    // The image is round-cropped
    overflow: 'hidden',
  },
  label: {
    marginTop: 16,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});

export const DeepSightSpinnerSmall: React.FC<{ style?: object }> = (props) => (
  <DeepSightSpinner size="sm" {...props} />
);

export const DeepSightSpinnerLarge: React.FC<{ style?: object; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

export default DeepSightSpinner;
