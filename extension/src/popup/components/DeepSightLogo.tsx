import React from 'react';

interface DeepSightLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const SIZES = { sm: 24, md: 40, lg: 64 };

export const DeepSightLogo: React.FC<DeepSightLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const px = SIZES[size];

  return (
    <span className={`ds-logo-wrap ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 6 : 10 }}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ds-logo-g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a9eff" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="ds-logo-g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id="ds-logo-glow">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="18" fill="url(#ds-logo-glow)" />
        <g transform="translate(24,24)">
          {/* Cardinal points */}
          <polygon points="0,-18 3.5,-4.5 0,-7 -3.5,-4.5" fill="url(#ds-logo-g1)" />
          <polygon points="18,0 4.5,3.5 7,0 4.5,-3.5" fill="url(#ds-logo-g1)" />
          <polygon points="0,18 -3.5,4.5 0,7 3.5,4.5" fill="url(#ds-logo-g1)" />
          <polygon points="-18,0 -4.5,-3.5 -7,0 -4.5,3.5" fill="url(#ds-logo-g1)" />
          {/* Diagonal points */}
          <polygon points="12,-12 3,0 0,-3" fill="url(#ds-logo-g2)" />
          <polygon points="12,12 0,3 3,0" fill="url(#ds-logo-g2)" />
          <polygon points="-12,12 -3,0 0,3" fill="url(#ds-logo-g2)" />
          <polygon points="-12,-12 0,-3 -3,0" fill="url(#ds-logo-g2)" />
          {/* Outer ring */}
          <circle cx="0" cy="0" r="14" fill="none" stroke="url(#ds-logo-g1)" strokeWidth="0.5" opacity="0.3" />
          {/* Center */}
          <circle cx="0" cy="0" r="4.5" fill="url(#ds-logo-g1)" />
          <circle cx="0" cy="0" r="2.5" fill="#0a0a0f" />
          <circle cx="0" cy="0" r="1" fill="url(#ds-logo-g1)" opacity="0.7" />
        </g>
      </svg>
      {showText && (
        <span className="ds-gradient-text" style={{ fontSize: size === 'lg' ? 28 : size === 'md' ? 16 : 13, fontWeight: 700, letterSpacing: -0.5 }}>
          DeepSight
        </span>
      )}
    </span>
  );
};
