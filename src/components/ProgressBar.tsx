import React from 'react';

interface ProgressBarProps {
  value: number;
  label?: string;
  variant?: 'default' | 'gradient' | 'glow';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  variant = 'gradient'
}) => {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-subtitle text-cream/80">{label}</span>
          <span className="text-sm font-bold text-gold-primary">{Math.round(clampedValue)}%</span>
        </div>
      )}

      <div className="relative h-3 bg-teal-deep/40 rounded-full overflow-hidden border border-gold-primary/20">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(0,212,170,0.3) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite'
          }}
        />

        <div
          className={`
            absolute inset-y-0 left-0 rounded-full
            transition-all duration-700 ease-out
            ${variant === 'gradient' && 'bg-gradient-to-r from-cyan-glow via-gold-primary to-gold-highlight'}
            ${variant === 'default' && 'bg-gold-primary'}
            ${variant === 'glow' && 'bg-cyan-glow shadow-[0_0_20px_rgba(0,212,170,0.6)]'}
          `}
          style={{ width: `${clampedValue}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>

        {clampedValue > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse"
            style={{ left: `calc(${clampedValue}% - 4px)` }}
          />
        )}
      </div>
    </div>
  );
};
