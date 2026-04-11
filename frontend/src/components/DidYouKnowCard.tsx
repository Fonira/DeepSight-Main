/**
 * DidYouKnowCard — Compact "Le Saviez-Vous?" card, top-right corner.
 * Uses the DeepSight cosmic spinner (gouvernail) as visual anchor.
 * Closeable, auto-rotates concepts from user analysis history.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useLoadingWord } from '../contexts/LoadingWordContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import type { LoadingWord } from '../contexts/LoadingWordContext';

// ─── Category icons ─────────────────────────────────────────────────────────

const CAT_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

// ─── Spinner sizes ──────────────────────────────────────────────────────────

const SPINNER_SIZE = 28;
const WHEEL_SIZE = 26;

// ─── Component ──────────────────────────────────────────────────────────────

export const DidYouKnowCard: React.FC = () => {
  const navigate = useNavigate();
  const { currentWord, nextWord } = useLoadingWord();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();

  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('ds-dyk-card-hidden') !== 'true';
    } catch { return true; }
  });
  const [expanded, setExpanded] = useState(false);
  const [displayedWord, setDisplayedWord] = useState<LoadingWord | null>(null);

  // Word transition
  useEffect(() => {
    if (currentWord && currentWord.term !== displayedWord?.term) {
      setDisplayedWord(currentWord);
      setExpanded(false);
    } else if (currentWord && !displayedWord) {
      setDisplayedWord(currentWord);
    }
  }, [currentWord, displayedWord]);

  const handleClose = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem('ds-dyk-card-hidden', 'true'); } catch { /* */ }
  }, []);

  const handleTermClick = useCallback(() => {
    if (displayedWord?.source === 'history' && displayedWord?.summaryId) {
      navigate(`/dashboard?id=${displayedWord.summaryId}`);
    }
  }, [displayedWord, navigate]);

  // Don't render for unauthenticated users or if hidden
  if (!isAuthenticated || !visible || !displayedWord) return null;

  const catIcon = CAT_ICONS[displayedWord.category] || '📚';
  const isClickable = displayedWord.source === 'history' && displayedWord.summaryId;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.96 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-3 right-3 z-40 hidden lg:block"
        style={{ maxWidth: 300 }}
      >
        <div className="relative rounded-2xl overflow-hidden border border-accent-primary/15 shadow-lg shadow-black/30">
          {/* Glass background */}
          <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-xl" />

          {/* Content */}
          <div className="relative p-3 space-y-2">

            {/* Header row: spinner + title + actions */}
            <div className="flex items-center gap-2">
              {/* DeepSight Cosmic Spinner */}
              <div
                className="relative flex-shrink-0 flex items-center justify-center"
                style={{ width: SPINNER_SIZE, height: SPINNER_SIZE }}
              >
                {/* Cosmic flames (background) */}
                <img
                  src="/spinner-cosmic.jpg"
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover rounded-full"
                  style={{
                    maskImage: 'radial-gradient(circle, transparent 35%, rgba(0,0,0,0.4) 45%, black 55%)',
                    WebkitMaskImage: 'radial-gradient(circle, transparent 35%, rgba(0,0,0,0.4) 45%, black 55%)',
                    mixBlendMode: 'screen',
                  }}
                />
                {/* Gouvernail wheel (rotating) */}
                <img
                  src="/spinner-wheel.jpg"
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: WHEEL_SIZE,
                    height: WHEEL_SIZE,
                    position: 'relative',
                    zIndex: 2,
                    mixBlendMode: 'screen',
                    opacity: 0.85,
                    filter: 'brightness(1.2) contrast(1.25) saturate(1.1)',
                    animation: 'dyk-spin 8s linear infinite',
                  }}
                />
              </div>

              {/* Title */}
              <span className="font-display text-[11px] font-semibold text-accent-primary uppercase tracking-wider flex-1">
                {language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?'}
              </span>

              {/* Next */}
              <button
                onClick={nextWord}
                className="p-1 rounded-md text-text-tertiary hover:text-accent-primary hover:bg-white/5 transition-all"
                title={language === 'fr' ? 'Suivant' : 'Next'}
              >
                <RefreshCw className="w-3 h-3" />
              </button>

              {/* Close */}
              <button
                onClick={handleClose}
                className="p-1 rounded-md text-text-tertiary hover:text-red-400 hover:bg-white/5 transition-all"
                title={language === 'fr' ? 'Fermer' : 'Close'}
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Concept card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={displayedWord.term}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Term */}
                <div className="flex items-start gap-1.5 mb-1">
                  <span className="text-xs flex-shrink-0 mt-0.5">{catIcon}</span>
                  <button
                    onClick={handleTermClick}
                    disabled={!isClickable}
                    className={`font-display text-sm font-semibold text-text-primary text-left leading-tight ${
                      isClickable ? 'hover:text-accent-primary cursor-pointer transition-colors' : ''
                    }`}
                  >
                    {displayedWord.term}
                  </button>
                </div>

                {/* Definition */}
                <p className="text-[11px] text-text-secondary leading-relaxed pl-5">
                  {expanded ? displayedWord.definition : displayedWord.shortDefinition}
                </p>

                {/* Footer actions */}
                <div className="flex items-center gap-3 mt-1.5 pl-5">
                  {displayedWord.definition !== displayedWord.shortDefinition && (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="flex items-center gap-0.5 text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
                    >
                      {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                      {expanded
                        ? (language === 'fr' ? 'Moins' : 'Less')
                        : (language === 'fr' ? 'Plus' : 'More')}
                    </button>
                  )}
                  {displayedWord.wikiUrl && (
                    <a
                      href={displayedWord.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[10px] text-text-tertiary hover:text-accent-info transition-colors"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Source
                    </a>
                  )}
                  {displayedWord.source === 'history' && (
                    <span className="text-[9px] text-accent-primary/50 ml-auto">
                      📜 {language === 'fr' ? 'Vos analyses' : 'Your analyses'}
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Subtle gold top border glow */}
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
        </div>

        {/* Keyframes for spinner */}
        <style>{`
          @keyframes dyk-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
};

export default DidYouKnowCard;
