/**
 * AmbientLightLayer — Couche d'effets lumineux DeepSight (mobile RN)
 *
 * Port React Native de frontend/src/components/AmbientLightLayer.tsx.
 * Empile 3 calques cosmiques :
 *   1. Ambient gradient (or top, cyan bottom-left, violet bottom-right)
 *   2. God rays (gold diagonal, white veil, top halo)
 *   3. Étoiles scintillantes — 9 points lumineux blanc / or / lavande
 *
 * Notes RN :
 *   - radial-gradient n'existe pas en RN → on simule avec plusieurs
 *     LinearGradient empilés à des angles différents.
 *   - mix-blend-mode: screen non disponible → fallback opacity simple.
 *   - prefers-reduced-motion via AccessibilityInfo : god rays masqués.
 *   - pointerEvents: 'none' sur tous les calques pour ne jamais
 *     intercepter les gestures.
 *   - StyleSheet.absoluteFill cover le parent (qui doit être flex: 1).
 */
import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, AccessibilityInfo, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  intensity?: Intensity;
}

interface Preset {
  ambientGold: number;
  ambientCyan: number;
  ambientViolet: number;
  rayGold: number;
  rayMain: number;
  rayTopHalo: number;
  starOpacityMul: number;
}

const PRESETS: Record<Intensity, Preset> = {
  soft: {
    ambientGold: 0.1,
    ambientCyan: 0.06,
    ambientViolet: 0.07,
    rayGold: 0.06,
    rayMain: 0.12,
    rayTopHalo: 0.08,
    starOpacityMul: 0.6,
  },
  normal: {
    ambientGold: 0.18,
    ambientCyan: 0.1,
    ambientViolet: 0.12,
    rayGold: 0.1,
    rayMain: 0.2,
    rayTopHalo: 0.14,
    starOpacityMul: 1,
  },
  strong: {
    ambientGold: 0.25,
    ambientCyan: 0.14,
    ambientViolet: 0.16,
    rayGold: 0.14,
    rayMain: 0.28,
    rayTopHalo: 0.2,
    starOpacityMul: 1.3,
  },
};

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
}

const STARS: Star[] = [
  { x: 12, y: 18, size: 1.5, color: "#ffffff", opacity: 0.7 },
  { x: 28, y: 42, size: 1.5, color: "#d4a054", opacity: 0.75 },
  { x: 47, y: 12, size: 1, color: "#ffffff", opacity: 0.55 },
  { x: 62, y: 78, size: 1.5, color: "#c4b5fd", opacity: 0.65 },
  { x: 78, y: 35, size: 1, color: "#ffffff", opacity: 0.6 },
  { x: 88, y: 62, size: 2, color: "#d4a054", opacity: 0.7 },
  { x: 8, y: 75, size: 1, color: "#c4b5fd", opacity: 0.55 },
  { x: 35, y: 90, size: 1.5, color: "#ffffff", opacity: 0.5 },
  { x: 92, y: 88, size: 1.5, color: "#d4a054", opacity: 0.6 },
];

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
}) => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduceMotion(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v: boolean) => {
        if (mounted) setReduceMotion(v);
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const preset = PRESETS[intensity];
  const sm = preset.starOpacityMul;

  const stars = useMemo(
    () =>
      STARS.map((s, i) => {
        const opacity = Math.min(0.9, s.opacity * sm);
        const dim = s.size * 2;
        const starStyle: ViewStyle = {
          position: "absolute",
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: dim,
          height: dim,
          borderRadius: s.size,
          backgroundColor: s.color,
          opacity,
          shadowColor: s.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: dim,
          elevation: 0,
        };
        return <View key={i} pointerEvents="none" style={starStyle} />;
      }),
    [sm],
  );

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.container]}
    >
      {/* 1 — Ambient gold top */}
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(200,144,58,${preset.ambientGold})`, "transparent"]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* 2 — Ambient cyan bottom-left */}
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(6,182,212,${preset.ambientCyan})`, "transparent"]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.6, y: 0.4 }}
      />

      {/* 3 — Ambient violet bottom-right */}
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(139,92,246,${preset.ambientViolet})`, "transparent"]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
        start={{ x: 1, y: 1 }}
        end={{ x: 0.4, y: 0.4 }}
      />

      {/* God rays — masqués si prefers-reduced-motion */}
      {!reduceMotion && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[
              "transparent",
              `rgba(212,160,84,${preset.rayGold})`,
              `rgba(212,160,84,${preset.rayMain})`,
              `rgba(212,160,84,${preset.rayGold})`,
              "transparent",
            ]}
            locations={[0.35, 0.48, 0.5, 0.52, 0.65]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
          />

          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(245,240,232,0.07)", "transparent"]}
            locations={[0.42, 0.5, 0.58]}
            style={StyleSheet.absoluteFill}
            start={{ x: 1, y: 1 }}
            end={{ x: 0, y: 0 }}
          />

          <LinearGradient
            pointerEvents="none"
            colors={[`rgba(200,144,58,${preset.rayTopHalo})`, "transparent"]}
            locations={[0, 0.32]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </>
      )}

      {stars}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export default AmbientLightLayer;
