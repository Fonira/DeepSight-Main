/**
 * DeepSight Spinner v2.0 — Aurora CSS Spinner
 * Rotation du vrai logo DeepSight + effets magiques (blades/flames/sparks).
 * 60fps, zéro vidéo, respecte prefers-reduced-motion.
 */

import React from "react";
import Browser from "../../utils/browser-polyfill";

type SpinnerSize = "xs" | "sm" | "md" | "lg";
type SpeedPreset = "slow" | "normal" | "fast";
type Effect = "blades" | "flames" | "sparks" | "magic";

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  showLabel?: boolean;
  speed?: SpeedPreset;
  /** Rétrocompatibilité — ignoré (logos platforms supprimés dans v2) */
  showLogos?: boolean;
  /** Override effets (défaut: auto selon taille) */
  effects?: Effect[];
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 24,
  sm: 40,
  md: 64,
  lg: 96,
};

const speedMap: Record<SpeedPreset, number> = {
  slow: 6,
  normal: 3.5,
  fast: 2,
};

function defaultEffects(px: number): Effect[] {
  if (px < 36) return [];
  if (px < 60) return ["flames"];
  return ["magic"];
}

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = "md",
  className = "",
  label = "Chargement...",
  showLabel = false,
  speed = "normal",
  effects,
}) => {
  const pixelSize = sizeMap[size];
  const duration = speedMap[speed];
  const resolvedEffects = effects ?? defaultEffects(pixelSize);
  const logoUrl = Browser.runtime.getURL("assets/deepsight-logo.png");

  const fxClasses = resolvedEffects.map((e) => `ds-spinner--fx-${e}`);
  const classes = ["ds-spinner", ...fxClasses, className]
    .filter(Boolean)
    .join(" ");

  const style = {
    width: pixelSize,
    height: pixelSize,
    ["--ds-spin-duration" as string]: `${duration}s`,
  } as React.CSSProperties;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
      role="status"
      aria-label={label}
    >
      <div className={classes} style={style}>
        <div className="ds-spinner__flames" aria-hidden="true" />
        <div className="ds-spinner__blades" aria-hidden="true" />
        <div className="ds-spinner__wheel">
          <img
            className="ds-spinner__img"
            src={logoUrl}
            alt=""
            draggable={false}
            aria-hidden="true"
          />
        </div>
        <div className="ds-spinner__pulse" aria-hidden="true" />
        <div className="ds-spinner__ring" aria-hidden="true" />
        <div className="ds-spinner__sparks" aria-hidden="true" />
      </div>

      {showLabel && <span className="ds-spinner--label">{label}</span>}

      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default DeepSightSpinner;
