/**
 * DEEP SIGHT — FlashcardDeck Component
 * Cartes flash interactives avec animation flip 3D
 * 
 * FONCTIONNALITÉS:
 * - 🔄 Animation flip 3D au clic
 * - ⬅️➡️ Navigation clavier (flèches)
 * - ✅❌ Marquer comme connu/à revoir
 * - 🔀 Shuffle
 * - 📊 Progression
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  RotateCcw, ChevronLeft, ChevronRight, Check, X,
  Shuffle, BookOpen, Sparkles
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Flashcard {
  front: string;
  back: string;
  id?: string | number;
}

interface FlashcardDeckProps {
  flashcards: Flashcard[];
  onComplete?: (stats: FlashcardStats) => void;
  onProgress?: (current: number, total: number, stats: FlashcardStats) => void;
  isLoading?: boolean;
  language?: 'fr' | 'en';
}

export interface FlashcardStats {
  known: number;
  unknown: number;
  total: number;
  percentage: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  flashcards,
  onComplete,
  onProgress,
  isLoading = false,
  language = 'fr',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<number>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  const t = {
    fr: {
      question: 'QUESTION',
      answer: 'RÉPONSE',
      tapToFlip: 'Cliquez pour voir la réponse',
      swipeHint: 'Utilisez les boutons ou les flèches du clavier',
      known: 'Maîtrisé',
      unknown: 'À revoir',
      shuffle: 'Mélanger',
      restart: 'Recommencer',
      loading: 'Génération des flashcards...',
      empty: 'Aucune flashcard disponible',
      completed: 'Félicitations !',
      completedSub: 'Vous avez terminé toutes les cartes',
      score: 'Score',
      reviewAgain: 'Revoir les cartes',
    },
    en: {
      question: 'QUESTION',
      answer: 'ANSWER',
      tapToFlip: 'Click to see the answer',
      swipeHint: 'Use buttons or arrow keys',
      known: 'Known',
      unknown: 'Review',
      shuffle: 'Shuffle',
      restart: 'Restart',
      loading: 'Generating flashcards...',
      empty: 'No flashcards available',
      completed: 'Congratulations!',
      completedSub: 'You have completed all cards',
      score: 'Score',
      reviewAgain: 'Review cards',
    },
  }[language];

  const getStats = useCallback((): FlashcardStats => {
    const known = knownCards.size;
    const unknown = unknownCards.size;
    return {
      known,
      unknown,
      total: flashcards.length,
      percentage: flashcards.length > 0 ? Math.round((known / flashcards.length) * 100) : 0,
    };
  }, [knownCards.size, unknownCards.size, flashcards.length]);

  // Report progress on change
  useEffect(() => {
    onProgress?.(currentIndex + 1, flashcards.length, getStats());
  }, [currentIndex, flashcards.length, onProgress, getStats]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;
      
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          handleFlip();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext('known');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNext('unknown');
          break;
        case 'ArrowUp':
          e.preventDefault();
          handlePrevious();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, isCompleted]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback((markAs?: 'known' | 'unknown') => {
    if (markAs === 'known') {
      setKnownCards((prev) => new Set(prev).add(currentIndex));
      setUnknownCards((prev) => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
    } else if (markAs === 'unknown') {
      setUnknownCards((prev) => new Set(prev).add(currentIndex));
      setKnownCards((prev) => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
    }

    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setIsCompleted(true);
      onComplete?.(getStats());
    }
  }, [currentIndex, flashcards.length, onComplete, getStats]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleShuffle = useCallback(() => {
    setCurrentIndex(0);
    setKnownCards(new Set());
    setUnknownCards(new Set());
    setIsFlipped(false);
    setIsCompleted(false);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4" />
        <p className="text-gray-400">{t.loading}</p>
      </div>
    );
  }

  // Empty state
  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BookOpen className="w-12 h-12 text-gray-500 mb-4" />
        <p className="text-gray-400">{t.empty}</p>
      </div>
    );
  }

  // Completed state
  if (isCompleted) {
    const stats = getStats();
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center">
          <Sparkles className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">{t.completed}</h3>
          <p className="text-gray-400 mb-6">{t.completedSub}</p>
          
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{stats.known}</div>
              <div className="text-sm text-gray-400">{t.known}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">{stats.unknown}</div>
              <div className="text-sm text-gray-400">{t.unknown}</div>
            </div>
          </div>

          <div className="text-lg text-gray-300 mb-6">
            {t.score}: <span className="text-amber-400 font-bold">{stats.percentage}%</span>
          </div>

          <button
            onClick={handleShuffle}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 
                     text-amber-400 rounded-lg transition-colors mx-auto"
          >
            <RotateCcw className="w-5 h-5" />
            {t.reviewAgain}
          </button>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm text-gray-400">
            {currentIndex + 1} / {flashcards.length}
          </span>
          <div className="flex gap-3">
            <span className="flex items-center gap-1 text-sm text-emerald-400">
              <Check className="w-4 h-4" />
              {knownCards.size}
            </span>
            <span className="flex items-center gap-1 text-sm text-red-400">
              <X className="w-4 h-4" />
              {unknownCards.size}
            </span>
          </div>
        </div>
      </div>

      {/* Swipe hints */}
      <div className="flex justify-between px-4 mb-2 text-xs">
        <span className="flex items-center gap-1 text-red-400">
          <ChevronLeft className="w-4 h-4" />
          {t.unknown}
        </span>
        <span className="flex items-center gap-1 text-emerald-400">
          {t.known}
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center perspective-1000 min-h-[300px]">
        <div
          className={`relative w-full max-w-lg aspect-[3/4] cursor-pointer preserve-3d transition-transform duration-500 ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          onClick={handleFlip}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 glass-panel rounded-2xl p-6 flex flex-col items-center justify-center
                       border-2 border-amber-500/30 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full 
                          bg-amber-500/20 text-amber-400 text-xs font-semibold">
              {t.question}
            </div>
            <p className="text-lg text-center text-white leading-relaxed">
              {currentCard.front}
            </p>
            <p className="absolute bottom-4 text-xs text-gray-500">
              {t.tapToFlip}
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 glass-panel rounded-2xl p-6 flex flex-col items-center justify-center
                       border-2 border-emerald-500/30 rotate-y-180 backface-hidden"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full 
                          bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              {t.answer}
            </div>
            <p className="text-lg text-center text-white leading-relaxed">
              {currentCard.back}
            </p>
            <p className="absolute bottom-4 text-xs text-gray-500">
              {t.swipeHint}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-700 transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-6 h-6 text-gray-300" />
        </button>

        <button
          onClick={() => handleNext('unknown')}
          className="p-4 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
        >
          <X className="w-6 h-6 text-red-400" />
        </button>

        <button
          onClick={handleShuffle}
          className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-700 transition-colors"
        >
          <Shuffle className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => handleNext('known')}
          className="p-4 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
        >
          <Check className="w-6 h-6 text-emerald-400" />
        </button>

        <button
          onClick={() => handleNext()}
          disabled={currentIndex === flashcards.length - 1}
          className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-700 transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-6 h-6 text-gray-300" />
        </button>
      </div>
    </div>
  );
};

export default FlashcardDeck;
