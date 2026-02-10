import React from 'react';

interface DeepSightSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const SPINNER_CLASSES = { sm: 'ds-spinner-sm', md: 'ds-spinner-md', lg: 'ds-spinner-lg' };

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  text,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg
        className={SPINNER_CLASSES[size]}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ds-spin-g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a9eff" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="ds-spin-g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id="ds-spin-glow">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="20" fill="url(#ds-spin-glow)" />
        <g transform="translate(24,24)">
          <polygon points="0,-20 3.5,-5 0,-8 -3.5,-5" fill="url(#ds-spin-g1)" />
          <polygon points="20,0 5,3.5 8,0 5,-3.5" fill="url(#ds-spin-g1)" />
          <polygon points="0,20 -3.5,5 0,8 3.5,5" fill="url(#ds-spin-g1)" />
          <polygon points="-20,0 -5,-3.5 -8,0 -5,3.5" fill="url(#ds-spin-g1)" />
          <polygon points="13,-13 3,0 0,-3" fill="url(#ds-spin-g2)" />
          <polygon points="13,13 0,3 3,0" fill="url(#ds-spin-g2)" />
          <polygon points="-13,13 -3,0 0,3" fill="url(#ds-spin-g2)" />
          <polygon points="-13,-13 0,-3 -3,0" fill="url(#ds-spin-g2)" />
          <circle cx="0" cy="0" r="5" fill="url(#ds-spin-g1)" />
          <circle cx="0" cy="0" r="2.5" fill="#0a0a0f" />
          <circle cx="0" cy="0" r="1" fill="url(#ds-spin-g1)" opacity="0.8" />
        </g>
      </svg>
      {text && (
        <span style={{ fontSize: 13, color: '#8888a0', textAlign: 'center' }}>
          {text}
        </span>
      )}
    </div>
  );
};
