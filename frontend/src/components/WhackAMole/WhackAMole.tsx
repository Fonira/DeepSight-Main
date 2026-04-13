/**
 * WhackAMole — Orchestrator component.
 * Renders the mole, particles, and fact card based on game phase.
 * Supports 'classic' and 'reverse' (image guess) modes.
 * Uses canvas-confetti for celebration bursts.
 */

import React, { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useAuth } from "../../hooks/useAuth";
import { useWhackAMole } from "./useWhackAMole";
import { clampFactPosition } from "./useWhackAMole";
import { MoleButton } from "./MoleButton";
import { MoleParticles } from "./MoleParticles";
import { FactRevealCard } from "./FactRevealCard";
import { ImageGuessCard } from "./ImageGuessCard";
import { MOLE_SIZE } from "./whackAMoleConstants";

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
    mode,
    reverseImageUrl,
    lastGuessResult,
    prefersReducedMotion,
    isConfettiMilestone,
    handleCatch,
    handleGuess,
    dismissFact,
  } = useWhackAMole({ sidebarCollapsed });

  const confettiFired = useRef(false);

  // Fire confetti on catch
  useEffect(() => {
    if (phase === "caught" && !prefersReducedMotion) {
      const x = (position.x + MOLE_SIZE / 2) / window.innerWidth;
      const y = (position.y + MOLE_SIZE / 2) / window.innerHeight;

      confetti({
        particleCount: 20,
        spread: 60,
        origin: { x, y },
        colors: ["#6366f1", "#8b5cf6", "#06b6d4", "#C8903A"],
        disableForReducedMotion: true,
        zIndex: 35,
      });

      if (isConfettiMilestone && !confettiFired.current) {
        confettiFired.current = true;
        setTimeout(() => {
          confetti({
            particleCount: 60,
            spread: 120,
            origin: { x, y },
            colors: ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"],
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

  // Classic mode flags
  const showMole =
    phase === "visible" || phase === "caught" || phase === "missed";
  const showParticles = phase === "caught";
  const showClassicFact =
    phase === "revealing" && currentFact && mode === "classic";

  // Reverse mode flags
  const showGuessCard =
    (phase === "guessing" || (phase === "revealing" && mode === "reverse")) &&
    currentFact &&
    reverseImageUrl;

  const factPosition = currentFact
    ? clampFactPosition(position)
    : { x: 0, y: 0 };

  return (
    <>
      {/* Classic: Mole button */}
      {showMole && mode === "classic" && (
        <MoleButton
          position={position}
          category={currentFact?.category || "misc"}
          phase={phase as "visible" | "caught" | "missed"}
          visibleDuration={visibleDuration}
          prefersReducedMotion={prefersReducedMotion}
          onCatch={handleCatch}
        />
      )}

      {/* Classic: Particle burst */}
      {mode === "classic" && (
        <MoleParticles position={position} active={showParticles} />
      )}

      {/* Classic: Fact reveal card */}
      <AnimatePresence>
        {showClassicFact && currentFact && (
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

      {/* Reverse: Image guess card */}
      <AnimatePresence>
        {showGuessCard && currentFact && reverseImageUrl && (
          <ImageGuessCard
            key={`reverse-${currentFact.term}`}
            fact={currentFact}
            imageUrl={reverseImageUrl}
            position={position}
            streak={streak}
            lastGuessResult={lastGuessResult}
            onGuess={handleGuess}
            onDismiss={dismissFact}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default WhackAMole;
