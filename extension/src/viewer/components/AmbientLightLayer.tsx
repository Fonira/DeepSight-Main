/**
 * AmbientLightLayer — Couche d'effets lumineux DeepSight (extension viewer)
 *
 * Port du composant frontend (frontend/src/components/AmbientLightLayer.tsx)
 * adapté à l'extension : inline styles purs, pas de dépendance Tailwind.
 *
 * Rend les rayons de lumière + halos + étoiles (pixels) + lune au-dessus
 * du fond opaque du viewer. Comme le web, utilise mix-blend-mode: screen
 * pour passer par-dessus les conteneurs sombres sans masquer le contenu.
 *
 * Toujours position: fixed, pointer-events: none, z-index: 1.
 */
import React from "react";
import { useTimeOfDay } from "../../hooks/useTimeOfDay";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  intensity?: Intensity;
}

const INTENSITY_MUL: Record<
  Intensity,
  { ambient: number; rays: number; stars: number; moon: number }
> = {
  soft: { ambient: 0.6, rays: 0.55, stars: 0.6, moon: 0.7 },
  normal: { ambient: 1, rays: 1, stars: 1, moon: 1 },
  strong: { ambient: 1.35, rays: 1.4, stars: 1.3, moon: 1.15 },
};

const TRANSITION_MS = 2000;

function rgba(rgb: string, a: number): string {
  return `rgba(${rgb},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

const fixedFill: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  pointerEvents: "none",
  zIndex: 1,
};

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
}) => {
  const { ambientPreset: p, prefersReducedMotion, phase } = useTimeOfDay();
  const mul = INTENSITY_MUL[intensity];

  const transitionStyle: React.CSSProperties = prefersReducedMotion
    ? {}
    : {
        transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1), transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
      };

  const aPrimary = p.ambientPrimary * mul.ambient;
  const aCyan = p.ambientCyan * mul.ambient;
  const aViolet = p.ambientViolet * mul.ambient;
  const aRayMain = p.rayOpacity * mul.rays;
  const aRayGold = aRayMain * 0.5;
  const aRayTop = p.rayTopHalo * mul.rays;
  const sm = p.starOpacityMul * mul.stars;
  const sa = (a: number) => Math.min(0.95, a * sm);

  const baseStars = `radial-gradient(1.5px 1.5px at 12% 18%, ${rgba(
    "255,255,255",
    sa(0.7),
  )}, transparent 50%), radial-gradient(1.5px 1.5px at 28% 42%, ${rgba(
    p.colors.accent,
    sa(0.75),
  )}, transparent 50%), radial-gradient(1px 1px at 47% 12%, ${rgba(
    "255,255,255",
    sa(0.55),
  )}, transparent 50%), radial-gradient(1.5px 1.5px at 62% 78%, ${rgba(
    "196,181,253",
    sa(0.65),
  )}, transparent 50%), radial-gradient(1px 1px at 78% 35%, ${rgba(
    "255,255,255",
    sa(0.6),
  )}, transparent 50%), radial-gradient(2px 2px at 88% 62%, ${rgba(
    p.colors.accent,
    sa(0.7),
  )}, transparent 50%), radial-gradient(1px 1px at 8% 75%, ${rgba(
    "196,181,253",
    sa(0.55),
  )}, transparent 50%), radial-gradient(1.5px 1.5px at 35% 90%, ${rgba(
    "255,255,255",
    sa(0.5),
  )}, transparent 50%), radial-gradient(1.5px 1.5px at 92% 88%, ${rgba(
    p.colors.accent,
    sa(0.6),
  )}, transparent 50%)`;

  const denseStars =
    p.starDensity === "dense"
      ? `, radial-gradient(1px 1px at 18% 55%, ${rgba(
          "255,255,255",
          sa(0.6),
        )}, transparent 50%), radial-gradient(1.5px 1.5px at 52% 28%, ${rgba(
          "232,234,237",
          sa(0.7),
        )}, transparent 50%), radial-gradient(1px 1px at 70% 15%, ${rgba(
          "196,181,253",
          sa(0.55),
        )}, transparent 50%), radial-gradient(1.5px 1.5px at 5% 38%, ${rgba(
          "255,255,255",
          sa(0.65),
        )}, transparent 50%), radial-gradient(1px 1px at 96% 22%, ${rgba(
          "232,234,237",
          sa(0.6),
        )}, transparent 50%)`
      : "";

  const haloPos = `${p.haloX}% ${p.haloY}%`;

  return (
    <>
      {/* Calque 1 — Ambient gradient */}
      <div
        aria-hidden="true"
        data-time-phase={phase}
        style={{
          ...fixedFill,
          background: `radial-gradient(ellipse 80% 50% at ${haloPos}, ${rgba(
            p.colors.primary,
            aPrimary,
          )} 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 10% 100%, ${rgba(
            p.colors.secondary,
            aCyan,
          )} 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 90% 90%, ${rgba(
            p.colors.tertiary,
            aViolet,
          )} 0%, transparent 50%)`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Calque 2 — God rays (rayons obliques + halo top) */}
      <div
        aria-hidden="true"
        style={{
          ...fixedFill,
          overflow: "hidden",
          background: `linear-gradient(105deg, transparent 35%, ${rgba(
            p.colors.rays,
            aRayGold,
          )} 48%, ${rgba(p.colors.rays, aRayMain)} 50%, ${rgba(
            p.colors.rays,
            aRayGold,
          )} 52%, transparent 65%), linear-gradient(75deg, transparent 42%, rgba(245,240,232,0.07) 50%, transparent 58%), linear-gradient(180deg, ${rgba(
            p.colors.rays,
            aRayTop,
          )} 0%, transparent 32%)`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Calque 3 — Étoiles scintillantes (pixels) */}
      <div
        aria-hidden="true"
        style={{
          ...fixedFill,
          backgroundImage: `${baseStars}${denseStars}`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {/* Calque 4 — Disque lunaire */}
      {p.moonVisible && p.moonOpacity > 0 && (
        <div aria-hidden="true" style={{ ...fixedFill, ...transitionStyle }}>
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
    </>
  );
};

export default AmbientLightLayer;
