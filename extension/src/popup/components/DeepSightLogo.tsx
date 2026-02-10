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
    <span
      className={`ds-logo-wrap ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 6 : 10 }}
    >
      <img
        src="assets/deepsight-logo-cosmic.png"
        alt="Deep Sight"
        width={px}
        height={px}
        style={{ objectFit: 'contain' }}
      />
      {showText && (
        <span
          className="ds-gradient-text"
          style={{
            fontSize: size === 'lg' ? 28 : size === 'md' ? 16 : 13,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          Deep Sight
        </span>
      )}
    </span>
  );
};
