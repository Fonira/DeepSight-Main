/**
 * AmbientLightLayer v2.1 — Couche d'effets lumineux DeepSight (mobile RN).
 *
 * VERSION LIGHT (différente de la web) :
 *   - Fond noir #0a0a0f conservé (les doodles restent bien visibles dessus)
 *   - Pas de calques 3-spots ambient qui éclairent tout l'écran
 *   - Pas d'étoiles (les doodles font la texture)
 *   - Beam mince qui traverse (35% hauteur, opacité capée à 0.18 max)
 *   - Lune = blanc PUR (#ffffff) la nuit (et non l'argenté froid de l'engine)
 *   - Soleil = warm discret le jour (60×60px disc avec glow soft)
 *   - intensityMul mobile baissé à 0.5 par défaut
 */
import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useAmbientPreset } from "../../hooks/useAmbientPreset";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  intensity?: Intensity;
}

const INTENSITY_MUL: Record<Intensity, number> = {
  soft: 0.5,
  normal: 0.75,
  strong: 1.0,
};

const BEAM_OPACITY_CAP = 0.18;
const BEAM_HEIGHT_PCT = 0.35;
const TRANSITION_MS = 1500;

const { height: SCREEN_H } = Dimensions.get("window");

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "soft",
}) => {
  const intensityMul = INTENSITY_MUL[intensity];
  const { preset, reduceMotion } = useAmbientPreset({ intensityMul });

  const beamOpacityRaw = Math.min(BEAM_OPACITY_CAP, preset.beam.opacity);
  const sunOpacityRaw = Math.min(0.4, preset.sun.opacity);
  const moonOpacityRaw = Math.min(0.7, preset.moon.opacity);

  const beamOpacity = useSharedValue(beamOpacityRaw);
  const sunOpacity = useSharedValue(sunOpacityRaw);
  const moonOpacity = useSharedValue(moonOpacityRaw);
  const sunX = useSharedValue(preset.sun.x);
  const sunY = useSharedValue(preset.sun.y);
  const moonX = useSharedValue(preset.moon.x);
  const moonY = useSharedValue(preset.moon.y);

  useEffect(() => {
    const ms = reduceMotion ? 0 : TRANSITION_MS;
    const cfg = { duration: ms, easing: Easing.bezier(0.4, 0, 0.2, 1) };
    beamOpacity.value = withTiming(beamOpacityRaw, cfg);
    sunOpacity.value = withTiming(sunOpacityRaw, cfg);
    moonOpacity.value = withTiming(moonOpacityRaw, cfg);
    sunX.value = withTiming(preset.sun.x, cfg);
    sunY.value = withTiming(preset.sun.y, cfg);
    moonX.value = withTiming(preset.moon.x, cfg);
    moonY.value = withTiming(preset.moon.y, cfg);
  }, [
    beamOpacityRaw,
    sunOpacityRaw,
    moonOpacityRaw,
    preset.sun.x,
    preset.sun.y,
    preset.moon.x,
    preset.moon.y,
    reduceMotion,
    beamOpacity,
    sunOpacity,
    moonOpacity,
    sunX,
    sunY,
    moonX,
    moonY,
  ]);

  const beamDirection = computeBeamDirection(preset.beam.angleDeg);
  const beamColor = preset.beam.color;
  const beamRgb = `rgb(${beamColor[0]}, ${beamColor[1]}, ${beamColor[2]})`;

  const animatedBeamStyle = useAnimatedStyle(() => ({
    opacity: beamOpacity.value,
  }));

  const animatedSunStyle = useAnimatedStyle(() => ({
    opacity: sunOpacity.value,
    top: `${sunY.value}%`,
    left: `${sunX.value}%`,
  }));

  const animatedMoonStyle = useAnimatedStyle(() => ({
    opacity: moonOpacity.value,
    top: `${moonY.value}%`,
    left: `${moonX.value}%`,
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
    >
      {preset.beam.opacity > 0.02 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { height: SCREEN_H * BEAM_HEIGHT_PCT, top: SCREEN_H * 0.32 },
            animatedBeamStyle,
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              "transparent",
              `${beamRgb}80`,
              beamRgb,
              `${beamRgb}80`,
              "transparent",
            ]}
            start={beamDirection.start}
            end={beamDirection.end}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {preset.sun.visible && sunOpacityRaw > 0.05 && (
        <Animated.View
          style={[styles.disc, styles.sunDisc, animatedSunStyle]}
          pointerEvents="none"
        >
          <View style={styles.sunGlow} pointerEvents="none" />
        </Animated.View>
      )}

      {preset.moon.visible && moonOpacityRaw > 0.05 && (
        <Animated.View
          style={[styles.disc, styles.moonDisc, animatedMoonStyle]}
          pointerEvents="none"
        >
          <View style={styles.moonGlow} pointerEvents="none" />
        </Animated.View>
      )}
    </View>
  );
};

function computeBeamDirection(angleDeg: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a >= 60 && a < 120) {
    return { start: { x: 0.7, y: 0 }, end: { x: 0.3, y: 1 } };
  }
  if (a >= 120 && a < 180) {
    return { start: { x: 0.3, y: 0 }, end: { x: 0.7, y: 1 } };
  }
  if (a >= 90 && a < 150) {
    return { start: { x: 0.6, y: 0 }, end: { x: 0.4, y: 1 } };
  }
  return { start: { x: 0.55, y: 0 }, end: { x: 0.45, y: 1 } };
}

const styles = StyleSheet.create({
  disc: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    transform: [{ translateX: -30 }, { translateY: 0 }],
  } as ViewStyle,
  sunDisc: {
    backgroundColor: "#fde68a",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 8,
  } as ViewStyle,
  sunGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    top: -10,
    left: -10,
    backgroundColor: "#fef3c7",
    opacity: 0.25,
  } as ViewStyle,
  moonDisc: {
    backgroundColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 8,
  } as ViewStyle,
  moonGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    top: -10,
    left: -10,
    backgroundColor: "#ffffff",
    opacity: 0.18,
  } as ViewStyle,
});

export default AmbientLightLayer;
