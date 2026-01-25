/**
 * 🧠 LOADING WORD COMPONENT — Widget "Le Saviez-Vous"
 * Affiche un mot éducatif avec sa définition pendant les chargements
 * - Design Deep Sight (cyan/gold)
 * - Animation fade-in/fade-out
 * - Mode expand/collapse pour la définition complète
 * - Support bilingue FR/EN
 */

import React, { useState, useEffect } from 'react';
import { useLoadingWord, LoadingWord as LoadingWordType } from '../contexts/LoadingWordContext';
import { useLanguage } from '../contexts/LanguageContext';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LoadingWordProps {
  className?: string;
  compact?: boolean;
  showCategory?: boolean;
  showSource?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CATEGORY ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_ICONS: Record<string, string> = {
  cognitive_bias: '🧠',
  science: '🔬',
  philosophy: '🎭',
  culture: '🌍',
  misc: '✨',
};

const CATEGORY_LABELS_FR: Record<string, string> = {
  cognitive_bias: 'Biais cognitif',
  science: 'Science',
  philosophy: 'Philosophie',
  culture: 'Culture',
  misc: 'Divers',
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  cognitive_bias: 'Cognitive bias',
  science: 'Science',
  philosophy: 'Philosophy',
  culture: 'Culture',
  misc: 'Miscellaneous',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordWidget: React.FC<LoadingWordProps> = ({
  className = '',
  compact = false,
  showCategory = true,
  showSource = false,
}) => {
  const { currentWord, isLoading, refreshWord } = useLoadingWord();
  const { language, t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [displayedWord, setDisplayedWord] = useState<LoadingWordType | null>(null);

  // Animation de transition quand le mot change
  useEffect(() => {
    if (currentWord && currentWord.term !== displayedWord?.term) {
      // Fade out
      setIsVisible(false);

      // Attendre la fin du fade out, puis changer le mot et fade in
      const timeout = setTimeout(() => {
        setDisplayedWord(currentWord);
        setIsExpanded(false);
        setIsVisible(true);
      }, 300);

      return () => clearTimeout(timeout);
    } else if (currentWord && !displayedWord) {
      setDisplayedWord(currentWord);
      setIsVisible(true);
    }
  }, [currentWord, displayedWord]);

  // Textes localisés
  const didYouKnow = language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?';
  const learnMore = language === 'fr' ? 'En savoir plus' : 'Learn more';
  const showLess = language === 'fr' ? 'Réduire' : 'Show less';
  const fromHistory = language === 'fr' ? 'Issu de vos analyses' : 'From your analyses';
  const categoryLabels = language === 'fr' ? CATEGORY_LABELS_FR : CATEGORY_LABELS_EN;

  if (!displayedWord) {
    return null;
  }

  const categoryIcon = CATEGORY_ICONS[displayedWord.category] || '📚';
  const categoryLabel = categoryLabels[displayedWord.category] || displayedWord.category;

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        bg-gradient-to-br from-bg-secondary/80 to-bg-tertiary/60
        border border-accent-primary/20
        backdrop-blur-sm
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-accent-primary/10">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label="lightbulb">💡</span>
          <span className="text-sm font-medium text-accent-primary">
            {didYouKnow}
          </span>
        </div>

        {showCategory && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <span role="img" aria-label={categoryLabel}>{categoryIcon}</span>
            {!compact && <span>{categoryLabel}</span>}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Term */}
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          <span className="text-accent-secondary">«</span>
          <span className="mx-1">{displayedWord.term}</span>
          <span className="text-accent-secondary">»</span>
        </h3>

        {/* Definition */}
        <p className={`
          text-sm text-text-secondary leading-relaxed
          transition-all duration-300 ease-in-out
          ${isExpanded ? '' : 'line-clamp-2'}
        `}>
          {isExpanded ? displayedWord.definition : displayedWord.shortDefinition}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-bg-tertiary/50">
          {/* Expand/Collapse button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-accent-primary hover:text-accent-hover transition-colors"
          >
            {isExpanded ? showLess : learnMore}
          </button>

          <div className="flex items-center gap-3">
            {/* Source indicator */}
            {showSource && displayedWord.source === 'history' && (
              <span className="text-xs text-accent-secondary flex items-center gap-1">
                <span role="img" aria-label="history">📜</span>
                {fromHistory}
              </span>
            )}

            {/* Wiki link */}
            {displayedWord.wikiUrl && (
              <a
                href={displayedWord.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-tertiary hover:text-accent-primary transition-colors"
                title="Wikipedia"
              >
                🔗 Wiki
              </a>
            )}

            {/* Refresh button */}
            <button
              onClick={refreshWord}
              disabled={isLoading}
              className={`
                text-text-tertiary hover:text-accent-primary transition-colors
                ${isLoading ? 'animate-spin' : ''}
              `}
              title={language === 'fr' ? 'Nouveau mot' : 'New word'}
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Decorative gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary opacity-50" />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPACT VERSION (pour les spinners)
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordCompact: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();

  if (!currentWord) {
    return null;
  }

  const didYouKnow = language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?';

  return (
    <div className={`text-center max-w-md mx-auto ${className}`}>
      <p className="text-xs text-accent-primary mb-1">💡 {didYouKnow}</p>
      <p className="text-sm text-text-primary font-medium">
        <span className="text-accent-secondary">«</span>
        {currentWord.term}
        <span className="text-accent-secondary">»</span>
      </p>
      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
        {currentWord.shortDefinition}
      </p>
    </div>
  );
};

export default LoadingWordWidget;
