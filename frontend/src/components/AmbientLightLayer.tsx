/**
 * AmbientLightLayer — Couche d'effets lumineux globaux DeepSight
 *
 * Composant fixe (position: fixed, z-[1]) à monter au plus haut niveau de l'App.
 *
 * 🆕 Variation dynamique selon l'heure (hook useTimeOfDay) :
 *   - dawn  (5h–8h)   : aurore rose/or, halo top-left
 *   - morning (8h–12h): or vif, halo top-center penché droite
 *   - noon  (12h–17h) : or éclatant + cyan, halo top-center
 *   - dusk  (17h–20h) : golden hour orange/violet, halo top-right
 *   - evening (20h–23h): nocturne indigo/cyan, halo top-center faible
 *   - night (23h–5h)  : clair de lune froid, halo bleu, lune visible, étoiles ×1.4
 *
 * Empile 5 calques cosmiques (z-[1] avec mix-blend-mode: screen pour passer
 * par-dessus les fonds opaques bg-bg-primary sans masquer le contenu) :
 *   1. Ambient gradient (couleur primaire au sommet, secondaire bottom-left, tertiaire bottom-right)
 *   2. God rays — rayons de lumière diagonaux + voile blanc + halo top
 *   3. Étoiles scintillantes — 9 ou 14 points lumineux selon densité
 *   4. Disque lunaire (uniquement la nuit + crépuscule tardif + soir)
 *   5. (optionnel) DoodleBackground — la signature visuelle existante
 *
 * Usage minimal :
 *   <AmbientLightLayer />                    // calques 1-4 dynamiques
 *   <AmbientLightLayer doodle="video" />     // + DoodleBackground variant="video"
 *   <AmbientLightLayer intensity="soft" />   // version atténuée pour pages denses
 *
 * À injecter une fois dans App.tsx au-dessus du Router. Tous les enfants en
 * profitent automatiquement. La couche est `pointer-events: none` donc elle
 * n'intercepte aucun clic.
 *
 * ⚠️ Visibilité partout : le layer est posé en z-[1] avec mix-blend-mode: screen
 * sur les calques de couleur, ce qui le rend visible PAR-DESSUS les conteneurs
 * de page qui ont un bg-bg-primary opaque, sans masquer le contenu (le mode
 * screen n'éclaircit que ce qui est plus sombre que la couleur appliquée, donc
 * sur le fond noir #0a0a0f la couleur passe, sur le contenu clair ça ne change
 * presque rien). La lune est en z-[1] sans blend-mode pour rester visible blanche.
 */

import React from "react";
import DoodleBackground from "./DoodleBackground";
import { useTimeOfDay } from "../hooks/useTimeOfDay";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  /** Densité de l'effet. Défaut : "normal". */
  intensity?: Intensity;
  /**
   * Variante du DoodleBackground à superposer. Si non fourni, aucun doodle
   * n'est ajouté (juste les rayons + étoiles + ambient + lune éventuelle).
   */
  doodle?: "default" | "video" | "academic" | "analysis" | "tech" | "creative";
  /** Opacité du DoodleBackground si activé. Défaut : 0.45. */
  doodleOpacity?: number;
  /** Si true, applique position fixed (cover viewport). Sinon position absolute. */
  fixed?: boolean;
}

// Multiplicateurs d'intensité globaux (par-dessus le preset temporel).
const INTENSITY_MUL: Record<
  Intensity,
  { ambient: number; rays: number; stars: number; moon: number }
> = {
  soft: { ambient: 0.6, rays: 0.55, stars: 0.6, moon: 0.7 },
  normal: { ambient: 1, rays: 1, stars: 1, moon: 1 },
  strong: { ambient: 1.35, rays: 1.4, stars: 1.3, moon: 1.15 },
};

// Durée de transition CSS entre phases (sauf si reduced-motion).
const TRANSITION_MS = 2000;

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
  doodle,
  doodleOpacity = 0.45,
  fixed = true,
}) => {
  const { ambientPreset: p, prefersReducedMotion, phase } = useTimeOfDay();
  const mul = INTENSITY_MUL[intensity];
  const positionClass = fixed ? "fixed" : "absolute";

  const transitionStyle: React.CSSProperties = prefersReducedMotion
    ? {}
    : {
        transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      };

  // Helpers d'écriture rgba avec opacité scalée
  const rgba = (rgb: string, a: number): string =>
    `rgba(${rgb},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

  const aPrimary = p.ambientPrimary * mul.ambient;
  const aCyan = p.ambientCyan * mul.ambient;
  const aViolet = p.ambientViolet * mul.ambient;
  const aRayMain = p.rayOpacity * mul.rays;
  const aRayGold = aRayMain * 0.5;
  const aRayTop = p.rayTopHalo * mul.rays;
  const sm = p.starOpacityMul * mul.stars;
  const sa = (a: number) => Math.min(0.95, a * sm);

  // Étoiles : densité variable. 9 par défaut, +5 supplémentaires en mode "dense" (nuit).
  const baseStars = `radial-gradient(1.5px 1.5px at 12% 18%, ${rgba("255,255,255", sa(0.7))}, transparent 50%), radial-gradient(1.5px 1.5px at 28% 42%, ${rgba(p.colors.accent, sa(0.75))}, transparent 50%), radial-gradient(1px 1px at 47% 12%, ${rgba("255,255,255", sa(0.55))}, transparent 50%), radial-gradient(1.5px 1.5px at 62% 78%, ${rgba("196,181,253", sa(0.65))}, transparent 50%), radial-gradient(1px 1px at 78% 35%, ${rgba("255,255,255", sa(0.6))}, transparent 50%), radial-gradient(2px 2px at 88% 62%, ${rgba(p.colors.accent, sa(0.7))}, transparent 50%), radial-gradient(1px 1px at 8% 75%, ${rgba("196,181,253", sa(0.55))}, transparent 50%), radial-gradient(1.5px 1.5px at 35% 90%, ${rgba("255,255,255", sa(0.5))}, transparent 50%), radial-gradient(1.5px 1.5px at 92% 88%, ${rgba(p.colors.accent, sa(0.6))}, transparent 50%)`;

  const denseStars =
    p.starDensity === "dense"
      ? `, radial-gradient(1px 1px at 18% 55%, ${rgba("255,255,255", sa(0.6))}, transparent 50%), radial-gradient(1.5px 1.5px at 52% 28%, ${rgba("232,234,237", sa(0.7))}, transparent 50%), radial-gradient(1px 1px at 70% 15%, ${rgba("196,181,253", sa(0.55))}, transparent 50%), radial-gradient(1.5px 1.5px at 5% 38%, ${rgba("255,255,255", sa(0.65))}, transparent 50%), radial-gradient(1px 1px at 96% 22%, ${rgba("232,234,237", sa(0.6))}, transparent 50%)`
      : "";

  // Position du halo principal calculée dynamiquement
  const haloPos = `${p.haloX}% ${p.haloY}%`;

  return (
    <>
      {/* Calque 1 — Ambient gradient (couleur primaire au sommet, secondaire bottom-left, tertiaire bottom-right) */}
      <div
        aria-hidden="true"
        data-time-phase={phase}
        className={`${positionClass} inset-0 pointer-events-none z-[1]`}
        style={{
          background: `radial-gradient(ellipse 80% 50% at ${haloPos}, ${rgba(p.colors.primary, aPrimary)} 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 10% 100%, ${rgba(p.colors.secondary, aCyan)} 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 90% 90%, ${rgba(p.colors.tertiary, aViolet)} 0%, transparent 50%)`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Calque 2 — God rays (rayons lumineux diagonaux + halo top) */}
      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-[1]`}
        style={{
          background: `linear-gradient(105deg, transparent 35%, ${rgba(p.colors.rays, aRayGold)} 48%, ${rgba(p.colors.rays, aRayMain)} 50%, ${rgba(p.colors.rays, aRayGold)} 52%, transparent 65%), linear-gradient(75deg, transparent 42%, rgba(245,240,232,0.07) 50%, transparent 58%), linear-gradient(180deg, ${rgba(p.colors.rays, aRayTop)} 0%, transparent 32%)`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Calque 3 — Étoiles scintillantes (9 ou 14 points lumineux fixes) */}
      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none z-[1]`}
        style={{
          backgroundImage: `${baseStars}${denseStars}`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Calque 4 — Disque lunaire (visible le soir et la nuit) */}
      {p.moonVisible && p.moonOpacity > 0 && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-[1]`}
          style={{ ...transitionStyle }}
        >
          <div
            style={{
              position: "absolute",
              top: `${p.moonY}%`,
              left: `${p.moonX}%`,
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              transform: "translate(-50%, 0)",
              background:
                "radial-gradient(circle at 38% 38%, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 80%, transparent 100%)",
              boxShadow:
                "0 0 60px 10px rgba(186,230,253,0.45), 0 0 120px 30px rgba(99,102,241,0.18)",
              opacity: Math.min(1, p.moonOpacity * mul.moon),
              ...transitionStyle,
            }}
          />
        </div>
      )}

      {/* Calque 5 — DoodleBackground (signature DeepSight, optionnel) */}
      {doodle && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-[1]`}
        >
          <DoodleBackground
            variant={doodle}
            className={`!opacity-[${doodleOpacity}]`}
          />
        </div>
      )}
    </>
  );
};

export default AmbientLightLayer;
