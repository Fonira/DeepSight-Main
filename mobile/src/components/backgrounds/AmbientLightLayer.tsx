/**
 * AmbientLightLayer v3 — Couche d'effets lumineux DeepSight (mobile RN).
 *
 * Powered by `@deepsight/lighting-engine` v2.0 (48 keyframes, sun/moon beam,
 * daily seeded angle variation). Consumes the v3 preset from
 * `AmbientLightingContext` and animates the beam rotation through Reanimated 4.
 *
 * Renders nothing when ambient lighting is disabled by the user.
 *
 *   - pointerEvents="none" → gestures pass through
 *   - absoluteFill → covers the entire screen, sits above page background
 *   - prefers-reduced-motion respected via preset.isReducedMotion → 0ms duration
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { rgbToCss } from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../../contexts/AmbientLightingContext";

const TRANSITION_MS = 4000;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

export function AmbientLightLayer() {
  const { preset, enabled } = useAmbientLightingContext();

  // Always declare hooks at the top — early return AFTER hooks to keep the
  // hook order stable across renders.
  const angle = useSharedValue(preset.beam.angleDeg);

  useEffect(() => {
    angle.value = withTiming(preset.beam.angleDeg, {
      duration: preset.isReducedMotion ? 0 : TRANSITION_MS,
      easing: EASE,
    });
  }, [preset.beam.angleDeg, preset.isReducedMotion, angle]);

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  if (!enabled) return null;

  const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
  const haloColor = rgbToCss(preset.colors.primary, preset.beam.opacity * 0.5);

  return (
    <View
      testID="ambient-light-layer"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {/* Halo — soft top-left glow */}
      <View
        pointerEvents="none"
        style={styles.halo}
      >
        <LinearGradient
          colors={[haloColor, "transparent"]}
          style={styles.haloFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </View>

      {/* Beam — horizontal gradient, rotated via Reanimated */}
      <Animated.View
        pointerEvents="none"
        style={[styles.beam, beamStyle]}
      >
        <LinearGradient
          colors={["transparent", beamColor, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export default AmbientLightLayer;

const styles = StyleSheet.create({
  halo: {
    position: "absolute",
    top: -150,
    left: -150,
    width: 500,
    height: 500,
    borderRadius: 250,
    overflow: "hidden",
  },
  haloFill: { flex: 1, opacity: 0.6 },
  beam: {
    position: "absolute",
    top: "50%",
    left: "-15%",
    width: "130%",
    height: 1.5,
  },
});
