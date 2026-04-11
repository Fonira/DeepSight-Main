/**
 * DashboardInsight — Bandeau "Savoir du Jour" style pull-quote magazine.
 * Full-width horizontal entre deux lignes dorées. Pas une card.
 * Rotation toutes les 90s avec morph Framer Motion.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useLoadingWord } from '../contexts/LoadingWordContext';
import { useLanguage } from '../contexts/LanguageContext';

const CAT_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

const ROTATION_INTERVAL = 90_000;

export const DashboardInsight: React.FC = () => {
  const navigate = useNavigate();
  const { currentWord, nextWord } = useLoadingWord();
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  // Auto-rotation
  useEffect(() => {
    const timer = setInterval(() => {
      nextWord();
      setExpanded(false);
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [nextWord]);

  const handleTermClick = useCallback(() => {
    if (currentWord?.source === 'history' && currentWord?.summaryId) {
      navigate(`/dashboard?id=${currentWord.summaryId}`);
    }
  }, [currentWord, navigate]);

  if (!currentWord) return null;

  const catIcon = CAT_ICONS[currentWord.category] || '📚';
  const isClickable = currentWord.source === 'history' && currentWord.summaryId;
  const hasLongDef = currentWord.definition !== currentWord.shortDefinition;

  return (
    <div className="my-6 sm:my-8">
      {/* Top gold rule */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent mb-5" />

      <div className="flex items-center justify-center gap-3 px-4">
        {/* Refresh (left, subtle) */}
        <button
          onClick={() => { nextWord(); setExpanded(false); }}
          className="p-1.5 rounded-lg text-text-muted hover:text-accent-primary hover:bg-white/5 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
          title={language === 'fr' ? 'Suivant' : 'Next'}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentWord.term}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="text-center max-w-3xl"
          >
            {/* Term + short definition on one line */}
            <div className="flex items-center justify-center gap-3 text-sm sm:text-base leading-relaxed text-text-secondary">
              {currentWord.imageUrl ? (
                <img
                  src={currentWord.imageUrl}
                  alt={currentWord.term}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  style={{ border: '2px solid #C8903A' }}
                  loading="lazy"
                />
              ) : (
                <span className="mr-1.5">{catIcon}</span>
              )}
              <p>
                <button
                  onClick={handleTermClick}
                  disabled={!isClickable}
                  className={`font-display text-base sm:text-lg font-semibold text-text-primary ${
                    isClickable ? 'hover:text-accent-primary cursor-pointer transition-colors' : ''
                  }`}
                >
                  {currentWord.term}
                </button>
                <span className="mx-2 text-accent-primary/40">—</span>
                <span className="font-body">{currentWord.shortDefinition}</span>
              </p>
            </div>

            {/* Expanded definition */}
            <AnimatePresence>
              {expanded && hasLongDef && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs sm:text-sm text-text-tertiary mt-2 leading-relaxed overflow-hidden"
                >
                  {currentWord.definition}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Actions row */}
            <div className="flex items-center justify-center gap-4 mt-2">
              {hasLongDef && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent-primary transition-colors"
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expanded
                    ? (language === 'fr' ? 'Moins' : 'Less')
                    : (language === 'fr' ? 'En savoir plus' : 'Learn more')}
                </button>
              )}
              {currentWord.wikiUrl && (
                <a
                  href={currentWord.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent-info transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Source
                </a>
              )}
              {currentWord.source === 'history' && (
                <span className="text-[10px] text-accent-primary/40">
                  📜 {language === 'fr' ? 'Vos analyses' : 'Your analyses'}
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Refresh (right, subtle) */}
        <button
          onClick={() => { nextWord(); setExpanded(false); }}
          className="p-1.5 rounded-lg text-text-muted hover:text-accent-primary hover:bg-white/5 transition-all flex-shrink-0"
          title={language === 'fr' ? 'Suivant' : 'Next'}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom gold rule */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent mt-5" />
    </div>
  );
};

export default DashboardInsight;
