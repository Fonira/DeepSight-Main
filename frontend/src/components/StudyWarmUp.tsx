/**
 * StudyWarmUp — Carte dashed "Warm-Up" avant le début de l'étude.
 * Auto-flip après 3s. Skippable. Même animation 3D flip que les flashcards.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { useLoadingWord } from '../contexts/LoadingWordContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { LoadingWord } from '../contexts/LoadingWordContext';

const CAT_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

interface StudyWarmUpProps {
  category?: string;
  onStart: () => void;
}

export const StudyWarmUp: React.FC<StudyWarmUpProps> = ({ category, onStart }) => {
  const { getWordByFilter, currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const [flipped, setFlipped] = useState(false);
  const [word, setWord] = useState<LoadingWord | null>(null);

  // Get a word matching the category if possible
  useEffect(() => {
    const w = category
      ? getWordByFilter({ category }) || getWordByFilter({})
      : getWordByFilter({});
    setWord(w || currentWord);
  }, [category, getWordByFilter, currentWord]);

  // Auto-flip after 3s
  useEffect(() => {
    const timer = setTimeout(() => setFlipped(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Skip on any keypress
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart]);

  if (!word) {
    // No word available, skip warm-up
    onStart();
    return null;
  }

  const catIcon = CAT_ICONS[word.category] || '📚';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 sm:py-16"
    >
      {/* 3D Flip Card */}
      <div
        className="relative w-72 sm:w-80 h-48 cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(!flipped)}
      >
        <div
          className="relative w-full h-full transition-transform duration-500 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent-primary/25 bg-bg-secondary/60 backdrop-blur-sm p-6"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <Lightbulb className="w-8 h-8 text-accent-primary/50 mb-3" />
            <p className="text-sm font-display font-semibold text-text-primary uppercase tracking-wider">
              {language === 'fr' ? 'Échauffement' : 'Warm-Up'}
            </p>
            <p className="text-[11px] text-text-muted mt-2">
              {language === 'fr' ? 'Retourne la carte...' : 'Flip the card...'}
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent-primary/25 bg-bg-secondary/60 backdrop-blur-sm p-6 text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="text-lg mb-2">{catIcon}</span>
            <p className="font-display text-base font-semibold text-text-primary mb-2">
              {word.term}
            </p>
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
              {word.shortDefinition}
            </p>
            {word.source === 'history' && (
              <p className="text-[9px] text-accent-primary/40 mt-2">
                📜 {language === 'fr' ? 'Vos analyses' : 'Your analyses'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        className="mt-8 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-sm font-medium transition-all border border-accent-primary/20 hover:border-accent-primary/40"
      >
        {language === 'fr' ? 'Commencer l\'étude' : 'Start studying'}
        <ArrowRight className="w-4 h-4" />
      </button>

      <p className="text-[10px] text-text-muted/50 mt-3">
        {language === 'fr' ? 'Appuyez sur Entrée pour passer' : 'Press Enter to skip'}
      </p>
    </motion.div>
  );
};

export default StudyWarmUp;
