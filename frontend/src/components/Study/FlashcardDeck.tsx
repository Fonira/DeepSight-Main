/**
 * 📇 FlashcardDeck — Swipeable Flashcard Component
 * Cartes à retourner avec gestes swipe gauche/droite
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Check, X, Layers, BookOpen } from 'lucide-react';
import type { StudyFlashcardItem } from '../../services/api';
import { ProgressBar } from './ProgressBar';

interface FlashcardDeckProps {
  flashcards: StudyFlashcardItem[];
  title: string;
  onComplete?: (known: number, unknown: number) => void;
  onExit?: () => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  flashcards,
  title,
  onComplete,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<number[]>([]);
  const [unknownCards, setUnknownCards] = useState<number[]>([]);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentCard = flashcards[currentIndex];
  const isCompleted = knownCards.length + unknownCards.length === flashcards.length;

  // Handle swipe
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    
    setTimeout(() => {
      if (direction === 'right') {
        setKnownCards(prev => [...prev, currentIndex]);
      } else {
        setUnknownCards(prev => [...prev, currentIndex]);
      }
      
      const nextIndex = currentIndex + 1;
      if (nextIndex < flashcards.length) {
        setCurrentIndex(nextIndex);
        setIsFlipped(false);
      }
      
      setSwipeDirection(null);
      setTouchDelta(0);
    }, 300);
  }, [currentIndex, flashcards.length]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const delta = e.touches[0].clientX - touchStart;
    setTouchDelta(delta);
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > 100) {
      handleSwipe(touchDelta > 0 ? 'right' : 'left');
    } else {
      setTouchDelta(0);
    }
    setTouchStart(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;
      
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          setIsFlipped(!isFlipped);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSwipe('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSwipe('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isCompleted, handleSwipe]);

  // Trigger completion callback
  useEffect(() => {
    if (isCompleted && onComplete) {
      onComplete(knownCards.length, unknownCards.length);
    }
  }, [isCompleted, knownCards.length, unknownCards.length, onComplete]);

  // Reset for retry
  const handleRetry = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards([]);
    setUnknownCards([]);
  };

  // Review unknown cards
  const handleReviewUnknown = () => {
    // Reset to only unknown cards (would need to filter flashcards)
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards([]);
    setUnknownCards([]);
  };

  if (!currentCard && !isCompleted) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Aucune flashcard disponible</p>
      </div>
    );
  }

  // Completion screen
  if (isCompleted) {
    const percentage = flashcards.length > 0 
      ? Math.round((knownCards.length / flashcards.length) * 100) 
      : 0;

    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mb-6 shadow-lg">
          <Check className="text-white" size={40} />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Deck terminé !
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{title}</p>

        <div className="flex gap-8 mb-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-500">{knownCards.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Connues</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-500">{unknownCards.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">À revoir</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-500">{percentage}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Maîtrisé</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RotateCw size={18} />
            Tout revoir
          </button>
          {unknownCards.length > 0 && (
            <button
              onClick={handleReviewUnknown}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl font-medium hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
            >
              <BookOpen size={18} />
              Revoir les {unknownCards.length} difficiles
            </button>
          )}
          {onExit && (
            <button
              onClick={onExit}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Terminer
            </button>
          )}
        </div>
      </div>
    );
  }

  // Card transform based on swipe/touch
  const getCardStyle = () => {
    if (swipeDirection === 'left') {
      return { transform: 'translateX(-150%) rotate(-20deg)', opacity: 0, transition: 'all 0.3s ease-out' };
    }
    if (swipeDirection === 'right') {
      return { transform: 'translateX(150%) rotate(20deg)', opacity: 0, transition: 'all 0.3s ease-out' };
    }
    if (touchDelta !== 0) {
      const rotation = touchDelta / 15;
      return { transform: `translateX(${touchDelta}px) rotate(${rotation}deg)` };
    }
    return {};
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-500" size={20} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {currentCard?.category || 'Flashcards'}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Carte {currentIndex + 1} / {flashcards.length}
          </span>
        </div>
        <ProgressBar 
          current={knownCards.length + unknownCards.length}
          total={flashcards.length}
          variant="success"
          showLabel={false}
        />
      </div>

      {/* Flashcard */}
      <div 
        className="relative perspective-1000 h-80 mb-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe indicators */}
        <div 
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity ${
            touchDelta < -50 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
            <X className="text-white" size={24} />
          </div>
        </div>
        <div 
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity ${
            touchDelta > 50 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <Check className="text-white" size={24} />
          </div>
        </div>

        {/* Card */}
        <div
          ref={cardRef}
          onClick={() => setIsFlipped(!isFlipped)}
          style={getCardStyle()}
          className={`absolute inset-0 cursor-pointer transform-style-preserve-3d transition-transform duration-500 ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden">
            <div className="h-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center">
              <div className="text-xs uppercase tracking-wider text-blue-500 font-semibold mb-4">
                Question
              </div>
              <p className="text-xl text-center text-gray-800 dark:text-white font-medium leading-relaxed">
                {currentCard?.front}
              </p>
              <div className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-500">
                Cliquez pour retourner
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <div className="h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 flex flex-col items-center justify-center">
              <div className="text-xs uppercase tracking-wider text-blue-100 font-semibold mb-4">
                Réponse
              </div>
              <p className="text-xl text-center text-white font-medium leading-relaxed">
                {currentCard?.back}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => handleSwipe('left')}
          className="flex items-center gap-2 px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          <X size={20} />
          À revoir
        </button>
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <RotateCw className="text-gray-600 dark:text-gray-400" size={24} />
        </button>
        <button
          onClick={() => handleSwipe('right')}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
        >
          <Check size={20} />
          Connue
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">←</kbd>
          À revoir
        </span>
        <span className="mx-3">•</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">Espace</kbd>
          Retourner
        </span>
        <span className="mx-3">•</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">→</kbd>
          Connue
        </span>
      </div>
    </div>
  );
};

export default FlashcardDeck;
