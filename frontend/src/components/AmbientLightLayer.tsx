/**
 * AmbientLightLayer — Couche d'effets lumineux globaux DeepSight
 *
 * Composant fixe (position: fixed, z-0) à monter au plus haut niveau de l'App.
 * Empile 4 calques cosmiques :
 *   1. Ambient gradient (or au sommet, cyan bottom-left, violet bottom-right)
 *   2. God rays — rayons de lumière diagonaux gold + voile blanc + halo top
 *   3. Étoiles scintillantes — 9 points lumineux blanc / or / lavande
 *   4. (optionnel) DoodleBackground — la signature visuelle existante
 *
 * Usage minimal :
 *   <AmbientLightLayer />                    // calques 1-3 seulement
 *   <AmbientLightLayer doodle="video" />     // + DoodleBackground variant="video"
 *   <AmbientLightLayer intensity="soft" />   // version atténuée pour pages denses
 *
 * À injecter une fois dans App.tsx au-dessus du Router. Tous les enfants en
 * profitent automatiquement. La couche est `pointer-events: none` donc elle
 * n'intercepte aucun clic.
 */

import React from "react";
import DoodleBackground from "./DoodleBackground";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  /** Densité de l'effet. Défaut : "normal". */
  intensity?: Intensity;
  /**
   * Variante du DoodleBackground à superposer. Si non fourni, aucun doodle
   * n'est ajouté (juste les rayons + étoiles + ambient).
   */
  doodle?: "default" | "video" | "academic" | "analysis" | "tech" | "creative";
  /** Opacité du DoodleBackground si activé. Défaut : 0.45. */
  doodleOpacity?: number;
  /** Si true, applique position fixed (cover viewport). Sinon position absolute (cover parent). */
  fixed?: boolean;
}

const INTENSITY_PRESET: Record<
  Intensity,
  {
    ambientGold: number;
    ambientCyan: number;
    ambientViolet: number;
    rayGold: number;
    rayMain: number;
    rayTopHalo: number;
    starOpacityMul: number;
  }
> = {
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

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
  doodle,
  doodleOpacity = 0.45,
  fixed = true,
}) => {
  const p = INTENSITY_PRESET[intensity];
  const positionClass = fixed ? "fixed" : "absolute";
  const sm = p.starOpacityMul;
  const sa = (a: number) => Math.min(0.9, a * sm).toFixed(2);

  return (
    <>
      {/* Calque 1 — Ambient gradient (or top, cyan bottom-left, violet bottom-right) */}
      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none z-0`}
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(200,144,58,${p.ambientGold}) 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 10% 100%, rgba(6,182,212,${p.ambientCyan}) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 90% 90%, rgba(139,92,246,${p.ambientViolet}) 0%, transparent 50%)`,
        }}
      />

      {/* Calque 2 — God rays (rayons lumineux diagonaux + halo top) */}
      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-0`}
        style={{
          background: `linear-gradient(105deg, transparent 35%, rgba(212,160,84,${p.rayGold}) 48%, rgba(212,160,84,${p.rayMain}) 50%, rgba(212,160,84,${p.rayGold}) 52%, transparent 65%), linear-gradient(75deg, transparent 42%, rgba(245,240,232,0.07) 50%, transparent 58%), linear-gradient(180deg, rgba(200,144,58,${p.rayTopHalo}) 0%, transparent 32%)`,
          mixBlendMode: "screen",
        }}
      />

      {/* Calque 3 — Étoiles scintillantes (9 points lumineux fixes) */}
      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none z-0`}
        style={{
          backgroundImage: `radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,${sa(0.7)}), transparent 50%), radial-gradient(1.5px 1.5px at 28% 42%, rgba(212,160,84,${sa(0.75)}), transparent 50%), radial-gradient(1px 1px at 47% 12%, rgba(255,255,255,${sa(0.55)}), transparent 50%), radial-gradient(1.5px 1.5px at 62% 78%, rgba(196,181,253,${sa(0.65)}), transparent 50%), radial-gradient(1px 1px at 78% 35%, rgba(255,255,255,${sa(0.6)}), transparent 50%), radial-gradient(2px 2px at 88% 62%, rgba(212,160,84,${sa(0.7)}), transparent 50%), radial-gradient(1px 1px at 8% 75%, rgba(196,181,253,${sa(0.55)}), transparent 50%), radial-gradient(1.5px 1.5px at 35% 90%, rgba(255,255,255,${sa(0.5)}), transparent 50%), radial-gradient(1.5px 1.5px at 92% 88%, rgba(212,160,84,${sa(0.6)}), transparent 50%)`,
        }}
      />

      {/* Calque 4 — DoodleBackground (signature DeepSight, optionnel) */}
      {doodle && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-0`}
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
