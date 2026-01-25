/**
 * 🧠 LOADING WORD CONTEXT V2 — Widget "Le Saviez-Vous"
 *
 * Fonctionnalités:
 * - Récupère les mots-clés depuis l'historique utilisateur
 * - Fallback vers données locales si pas d'historique
 * - Timer de 60 secondes pour rafraîchir automatiquement
 * - Cache local pour éviter les répétitions
 * - Support bilingue FR/EN
 * - summaryId pour navigation vers l'analyse source
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useLanguage } from './LanguageContext';
import { DEFAULT_WORDS, getRandomWord, WordData } from '../data/defaultWords';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LoadingWord {
  term: string;
  definition: string;
  shortDefinition: string;
  category: string;
  source: 'history' | 'local';
  wikiUrl?: string;
  // NOUVEAU: Pour navigation vers l'analyse source
  summaryId?: number;
  videoTitle?: string;
  videoId?: string;
}

interface HistoryKeyword {
  term: string;
  summary_id: number;
  video_title: string | null;
  video_id: string | null;
  category: string | null;
  created_at: string | null;
}

interface LoadingWordContextType {
  currentWord: LoadingWord | null;
  isLoading: boolean;
  error: string | null;
  refreshWord: () => void;
  startTimer: () => void;
  stopTimer: () => void;
  isTimerActive: boolean;
  hasHistory: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const LoadingWordContext = createContext<LoadingWordContextType | undefined>(undefined);

// Intervalle de rafraîchissement: 60 secondes
const REFRESH_INTERVAL = 60 * 1000;

// Cache des mots déjà affichés pour éviter les répétitions
const displayedWords = new Set<string>();

// Cache des mots-clés de l'historique
let historyKeywordsCache: HistoryKeyword[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function convertLocalWord(word: WordData, lang: string): LoadingWord {
  return {
    term: lang === 'fr' ? word.term : word.term_en,
    definition: lang === 'fr' ? word.definition_fr : word.definition_en,
    shortDefinition: lang === 'fr' ? word.short_fr : word.short_en,
    category: word.category,
    source: 'local',
    wikiUrl: word.wiki_url,
  };
}

function convertHistoryKeyword(keyword: HistoryKeyword): LoadingWord {
  return {
    term: keyword.term,
    definition: keyword.video_title
      ? `Mot-clé extrait de l'analyse "${keyword.video_title}"`
      : 'Mot-clé de votre historique d\'analyses',
    shortDefinition: keyword.video_title
      ? `De: ${keyword.video_title.slice(0, 50)}${keyword.video_title.length > 50 ? '...' : ''}`
      : 'Cliquez pour voir l\'analyse',
    category: keyword.category || 'history',
    source: 'history',
    summaryId: keyword.summary_id,
    videoTitle: keyword.video_title || undefined,
    videoId: keyword.video_id || undefined,
  };
}

function getRandomHistoryKeyword(excludeTerms: string[]): HistoryKeyword | null {
  if (historyKeywordsCache.length === 0) return null;

  const available = historyKeywordsCache.filter(
    k => !excludeTerms.includes(k.term.toLowerCase())
  );

  if (available.length === 0) {
    // Reset si tout a été affiché
    displayedWords.clear();
    return historyKeywordsCache[Math.floor(Math.random() * historyKeywordsCache.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { language } = useLanguage();
  const [currentWord, setCurrentWord] = useState<LoadingWord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Utilise les données locales en fallback
   */
  const useLocalFallback = useCallback(() => {
    const excludeList = Array.from(displayedWords).slice(-20);
    const word = getRandomWord(excludeList);
    const loadingWord = convertLocalWord(word, language);

    setCurrentWord(loadingWord);
    displayedWords.add(loadingWord.term.toLowerCase());

    // Limiter la taille du cache
    if (displayedWords.size > 50) {
      const iterator = displayedWords.values();
      displayedWords.delete(iterator.next().value);
    }
  }, [language]);

  /**
   * Utilise un mot de l'historique
   */
  const useHistoryWord = useCallback(() => {
    const excludeList = Array.from(displayedWords);
    const keyword = getRandomHistoryKeyword(excludeList);

    if (keyword) {
      const loadingWord = convertHistoryKeyword(keyword);
      setCurrentWord(loadingWord);
      displayedWords.add(loadingWord.term.toLowerCase());

      // Limiter la taille du cache
      if (displayedWords.size > 50) {
        const iterator = displayedWords.values();
        displayedWords.delete(iterator.next().value);
      }
    } else {
      useLocalFallback();
    }
  }, [useLocalFallback]);

  /**
   * Récupère les mots-clés depuis l'API historique
   */
  const fetchHistoryKeywords = useCallback(async () => {
    // Vérifier le cache
    const now = Date.now();
    if (historyKeywordsCache.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      return historyKeywordsCache;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://deep-sight-backend-v3-production.up.railway.app';
      const token = localStorage.getItem('access_token');

      if (!token) {
        return [];
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_URL}/api/history/keywords?limit=200`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      historyKeywordsCache = data.keywords || [];
      lastFetchTime = now;

      if (isMountedRef.current) {
        setHasHistory(data.has_history || false);
      }

      return historyKeywordsCache;
    } catch (err) {
      console.info('[LoadingWord] Could not fetch history keywords:', err);
      return [];
    }
  }, []);

  /**
   * Récupère et affiche un nouveau mot
   */
  const fetchWord = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Essayer de récupérer les mots-clés de l'historique
      const keywords = await fetchHistoryKeywords();

      if (isMountedRef.current) {
        if (keywords.length > 0) {
          useHistoryWord();
        } else {
          useLocalFallback();
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.info('[LoadingWord] Error, using local fallback');
        useLocalFallback();
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchHistoryKeywords, useHistoryWord, useLocalFallback]);

  /**
   * Rafraîchit le mot manuellement
   */
  const refreshWord = useCallback(() => {
    // Si on a des mots en cache, les utiliser directement
    if (historyKeywordsCache.length > 0) {
      useHistoryWord();
    } else {
      fetchWord();
    }
  }, [fetchWord, useHistoryWord]);

  /**
   * Démarre le timer de rafraîchissement automatique
   */
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsTimerActive(true);

    // Démarrer le timer pour les rafraîchissements suivants
    timerRef.current = setInterval(() => {
      refreshWord();
    }, REFRESH_INTERVAL);
  }, [refreshWord]);

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

    // Afficher immédiatement un mot local pendant le chargement
    useLocalFallback();

    // Puis essayer de récupérer les mots de l'historique
    fetchWord();

    // Démarrer le timer automatiquement
    const timer = setInterval(() => {
      if (historyKeywordsCache.length > 0) {
        useHistoryWord();
      } else {
        useLocalFallback();
      }
    }, REFRESH_INTERVAL);

    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch quand la langue change (pour les mots locaux)
  useEffect(() => {
    if (currentWord && currentWord.source === 'local') {
      useLocalFallback();
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
        hasHistory,
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
