/**
 * AmbientLightLayer — Couche d'effets lumineux DeepSight (mobile RN)
 *
 * Port React Native de frontend/src/components/AmbientLightLayer.tsx avec
 * variation dynamique selon l'heure (hook useTimeOfDay).
 *
 * 6 phases (cf. useTimeOfDay) :
 *   - dawn  (5h–8h)   : aurore rose/or, halo top-left
 *   - morning (8h–12h): or vif, halo top-center penché droite
 *   - noon  (12h–17h) : or éclatant + cyan, halo top-center
 *   - dusk  (17h–20h) : golden hour orange/violet, halo top-right
 *   - evening (20h–23h): nocturne indigo/cyan, halo top-center faible
 *   - night (23h–5h)  : clair de lune froid, halo bleu, lune visible, étoiles ×1.4
 *
 * Empile les calques cosmiques :
 *   1. Ambient gradient (couleur primaire au sommet)
 *   2. Ambient secondaire bottom-left (cyan / indigo)
 *   3. Ambient tertiaire bottom-right (violet)
 *   4. God rays diagonaux + voile blanc + halo top
 *   5. Étoiles scintillantes — 9 ou 14 points lumineux selon densité
 *   6. Disque lunaire (visible le soir et la nuit)
 *
 * Notes RN :
 *   - radial-gradient n'existe pas en RN → on simule avec plusieurs
 *     LinearGradient empilés à des angles différents.
 *   - mix-blend-mode: screen non disponible → opacités réglées dans le preset.
 *   - prefers-reduced-motion via AccessibilityInfo : god rays masqués et
 *     transitions figées.
 *   - pointerEvents: 'none' sur tous les calques pour ne jamais
 *     intercepter les gestures.
 *   - StyleSheet.absoluteFill cover le parent (qui doit être flex: 1).
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

// Multiplicateurs d'intensité globaux (par-dessus le preset temporel).
// "minimal" : présence très subtile pour pages internes (lecture/travail).
// "soft"    : version atténuée pour pages denses.
// "normal"  : intensité par défaut (accueil, login).
// "strong"  : présence renforcée pour écrans hero / marketing.
const INTENSITY_MUL: Record<
  Intensity,
  { ambient: number; rays: number; stars: number; moon: number }
> = {
  minimal: { ambient: 0.3, rays: 0.25, stars: 0.35, moon: 0.4 },
  soft: { ambient: 0.6, rays: 0.55, stars: 0.6, moon: 0.7 },
  normal: { ambient: 1, rays: 1, stars: 1, moon: 1 },
  strong: { ambient: 1.35, rays: 1.4, stars: 1.3, moon: 1.15 },
};

interface Star {
  /** Position X en % */
  x: number;
  /** Position Y en % */
  y: number;
  /** Taille du point (rayon en dp) */
  size: number;
  /** Couleur (utilisée seulement si dense=false ou variant standard) */
  color: string;
  /** Opacité de base (multiplée par starOpacityMul) */
  opacity: number;
}

// 9 étoiles de base (toujours visibles)
const BASE_STARS: Star[] = [
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

// 5 étoiles supplémentaires en mode "dense" (nuit, +30% densité)
const DENSE_EXTRA_STARS: Star[] = [
  { x: 18, y: 55, size: 1, color: "#ffffff", opacity: 0.6 },
  { x: 52, y: 28, size: 1.5, color: "#e8eaed", opacity: 0.7 },
  { x: 70, y: 15, size: 1, color: "#c4b5fd", opacity: 0.55 },
  { x: 5, y: 38, size: 1.5, color: "#ffffff", opacity: 0.65 },
  { x: 96, y: 22, size: 1, color: "#e8eaed", opacity: 0.6 },
];

// Helper rgba avec opacité scalée et clampée
function rgba(rgb: string, a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  return `rgba(${rgb},${clamped.toFixed(3)})`;
}

interface MoonProps {
  preset: AmbientPreset;
  moonOpacity: number;
}

/**
 * Disque lunaire avec halo bleu froid simulé via shadow.
 * Utilise plusieurs Views imbriquées pour simuler un glow plus fort.
 */
const Moon: React.FC<MoonProps> = ({ preset, moonOpacity }) => {
  const moonStyle: ViewStyle = {
    position: "absolute",
    left: `${preset.moonX}%`,
    top: `${preset.moonY}%`,
    width: 72,
    height: 72,
    borderRadius: 36,
    transform: [{ translateX: -36 }],
    backgroundColor: "#f1f5f9",
    opacity: moonOpacity,
    // Halo bleu froid via shadow (iOS) / elevation (Android approximation)
    shadowColor: "#bae6fd",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  };

  // Glow extérieur indigo (calque additionnel pour renforcer l'effet sur Android
  // où shadowRadius est limité — un cercle plus grand avec opacité faible)
  const haloStyle: ViewStyle = {
    position: "absolute",
    left: `${preset.moonX}%`,
    top: `${preset.moonY}%`,
    width: 140,
    height: 140,
    borderRadius: 70,
    transform: [{ translateX: -70 }, { translateY: -34 }],
    backgroundColor: "rgba(99,102,241,0.18)",
    opacity: moonOpacity * 0.8,
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
  const { ambientPreset: p, prefersReducedMotion } = useTimeOfDay();
  const mul = INTENSITY_MUL[intensity];

  // Opacités finales (preset × intensity multiplier)
  const aPrimary = p.ambientPrimary * mul.ambient;
  const aCyan = p.ambientCyan * mul.ambient;
  const aViolet = p.ambientViolet * mul.ambient;
  const aRayMain = p.rayOpacity * mul.rays;
  const aRayGold = aRayMain * 0.5;
  const aRayTop = p.rayTopHalo * mul.rays;
  const sm = p.starOpacityMul * mul.stars;

  // Étoiles à afficher (densité variable selon la phase)
  const starsToRender = useMemo<Star[]>(() => {
    return p.starDensity === "dense"
      ? [...BASE_STARS, ...DENSE_EXTRA_STARS]
      : BASE_STARS;
  }, [p.starDensity]);

  const stars = useMemo(
    () =>
      starsToRender.map((s, i) => {
        const opacity = Math.min(0.9, s.opacity * sm);
        const dim = s.size * 2;
        // La nuit, on remplace les étoiles or par du blanc-argenté pour
        // matcher l'accent défini dans le preset (#e8eaed).
        const color =
          p.starDensity === "dense" && s.color === "#d4a054"
            ? "#e8eaed"
            : s.color;
        const starStyle: ViewStyle = {
          position: "absolute",
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: dim,
          height: dim,
          borderRadius: s.size,
          backgroundColor: color,
          opacity,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7,
          shadowRadius: dim,
          elevation: 0,
        };
        return <View key={i} pointerEvents="none" style={starStyle} />;
      }),
    [starsToRender, sm, p.starDensity],
  );

  // Halo top — position dynamique. On simule un radial-gradient en utilisant
  // un LinearGradient vertical descendant centré, mais shifté visuellement par
  // sa colorisation. L'effet n'est pas parfaitement positionné en X mais reste
  // cohérent avec le brief (l'opacité décroît verticalement, pas radialement).
  // Pour matcher la position X du halo, on utilise un gradient diagonal avec
  // start ajusté.
  const haloStartX = p.haloX / 100;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.container]}
    >
      {/* 1 — Ambient principal (couleur primaire, halo top, position dynamique) */}
      <LinearGradient
        pointerEvents="none"
        colors={[rgba(p.colors.primary, aPrimary), "transparent"]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        start={{ x: haloStartX, y: 0 }}
        end={{ x: haloStartX, y: 1 }}
      />

      {/* 2 — Ambient secondaire bottom-left (cyan / indigo selon phase) */}
      <LinearGradient
        pointerEvents="none"
        colors={[rgba(p.colors.secondary, aCyan), "transparent"]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.6, y: 0.4 }}
      />

      {/* 3 — Ambient tertiaire bottom-right (violet) */}
      <LinearGradient
        pointerEvents="none"
        colors={[rgba(p.colors.tertiary, aViolet), "transparent"]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
        start={{ x: 1, y: 1 }}
        end={{ x: 0.4, y: 0.4 }}
      />

      {/* 4 — God rays — masqués si prefers-reduced-motion */}
      {!prefersReducedMotion && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[
              "transparent",
              rgba(p.colors.rays, aRayGold),
              rgba(p.colors.rays, aRayMain),
              rgba(p.colors.rays, aRayGold),
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
            colors={[rgba(p.colors.rays, aRayTop), "transparent"]}
            locations={[0, 0.32]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </>
      )}

      {/* 5 — Étoiles scintillantes (9 ou 14 selon densité) */}
      {stars}

      {/* 6 — Disque lunaire (visible le soir et la nuit) */}
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
