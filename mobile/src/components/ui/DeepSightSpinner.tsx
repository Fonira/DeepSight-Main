/**
 * DeepSight Spinner v2.0 — Aurora édition
 * Vrai logo DeepSight qui tourne + flammes orbitantes + halo pulsant.
 * Port Reanimated du spinner CSS web. Respecte reduce motion via isAnimating.
 */

import React, { useEffect } from "react";
import { View, Image, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { fontFamily, fontSize } from "../../theme/typography";

// Vrai logo DeepSight (1024x1024, vignette radiale, fond noir)
const LOGO_SOURCE = require("../../../assets/images/deepsight-logo.png");

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
type SpeedPreset = "slow" | "normal" | "fast";

const sizeMap: Record<SpinnerSize, number> = {
  xs: 28,
  sm: 40,
  md: 64,
  lg: 96,
  xl: 140,
};

const speedMap: Record<SpeedPreset, number> = {
  slow: 5000,
  normal: 3500,
  fast: 2000,
};

// Palette aurora (identique au web)
const FLAME_COLORS = [
  "#fbbf24", // or
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // rose
  "#fb923c", // orange
  "#6366f1", // indigo
] as const;

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  label?: string;
  showLabel?: boolean;
  duration?: number;
  speed?: SpeedPreset;
  /** Rétrocompat — ignoré */
  color?: string;
  /** Rétrocompat — ignoré */
  showGlow?: boolean;
  /** Rétrocompat — ignoré */
  source?: any;
  isAnimating?: boolean;
  style?: object;
}

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = "md",
  label = "Chargement...",
  showLabel = false,
  duration,
  speed,
  isAnimating = true,
  style,
}) => {
  const { colors } = useTheme();
  const resolvedDuration = duration ?? (speed ? speedMap[speed] : 3500);
  const pixelSize = sizeMap[size];

  // Animations partagées
  const rotation = useSharedValue(0);
  const counterRotation = useSharedValue(0);
  const logoScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0.55);
  const flameScales = FLAME_COLORS.map(() => useSharedValue(1));
  const labelOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (!isAnimating) return;

    // Logo rotation
    rotation.value = withRepeat(
      withTiming(360, { duration: resolvedDuration, easing: Easing.linear }),
      -1,
      false,
    );

    // Particules en contre-rotation (effet scie inversée)
    counterRotation.value = withRepeat(
      withTiming(-360, {
        duration: resolvedDuration * 0.7,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    // Pulsation logo (breathe)
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.97, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Halo pulse
    haloOpacity.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: 1750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Flammes : chaque particule pulse avec décalage
    flameScales.forEach((scale, i) => {
      setTimeout(() => {
        scale.value = withRepeat(
          withSequence(
            withTiming(1.4, {
              duration: 450,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(0.7, {
              duration: 450,
              easing: Easing.inOut(Easing.ease),
            }),
          ),
          -1,
          true,
        );
      }, i * 120);
    });

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

  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${counterRotation.value}deg` }],
  }));

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const outerSize = pixelSize * 1.6;
  const logoSize = pixelSize;
  const flameRadius = pixelSize * 0.72;
  const flameSize = Math.max(pixelSize * 0.12, 4);
  const showFlames = pixelSize >= 40;
  const showHalo = pixelSize >= 48;

  return (
    <View style={[styles.container, style]}>
      <View
        style={{
          width: outerSize,
          height: outerSize,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Halo aurora pulsant (derrière) */}
        {showHalo && (
          <Animated.View
            style={[
              {
                position: "absolute",
                width: outerSize,
                height: outerSize,
                borderRadius: outerSize / 2,
                backgroundColor: "transparent",
                shadowColor: "#8b5cf6",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: outerSize * 0.3,
                elevation: 20,
              },
              haloStyle,
            ]}
          >
            <View
              style={{
                width: outerSize * 0.7,
                height: outerSize * 0.7,
                borderRadius: outerSize * 0.35,
                backgroundColor: "#6366f1",
                opacity: 0.15,
                position: "absolute",
                top: outerSize * 0.15,
                left: outerSize * 0.15,
              }}
            />
            <View
              style={{
                width: outerSize * 0.5,
                height: outerSize * 0.5,
                borderRadius: outerSize * 0.25,
                backgroundColor: "#fb923c",
                opacity: 0.12,
                position: "absolute",
                top: outerSize * 0.25,
                left: outerSize * 0.3,
              }}
            />
          </Animated.View>
        )}

        {/* Logo DeepSight qui tourne */}
        <Animated.View style={[styles.logoWrapper, rotationStyle]}>
          <Animated.View style={logoAnimStyle}>
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
        </Animated.View>

        {/* Anneau de flammes orbitantes (contre-rotation) */}
        {showFlames && (
          <Animated.View
            style={[
              {
                width: outerSize,
                height: outerSize,
                position: "absolute",
              },
              counterStyle,
            ]}
            pointerEvents="none"
          >
            {FLAME_COLORS.map((color, i) => {
              const angle =
                (i / FLAME_COLORS.length) * 2 * Math.PI - Math.PI / 2;
              const x =
                Math.cos(angle) * flameRadius + outerSize / 2 - flameSize / 2;
              const y =
                Math.sin(angle) * flameRadius + outerSize / 2 - flameSize / 2;

              return (
                <FlameParticle
                  key={i}
                  color={color}
                  x={x}
                  y={y}
                  particleSize={flameSize}
                  scaleValue={flameScales[i]}
                />
              );
            })}
          </Animated.View>
        )}
      </View>

      {showLabel && (
        <Animated.Text
          style={[styles.label, { color: colors.textTertiary }, labelStyle]}
        >
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
          position: "absolute",
          left: x,
          top: y,
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: particleSize * 1.2,
          elevation: 6,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    zIndex: 10,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    overflow: "hidden",
  },
  label: {
    marginTop: 16,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});

export const DeepSightSpinnerSmall: React.FC<{ style?: object }> = (props) => (
  <DeepSightSpinner size="sm" {...props} />
);

export const DeepSightSpinnerLarge: React.FC<{
  style?: object;
  label?: string;
}> = (props) => <DeepSightSpinner size="lg" showLabel {...props} />;

export default DeepSightSpinner;
