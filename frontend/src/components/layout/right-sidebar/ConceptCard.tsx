/**
 * ConceptCard — "Le Saviez-Vous?" embedded widget for the right sidebar.
 * Consumes LoadingWordContext for concept rotation.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useLoadingWord } from '../../../contexts/LoadingWordContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import type { LoadingWord } from '../../../contexts/LoadingWordContext';

const CATEGORY_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
};

export const ConceptCard: React.FC = () => {
  const navigate = useNavigate();
  const { currentWord, nextWord, setEmbeddedMode } = useLoadingWord();
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayedWord, setDisplayedWord] = useState<LoadingWord | null>(null);

  // Activate embedded mode on mount — hides the floating widget
  useEffect(() => {
    setEmbeddedMode(true);
    return () => setEmbeddedMode(false);
  }, [setEmbeddedMode]);

  // Animate word transitions
  useEffect(() => {
    if (currentWord && currentWord.term !== displayedWord?.term) {
      setDisplayedWord(currentWord);
      setIsExpanded(false);
    } else if (currentWord && !displayedWord) {
      setDisplayedWord(currentWord);
    }
  }, [currentWord, displayedWord]);

  if (!displayedWord) return null;

  const categoryIcon = CATEGORY_ICONS[displayedWord.category] || '📚';
  const isClickable = displayedWord.source === 'history' && displayedWord.summaryId;

  const handleTermClick = () => {
    if (isClickable && displayedWord.summaryId) {
      navigate(`/dashboard?id=${displayedWord.summaryId}`);
    }
  };

  return (
    <div className="space-y-2">
      {/* Section title */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xs font-semibold text-accent-primary uppercase tracking-wider">
          {language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?'}
        </h3>
        <button
          onClick={nextWord}
          className="p-1 rounded-md text-text-tertiary hover:text-accent-primary hover:bg-white/5 transition-all"
          title={language === 'fr' ? 'Suivant' : 'Next'}
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Concept card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={displayedWord.term}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl bg-white/[0.03] border border-border-subtle p-3 space-y-2"
        >
          {/* Term */}
          <div className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">{categoryIcon}</span>
            <button
              onClick={handleTermClick}
              className={`font-display text-sm font-semibold text-text-primary text-left leading-tight ${
                isClickable ? 'hover:text-accent-primary cursor-pointer transition-colors' : ''
              }`}
            >
              {displayedWord.term}
            </button>
          </div>

          {/* Short definition */}
          <p className="text-xs text-text-secondary leading-relaxed">
            {isExpanded ? displayedWord.definition : displayedWord.shortDefinition}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {displayedWord.definition !== displayedWord.shortDefinition && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {isExpanded
                  ? (language === 'fr' ? 'Réduire' : 'Less')
                  : (language === 'fr' ? 'En savoir plus' : 'More')}
              </button>
            )}
            {displayedWord.wikiUrl && (
              <a
                href={displayedWord.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent-info transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Source
              </a>
            )}
          </div>

          {/* Source badge */}
          {displayedWord.source === 'history' && (
            <div className="text-[10px] text-accent-primary/60 flex items-center gap-1">
              <span>📜</span>
              {language === 'fr' ? 'De vos analyses' : 'From your analyses'}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
