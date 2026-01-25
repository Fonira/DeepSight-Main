/**
 * 🧠 LOADING WORD COMPONENT V2 — Widget "Le Saviez-Vous"
 *
 * Fonctionnalités:
 * - Affiche un mot-clé avec sa définition
 * - Design Deep Sight (cyan/gold)
 * - Animation fade-in/fade-out
 * - NOUVEAU: Cliquable → navigation vers l'analyse source
 * - Mode expand/collapse pour la définition complète
 * - Support bilingue FR/EN
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  history: '📜',
  technology: '⚡',
  person: '👤',
  company: '🏢',
  concept: '💡',
  event: '📅',
  place: '📍',
};

const CATEGORY_LABELS_FR: Record<string, string> = {
  cognitive_bias: 'Biais cognitif',
  science: 'Science',
  philosophy: 'Philosophie',
  culture: 'Culture',
  misc: 'Divers',
  history: 'Historique',
  technology: 'Technologie',
  person: 'Personne',
  company: 'Entreprise',
  concept: 'Concept',
  event: 'Événement',
  place: 'Lieu',
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  cognitive_bias: 'Cognitive bias',
  science: 'Science',
  philosophy: 'Philosophy',
  culture: 'Culture',
  misc: 'Miscellaneous',
  history: 'History',
  technology: 'Technology',
  person: 'Person',
  company: 'Company',
  concept: 'Concept',
  event: 'Event',
  place: 'Place',
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN WIDGET COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordWidget: React.FC<LoadingWordProps> = ({
  className = '',
  compact = false,
  showCategory = true,
  showSource = false,
}) => {
  const navigate = useNavigate();
  const { currentWord, isLoading, refreshWord, hasHistory } = useLoadingWord();
  const { language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [displayedWord, setDisplayedWord] = useState<LoadingWordType | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Animation de transition quand le mot change
  useEffect(() => {
    if (currentWord && currentWord.term !== displayedWord?.term) {
      setIsVisible(false);
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
  const fromHistory = language === 'fr' ? 'De vos analyses' : 'From your analyses';
  const clickToView = language === 'fr' ? 'Cliquez pour voir l\'analyse' : 'Click to view analysis';
  const categoryLabels = language === 'fr' ? CATEGORY_LABELS_FR : CATEGORY_LABELS_EN;

  if (!displayedWord) {
    return null;
  }

  const categoryIcon = CATEGORY_ICONS[displayedWord.category] || '📚';
  const categoryLabel = categoryLabels[displayedWord.category] || displayedWord.category;
  const isClickable = displayedWord.source === 'history' && displayedWord.summaryId;

  // Navigation vers l'analyse source
  const handleTermClick = () => {
    if (isClickable && displayedWord.summaryId) {
      navigate(`/dashboard?id=${displayedWord.summaryId}`);
    }
  };

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

        <div className="flex items-center gap-2">
          {/* Source badge */}
          {displayedWord.source === 'history' && (
            <span className="text-xs bg-accent-secondary/20 text-accent-secondary px-2 py-0.5 rounded-full">
              📜 {fromHistory}
            </span>
          )}

          {showCategory && displayedWord.source === 'local' && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <span role="img" aria-label={categoryLabel}>{categoryIcon}</span>
              {!compact && <span>{categoryLabel}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Term - Cliquable si de l'historique */}
        <h3
          onClick={handleTermClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`
            text-lg font-semibold text-text-primary mb-2
            transition-all duration-200
            ${isClickable
              ? 'cursor-pointer hover:text-accent-primary group'
              : ''
            }
          `}
          title={isClickable ? clickToView : undefined}
        >
          <span className="text-accent-secondary">«</span>
          <span className={`
            mx-1
            ${isClickable ? 'underline decoration-dotted decoration-accent-primary/50 hover:decoration-solid' : ''}
          `}>
            {displayedWord.term}
          </span>
          <span className="text-accent-secondary">»</span>

          {/* Indicateur cliquable */}
          {isClickable && isHovered && (
            <span className="ml-2 text-xs text-accent-primary animate-pulse">
              → {language === 'fr' ? 'Voir' : 'View'}
            </span>
          )}
        </h3>

        {/* Video title si de l'historique */}
        {displayedWord.source === 'history' && displayedWord.videoTitle && (
          <p className="text-xs text-text-tertiary mb-2 italic truncate">
            📹 {displayedWord.videoTitle}
          </p>
        )}

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
          {/* Expand/Collapse ou Voir l'analyse */}
          <div className="flex items-center gap-3">
            {displayedWord.source === 'local' && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-accent-primary hover:text-accent-hover transition-colors"
              >
                {isExpanded ? showLess : learnMore}
              </button>
            )}

            {isClickable && (
              <button
                onClick={handleTermClick}
                className="text-xs bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 px-3 py-1 rounded-full transition-colors"
              >
                📊 {language === 'fr' ? 'Voir l\'analyse' : 'View analysis'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Wiki link (seulement pour les mots locaux) */}
            {displayedWord.wikiUrl && displayedWord.source === 'local' && (
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
// 🎯 COMPACT VERSION (pour les spinners et positions fixes)
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordCompact: React.FC<{ className?: string }> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { currentWord, refreshWord, isLoading } = useLoadingWord();
  const { language } = useLanguage();

  if (!currentWord) {
    return null;
  }

  const didYouKnow = language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?';
  const isClickable = currentWord.source === 'history' && currentWord.summaryId;

  const handleClick = () => {
    if (isClickable && currentWord.summaryId) {
      navigate(`/dashboard?id=${currentWord.summaryId}`);
    }
  };

  return (
    <div className={`
      bg-bg-secondary/90 backdrop-blur-sm rounded-lg border border-accent-primary/20 p-3
      transition-all duration-300 hover:border-accent-primary/40
      ${className}
    `}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-accent-primary flex items-center gap-1">
          💡 {didYouKnow}
        </p>
        <button
          onClick={refreshWord}
          disabled={isLoading}
          className={`text-xs text-text-tertiary hover:text-accent-primary ${isLoading ? 'animate-spin' : ''}`}
        >
          🔄
        </button>
      </div>

      <p
        onClick={handleClick}
        className={`
          text-sm text-text-primary font-medium
          ${isClickable ? 'cursor-pointer hover:text-accent-primary transition-colors' : ''}
        `}
      >
        <span className="text-accent-secondary">«</span>
        <span className={isClickable ? 'underline decoration-dotted' : ''}>
          {currentWord.term}
        </span>
        <span className="text-accent-secondary">»</span>
      </p>

      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
        {currentWord.shortDefinition}
      </p>

      {currentWord.source === 'history' && (
        <p className="text-xs text-accent-secondary mt-2 flex items-center gap-1">
          📜 {language === 'fr' ? 'De vos analyses' : 'From your analyses'}
          {isClickable && (
            <span className="text-accent-primary ml-1">→</span>
          )}
        </p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 GLOBAL FIXED WIDGET (pour App.tsx) — AVEC EXPANSION POUR DÉFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordGlobal: React.FC = () => {
  const navigate = useNavigate();
  const { currentWord, refreshWord, isLoading } = useLoadingWord();
  const { language } = useLanguage();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (!currentWord) {
    return null;
  }

  const didYouKnow = language === 'fr' ? 'Le saviez-vous ?' : 'Did you know?';
  const isClickable = currentWord.source === 'history' && currentWord.summaryId;
  const hasFullDefinition = currentWord.definition && currentWord.definition.length > 80;

  const handleClick = () => {
    if (isClickable && currentWord.summaryId) {
      navigate(`/dashboard?id=${currentWord.summaryId}`);
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-accent-primary text-white p-3 rounded-full shadow-lg hover:bg-accent-hover transition-colors"
        title={didYouKnow}
      >
        💡
      </button>
    );
  }

  return (
    <div className={`
      fixed bottom-4 right-4 z-50
      bg-bg-secondary/95 backdrop-blur-md rounded-xl border border-accent-primary/30
      shadow-2xl shadow-accent-primary/10
      transition-all duration-300 ease-in-out
      ${isMinimized ? 'w-auto' : isExpanded ? 'w-96 max-h-[60vh]' : 'w-80'}
      hidden lg:block
      overflow-hidden
    `}>
      {/* Header with controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-accent-primary/10 bg-bg-secondary/50">
        <span className="text-xs font-medium text-accent-primary flex items-center gap-1">
          💡 {didYouKnow}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={refreshWord}
            disabled={isLoading}
            className={`text-xs p-1 text-text-tertiary hover:text-accent-primary ${isLoading ? 'animate-spin' : ''}`}
            title={language === 'fr' ? 'Nouveau mot' : 'New word'}
          >
            🔄
          </button>
          {hasFullDefinition && !isMinimized && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs p-1 text-text-tertiary hover:text-accent-primary"
              title={isExpanded ? (language === 'fr' ? 'Réduire' : 'Collapse') : (language === 'fr' ? 'Agrandir' : 'Expand')}
            >
              {isExpanded ? '🔽' : '🔼'}
            </button>
          )}
          <button
            onClick={() => { setIsMinimized(!isMinimized); setIsExpanded(false); }}
            className="text-xs p-1 text-text-tertiary hover:text-accent-primary"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '⬆️' : '⬇️'}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-xs p-1 text-text-tertiary hover:text-red-400"
            title={language === 'fr' ? 'Fermer' : 'Close'}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content (hidden when minimized) */}
      {!isMinimized && (
        <div className={`p-3 ${isExpanded ? 'overflow-y-auto max-h-[50vh]' : ''}`}>
          {/* Term */}
          <p
            onClick={handleClick}
            className={`
              text-sm font-semibold text-text-primary mb-2
              ${isClickable ? 'cursor-pointer hover:text-accent-primary transition-colors' : ''}
            `}
          >
            <span className="text-accent-secondary">«</span>
            <span className={isClickable ? 'underline decoration-dotted decoration-accent-primary/50' : ''}>
              {currentWord.term}
            </span>
            <span className="text-accent-secondary">»</span>
          </p>

          {/* Definition */}
          <div className="text-xs text-text-secondary leading-relaxed">
            {isExpanded ? (
              // Full definition when expanded
              <p className="whitespace-pre-wrap">{currentWord.definition}</p>
            ) : (
              // Short definition with expand hint
              <>
                <p className="line-clamp-3">{currentWord.shortDefinition}</p>
                {hasFullDefinition && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="text-accent-primary hover:underline mt-1 flex items-center gap-1"
                  >
                    {language === 'fr' ? 'Lire la suite...' : 'Read more...'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Source: Video title (clickable) for history items, Category for local */}
          <div className="mt-2 pt-2 border-t border-bg-tertiary/50">
            {currentWord.source === 'history' && currentWord.videoTitle ? (
              <button
                onClick={handleClick}
                className="w-full text-left text-xs text-accent-secondary hover:text-accent-primary transition-colors group flex items-center gap-1"
                title={language === 'fr' ? 'Cliquez pour voir l\'analyse' : 'Click to view analysis'}
              >
                <span className="text-base">📹</span>
                <span className="truncate flex-1 underline decoration-dotted decoration-accent-primary/30 group-hover:decoration-solid">
                  {currentWord.videoTitle}
                </span>
                <span className="text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </button>
            ) : (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                📚 {currentWord.category ? CATEGORY_LABELS_FR[currentWord.category] || currentWord.category : (language === 'fr' ? 'Culture' : 'Knowledge')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Decorative line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary opacity-50 rounded-b-xl" />
    </div>
  );
};

export default LoadingWordWidget;
