/**
 * ImageGuessCard — Reverse Prompt mode.
 * Shows AI image, user must type the keyword.
 * Fuzzy validation: correct / close / wrong.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, Check, X, Clock, Sparkles } from 'lucide-react';
import type { LoadingWord } from '../../contexts/LoadingWordContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { REVERSE_GUESS_DURATION, REVERSE_IMAGE_SIZE } from './whackAMoleConstants';

interface ImageGuessCardProps {
  fact: LoadingWord;
  imageUrl: string;
  position: { x: number; y: number };
  streak: number;
  lastGuessResult: 'correct' | 'close' | 'wrong' | null;
  onGuess: (input: string) => void;
  onDismiss: () => void;
  prefersReducedMotion: boolean;
}

export const ImageGuessCard: React.FC<ImageGuessCardProps> = ({
  fact,
  imageUrl,
  position,
  streak,
  lastGuessResult,
  onGuess,
  onDismiss,
  prefersReducedMotion,
}) => {
  const { language } = useLanguage();
  const [input, setInput] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(REVERSE_GUESS_DURATION / 1000);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRevealing = lastGuessResult !== null;

  // Focus input on mount
  useEffect(() => {
    if (!isRevealing) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isRevealing]);

  // Countdown timer
  useEffect(() => {
    if (isRevealing) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRevealing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isRevealing) {
      onGuess(input);
    }
  };

  const resultColor = lastGuessResult === 'correct'
    ? 'text-emerald-400'
    : lastGuessResult === 'close'
    ? 'text-amber-400'
    : 'text-red-400';

  const resultBorderColor = lastGuessResult === 'correct'
    ? 'border-emerald-500/30'
    : lastGuessResult === 'close'
    ? 'border-amber-500/30'
    : 'border-red-500/30';

  const resultMessage = lastGuessResult === 'correct'
    ? (language === 'fr' ? 'Exact !' : 'Correct!')
    : lastGuessResult === 'close'
    ? (language === 'fr' ? 'Presque !' : 'Almost!')
    : (language === 'fr' ? 'Raté !' : 'Wrong!');

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="fixed z-30"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-label={language === 'fr' ? 'Devinez le concept' : 'Guess the concept'}
    >
      <div
        className={`relative rounded-2xl overflow-hidden border ${
          isRevealing ? resultBorderColor : 'border-white/10'
        } transition-colors duration-300`}
        style={{
          width: 360,
          background: 'rgba(17, 17, 24, 0.95)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Glass background */}
        <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-xl" />

        {/* Image section */}
        <div className="relative overflow-hidden" style={{ height: REVERSE_IMAGE_SIZE }}>
          {/* Shimmer */}
          {!imageLoaded && (
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(110deg, #0a0a0f 30%, #1a1a2e 50%, #0a0a0f 70%)',
                backgroundSize: '200% 100%',
                animation: 'guess-shimmer 1.5s ease-in-out infinite',
              }}
            />
          )}
          <motion.img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            onLoad={() => setImageLoaded(true)}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.1, filter: 'brightness(0.3)' }}
            animate={{
              opacity: imageLoaded ? 1 : 0,
              scale: imageLoaded ? 1 : 1.1,
              filter: imageLoaded ? 'brightness(1)' : 'brightness(0.3)',
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#12121a] to-transparent" />

          {/* Timer badge */}
          {!isRevealing && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
              <Clock className="w-3 h-3 text-accent-primary" />
              <span className={`text-xs font-mono font-medium ${timeLeft <= 5 ? 'text-red-400' : 'text-white/70'}`}>
                {timeLeft}s
              </span>
            </div>
          )}

          {/* AI badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
            <Sparkles className="w-2.5 h-2.5 text-[#C8903A]" />
            <span className="text-[9px] text-white/50 font-medium">Image IA</span>
          </div>

          {/* Streak badge */}
          {streak > 0 && (
            <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-accent-primary/20 border border-accent-primary/30">
              <span className="text-xs font-semibold text-accent-primary">{streak}x</span>
            </div>
          )}

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="absolute top-3 right-12 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/50 hover:text-white transition-all"
            aria-label={language === 'fr' ? 'Fermer' : 'Close'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Input / Result section */}
        <div className="relative p-4 space-y-3">
          {!isRevealing ? (
            <>
              {/* Challenge prompt */}
              <div className="flex items-center gap-2 text-text-secondary">
                <Eye className="w-4 h-4 text-accent-primary" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Quel concept illustre cette image ?' : 'What concept does this image illustrate?'}
                </span>
              </div>

              {/* Input form */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={language === 'fr' ? 'Votre r\u00e9ponse...' : 'Your answer...'}
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-primary/40 transition-colors"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-4 py-2 rounded-lg bg-accent-primary/20 border border-accent-primary/30 text-accent-primary text-sm font-medium hover:bg-accent-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Check className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Result feedback */}
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-2"
              >
                <p className={`text-lg font-semibold ${resultColor}`}>
                  {resultMessage}
                </p>
                <p className="text-text-primary font-display text-xl font-semibold">
                  {fact.term}
                </p>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {fact.shortDefinition}
                </p>
              </motion.div>
            </>
          )}
        </div>

        {/* Gold accent line */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes guess-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
};
