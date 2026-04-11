/**
 * MoleParticles — Burst of colorful particles on successful catch.
 * 8 dots exploding radially outward from the mole position.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { PARTICLE_COUNT, PARTICLE_SIZE, PARTICLE_DISTANCE, PARTICLE_COLORS, MOLE_SIZE } from './whackAMoleConstants';

interface MoleParticlesProps {
  position: { x: number; y: number };
  active: boolean;
}

export const MoleParticles: React.FC<MoleParticlesProps> = ({ position, active }) => {
  if (!active) return null;

  const centerX = position.x + MOLE_SIZE / 2;
  const centerY = position.y + MOLE_SIZE / 2;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const targetX = Math.cos(angle) * PARTICLE_DISTANCE;
        const targetY = Math.sin(angle) * PARTICLE_DISTANCE;
        const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];

        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: centerX - PARTICLE_SIZE / 2,
              top: centerY - PARTICLE_SIZE / 2,
              width: PARTICLE_SIZE,
              height: PARTICLE_SIZE,
              backgroundColor: color,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: targetX,
              y: targetY,
              opacity: 0,
              scale: 0,
            }}
            transition={{
              duration: 0.5,
              delay: i * 0.02,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        );
      })}
    </div>
  );
};
