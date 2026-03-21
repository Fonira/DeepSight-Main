import React from 'react';
import { motion } from 'framer-motion';
import DoodleIcon from './DoodleIcon';

interface DoodleCTAAccentProps {
  doodle: string;
  position?: 'left' | 'right';
  size?: number;
  className?: string;
}

/**
 * DoodleCTAAccent: Small decorative doodle positioned on CTA buttons/cards
 * 
 * Features:
 * - Absolute positioning (parent must have position: relative)
 * - Pulsing scale animation (0.9 → 1.1)
 * - Semi-transparent color (60% opacity)
 * - Default top-right or top-left corner
 */
const DoodleCTAAccent: React.FC<DoodleCTAAccentProps> = ({
  doodle,
  position = 'right',
  size = 20,
  className = '',
}) => {
  const positionClasses =
    position === 'right'
      ? '-top-2 -right-3'
      : '-top-2 -left-3';

  return (
    <motion.div
      className={`absolute ${positionClasses} ${className}`}
      animate={{
        scale: [0.9, 1.1, 0.9],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <DoodleIcon
        name={doodle}
        size={size}
        color="var(--accent-primary)"
        className="opacity-60"
      />
    </motion.div>
  );
};

export default DoodleCTAAccent;
