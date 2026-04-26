/**
 * AmbientLightLayer v2.3 — Couche d'effets lumineux DeepSight (mobile RN).
 *
 * VERSION LIGHT (différente de la web) :
 *   - Fond noir #0a0a0f conservé (les doodles restent bien visibles dessus)
 *   - PAS de calques 3-spots ambient qui éclairent tout l'écran
 *   - Cycle complet jour/nuit basé sur useTimeOfDay :
 *       • dawn/morning/noon/dusk → soleil visible + rayon doré
 *       • evening/night          → lune visible + rayon argenté/lunaire
 *   - Étoiles scintillantes (5 base + 4 dense la nuit)
 *   - Beam mince qui traverse (35% hauteur, opacité capée à 0.18 max)
 *   - intensityMul mobile baissé pour rester discret
 *
 * Utilise useTimeOfDay (hook legacy interne) — PAS @deepsight/lighting-engine
 * (ce dernier ne se résout pas correctement dans Metro/EAS).
 */
import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, ViewStyle, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTimeOfDay, type TimePhase } from "../../hooks/useTimeOfDay";

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

// ─── Phase config — soleil/lune/couleur du beam ─────────────────────────────

interface PhaseConfig {
  /** Couleur du beam au format "r,g,b" */
  beamRgb: string;
  /** Opacité du beam (avant cap & intensity mul) */
  beamOpacity: number;
  /** Soleil visible ? */
  sunVisible: boolean;
  /** Position soleil en % */
  sunX: number;
  sunY: number;
  /** Opacité soleil */
  sunOpacity: number;
  /** Lune visible ? */
  moonVisible: boolean;
  moonX: number;
  moonY: number;
  moonOpacity: number;
  /** Multiplicateur opacité étoiles */
  starsMul: number;
}

const PHASE_CONFIG: Record<TimePhase, PhaseConfig> = {
  dawn: {
    beamRgb: "248,180,140",
    beamOpacity: 0.55,
    sunVisible: true,
    sunX: 18,
    sunY: 14,
    sunOpacity: 0.35,
    moonVisible: false,
    moonX: 0,
    moonY: 0,
    moonOpacity: 0,
    starsMul: 0.25,
  },
  morning: {
    beamRgb: "253,224,71",
    beamOpacity: 0.65,
    sunVisible: true,
    sunX: 50,
    sunY: 12,
    sunOpacity: 0.4,
    moonVisible: false,
    moonX: 0,
    moonY: 0,
    moonOpacity: 0,
    starsMul: 0.1,
  },
  noon: {
    beamRgb: "254,240,138",
    beamOpacity: 0.7,
    sunVisible: true,
    sunX: 75,
    sunY: 10,
    sunOpacity: 0.45,
    moonVisible: false,
    moonX: 0,
    moonY: 0,
    moonOpacity: 0,
    starsMul: 0.05,
  },
  dusk: {
    beamRgb: "251,146,60",
    beamOpacity: 0.6,
    sunVisible: true,
    sunX: 88,
    sunY: 18,
    sunOpacity: 0.3,
    moonVisible: false,
    moonX: 0,
    moonY: 0,
    moonOpacity: 0,
    starsMul: 0.4,
  },
  evening: {
    beamRgb: "165,180,252",
    beamOpacity: 0.55,
    sunVisible: false,
    sunX: 0,
    sunY: 0,
    sunOpacity: 0,
    moonVisible: true,
    moonX: 22,
    moonY: 16,
    moonOpacity: 0.55,
    starsMul: 0.7,
  },
  night: {
    beamRgb: "186,230,253",
    beamOpacity: 0.5,
    sunVisible: false,
    sunX: 0,
    sunY: 0,
    sunOpacity: 0,
    moonVisible: true,
    moonX: 18,
    moonY: 12,
    moonOpacity: 0.7,
    starsMul: 1.0,
  },
};

// ─── Étoiles ────────────────────────────────────────────────────────────────

interface StarDef {
  x: number;
  y: number;
  size: number;
  color: string;
  baseOpacity: number;
}

const BASE_STARS: StarDef[] = [
  { x: 12, y: 18, size: 3, color: "#ffffff", baseOpacity: 0.7 },
  { x: 28, y: 42, size: 3, color: "#e8eaed", baseOpacity: 0.65 },
  { x: 47, y: 12, size: 2, color: "#ffffff", baseOpacity: 0.55 },
  { x: 62, y: 78, size: 3, color: "#c4b5fd", baseOpacity: 0.6 },
  { x: 78, y: 35, size: 2, color: "#ffffff", baseOpacity: 0.55 },
];

const DENSE_EXTRA_STARS: StarDef[] = [
  { x: 88, y: 62, size: 4, color: "#bae6fd", baseOpacity: 0.6 },
  { x: 8, y: 75, size: 2, color: "#c4b5fd", baseOpacity: 0.5 },
  { x: 35, y: 90, size: 3, color: "#ffffff", baseOpacity: 0.5 },
  { x: 92, y: 22, size: 2, color: "#e8eaed", baseOpacity: 0.55 },
];

// ─── Component ──────────────────────────────────────────────────────────────

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "soft",
}) => {
  const intensityMul = INTENSITY_MUL[intensity];
  const { phase, prefersReducedMotion } = useTimeOfDay();
  const cfg = PHASE_CONFIG[phase];

  const beamOpacityRaw = Math.min(
    BEAM_OPACITY_CAP,
    cfg.beamOpacity * intensityMul,
  );
  const sunOpacityRaw = Math.min(0.5, cfg.sunOpacity * intensityMul);
  const moonOpacityRaw = Math.min(0.8, cfg.moonOpacity * intensityMul);
  const starsMul = Math.min(1, cfg.starsMul * intensityMul);

  const beamOpacity = useSharedValue(beamOpacityRaw);
  const sunOpacity = useSharedValue(sunOpacityRaw);
  const moonOpacity = useSharedValue(moonOpacityRaw);
  const starsOpacity = useSharedValue(starsMul);
  const sunX = useSharedValue(cfg.sunX);
  const sunY = useSharedValue(cfg.sunY);
  const moonX = useSharedValue(cfg.moonX);
  const moonY = useSharedValue(cfg.moonY);

  useEffect(() => {
    const ms = prefersReducedMotion ? 0 : TRANSITION_MS;
    const tcfg = { duration: ms, easing: Easing.bezier(0.4, 0, 0.2, 1) };
    beamOpacity.value = withTiming(beamOpacityRaw, tcfg);
    sunOpacity.value = withTiming(sunOpacityRaw, tcfg);
    moonOpacity.value = withTiming(moonOpacityRaw, tcfg);
    starsOpacity.value = withTiming(starsMul, tcfg);
    sunX.value = withTiming(cfg.sunX, tcfg);
    sunY.value = withTiming(cfg.sunY, tcfg);
    moonX.value = withTiming(cfg.moonX, tcfg);
    moonY.value = withTiming(cfg.moonY, tcfg);
  }, [
    beamOpacityRaw,
    sunOpacityRaw,
    moonOpacityRaw,
    starsMul,
    cfg.sunX,
    cfg.sunY,
    cfg.moonX,
    cfg.moonY,
    prefersReducedMotion,
    beamOpacity,
    sunOpacity,
    moonOpacity,
    starsOpacity,
    sunX,
    sunY,
    moonX,
    moonY,
  ]);

  const beamRgb = `rgb(${cfg.beamRgb})`;
  const beamRgbHalf = `rgba(${cfg.beamRgb},0.5)`;

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

  const animatedStarsStyle = useAnimatedStyle(() => ({
    opacity: starsOpacity.value,
  }));

  const starsToRender = useMemo(() => {
    return phase === "evening" || phase === "night" || phase === "dusk"
      ? [...BASE_STARS, ...DENSE_EXTRA_STARS]
      : BASE_STARS;
  }, [phase]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
    >
      {/* Étoiles — visibles selon la phase */}
      {starsMul > 0.05 && (
        <Animated.View
          style={[StyleSheet.absoluteFill, animatedStarsStyle]}
          pointerEvents="none"
        >
          {starsToRender.map((s, i) => {
            const dim = s.size;
            const starStyle: ViewStyle = {
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              backgroundColor: s.color,
              opacity: s.baseOpacity,
              shadowColor: s.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: dim * 1.5,
              elevation: 0,
            };
            return <View key={i} pointerEvents="none" style={starStyle} />;
          })}
        </Animated.View>
      )}

      {/* Beam — rayon de soleil le jour, rayon de lune la nuit */}
      {cfg.beamOpacity > 0.02 && (
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
              beamRgbHalf,
              beamRgb,
              beamRgbHalf,
              "transparent",
            ]}
            start={{ x: 0.55, y: 0 }}
            end={{ x: 0.45, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {/* Soleil — visible le jour */}
      {cfg.sunVisible && sunOpacityRaw > 0.05 && (
        <Animated.View
          style={[styles.disc, styles.sunDisc, animatedSunStyle]}
          pointerEvents="none"
        >
          <View style={styles.sunGlow} pointerEvents="none" />
        </Animated.View>
      )}

      {/* Lune — visible la nuit */}
      {cfg.moonVisible && moonOpacityRaw > 0.05 && (
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
