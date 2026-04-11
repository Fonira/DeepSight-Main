/**
 * WhackAMole — Orchestrator component.
 * Renders the mole, particles, and fact card based on game phase.
 * Uses canvas-confetti for celebration bursts.
 */

import React, { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '../../hooks/useAuth';
import { useWhackAMole } from './useWhackAMole';
import { clampFactPosition } from './useWhackAMole';
import { MoleButton } from './MoleButton';
import { MoleParticles } from './MoleParticles';
import { FactRevealCard } from './FactRevealCard';
import { MOLE_SIZE } from './whackAMoleConstants';

interface WhackAMoleProps {
  sidebarCollapsed: boolean;
}

export const WhackAMole: React.FC<WhackAMoleProps> = ({ sidebarCollapsed }) => {
  const { isAuthenticated } = useAuth();
  const {
    phase,
    position,
    currentFact,
    streak,
    enabled,
    visibleDuration,
    prefersReducedMotion,
    isConfettiMilestone,
    handleCatch,
    dismissFact,
  } = useWhackAMole({ sidebarCollapsed });

  const confettiFired = useRef(false);

  // Fire confetti on catch
  useEffect(() => {
    if (phase === 'caught' && !prefersReducedMotion) {
      // Small burst at mole position
      const x = (position.x + MOLE_SIZE / 2) / window.innerWidth;
      const y = (position.y + MOLE_SIZE / 2) / window.innerHeight;

      confetti({
        particleCount: 20,
        spread: 60,
        origin: { x, y },
        colors: ['#6366f1', '#8b5cf6', '#06b6d4', '#C8903A'],
        disableForReducedMotion: true,
        zIndex: 35,
      });

      // Extra burst for milestones
      if (isConfettiMilestone && !confettiFired.current) {
        confettiFired.current = true;
        setTimeout(() => {
          confetti({
            particleCount: 60,
            spread: 120,
            origin: { x, y },
            colors: ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981'],
            disableForReducedMotion: true,
            zIndex: 35,
          });
        }, 200);
      }
    } else {
      confettiFired.current = false;
    }
  }, [phase, position, prefersReducedMotion, isConfettiMilestone]);

  // Don't render if disabled or not authenticated
  if (!enabled || !isAuthenticated) return null;

  const showMole = phase === 'visible' || phase === 'caught' || phase === 'missed';
  const showParticles = phase === 'caught';
  const showFact = phase === 'revealing' && currentFact;

  const factPosition = currentFact ? clampFactPosition(position) : { x: 0, y: 0 };

  return (
    <>
      {/* Mole button */}
      {showMole && (
        <MoleButton
          position={position}
          category={currentFact?.category || 'misc'}
          phase={phase as 'visible' | 'caught' | 'missed'}
          visibleDuration={visibleDuration}
          prefersReducedMotion={prefersReducedMotion}
          onCatch={handleCatch}
        />
      )}

      {/* Particle burst */}
      <MoleParticles position={position} active={showParticles} />

      {/* Fact reveal card */}
      <AnimatePresence>
        {showFact && currentFact && (
          <FactRevealCard
            key={currentFact.term}
            fact={currentFact}
            position={factPosition}
            streak={streak}
            onDismiss={dismissFact}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default WhackAMole;
