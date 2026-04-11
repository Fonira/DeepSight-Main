import React from 'react';
import { DOODLE_MAP } from './doodlePaths';

interface DoodleIconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const DoodleIcon: React.FC<DoodleIconProps> = ({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.5,
  className = '',
  style,
}) => {
  const path = DOODLE_MAP[name];
  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`doodle-icon ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
};
