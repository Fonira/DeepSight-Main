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
import { getRandomWord, WordData } from '../data/defaultWords';

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
  // Définitions générées par IA (Mistral)
  definition: string | null;
  short_definition: string | null;
  // Source Wikipedia ou alternative
  wiki_url: string | null;
  confidence: string | null;
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
  // Utiliser la définition IA si disponible, sinon fallback contextuel
  const hasAIDefinition = keyword.definition && keyword.definition.trim().length > 0;

  const definition = hasAIDefinition
    ? keyword.definition!
    : keyword.video_title
      ? `Terme clé de l'analyse "${keyword.video_title}". Cliquez pour voir le contexte.`
      : 'Terme de votre historique d\'analyses.';

  const shortDefinition = hasAIDefinition && keyword.short_definition
    ? keyword.short_definition
    : hasAIDefinition
      ? keyword.definition!.slice(0, 80) + (keyword.definition!.length > 80 ? '...' : '')
      : 'Cliquez pour voir le contexte dans votre analyse.';

  return {
    term: keyword.term,
    definition: definition,
    shortDefinition: shortDefinition,
    category: keyword.category || 'concept',
    source: 'history',
    summaryId: keyword.summary_id,
    videoTitle: keyword.video_title || undefined,
    videoId: keyword.video_id || undefined,
    wikiUrl: keyword.wiki_url || undefined,
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
      displayedWords.delete(iterator.next().value as string);
    }
  }, [language]);

  /**
   * Utilise un mot de l'historique — PRIORITÉ ABSOLUE (PAS DE FALLBACK LOCAL)
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
        displayedWords.delete(iterator.next().value as string);
      }
    }
    // PAS DE FALLBACK LOCAL - Si historique existe, on n'affiche QUE l'historique
  }, []);

  /**
   * Récupère les mots-clés depuis l'API historique
   * PRIORITÉ ABSOLUE: Ne retourne [] que si l'utilisateur n'a vraiment PAS d'historique
   */
  const fetchHistoryKeywords = useCallback(async (): Promise<{ keywords: HistoryKeyword[], hasHistory: boolean }> => {
    // Vérifier le cache
    const now = Date.now();
    if (historyKeywordsCache.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      return { keywords: historyKeywordsCache, hasHistory: true };
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://deep-sight-backend-v3-production.up.railway.app';
      const token = localStorage.getItem('access_token');

      if (!token) {
        console.info('[LoadingWord] No token - using local fallback');
        return { keywords: [], hasHistory: false };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

      const response = await fetch(`${API_URL}/api/history/keywords?limit=200`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[LoadingWord] API error:', response.status);
        // Sur erreur API, retourner le cache existant si disponible
        if (historyKeywordsCache.length > 0) {
          return { keywords: historyKeywordsCache, hasHistory: true };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.info('[LoadingWord] Fetched keywords:', data.keywords?.length || 0, 'hasHistory:', data.has_history);

      historyKeywordsCache = data.keywords || [];
      lastFetchTime = now;

      if (isMountedRef.current) {
        setHasHistory(data.has_history || false);
      }

      return { keywords: historyKeywordsCache, hasHistory: data.has_history || false };
    } catch (err) {
      console.warn('[LoadingWord] Fetch error:', err);
      // Sur erreur réseau, utiliser le cache si disponible
      if (historyKeywordsCache.length > 0) {
        return { keywords: historyKeywordsCache, hasHistory: true };
      }
      // Pas de cache, indiquer qu'on ne sait pas si l'utilisateur a un historique
      return { keywords: [], hasHistory: false };
    }
  }, []);

  /**
   * Récupère et affiche un nouveau mot — HISTORIQUE EN PRIORITÉ ABSOLUE
   */
  const fetchWord = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const { keywords, hasHistory: userHasHistory } = await fetchHistoryKeywords();

      if (isMountedRef.current) {
        if (keywords.length > 0) {
          // Utiliser l'historique
          useHistoryWord();
        } else if (!userHasHistory) {
          // L'utilisateur n'a PAS d'historique → fallback local OK
          console.info('[LoadingWord] No history - using local fallback');
          useLocalFallback();
        } else {
          // L'utilisateur A un historique mais keywords vide (erreur?) → ne rien afficher plutôt que local
          console.warn('[LoadingWord] User has history but keywords empty - retrying...');
          // Réessayer après 2 secondes
          setTimeout(() => {
            if (isMountedRef.current) fetchWord();
          }, 2000);
        }
      }
    } catch (err) {
      console.error('[LoadingWord] Critical error:', err);
      // Même sur erreur critique, ne pas afficher de mot local si on sait que l'utilisateur a un historique
      if (historyKeywordsCache.length > 0) {
        useHistoryWord();
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchHistoryKeywords, useHistoryWord, useLocalFallback]);

  /**
   * Rafraîchit le mot manuellement — TOUJOURS vérifier l'historique d'abord
   */
  const refreshWord = useCallback(() => {
    // TOUJOURS re-fetch pour s'assurer d'avoir l'historique le plus récent
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

  // Fetch initial au montage — PRIORITÉ ABSOLUE À L'HISTORIQUE
  useEffect(() => {
    isMountedRef.current = true;

    // NE PAS afficher de mot local immédiatement
    // Attendre fetchWord() pour avoir l'historique en priorité
    fetchWord();

    // Timer: toujours vérifier l'historique d'abord
    const timer = setInterval(() => {
      if (historyKeywordsCache.length > 0) {
        // Utiliser l'historique en priorité
        useHistoryWord();
      } else {
        // Re-fetch pour vérifier si nouvel historique disponible
        fetchWord();
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
