/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ✨ DEEPSIGHT SPINNER v3.1 — Gouvernail cosmique officiel                         ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Flammes cosmiques fixes (arrière-plan) + Gouvernail argenté/doré qui tourne      ║
 * ║  Images : /spinner-cosmic.jpg (flammes) + /spinner-wheel.jpg (gouvernail)         ║
 * ║  - Sur fond sombre (défaut) : mix-blend-mode: screen pour intégration naturelle   ║
 * ║  - Sur fond clair/coloré (boutons) : blend normal, fond noir circulaire           ║
 * ║  Tailles: xs (24px) → xxl (350px)                                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface DeepSightSpinnerProps {
  /** Taille prédéfinie ou pixels custom */
  size?: SpinnerSize | number;
  /** Classes CSS additionnelles */
  className?: string;
  /** Texte sous le spinner */
  label?: string;
  /** Afficher le label */
  showLabel?: boolean;
  /** Vitesse de rotation */
  speed?: 'slow' | 'normal' | 'fast';
  /**
   * Mode fond clair : pour usage dans boutons/surfaces claires.
   * Ajoute un fond noir circulaire et désactive mix-blend-mode
   * afin que le spinner reste visible sur fond coloré.
   */
  onLight?: boolean;
}

const sizeConfig: Record<SpinnerSize, { container: number; wheel: number }> = {
  xs:  { container: 24,  wheel: 22  },
  sm:  { container: 40,  wheel: 36  },
  md:  { container: 64,  wheel: 58  },
  lg:  { container: 120, wheel: 110 },
  xl:  { container: 200, wheel: 185 },
  xxl: { container: 350, wheel: 320 },
};

const speedMap: Record<string, number> = {
  slow: 8,
  normal: 5,
  fast: 2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  className = '',
  label = 'Chargement...',
  showLabel = false,
  speed = 'normal',
  onLight = false,
}) => {
  const isPreset = typeof size === 'string';
  const containerPx = isPreset ? sizeConfig[size as SpinnerSize].container : size;
  const wheelPx = isPreset ? sizeConfig[size as SpinnerSize].wheel : Math.round((size as number) * 0.91);
  const duration = speedMap[speed];

  // Pour xs, pas de flammes — trop petit pour que ce soit lisible
  const showFlames = containerPx >= 36;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-label={label}
    >
      {/* Container circulaire */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: containerPx,
          height: containerPx,
          // Sur fond clair : fond noir circulaire pour que screen blend fonctionne
          ...(onLight && {
            backgroundColor: '#000',
            borderRadius: '50%',
            overflow: 'hidden',
          }),
        }}
      >
        {/* FLAMMES COSMIQUES — fixes (arrière-plan) */}
        {showFlames && (
          <img
            src="/spinner-cosmic.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              maskImage: `radial-gradient(
                circle at center,
                transparent 0%,
                transparent 38%,
                rgba(0,0,0,0.4) 45%,
                black 52%,
                black 100%
              )`,
              WebkitMaskImage: `radial-gradient(
                circle at center,
                transparent 0%,
                transparent 38%,
                rgba(0,0,0,0.4) 45%,
                black 52%,
                black 100%
              )`,
              zIndex: 1,
              mixBlendMode: onLight ? 'normal' : 'screen',
              borderRadius: '50%',
            }}
          />
        )}

        {/* GOUVERNAIL — tourne */}
        <img
          src="/spinner-wheel.jpg"
          alt=""
          aria-hidden="true"
          style={{
            width: wheelPx,
            height: wheelPx,
            position: 'relative',
            zIndex: 10,
            mixBlendMode: onLight ? 'normal' : 'screen',
            opacity: 0.85,
            filter: 'brightness(1.2) contrast(1.25) saturate(1.1)',
            animation: `deepsight-gouvernail-spin ${duration}s linear infinite`,
            willChange: 'transform',
          }}
        />
      </div>

      {/* Label optionnel */}
      {showLabel && (
        <span className="text-sm text-white/40 animate-pulse select-none">
          {label}
        </span>
      )}

      {/* Accessibilité */}
      <span className="sr-only">{label}</span>

      {/* Keyframes */}
      <style>{`
        @keyframes deepsight-gouvernail-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANTS PRATIQUES
// ═══════════════════════════════════════════════════════════════════════════════

/** 24px — Inline dans boutons, badges, à côté de texte (fond sombre) */
export const DeepSightSpinnerMicro: React.FC<{ className?: string; onLight?: boolean }> = (props) => (
  <DeepSightSpinner size="xs" speed="fast" {...props} />
);

/** 40px — Boutons moyens, headers de section */
export const DeepSightSpinnerSmall: React.FC<{ className?: string; onLight?: boolean }> = (props) => (
  <DeepSightSpinner size="sm" speed="normal" {...props} />
);

/** 120px — Section loading, cards, modals — avec label */
export const DeepSightSpinnerLarge: React.FC<{ className?: string; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

/** 350px — Hero loading, full-page, landing */
export const DeepSightSpinnerHero: React.FC<{ className?: string; label?: string }> = (props) => (
  <DeepSightSpinner size="xxl" speed="slow" showLabel {...props} />
);

export default DeepSightSpinner;
