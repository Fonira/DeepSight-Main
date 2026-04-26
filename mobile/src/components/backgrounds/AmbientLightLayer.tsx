/**
 * AmbientLightLayer — Couche d'effets lumineux DeepSight (mobile RN)
 *
 * 🆕 v3 (avril 2026) : refonte minimaliste suite au feedback "trop blanc, trop fort".
 *
 * Au lieu d'empiler 6 calques (3 ambient gradients + god rays + voile blanc + halo
 * top + étoiles + lune) qui cumulaient leurs opacités jusqu'à blanchir le centre
 * de l'écran, on ne garde que :
 *
 *   1. UN seul rayon vertical fin et centré (10-12% de largeur, opacité douce)
 *      — la signature visuelle de marque
 *   2. Disque lunaire la nuit uniquement (avec halo bleu froid)
 *   3. ~5 étoiles discrètes la nuit uniquement
 *
 * 6 phases pilotent juste la COULEUR et l'OPACITÉ du rayon :
 *   - dawn  (5h–8h)   : rose-or chaud
 *   - morning (8h–12h): or vif
 *   - noon  (12h–17h) : or éclatant
 *   - dusk  (17h–20h) : orange-violet
 *   - evening (20h–23h): indigo doux
 *   - night (23h–5h)  : bleu lune froid + lune visible + étoiles
 *
 * Intensity multiplier global :
 *   - "normal" sur accueil + login : opacité de base (~0.15)
 *   - "minimal" sur pages internes : ÷3 (~0.05) — quasi imperceptible
 *
 * Notes RN :
 *   - mix-blend-mode non disponible → opacités chiffrées avec parcimonie
 *   - prefers-reduced-motion → pas de transitions, mais le rendu reste identique
 *   - pointerEvents="none" partout pour ne pas intercepter les gestures
 */
import React, { useMemo } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTimeOfDay, AmbientPreset } from "../../hooks/useTimeOfDay";

type Intensity = "minimal" | "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  /** Densité de l'effet. Défaut : "normal". */
  intensity?: Intensity;
}

// Multiplicateur global d'intensité par-dessus le preset temporel.
// Volontairement très bas pour éviter l'effet "écran blanc" du précédent design.
const INTENSITY_MUL: Record<
  Intensity,
  { beam: number; star: number; moon: number }
> = {
  minimal: { beam: 0.18, star: 0.25, moon: 0.4 },
  soft: { beam: 0.35, star: 0.4, moon: 0.7 },
  normal: { beam: 0.55, star: 0.6, moon: 1 },
  strong: { beam: 0.85, star: 0.85, moon: 1.15 },
};

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
}

// 5 étoiles seulement, position en % — visible la nuit uniquement
const NIGHT_STARS: Star[] = [
  { x: 12, y: 18, size: 1.2, color: "#ffffff", opacity: 0.55 },
  { x: 78, y: 22, size: 1, color: "#e8eaed", opacity: 0.5 },
  { x: 28, y: 38, size: 1.5, color: "#c4b5fd", opacity: 0.6 },
  { x: 88, y: 62, size: 1, color: "#bae6fd", opacity: 0.45 },
  { x: 35, y: 78, size: 1.2, color: "#ffffff", opacity: 0.5 },
];

function rgba(rgb: string, a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  return `rgba(${rgb},${clamped.toFixed(3)})`;
}

interface MoonProps {
  preset: AmbientPreset;
  moonOpacity: number;
}

/** Disque lunaire avec halo bleu froid simulé via shadow + cercle d'overlay. */
const Moon: React.FC<MoonProps> = ({ preset, moonOpacity }) => {
  const moonStyle: ViewStyle = {
    position: "absolute",
    left: `${preset.moonX}%`,
    top: `${preset.moonY}%`,
    width: 56,
    height: 56,
    borderRadius: 28,
    transform: [{ translateX: -28 }],
    backgroundColor: "#f1f5f9",
    opacity: moonOpacity,
    shadowColor: "#bae6fd",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 16,
  };

  const haloStyle: ViewStyle = {
    position: "absolute",
    left: `${preset.moonX}%`,
    top: `${preset.moonY}%`,
    width: 110,
    height: 110,
    borderRadius: 55,
    transform: [{ translateX: -55 }, { translateY: -27 }],
    backgroundColor: "rgba(99,102,241,0.12)",
    opacity: moonOpacity * 0.7,
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={haloStyle} />
      <View pointerEvents="none" style={moonStyle} />
    </View>
  );
};

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
}) => {
  const { ambientPreset: p } = useTimeOfDay();
  const mul = INTENSITY_MUL[intensity];

  // Opacités finales (preset × intensity multiplier)
  const beamCenterOpacity = p.rayOpacity * mul.beam;
  const beamEdgeOpacity = beamCenterOpacity * 0.4;
  const starMul = p.starOpacityMul * mul.star;

  // Étoiles uniquement la nuit (densité "dense" dans l'ancien preset)
  const showStars = p.starDensity === "dense" && starMul > 0.05;

  const stars = useMemo(
    () =>
      NIGHT_STARS.map((s, i) => {
        const opacity = Math.min(0.7, s.opacity * starMul);
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
          shadowOpacity: 0.6,
          shadowRadius: dim * 1.2,
          elevation: 0,
        };
        return <View key={i} pointerEvents="none" style={starStyle} />;
      }),
    [starMul],
  );

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.container]}
    >
      {/*
        UN SEUL rayon vertical fin et centré.
        - Trait vertical de ~12% de largeur au centre de l'écran
        - Densité douce qui décroît du centre vers les bords (gold/main/gold)
        - Couleur dépend de l'heure (or le jour, bleu lune la nuit)
      */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          "transparent",
          rgba(p.colors.rays, beamEdgeOpacity),
          rgba(p.colors.rays, beamCenterOpacity),
          rgba(p.colors.rays, beamEdgeOpacity),
          "transparent",
        ]}
        locations={[0.44, 0.48, 0.5, 0.52, 0.56]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />

      {/* Étoiles discrètes (la nuit seulement) */}
      {showStars && stars}

      {/* Disque lunaire (visible le soir et la nuit) */}
      {p.moonVisible && p.moonOpacity > 0 && (
        <Moon preset={p} moonOpacity={Math.min(1, p.moonOpacity * mul.moon)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export default AmbientLightLayer;
