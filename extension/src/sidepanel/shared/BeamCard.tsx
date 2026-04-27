import React, { type ReactNode, type CSSProperties } from "react";

export interface BeamCardProps {
  children: ReactNode;
  beamColor?: string; // default "#d4a574"
  haloColor?: string; // default "#d4a574"
  angle?: number; // default 22 (degrees, diagonal top-left to bottom-right)
  intensity?: number; // 0..1, default 0.4 (beam stroke-opacity)
  haloIntensity?: number; // 0..1, default 0.35
  haloOriginX?: number; // 0..100, default 15 (% from left)
  haloOriginY?: number; // 0..100, default 25 (% from top)
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
  role?: string;
  as?: "div" | "section" | "article";
}

/**
 * BeamCard — V3 visual signature for DeepSight extension sidebar.
 *
 * Renders a card with a faint diagonal beam of golden light + a soft halo
 * at its origin (no solid disc visible). The beam + halo are pure decoration
 * (pointer-events: none, behind text content via z-index).
 *
 * Color/angle/intensity props default to constants. The parallel
 * `ambient-lighting-v3` PR will wrap the app in `<AmbientLightingProvider>`
 * and these props will be overridden via Context (heure-aware).
 *
 * The `children` slot is positioned at z-index 2 above the beam (z-index 0)
 * + halo (z-index 0) but allows other absolute-positioned overlays via
 * portals or absolute children (e.g. SunflowerLayer mascot in bottom-right).
 */
export const BeamCard: React.FC<BeamCardProps> = ({
  children,
  beamColor = "#d4a574",
  haloColor = "#d4a574",
  angle = 22,
  intensity = 0.4,
  haloIntensity = 0.35,
  haloOriginX = 15,
  haloOriginY = 25,
  className,
  style,
  onClick,
  ariaLabel,
  role,
  as = "div",
}) => {
  // Stable IDs — must be unique per instance to avoid SVG gradient collisions.
  const idSeed = React.useId().replace(/:/g, "");
  const haloId = `v3-halo-${idSeed}`;
  const beamId = `v3-beam-${idSeed}`;

  // Beam line endpoints. Computed from angle (degrees) + halo origin so the
  // beam visually emerges from the halo and exits past the opposite corner.
  // For default angle=22 + origin (15, 25), the line travels diagonally.
  const radians = (angle * Math.PI) / 180;
  const lineLength = 140; // SVG viewBox units (overshoot card bounds)
  const beamX1 = haloOriginX;
  const beamY1 = haloOriginY;
  const beamX2 = haloOriginX + Math.cos(radians) * lineLength;
  const beamY2 = haloOriginY + Math.sin(radians) * lineLength;

  // `as` accepted for API symmetry — currently always rendered as <div> to keep
  // the keyboard handler typing simple. Extending to <section>/<article> would
  // require per-element keyboard handler typing which we don't need here.
  void as;
  const interactive = typeof onClick === "function";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (interactive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`v3-card${className ? ` ${className}` : ""}`}
      style={style}
      onClick={onClick}
      role={role || (interactive ? "button" : undefined)}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <svg
        className="v3-card-beam"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient
            id={haloId}
            cx={`${haloOriginX}%`}
            cy={`${haloOriginY}%`}
            r="40%"
          >
            <stop
              offset="0%"
              stopColor={haloColor}
              stopOpacity={haloIntensity}
            />
            <stop
              offset="60%"
              stopColor={haloColor}
              stopOpacity={haloIntensity * 0.3}
            />
            <stop offset="100%" stopColor={haloColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={beamId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={beamColor} stopOpacity="0" />
            <stop offset="15%" stopColor={beamColor} stopOpacity={intensity} />
            <stop
              offset="65%"
              stopColor={beamColor}
              stopOpacity={intensity * 0.85}
            />
            <stop offset="100%" stopColor={beamColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Halo radial — sits behind beam, marks the "source" softly */}
        <rect width="100" height="100" fill={`url(#${haloId})`} />
        {/* Beam line — single diagonal stroke fading at both ends */}
        <line
          x1={beamX1}
          y1={beamY1}
          x2={beamX2}
          y2={beamY2}
          stroke={`url(#${beamId})`}
          strokeWidth="0.4"
          strokeLinecap="round"
        />
      </svg>
      <div className="v3-card-content">{children}</div>
    </div>
  );
};
