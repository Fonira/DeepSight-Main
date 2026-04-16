import React from "react";
import "./Spinner.css";

export type SpinnerSize = "sm" | "md" | "lg";
export type SpinnerEffect = "blades" | "flames" | "water" | "sparks" | "rings" | "magic";

export interface SpinnerProps {
  /** Taille visuelle : sm (96px loader), md (280px section), lg (520px hero) */
  size?: SpinnerSize;
  /** Vitesse rotation en secondes (override la valeur par défaut de la taille) */
  speed?: number;
  /** URL du logo (défaut: /deepsight-logo.png) */
  logoSrc?: string;
  /** Sens de rotation inversé */
  reverse?: boolean;
  /**
   * Effets magiques à activer (cumulables). Ou "magic" = tous d'un coup.
   * - blades : traînées conic-gradient (effet scie/vitesse)
   * - flames : blobs flammes orange/rouge orbitant
   * - water  : mist cyan contre-rotation
   * - sparks : étincelles qui giclent
   * - rings  : ondes magiques qui s'étendent
   * - magic  : preset tout-en-un
   */
  effects?: SpinnerEffect[];
  /** Label accessibilité */
  label?: string;
  /** Classe CSS additionnelle */
  className?: string;
}

/**
 * DeepSight Spinner — logo aurora qui tourne avec effets magiques cumulables.
 * Full CSS, 60fps, respecte prefers-reduced-motion.
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  speed,
  logoSrc = "/deepsight-logo.png",
  reverse = false,
  effects = [],
  label = "Chargement…",
  className = "",
}) => {
  const style: React.CSSProperties = speed
    ? ({ ["--ds-spin-duration" as string]: `${speed}s` } as React.CSSProperties)
    : {};

  const fxClasses = effects.map((e) => `ds-spinner--fx-${e}`);

  const classes = [
    "ds-spinner",
    `ds-spinner--${size}`,
    reverse ? "ds-spinner--reverse" : "",
    ...fxClasses,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={style}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Effets derrière la roue */}
      <div className="ds-spinner__water" aria-hidden="true" />
      <div className="ds-spinner__flames" aria-hidden="true" />
      <div className="ds-spinner__blades" aria-hidden="true" />
      <div className="ds-spinner__rings" aria-hidden="true" />

      {/* Roue (logo qui tourne) */}
      <div className="ds-spinner__wheel">
        <img
          className="ds-spinner__img"
          src={logoSrc}
          alt=""
          draggable={false}
          aria-hidden="true"
        />
      </div>

      {/* Overlays devant la roue */}
      <div className="ds-spinner__pulse" aria-hidden="true" />
      <div className="ds-spinner__ring" aria-hidden="true" />
      <div className="ds-spinner__sparks" aria-hidden="true" />

      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default Spinner;
