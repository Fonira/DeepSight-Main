/**
 * SidebarInsight — Pulse compact dans la sidebar.
 * Même poids visuel qu'un nav item. Barre dorée gauche + icône + terme.
 * Tooltip au hover avec shortDefinition. Collapsed = icône seule.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoadingWord } from '../contexts/LoadingWordContext';
import { useLanguage } from '../contexts/LanguageContext';

const CAT_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

const ROTATION_INTERVAL = 120_000;

interface SidebarInsightProps {
  collapsed?: boolean;
}

export const SidebarInsight: React.FC<SidebarInsightProps> = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const { currentWord, nextWord } = useLoadingWord();
  const { language } = useLanguage();
  const [localWord, setLocalWord] = useState(currentWord);
  const [showTooltip, setShowTooltip] = useState(false);

  // Use a separate slower rotation for sidebar
  useEffect(() => {
    setLocalWord(currentWord);
  }, [currentWord]);

  useEffect(() => {
    const timer = setInterval(() => {
      nextWord();
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [nextWord]);

  const handleClick = useCallback(() => {
    if (localWord?.source === 'history' && localWord?.summaryId) {
      navigate(`/dashboard?id=${localWord.summaryId}`);
    } else if (localWord?.wikiUrl) {
      window.open(localWord.wikiUrl, '_blank', 'noopener,noreferrer');
    }
  }, [localWord, navigate]);

  if (!localWord) return null;

  const catIcon = CAT_ICONS[localWord.category] || '📚';
  const isClickable = (localWord.source === 'history' && localWord.summaryId) || localWord.wikiUrl;

  if (collapsed) {
    return (
      <div className="px-2 py-2 relative group">
        <button
          onClick={handleClick}
          className="w-full flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-accent-primary hover:bg-white/5 transition-all border-l-[3px] border-accent-primary/30"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span className="text-sm">{catIcon}</span>
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-56 p-3 rounded-xl bg-bg-elevated border border-border-subtle shadow-lg shadow-black/30">
            <p className="font-display text-xs font-semibold text-text-primary mb-1">
              {localWord.term}
            </p>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {localWord.shortDefinition}
            </p>
            {localWord.source === 'history' && (
              <p className="text-[9px] text-accent-primary/50 mt-1.5">
                📜 {language === 'fr' ? 'Vos analyses' : 'Your analyses'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 relative group">
      <button
        onClick={handleClick}
        disabled={!isClickable}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-[3px] border-accent-primary/30 transition-all duration-200 ${
          isClickable
            ? 'hover:bg-white/5 hover:border-accent-primary/60 cursor-pointer'
            : ''
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-xs flex-shrink-0">{catIcon}</span>
        <span className="text-[11px] text-text-tertiary group-hover:text-text-secondary transition-colors truncate font-medium">
          {localWord.term}
        </span>
      </button>

      {/* Tooltip with definition */}
      {showTooltip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-56 p-3 rounded-xl bg-bg-elevated border border-border-subtle shadow-lg shadow-black/30">
          <p className="font-display text-xs font-semibold text-text-primary mb-1">
            {localWord.term}
          </p>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {localWord.shortDefinition}
          </p>
          {localWord.source === 'history' && (
            <p className="text-[9px] text-accent-primary/50 mt-1.5">
              📜 {language === 'fr' ? 'Vos analyses' : 'Your analyses'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SidebarInsight;
