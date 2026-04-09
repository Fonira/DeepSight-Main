/**
 * VoiceButton — Floating circular button for voice chat
 * Fixed bottom-right, 3 states: idle / locked / active
 */

import React, { useCallback } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Mic, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { PLAN_LIMITS, normalizePlanId } from '../../config/planPrivileges';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface VoiceButtonProps {
  summaryId: number;
  onOpen: () => void;
  disabled?: boolean;
}

type VoiceState = 'idle' | 'locked';

// ═══════════════════════════════════════════════════════════════════════════════
// Animation variants
// ═══════════════════════════════════════════════════════════════════════════════

const pulseVariants: Variants = {
  active: {
    boxShadow: [
      '0 0 0 0 rgba(99, 102, 241, 0)',
      '0 0 20px 8px rgba(99, 102, 241, 0.35)',
      '0 0 0 0 rgba(99, 102, 241, 0)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  idle: {
    boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

const VoiceButton: React.FC<VoiceButtonProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  summaryId: _summaryId,
  onOpen,
  disabled = false,
}) => {
  const { user } = useAuth();
  const plan = normalizePlanId(user?.plan);
  const voiceEnabled = PLAN_LIMITS[plan].voiceChatEnabled;

  // Determine visual state
  const state: VoiceState = disabled
    ? 'idle'
    : !voiceEnabled
      ? 'locked'
      : 'idle';

  const handleClick = useCallback(() => {
    if (state === 'locked' || disabled) return;
    onOpen();
  }, [state, disabled, onOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const isLocked = state === 'locked';

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={
        isLocked
          ? 'Chat vocal — Disponible à partir du plan Étudiant'
          : 'Ouvrir le chat vocal'
      }
      aria-disabled={isLocked || disabled}
      className={`
        fixed bottom-6 right-6 z-40
        flex items-center justify-center
        rounded-full cursor-pointer
        w-12 h-12 md:w-14 md:h-14
        transition-colors duration-200
        outline-none
        focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]
        ${
          isLocked
            ? 'bg-white/5 border border-white/10 cursor-not-allowed opacity-60'
            : 'bg-white/5 border border-white/10 hover:bg-white/[0.08]'
        }
        group
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      whileHover={!isLocked && !disabled ? { scale: 1.05 } : undefined}
      whileTap={!isLocked && !disabled ? { scale: 0.95 } : undefined}
      variants={pulseVariants}
      animate="idle"
    >
      {/* Icon */}
      {isLocked ? (
        <Lock className="w-5 h-5 md:w-6 md:h-6 text-white/40" />
      ) : (
        <Mic className="w-5 h-5 md:w-6 md:h-6 text-white/60" />
      )}

      {/* Locked tooltip */}
      {isLocked && (
        <div
          className="
            absolute bottom-full right-0 mb-3
            px-3 py-2 rounded-lg
            bg-[#1a1a2e] border border-white/10
            text-xs text-white/70 whitespace-nowrap
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            pointer-events-none
          "
        >
          Disponible à partir du plan Étudiant
          <div className="absolute top-full right-4 w-2 h-2 bg-[#1a1a2e] border-r border-b border-white/10 transform rotate-45 -translate-y-1" />
        </div>
      )}
    </motion.div>
  );
};

export default VoiceButton;
