/**
 * DEEP SIGHT — MasteryRing
 * SVG circulaire montrant le % de maîtrise d'une vidéo.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface MasteryRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
}

const getColor = (percent: number): string => {
  if (percent >= 80) return '#22c55e';
  if (percent >= 50) return '#eab308';
  if (percent >= 25) return '#f97316';
  return '#ef4444';
};

export const MasteryRing: React.FC<MasteryRingProps> = ({
  percent,
  size = 64,
  strokeWidth = 6,
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;
  const color = useMemo(() => getColor(clamped), [clamped]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Maîtrise : ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <span
        className="absolute text-xs font-bold text-white"
        style={{ fontSize: size * 0.22 }}
      >
        {clamped}%
      </span>
    </div>
  );
};
