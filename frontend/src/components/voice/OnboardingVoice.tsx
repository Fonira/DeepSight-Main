/**
 * OnboardingVoice — Floating bubble that triggers a voice onboarding session
 * v1.0 — Shows for new users (first login), triggers "onboarding" agent type
 *
 * Usage:
 *   <OnboardingVoice
 *     isNewUser={true}
 *     onDismiss={() => setDismissed(true)}
 *   />
 *
 * Integration:
 *   Place in DashboardPage.tsx, conditionally rendered when:
 *   - user.onboarding_completed === false
 *   - user has not dismissed the bubble
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingVoiceProps {
  isNewUser: boolean;
  onDismiss?: () => void;
  onStartSession?: () => void;
}

export const OnboardingVoice: React.FC<OnboardingVoiceProps> = ({
  isNewUser,
  onDismiss,
  onStartSession,
}) => {
  const [isVisible, setIsVisible] = useState(isNewUser);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleStart = useCallback(() => {
    onStartSession?.();
  }, [onStartSession]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1.5 }}
        className="fixed bottom-6 right-6 z-40"
      >
        {isExpanded ? (
          /* Expanded card */
          <motion.div
            initial={{ width: 56, height: 56 }}
            animate={{ width: 320, height: 'auto' }}
            className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-5 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Content */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" strokeWidth="2" />
                  <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h3 className="text-white text-sm font-medium mb-1">
                  Bienvenue sur DeepSight !
                </h3>
                <p className="text-white/50 text-xs leading-relaxed">
                  Voulez-vous que je vous guide vocalement ?
                  Je peux vous montrer comment analyser votre première vidéo.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleStart}
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-medium hover:from-indigo-400 hover:to-violet-400 transition-all"
              >
                Commencer le guide
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 hover:text-white/70 transition-all"
              >
                Plus tard
              </button>
            </div>
          </motion.div>
        ) : (
          /* Collapsed bubble */
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center relative"
          >
            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />

            {/* Microphone icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" className="relative z-10">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" strokeWidth="2" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" />
            </svg>

            {/* Badge */}
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#0a0a0f] flex items-center justify-center">
              <span className="text-[8px] text-black font-bold">?</span>
            </span>
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingVoice;
