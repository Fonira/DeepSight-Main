/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ✨ DEEPSIGHT SPINNER v2.0 — Logo boussole animé haute qualité                    ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  SVG pur, pas d'images — render parfait à toutes tailles (12px → 350px)           ║
 * ║  Boussole/compas DeepSight avec rotation fluide + glow animé                      ║
 * ║  Tailles: xs (16px), sm (24px), md (40px), lg (64px), xl (120px), xxl (200px)     ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface DeepSightSpinnerProps {
  size?: SpinnerSize | number;
  className?: string;
  label?: string;
  showLabel?: boolean;
  speed?: 'slow' | 'normal' | 'fast';
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 64,
  xl: 120,
  xxl: 200,
};

const speedMap: Record<string, number> = {
  slow: 6,
  normal: 3,
  fast: 1.5,
};

// Unique ID suffix to avoid SVG gradient conflicts when multiple spinners render
let idCounter = 0;

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  className = '',
  label = 'Chargement...',
  showLabel = false,
  speed = 'normal',
}) => {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];
  const duration = speedMap[speed];
  const uid = React.useMemo(() => `ds-${++idCounter}`, []);

  // For very small sizes (xs), render a simplified version
  const isMinimal = pixelSize <= 20;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}
      role="status"
      aria-label={label}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Main gradient: blue → violet → gold */}
          <linearGradient id={`${uid}-g1`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a9eff" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>

          {/* Semi-transparent gradient for diagonal spokes */}
          <linearGradient id={`${uid}-g2`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
          </linearGradient>

          {/* Center glow */}
          <radialGradient id={`${uid}-cg`}>
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>

          {/* Outer glow */}
          <radialGradient id={`${uid}-og`}>
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#4a9eff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient glow (static) */}
        <circle cx="50" cy="50" r="48" fill={`url(#${uid}-og)`} />

        {/* ═══ ROTATING GROUP ═══ */}
        <g style={{ transformOrigin: '50px 50px', animation: `deepsight-spin ${duration}s linear infinite` }}>
          {/* Outer ring */}
          <circle cx="50" cy="50" r="42" stroke={`url(#${uid}-g1)`} strokeWidth="0.75" opacity="0.3" />

          {/* Tick marks (8 positions) */}
          {!isMinimal && (
            <g stroke={`url(#${uid}-g1)`} strokeWidth="0.75" opacity="0.35">
              <line x1="50" y1="6" x2="50" y2="10" />
              <line x1="94" y1="50" x2="90" y2="50" />
              <line x1="50" y1="94" x2="50" y2="90" />
              <line x1="6" y1="50" x2="10" y2="50" />
              <line x1="81" y1="19" x2="78.3" y2="21.7" />
              <line x1="81" y1="81" x2="78.3" y2="78.3" />
              <line x1="19" y1="81" x2="21.7" y2="78.3" />
              <line x1="19" y1="19" x2="21.7" y2="21.7" />
            </g>
          )}

          {/* Inner ring */}
          <circle cx="50" cy="50" r="33" stroke={`url(#${uid}-g1)`} strokeWidth="0.5" opacity="0.2" />

          {/* Cardinal spokes (N/E/S/W - larger diamond shapes) */}
          <polygon points="50,8 56,40 50,34 44,40" fill={`url(#${uid}-g1)`} />
          <polygon points="92,50 60,56 66,50 60,44" fill={`url(#${uid}-g1)`} />
          <polygon points="50,92 44,60 50,66 56,60" fill={`url(#${uid}-g1)`} />
          <polygon points="8,50 40,44 34,50 40,56" fill={`url(#${uid}-g1)`} />

          {/* Diagonal spokes (NE/SE/SW/NW - smaller, semi-transparent) */}
          {!isMinimal && (
            <>
              <polygon points="78,22 56,50 50,44" fill={`url(#${uid}-g2)`} />
              <polygon points="78,78 50,56 56,50" fill={`url(#${uid}-g2)`} />
              <polygon points="22,78 44,50 50,56" fill={`url(#${uid}-g2)`} />
              <polygon points="22,22 50,44 44,50" fill={`url(#${uid}-g2)`} />
            </>
          )}

          {/* Center hub */}
          <circle cx="50" cy="50" r="14" fill={`url(#${uid}-cg)`} />
          <circle cx="50" cy="50" r="10" fill={`url(#${uid}-g1)`} />
          <circle cx="50" cy="50" r="6" fill="#0a0a0f" />
          <circle cx="50" cy="50" r="2.5" fill={`url(#${uid}-g1)`} opacity="0.9" />
        </g>

        <style>{`
          @keyframes deepsight-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </svg>

      {showLabel && (
        <span className="text-sm text-white/40 animate-pulse">{label}</span>
      )}

      <span className="sr-only">{label}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** 16px — Inline dans les boutons, badges, à côté de texte */
export const DeepSightSpinnerMicro: React.FC<{ className?: string }> = (props) => (
  <DeepSightSpinner size="xs" speed="fast" {...props} />
);

/** 24px — Boutons moyens, headers de section */
export const DeepSightSpinnerSmall: React.FC<{ className?: string }> = (props) => (
  <DeepSightSpinner size="sm" speed="normal" {...props} />
);

/** 64px — Section loading, cards, modals */
export const DeepSightSpinnerLarge: React.FC<{ className?: string; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

/** 200px — Hero loading, full-page, analyse en cours */
export const DeepSightSpinnerHero: React.FC<{ className?: string; label?: string }> = (props) => (
  <DeepSightSpinner size="xxl" speed="slow" showLabel {...props} />
);

export default DeepSightSpinner;
