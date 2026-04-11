/**
 * LoadingInsight — "Knowledge Drip" pendant le chargement d'analyse.
 * Typewriter effect, rotation toutes les 15s.
 * S'insère dans le loading state existant du DashboardPage.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoadingWord } from '../contexts/LoadingWordContext';
import { useLanguage } from '../contexts/LanguageContext';

const CAT_ICONS: Record<string, string> = {
  cognitive_bias: '🧠', science: '🔬', philosophy: '🎭', culture: '🌍',
  misc: '✨', history: '📜', technology: '⚡', person: '👤',
  company: '🏢', concept: '💡', event: '📅', place: '📍',
  psychology: '🧩', economics: '💰', art: '🎨', nature: '🌿',
};

const ROTATION_INTERVAL = 15_000;
const TYPEWRITER_SPEED = 18; // ms per char

export const LoadingInsight: React.FC = () => {
  const { currentWord, nextWord } = useLoadingWord();
  const { language } = useLanguage();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [wordKey, setWordKey] = useState(0);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  const fullText = currentWord
    ? `«${currentWord.term}» — ${currentWord.shortDefinition}`
    : '';

  // Typewriter effect
  const startTypewriter = useCallback((text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    typewriterRef.current = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        setIsTyping(false);
      }
    }, TYPEWRITER_SPEED);
  }, []);

  // Start typewriter when word changes
  useEffect(() => {
    if (fullText) {
      startTypewriter(fullText);
    }
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [fullText, startTypewriter, wordKey]);

  // Auto-rotation
  useEffect(() => {
    const timer = setInterval(() => {
      nextWord();
      setWordKey(k => k + 1);
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [nextWord]);

  if (!currentWord) return null;

  const catIcon = CAT_ICONS[currentWord.category] || '📚';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={wordKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4 max-w-md mx-auto text-center"
      >
        <p className="text-xs text-text-muted leading-relaxed">
          <span className="mr-1">{catIcon}</span>
          <span className="font-body">
            {displayedText}
            {isTyping && (
              <span className="inline-block w-0.5 h-3 bg-accent-primary/60 ml-0.5 animate-pulse" />
            )}
          </span>
        </p>
        {!isTyping && currentWord.wikiUrl && (
          <a
            href={currentWord.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-text-muted/50 hover:text-accent-info transition-colors mt-1 inline-block"
          >
            {language === 'fr' ? 'En savoir plus' : 'Learn more'} →
          </a>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default LoadingInsight;
