/**
 * AmbientLightLayer (mobile) — Version LÉGÈRE
 *
 * Refonte v2.1 (avril 2026) : sur mobile on garde le fond noir + doodles bien
 * visibles. Pas de gradient ambient qui couvre tout l'écran. Juste :
 *   1. Un mince rayon central (sun le jour, moon la nuit) qui traverse
 *   2. Un disque astre (sun ou moon) discret en haut
 *
 * Différences vs version web (qui reste plus saturée) :
 *   - PAS de calques ambient 3-couches qui éclairent tout l'écran
 *   - PAS d'étoiles (les doodles fournissent déjà la texture)
 *   - Beam mince + opacité réduite (max 0.18 vs 0.28 web)
 *   - Moon = blanc pur (#ffffff) au lieu de l'argenté du moteur
 *   - Sun = warm comme web mais beam fin
 *   - intensityMul forcé à 0.5 par défaut (vs 0.7 OLED) → plus discret
 *
 * Le fond reste #0a0a0f avec les doodles visibles dessus. Le beam ajoute juste
 * une présence cosmique discrète sans masquer le contenu.
 *
 * Adapté Reanimated v4 — transitions UI thread.
 */

import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAmbientPreset } from "../hooks/useAmbientPreset";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type Intensity = "soft" | "normal";

interface AmbientLightLayerProps {
  /** "soft" (défaut, ultra-discret) ou "normal" (un peu plus visible). */
  intensity?: Intensity;
}

/** Mobile = beaucoup plus discret que web. */
const INTENSITY_MUL: Record<Intensity, number> = {
  soft: 0.5,
  normal: 0.75,
};

const TRANSITION_MS = 1500;

/** Couleur lune forcée à blanc pur (briefing user). */
const MOON_WHITE: readonly [number, number, number] = [255, 255, 255];

const rgba = (rgb: readonly [number, number, number], alpha: number): string =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "soft",
}) => {
  const { preset: p, prefersReducedMotion } = useAmbientPreset({ intensityMul: 1 });
  const userMul = INTENSITY_MUL[intensity];

  // Couleur du beam : moon-type → blanc pur, sinon couleur du moteur
  const isMoonBeam = p.centralBeam.type === "moon";
  const beamColor = isMoonBeam ? MOON_WHITE : p.centralBeam.rgb;

  // Opacités finales (capées pour rester légères sur mobile)
  const beamOpacityRaw = p.centralBeam.opacity * userMul;
  const beamOpacity = Math.min(0.18, beamOpacityRaw); // hard cap
  const moonOpacity = Math.min(0.45, p.moon.opacity * userMul);
  const sunOpacity = Math.min(0.4, p.sun.opacity * userMul);

  // Reanimated shared values
  const beamSv = useSharedValue(beamOpacity);
  const moonSv = useSharedValue(moonOpacity);
  const sunSv = useSharedValue(sunOpacity);

  useEffect(() => {
    const dur = prefersReducedMotion ? 0 : TRANSITION_MS;
    const easing = Easing.inOut(Easing.cubic);
    beamSv.value = withTiming(beamOpacity, { duration: dur, easing });
    moonSv.value = withTiming(moonOpacity, { duration: dur, easing });
    sunSv.value = withTiming(sunOpacity, { duration: dur, easing });
  }, [beamOpacity, moonOpacity, sunOpacity, prefersReducedMotion, beamSv, moonSv, sunSv]);

  const beamStyle = useAnimatedStyle(() => ({ opacity: beamSv.value }));
  const moonStyle = useAnimatedStyle(() => ({ opacity: moonSv.value }));
  const sunStyle = useAnimatedStyle(() => ({ opacity: sunSv.value }));

  // Largeur du beam : mince — 30% écran max, axé selon l'angle
  const beamRotation = `${p.centralBeam.angleDeg - 90}deg`;

  // Mémoriser les couleurs pour éviter recreate des arrays à chaque render
  const beamGradientColors = useMemo<readonly [string, string, string, string]>(
    () => [
      "transparent",
      rgba(beamColor, 0.45),
      rgba(beamColor, 1),
      "transparent",
    ],
    [beamColor[0], beamColor[1], beamColor[2]],
  );

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Calque 1 — Le mince rayon central qui traverse */}
      <Animated.View style={[styles.beamWrapper, beamStyle]}>
        <View
          style={[
            styles.beamRotator,
            { transform: [{ rotate: beamRotation }] },
          ]}
        >
          <LinearGradient
            colors={beamGradientColors as unknown as readonly [string, string, ...string[]]}
            locations={[0.42, 0.49, 0.5, 0.58]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.beamGradient}
          />
        </View>
      </Animated.View>

      {/* Calque 2 — Disque lunaire blanc (uniquement la nuit) */}
      {p.moon.visible && moonOpacity > 0.02 && (
        <Animated.View
          style={[
            styles.disc,
            moonStyle,
            {
              top: `${p.moon.yPercent}%`,
              left: `${p.moon.xPercent}%`,
            },
          ]}
        >
          <View style={styles.moonDisc} />
        </Animated.View>
      )}

      {/* Calque 3 — Disque solaire warm (uniquement le jour) */}
      {p.sun.visible && sunOpacity > 0.02 && (
        <Animated.View
          style={[
            styles.disc,
            sunStyle,
            {
              top: `${p.sun.yPercent}%`,
              left: `${p.sun.xPercent}%`,
            },
          ]}
        >
          <View
            style={[
              styles.sunDisc,
              {
                backgroundColor: rgba(p.centralBeam.rgb, 0.9),
                shadowColor: rgba(p.centralBeam.rgb, 1),
              },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
};

const BEAM_THICKNESS = SCREEN_H * 0.35;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    overflow: "hidden",
  },
  beamWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  beamRotator: {
    width: SCREEN_W * 1.8,
    height: BEAM_THICKNESS,
  },
  beamGradient: {
    flex: 1,
  },
  disc: {
    position: "absolute",
    width: 56,
    height: 56,
    marginLeft: -28,
  },
  moonDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  sunDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
});

export default AmbientLightLayer;
