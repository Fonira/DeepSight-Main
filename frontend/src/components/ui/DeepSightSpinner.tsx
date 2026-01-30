/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ✨ DEEPSIGHT SPINNER — Loading Animation Style Claude Sparkle                     ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Cosmic compass wheel with smooth rotation                                        ║
 * ║  - Pulsing glow effect                                                             ║
 * ║  - Blue/Orange gradient aura                                                       ║
 * ║  - Multiple sizes: sm, md, lg, xl                                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  showLabel?: boolean;
}

const sizeConfig: Record<SpinnerSize, { container: number; wheel: number; stroke: number }> = {
  xs: { container: 24, wheel: 20, stroke: 2 },
  sm: { container: 32, wheel: 28, stroke: 2.5 },
  md: { container: 48, wheel: 42, stroke: 3 },
  lg: { container: 64, wheel: 56, stroke: 3.5 },
  xl: { container: 96, wheel: 84, stroke: 4 },
};

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  className = '',
  label = 'Chargement...',
  showLabel = false,
}) => {
  const config = sizeConfig[size];
  const center = config.wheel / 2;
  const radius = (config.wheel - config.stroke) / 2 - 2;
  const spokeLength = radius * 0.7;
  const innerRadius = radius * 0.25;

  return (
    <div 
      className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}
      role="status"
      aria-label={label}
    >
      <div 
        className="relative"
        style={{ width: config.container, height: config.container }}
      >
        {/* Glow effect background */}
        <div 
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(249,115,22,0.2) 50%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
        
        {/* Main SVG */}
        <svg
          width={config.container}
          height={config.container}
          viewBox={`0 0 ${config.wheel} ${config.wheel}`}
          className="relative z-10"
          style={{
            animation: 'deepsight-spin 3s linear infinite',
          }}
        >
          <defs>
            {/* Gradient for the wheel */}
            <linearGradient id="wheelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Outer ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#wheelGradient)"
            strokeWidth={config.stroke}
            opacity="0.8"
            filter="url(#glow)"
          />
          
          {/* Inner ring */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke="url(#wheelGradient)"
            strokeWidth={config.stroke * 0.6}
            opacity="0.9"
          />
          
          {/* 8 Spokes */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = center + innerRadius * Math.cos(rad);
            const y1 = center + innerRadius * Math.sin(rad);
            const x2 = center + (radius - config.stroke) * Math.cos(rad);
            const y2 = center + (radius - config.stroke) * Math.sin(rad);
            
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="url(#wheelGradient)"
                strokeWidth={config.stroke * 0.7}
                strokeLinecap="round"
                opacity={0.7 + (i % 2) * 0.3}
                filter="url(#glow)"
              />
            );
          })}
          
          {/* Cardinal point accents (N, E, S, W) */}
          {[0, 90, 180, 270].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x = center + (radius + 2) * Math.cos(rad - Math.PI/2);
            const y = center + (radius + 2) * Math.sin(rad - Math.PI/2);
            
            return (
              <circle
                key={`accent-${angle}`}
                cx={x}
                cy={y}
                r={config.stroke * 0.8}
                fill="url(#wheelGradient)"
                filter="url(#glow)"
                className="animate-pulse"
              />
            );
          })}
          
          {/* Center dot */}
          <circle
            cx={center}
            cy={center}
            r={config.stroke}
            fill="url(#wheelGradient)"
            filter="url(#glow)"
          />
        </svg>
        
        {/* Sparkle particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400 rounded-full"
              style={{
                left: `${50 + 40 * Math.cos((i * 60 * Math.PI) / 180)}%`,
                top: `${50 + 40 * Math.sin((i * 60 * Math.PI) / 180)}%`,
                animation: `deepsight-sparkle 2s ease-in-out ${i * 0.3}s infinite`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      </div>
      
      {showLabel && (
        <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          {label}
        </span>
      )}
      
      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes deepsight-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes deepsight-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

// Quick variants
export const DeepSightSpinnerSmall: React.FC<{ className?: string }> = (props) => (
  <DeepSightSpinner size="sm" {...props} />
);

export const DeepSightSpinnerLarge: React.FC<{ className?: string; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

export default DeepSightSpinner;
