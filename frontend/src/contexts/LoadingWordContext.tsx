/**
 * 🧠 LOADING WORD CONTEXT — Widget "Le Saviez-Vous"
 * Fournit un mot éducatif pendant les chargements
 * - Timer de 60 secondes pour rafraîchir automatiquement
 * - Cache local pour éviter les répétitions
 * - Support bilingue FR/EN
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { API_URL } from '../services/api';
import { useLanguage } from './LanguageContext';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LoadingWord {
  term: string;
  definition: string;
  shortDefinition: string;
  category: string;
  source: 'history' | 'curated';
  wikiUrl?: string;
}

interface LoadingWordContextType {
  currentWord: LoadingWord | null;
  isLoading: boolean;
  error: string | null;
  refreshWord: () => void;
  startTimer: () => void;
  stopTimer: () => void;
  isTimerActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const LoadingWordContext = createContext<LoadingWordContextType | undefined>(undefined);

// Intervalle de rafraîchissement: 60 secondes
const REFRESH_INTERVAL = 60 * 1000;

// Cache des mots déjà affichés pour éviter les répétitions
const displayedWords = new Set<string>();

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { language } = useLanguage();
  const [currentWord, setCurrentWord] = useState<LoadingWord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Récupère un mot aléatoire depuis l'API
   */
  const fetchWord = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Construire la liste des mots à exclure (ceux déjà affichés)
      const excludeList = Array.from(displayedWords).slice(-20).join(',');
      const url = `${API_URL}/api/words/random?lang=${language}${excludeList ? `&exclude=${excludeList}` : ''}`;

      const token = localStorage.getItem('access_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (isMountedRef.current) {
        const word: LoadingWord = {
          term: data.term,
          definition: data.definition,
          shortDefinition: data.short_definition,
          category: data.category,
          source: data.source,
          wikiUrl: data.wiki_url,
        };

        setCurrentWord(word);
        displayedWords.add(word.term);

        // Limiter la taille du cache
        if (displayedWords.size > 50) {
          const iterator = displayedWords.values();
          displayedWords.delete(iterator.next().value);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.warn('[LoadingWord] Error fetching word:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [language]);

  /**
   * Rafraîchit le mot manuellement
   */
  const refreshWord = useCallback(() => {
    fetchWord();
  }, [fetchWord]);

  /**
   * Démarre le timer de rafraîchissement automatique
   */
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsTimerActive(true);

    // Fetch immédiatement si pas de mot actuel
    if (!currentWord) {
      fetchWord();
    }

    // Démarrer le timer pour les rafraîchissements suivants
    timerRef.current = setInterval(() => {
      fetchWord();
    }, REFRESH_INTERVAL);
  }, [fetchWord, currentWord]);

  /**
   * Arrête le timer de rafraîchissement
   */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerActive(false);
  }, []);

  // Fetch initial au montage
  useEffect(() => {
    isMountedRef.current = true;
    fetchWord();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch quand la langue change
  useEffect(() => {
    if (currentWord) {
      fetchWord();
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LoadingWordContext.Provider
      value={{
        currentWord,
        isLoading,
        error,
        refreshWord,
        startTimer,
        stopTimer,
        isTimerActive,
      }}
    >
      {children}
    </LoadingWordContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export const useLoadingWord = () => {
  const context = useContext(LoadingWordContext);
  if (!context) {
    throw new Error('useLoadingWord must be used within a LoadingWordProvider');
  }
  return context;
};

export default LoadingWordContext;
