/**
 * AmbientLightLayer v2 — Couche d'effets lumineux globaux DeepSight (web).
 *
 * Consomme @deepsight/lighting-engine via useAmbientPreset() pour avoir un
 * preset à jour toutes les 30s, avec :
 *   - 48 keyframes (toutes les 30 min sur 24h)
 *   - sun-beam doré chaud le jour, moon-beam argenté froid la nuit
 *   - cross-fade twilight aux crépuscules (5h-7h, 17h-19h)
 *   - variation seedée jour-à-jour sur l'angle du beam (± 15°)
 *
 * Empile 6 calques en `position: fixed`, `pointer-events: none`, z-[1] avec
 * `mix-blend-mode: screen` pour passer par-dessus les fonds opaques sans
 * masquer le contenu :
 *
 *   1. Ambient gradient (3 spots colorés : haut, bottom-left, bottom-right)
 *   2. Beam principal — sun OU moon avec angle dynamique
 *   3. Étoiles scintillantes (densité variable : sparse jour / dense nuit)
 *   4. Disque solaire (jour)
 *   5. Disque lunaire (nuit)
 *   6. (optionnel) DoodleBackground signature DeepSight
 *
 * Toutes les transitions d'opacité/couleur sont smoothées via CSS transition
 * de 1.5s cubic-bezier(0.4, 0, 0.2, 1). Si prefers-reduced-motion → 0ms.
 */

import React from "react";
import DoodleBackground from "./DoodleBackground";
import { useAmbientPreset } from "../hooks/useAmbientPreset";

type Intensity = "soft" | "normal" | "strong";

interface AmbientLightLayerProps {
  intensity?: Intensity;
  doodle?: "default" | "video" | "academic" | "analysis" | "tech" | "creative";
  doodleOpacity?: number;
  fixed?: boolean;
}

const INTENSITY_MUL: Record<Intensity, number> = {
  soft: 0.7,
  normal: 1,
  strong: 1.25,
};

const TRANSITION_MS = 1500;

export const AmbientLightLayer: React.FC<AmbientLightLayerProps> = ({
  intensity = "normal",
  doodle,
  doodleOpacity = 0.45,
  fixed = true,
}) => {
  const intensityMul = INTENSITY_MUL[intensity];
  const { preset: p, prefersReducedMotion } = useAmbientPreset({
    intensityMul,
  });

  const positionClass = fixed ? "fixed" : "absolute";

  const transitionStyle: React.CSSProperties = prefersReducedMotion
    ? {}
    : {
        transition: `background ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      };

  const rgba = (rgb: [number, number, number], a: number): string =>
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

  const aPrimary = p.ambient.primary;
  const aSecondary = p.ambient.secondary;
  const aTertiary = p.ambient.tertiary;
  const haloPos = `${p.haloX}% ${p.haloY}%`;

  const beamOpacity = p.beam.opacity;
  const beamColor = p.beam.color;
  const beamAngle = p.beam.angleDeg;
  const beamGradient = `linear-gradient(${beamAngle}deg, transparent 35%, ${rgba(beamColor, beamOpacity * 0.5)} 48%, ${rgba(beamColor, beamOpacity)} 50%, ${rgba(beamColor, beamOpacity * 0.5)} 52%, transparent 65%)`;
  const beamSecondary = `linear-gradient(${beamAngle - 30}deg, transparent 42%, ${rgba(beamColor, beamOpacity * 0.18)} 50%, transparent 58%)`;
  const beamHood = `linear-gradient(180deg, ${rgba(beamColor, beamOpacity * 0.55)} 0%, transparent 32%)`;

  const sm = p.starOpacityMul;
  const sa = (a: number): number => Math.min(0.95, a * sm);
  const accent = p.colors.accent;

  const baseStars = `radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,${sa(0.7).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 28% 42%, ${rgba(accent, sa(0.75))}, transparent 50%), radial-gradient(1px 1px at 47% 12%, rgba(255,255,255,${sa(0.55).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 62% 78%, ${rgba([196, 181, 253], sa(0.65))}, transparent 50%), radial-gradient(1px 1px at 78% 35%, rgba(255,255,255,${sa(0.6).toFixed(3)}), transparent 50%), radial-gradient(2px 2px at 88% 62%, ${rgba(accent, sa(0.7))}, transparent 50%), radial-gradient(1px 1px at 8% 75%, ${rgba([196, 181, 253], sa(0.55))}, transparent 50%), radial-gradient(1.5px 1.5px at 35% 90%, rgba(255,255,255,${sa(0.5).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 92% 88%, ${rgba(accent, sa(0.6))}, transparent 50%)`;

  const denseStars =
    p.starDensity === "dense"
      ? `, radial-gradient(1px 1px at 18% 55%, rgba(255,255,255,${sa(0.6).toFixed(3)}), transparent 50%), radial-gradient(1.5px 1.5px at 52% 28%, rgba(232,234,237,${sa(0.7).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 70% 15%, ${rgba([196, 181, 253], sa(0.55))}, transparent 50%), radial-gradient(1.5px 1.5px at 5% 38%, rgba(255,255,255,${sa(0.65).toFixed(3)}), transparent 50%), radial-gradient(1px 1px at 96% 22%, rgba(232,234,237,${sa(0.6).toFixed(3)}), transparent 50%)`
      : "";

  return (
    <>
      <div
        aria-hidden="true"
        data-mood={p.mood}
        data-beam-type={p.beam.type}
        className={`${positionClass} inset-0 pointer-events-none z-[1]`}
        style={{
          background: `radial-gradient(ellipse 80% 50% at ${haloPos}, ${rgba(p.colors.primary, aPrimary)} 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 10% 100%, ${rgba(p.colors.secondary, aSecondary)} 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 90% 90%, ${rgba(p.colors.tertiary, aTertiary)} 0%, transparent 50%)`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none overflow-hidden z-[1]`}
        style={{
          background: `${beamGradient}, ${beamSecondary}, ${beamHood}`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      <div
        aria-hidden="true"
        className={`${positionClass} inset-0 pointer-events-none z-[1]`}
        style={{
          backgroundImage: `${baseStars}${denseStars}`,
          mixBlendMode: "screen",
          ...transitionStyle,
        }}
      />

      {p.sun.visible && p.sun.opacity > 0.05 && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-[1]`}
          style={{ ...transitionStyle }}
        >
          <div
            style={{
              position: "absolute",
              top: `${p.sun.y}%`,
              left: `${p.sun.x}%`,
              width: "84px",
              height: "84px",
              borderRadius: "50%",
              transform: "translate(-50%, 0)",
              background:
                "radial-gradient(circle at 50% 50%, #fff8d4 0%, #fde68a 50%, #fbbf24 80%, transparent 100%)",
              boxShadow:
                "0 0 80px 20px rgba(253,224,71,0.35), 0 0 160px 50px rgba(251,191,36,0.18)",
              opacity: p.sun.opacity,
              ...transitionStyle,
            }}
          />
        </div>
      )}

      {p.moon.visible && p.moon.opacity > 0.05 && (
        <div
          aria-hidden="true"
          className={`${positionClass} inset-0 pointer-events-none z-[1]`}
          style={{ ...transitionStyle }}
        >
          <div
            style={{
              position: "absolute",
              top: `${p.moon.y}%`,
              left: `${p.moon.x}%`,
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              transform: "translate(-50%, 0)",
              background:
                "radial-gradient(circle at 38% 38%, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 80%, transparent 100%)",
              boxShadow:
                "0 0 60px 10px rgba(186,230,253,0.45), 0 0 120px 30px rgba(99,102,241,0.18)",
              opacity: p.moon.opacity,
              ...transitionStyle,
            }}
          />
        </div>
      )}

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
