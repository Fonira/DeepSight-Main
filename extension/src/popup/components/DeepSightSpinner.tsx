import React from 'react';

interface DeepSightSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const SIZE_PX = { sm: 24, md: 48, lg: 80 };
const WHEEL_PX = { sm: 20, md: 42, lg: 72 };

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  text,
}) => {
  const containerPx = SIZE_PX[size];
  const wheelPx = WHEEL_PX[size];
  const speed = size === 'sm' ? 2 : 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          position: 'relative',
          width: containerPx,
          height: containerPx,
        }}
      >
        {/* Cosmic flames background (fixed) */}
        {size !== 'sm' && (
          <img
            src="assets/spinner-cosmic.jpg"
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
              maskImage: 'radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)',
              WebkitMaskImage: 'radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)',
              zIndex: 1,
            }}
          />
        )}

        {/* Wheel that spins */}
        <img
          src="assets/spinner-wheel.jpg"
          alt=""
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: wheelPx,
            height: wheelPx,
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            mixBlendMode: 'screen',
            opacity: 0.85,
            filter: 'brightness(1.2) contrast(1.25) saturate(1.1)',
            animation: `ds-popup-spin ${speed}s linear infinite`,
            borderRadius: '50%',
          }}
        />
      </div>
      {text && (
        <span style={{ fontSize: 13, color: '#8888a0', textAlign: 'center' }}>
          {text}
        </span>
      )}

      <style>{`
        @keyframes ds-popup-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
