/**
 * AmbientLightLayer — Couche d'effets lumineux globaux DeepSight (web)
 *
 * 🆕 v2 (avril 2026) : consomme @deepsight/lighting-engine via useAmbientPreset.
 *   - 48 keyframes interpolés (toutes les 30 min) au lieu de 6 phases discrètes
 *   - Sun/moon beam type avec angle dynamique seedé par jour
 *   - Mood interpolé continu ("Lune haute → Heure du loup")
 *
 * Composant fixe (position: fixed, z-[1]) à monter au plus haut niveau de l'App.
 *
 * Empile 5 calques cosmiques (mix-blend-mode: screen pour passer par-dessus
 * les fonds opaques bg-bg-primary sans masquer le contenu) :
 *   1. Ambient gradient (3 radial-gradients superposés via cssGradient du preset)
 *   2. Central beam (linear-gradient à l'angle calculé : sun/moon/twilight)
 *   3. Étoiles scintillantes (densité interpolée 0..1)
 *   4. Disque lunaire OU solaire (selon preset.moon.visible / preset.sun.visible)
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
 * de page qui ont un bg-bg-primary opaque, sans masquer le contenu.
 */

import React from "react";
import DoodleBackground from "./DoodleBackground";
import { useAmbientPreset } from "../hooks/useAmbientPreset";
import { rgbToCss } from "@deepsight/lighting-engine";

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

// Multiplicateurs d'intensité globaux (par-dessus le preset du moteur).
const INTENSITY_MUL: Record<
  Intensity,
  { ambient: number; beam: number; stars: number; disc: number }
> = {
  soft: { ambient: 0.6, beam: 0.55, stars: 0.6, disc: 0.7 },
  normal: { ambient: 1, beam: 1, stars: 1, disc: 1 },
  strong: { ambient: 1.35, beam: 1.4, stars: 1.3, disc: 1.15 },
};

// Durée de transition CSS entre phases (sauf si reduced-motion).
const TRANSITION_MS = 2000;

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
  doodle,
  doodleOpacity = 0.45,
  fixed = true,
}) => {
  const { preset, prefersReducedMotion } = useAmbientPreset();
  const mul = INTENSITY_MUL[intensity];
  const positionClass = fixed ? "fixed" : "absolute";

  const transitionStyle: React.CSSProperties = prefersReducedMotion
    ? {}
    : {
        transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      };

  // --- Calque 1 : Ambient gradient (3 radial-gradients via le preset) ---
  // Le moteur produit déjà cssGradient prêt à l'emploi, on applique juste
  // l'intensity multiplier en re-construisant.
  const ambientGradient = (() => {
    const p = rgbToCss(
      preset.ambient.primary,
      Math.min(1, preset.ambient.primaryOpacity * mul.ambient),
    );
    const s = rgbToCss(
      preset.ambient.secondary,
      Math.min(1, preset.ambient.secondaryOpacity * mul.ambient),
    );
    const t = rgbToCss(
      preset.ambient.tertiary,
      Math.min(1, preset.ambient.tertiaryOpacity * mul.ambient),
    );
    return [
      `radial-gradient(ellipse 80% 50% at 50% 0%, ${p} 0%, transparent 60%)`,
      `radial-gradient(ellipse 45% 35% at 10% 100%, ${s} 0%, transparent 50%)`,
      `radial-gradient(ellipse 50% 40% at 90% 90%, ${t} 0%, transparent 50%)`,
    ].join(", ");
  })();

  // --- Calque 2 : Central beam (linear-gradient à l'angle calculé) ---
  const beamAngle = preset.centralBeam.angleDeg;
  const beamOpacity = Math.min(
    1,
    preset.centralBeam.opacity * mul.beam,
  );
  const beamRgb = preset.centralBeam.rgb;
  const beamMain = rgbToCss(beamRgb, beamOpacity);
  const beamGold = rgbToCss(beamRgb, beamOpacity * 0.5);
  const haloTop = rgbToCss(beamRgb, preset.rayHalo.topOpacity * mul.beam);

  const beamGradient = `linear-gradient(${beamAngle}deg, transparent 35%, ${beamGold} 48%, ${beamMain} 50%, ${beamGold} 52%, transparent 65%), linear-gradient(75deg, transparent 42%, rgba(245,240,232,0.07) 50%, transparent 58%), linear-gradient(180deg, ${haloTop} 0%, transparent 32%)`;

  // --- Calque 3 : Étoiles ---
  // density: 0..1 (continu) → on construit toujours le set complet de
  // 14 étoiles, mais leur opacité globale suit density × stars.opacity × mul.
  const starOpacityScale = Math.min(
    1,
    preset.stars.density * preset.stars.opacity * mul.stars,
  );
  const sa = (a: number) => Math.max(0, Math.min(0.95, a * starOpacityScale));
  const starColor = "255,255,255";
  const accentColor = `${preset.ambient.primary[0]},${preset.ambient.primary[1]},${preset.ambient.primary[2]}`;

  const starsBackground = `radial-gradient(1.5px 1.5px at 12% 18%, rgba(${starColor},${sa(0.7).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 28% 42%, rgba(${accentColor},${sa(0.75).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 47% 12%, rgba(${starColor},${sa(0.55).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 62% 78%, rgba(196,181,253,${sa(0.65).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 78% 35%, rgba(${starColor},${sa(0.6).toFixed(3)}), transparent 50%), radial-gradient(2px 2px at 88% 62%, rgba(${accentColor},${sa(0.7).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 8% 75%, rgba(196,181,253,${sa(0.55).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 35% 90%, rgba(${starColor},${sa(0.5).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 92% 88%, rgba(${accentColor},${sa(0.6).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 18% 55%, rgba(${starColor},${sa(0.6).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 52% 28%, rgba(232,234,237,${sa(0.7).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 70% 15%, rgba(196,181,253,${sa(0.55).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 5% 38%, rgba(${starColor},${sa(0.65).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 96% 22%, rgba(232,234,237,${sa(0.6).toFixed(3)}), transparent 50%)`;

  // --- Calque 4 : Disque solaire OU lunaire (selon visibilité) ---
  const showMoon = preset.moon.visible && preset.moon.opacity > 0;
  const showSun = preset.sun.visible && preset.sun.opacity > 0;

  const moonOpacity = Math.min(1, preset.moon.opacity * mul.disc);
  const sunOpacity = Math.min(1, preset.sun.opacity * mul.disc);

  return (
    <>
      {/* Calque 1 — Ambient gradient (3 radial-gradients) */}
      <div
        aria-hidden="true"
        data-beam-type={preset.centralBeam.type}
        data-mood={preset.mood}
        className={`${positionClass} inset-0 pointer-events-none z-[1]`}
        style={{
          background: ambientGradient,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Calque 2 — Central beam (linear-gradient à l'angle calculé) */}
      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-[1]`}
        style={{
          background: beamGradient,
          mixBlendMode: "screen",
          filter:
            preset.centralBeam.blurPx > 0
              ? `blur(${preset.centralBeam.blurPx}px)`
              : undefined,
          ...transitionStyle,
        }}
      />

      {/* Calque 3 — Étoiles scintillantes */}
      {starOpacityScale > 0.01 && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-[1]`}
          style={{
            backgroundImage: starsBackground,
            mixBlendMode: "screen",
            ...transitionStyle,
          }}
        />
      )}

      {/* Calque 4a — Disque lunaire (visible le soir et la nuit) */}
      {showMoon && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-[1]`}
          style={{ ...transitionStyle }}
        >
          <div
            style={{
              position: "absolute",
              top: `${preset.moon.yPercent}%`,
              left: `${preset.moon.xPercent}%`,
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              transform: "translate(-50%, 0)",
              background:
                "radial-gradient(circle at 38% 38%, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 80%, transparent 100%)",
              boxShadow:
                "0 0 60px 10px rgba(186,230,253,0.45), 0 0 120px 30px rgba(99,102,241,0.18)",
              opacity: moonOpacity,
              ...transitionStyle,
            }}
          />
        </div>
      )}

      {/* Calque 4b — Disque solaire (visible le jour) */}
      {showSun && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-[1]`}
          style={{ ...transitionStyle }}
        >
          <div
            style={{
              position: "absolute",
              top: `${preset.sun.yPercent}%`,
              left: `${preset.sun.xPercent}%`,
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              transform: "translate(-50%, 0)",
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,243,205,0.85) 0%, rgba(252,211,77,0.55) 40%, rgba(251,146,60,0.25) 70%, transparent 100%)",
              boxShadow:
                "0 0 80px 20px rgba(252,211,77,0.35), 0 0 160px 50px rgba(251,146,60,0.18)",
              opacity: sunOpacity,
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
