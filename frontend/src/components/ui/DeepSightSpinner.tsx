/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ✨ DEEPSIGHT SPINNER — Logo animé officiel                                        ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Gouvernail cosmique qui tourne — Style Claude sparkle                             ║
 * ║  - Flammes cosmiques fixes en arrière-plan                                         ║
 * ║  - Gouvernail argenté/doré qui tourne                                              ║
 * ║  - Tailles: xs, sm, md, lg, xl, xxl                                               ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  showLabel?: boolean;
  speed?: 'slow' | 'normal' | 'fast';
}

const sizeConfig: Record<SpinnerSize, { container: number; wheel: number }> = {
  xs: { container: 24, wheel: 22 },
  sm: { container: 40, wheel: 36 },
  md: { container: 64, wheel: 58 },
  lg: { container: 120, wheel: 110 },
  xl: { container: 200, wheel: 185 },
  xxl: { container: 350, wheel: 320 },
};

const speedConfig: Record<string, number> = {
  slow: 8,
  normal: 5,
  fast: 2,
};

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  className = '',
  label = 'Chargement...',
  showLabel = false,
  speed = 'normal',
}) => {
  const config = sizeConfig[size];
  const duration = speedConfig[speed];

  return (
    <div 
      className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-label={label}
    >
      <div 
        className="relative"
        style={{ 
          width: config.container, 
          height: config.container,
        }}
      >
        {/* Flammes cosmiques - FIXES */}
        <img
          src="/spinner-cosmic.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            maskImage: `radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)`,
            WebkitMaskImage: `radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)`,
            zIndex: 1,
          }}
        />
        
        {/* Gouvernail qui TOURNE */}
        <img
          src="/spinner-wheel.jpg"
          alt=""
          className="relative"
          style={{
            width: config.wheel,
            height: config.wheel,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            mixBlendMode: 'screen',
            opacity: 0.85,
            filter: 'brightness(1.2) contrast(1.25) saturate(1.1)',
            animation: `deepsight-spin ${duration}s linear infinite`,
          }}
        />
      </div>
      
      {showLabel && (
        <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          {label}
        </span>
      )}
      
      <style>{`
        @keyframes deepsight-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Variants pratiques
export const DeepSightSpinnerMicro: React.FC<{ className?: string }> = (props) => (
  <DeepSightSpinner size="xs" speed="fast" {...props} />
);

export const DeepSightSpinnerSmall: React.FC<{ className?: string }> = (props) => (
  <DeepSightSpinner size="sm" {...props} />
);

export const DeepSightSpinnerLarge: React.FC<{ className?: string; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

export const DeepSightSpinnerHero: React.FC<{ className?: string }> = (props) => (
  <DeepSightSpinner size="xxl" speed="slow" {...props} />
);

export default DeepSightSpinner;
