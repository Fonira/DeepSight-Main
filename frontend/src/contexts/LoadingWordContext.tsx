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

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { useLanguage } from "./LanguageContext";
import {
  getRandomWord,
  getWordByCategory,
  WordData,
} from "../data/defaultWords";

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LoadingWord {
  term: string;
  definition: string;
  shortDefinition: string;
  category: string;
  source: "history" | "local";
  wikiUrl?: string;
  // NOUVEAU: Pour navigation vers l'analyse source
  summaryId?: number;
  videoTitle?: string;
  videoId?: string;
  // Image IA générée (pipeline Mistral → fal.ai)
  imageUrl?: string;
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
  // Image IA générée
  image_url: string | null;
}

export interface CategoryCount {
  category: string;
  count: number;
}

interface WordFilter {
  source?: "history" | "local";
  category?: string;
}

interface LoadingWordContextType {
  currentWord: LoadingWord | null;
  isLoading: boolean;
  error: string | null;
  refreshWord: () => void;
  nextWord: () => void;
  injectConcepts: (
    concepts: {
      term: string;
      definition: string;
      short_definition?: string;
      category?: string;
      wiki_url?: string;
      summary_id?: number;
      video_title?: string;
    }[],
  ) => void;
  startTimer: () => void;
  stopTimer: () => void;
  isTimerActive: boolean;
  hasHistory: boolean;
  /** Toggle le widget flottant "Le Saviez-Vous" (pour intégration sidebar) */
  isWidgetVisible: boolean;
  toggleWidget: () => void;
  /** Sidebar droite "Le Saviez-Vous" — visible sur desktop xl+ */
  isSidebarVisible: boolean;
  toggleSidebar: () => void;
  /** Distribution des catégories de l'utilisateur (top centres d'intérêt) */
  userCategories: CategoryCount[];
  /** Nombre total de keywords dans l'historique */
  historyCount: number;
  /** Récupère un mot filtré par source et/ou catégorie */
  getWordByFilter: (filter: WordFilter) => LoadingWord | null;
  /** Récupère les N derniers termes uniques (pour ticker, etc.) */
  getRecentTerms: (count: number) => LoadingWord[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const LoadingWordContext = createContext<LoadingWordContextType | undefined>(
  undefined,
);

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
    term: lang === "fr" ? word.term : word.term_en,
    definition: lang === "fr" ? word.definition_fr : word.definition_en,
    shortDefinition: lang === "fr" ? word.short_fr : word.short_en,
    category: word.category,
    source: "local",
    wikiUrl: word.wiki_url,
  };
}

function convertHistoryKeyword(keyword: HistoryKeyword): LoadingWord {
  // Utiliser la définition IA si disponible, sinon fallback contextuel
  const hasAIDefinition =
    keyword.definition && keyword.definition.trim().length > 0;

  const definition = hasAIDefinition
    ? keyword.definition!
    : keyword.video_title
      ? `Terme clé de l'analyse "${keyword.video_title}". Cliquez pour voir le contexte.`
      : "Terme de votre historique d'analyses.";

  const shortDefinition =
    hasAIDefinition && keyword.short_definition
      ? keyword.short_definition
      : hasAIDefinition
        ? keyword.definition!.slice(0, 80) +
          (keyword.definition!.length > 80 ? "..." : "")
        : "Cliquez pour voir le contexte dans votre analyse.";

  return {
    term: keyword.term,
    definition: definition,
    shortDefinition: shortDefinition,
    category: keyword.category || "concept",
    source: "history",
    summaryId: keyword.summary_id,
    videoTitle: keyword.video_title || undefined,
    videoId: keyword.video_id || undefined,
    wikiUrl: keyword.wiki_url || undefined,
    imageUrl: keyword.image_url || undefined,
  };
}

function getRandomHistoryKeyword(
  excludeTerms: string[],
): HistoryKeyword | null {
  if (historyKeywordsCache.length === 0) return null;

  const available = historyKeywordsCache.filter(
    (k) => !excludeTerms.includes(k.term.toLowerCase()),
  );

  if (available.length === 0) {
    // Reset si tout a été affiché
    displayedWords.clear();
    return historyKeywordsCache[
      Math.floor(Math.random() * historyKeywordsCache.length)
    ];
  }

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Calcule la distribution des catégories dans l'historique utilisateur
 */
function computeUserCategories(): CategoryCount[] {
  if (historyKeywordsCache.length === 0) return [];

  const counts: Record<string, number> = {};
  for (const k of historyKeywordsCache) {
    const cat = k.category || "concept";
    counts[cat] = (counts[cat] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export const LoadingWordProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { language } = useLanguage();
  const [currentWord, setCurrentWord] = useState<LoadingWord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    try {
      const stored = localStorage.getItem("ds-sidebar-dyk-visible");
      return stored !== "false"; // visible par défaut
    } catch {
      return true;
    }
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Utilise les données locales en fallback — biaisé vers les centres d'intérêt utilisateur
   */
  const applyLocalFallback = useCallback(() => {
    const excludeList = Array.from(displayedWords).slice(-20);

    // Si l'utilisateur a un historique, biaiser vers ses catégories préférées
    const topCategory = computeUserCategories()[0]?.category;
    const word = topCategory
      ? getWordByCategory(topCategory, excludeList)
      : getRandomWord(excludeList);
    const loadingWord = convertLocalWord(word, language);

    setCurrentWord(loadingWord);
    displayedWords.add(loadingWord.term.toLowerCase());

    // Limiter la taille du cache
    if (displayedWords.size > 80) {
      const iterator = displayedWords.values();
      displayedWords.delete(iterator.next().value as string);
    }
  }, [language]);

  /**
   * Utilise un mot de l'historique — PRIORITÉ ABSOLUE (PAS DE FALLBACK LOCAL)
   */
  const applyHistoryWord = useCallback(() => {
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
  const fetchHistoryKeywords = useCallback(async (): Promise<{
    keywords: HistoryKeyword[];
    hasHistory: boolean;
  }> => {
    // Vérifier le cache
    const now = Date.now();
    if (
      historyKeywordsCache.length > 0 &&
      now - lastFetchTime < CACHE_DURATION
    ) {
      return { keywords: historyKeywordsCache, hasHistory: true };
    }

    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com";
      const token = localStorage.getItem("access_token");

      if (!token) {
        return { keywords: [], hasHistory: false };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

      const response = await fetch(
        `${API_URL}/api/history/keywords?limit=200`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Sur erreur API, retourner le cache existant si disponible
        if (historyKeywordsCache.length > 0) {
          return { keywords: historyKeywordsCache, hasHistory: true };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      historyKeywordsCache = data.keywords || [];
      lastFetchTime = now;

      if (isMountedRef.current) {
        setHasHistory(data.has_history || false);
      }

      return {
        keywords: historyKeywordsCache,
        hasHistory: data.has_history || false,
      };
    } catch (err) {
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
      const { keywords, hasHistory: userHasHistory } =
        await fetchHistoryKeywords();

      if (isMountedRef.current) {
        if (keywords.length > 0) {
          // Utiliser l'historique
          applyHistoryWord();
        } else if (!userHasHistory) {
          // L'utilisateur n'a PAS d'historique → fallback local OK
          applyLocalFallback();
        } else {
          // L'utilisateur A un historique mais keywords vide (erreur?) → ne rien afficher plutôt que local
          // Réessayer après 2 secondes
          setTimeout(() => {
            if (isMountedRef.current) fetchWord();
          }, 2000);
        }
      }
    } catch (err) {
      console.error("[LoadingWord] Critical error:", err);
      // Même sur erreur critique, ne pas afficher de mot local si on sait que l'utilisateur a un historique
      if (historyKeywordsCache.length > 0) {
        applyHistoryWord();
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchHistoryKeywords, applyHistoryWord, applyLocalFallback]);

  /**
   * Rafraîchit le mot manuellement — TOUJOURS vérifier l'historique d'abord
   */
  const refreshWord = useCallback(() => {
    // TOUJOURS re-fetch pour s'assurer d'avoir l'historique le plus récent
    fetchWord();
  }, [fetchWord]);

  /**
   * 🆕 Mot suivant INSTANTANÉ — mix 70% historique / 30% local pour variété
   */
  const nextWord = useCallback(() => {
    if (historyKeywordsCache.length > 0) {
      const roll = Math.random();
      if (roll < 0.7) {
        applyHistoryWord();
      } else {
        applyLocalFallback();
      }
    } else {
      applyLocalFallback();
    }
  }, [applyHistoryWord, applyLocalFallback]);

  /**
   * 🆕 Injecte des concepts enrichis (depuis ConceptsGlossary/KeywordsModal)
   * Ces concepts deviennent prioritaires dans la rotation
   */
  const injectConcepts = useCallback(
    (
      concepts: {
        term: string;
        definition: string;
        short_definition?: string;
        category?: string;
        wiki_url?: string;
        summary_id?: number;
        video_title?: string;
      }[],
    ) => {
      if (!concepts || concepts.length === 0) return;

      const newKeywords: HistoryKeyword[] = concepts.map((c) => ({
        term: c.term,
        summary_id: c.summary_id || 0,
        video_title: c.video_title || null,
        video_id: null,
        category: c.category || "concept",
        created_at: new Date().toISOString(),
        definition: c.definition,
        short_definition:
          c.short_definition ||
          (c.definition.length > 80
            ? c.definition.slice(0, 77) + "..."
            : c.definition),
        wiki_url: c.wiki_url || null,
        confidence: "high",
        image_url: null,
      }));

      // Injecter en tête du cache (prioritaires)
      const existingTerms = new Set(
        historyKeywordsCache.map((k) => k.term.toLowerCase()),
      );
      const fresh = newKeywords.filter(
        (k) => !existingTerms.has(k.term.toLowerCase()),
      );
      historyKeywordsCache = [...fresh, ...historyKeywordsCache];
      lastFetchTime = Date.now(); // Reset cache timer

      // Afficher immédiatement un des nouveaux concepts
      if (fresh.length > 0) {
        const picked = fresh[Math.floor(Math.random() * fresh.length)];
        const word = convertHistoryKeyword(picked);
        setCurrentWord(word);
        displayedWords.add(word.term.toLowerCase());
        if (isMountedRef.current) setHasHistory(true);
      }
    },
    [],
  );

  /**
   * Toggle la visibilité du widget flottant (pour intégration sidebar)
   */
  const toggleWidget = useCallback(() => {
    setIsWidgetVisible((prev) => !prev);
  }, []);

  /**
   * Toggle la sidebar droite "Le Saviez-Vous" (desktop xl+)
   */
  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ds-sidebar-dyk-visible", String(next));
      } catch {
        /* */
      }
      return next;
    });
  }, []);

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

  /**
   * Récupère un mot filtré par source et/ou catégorie (sans modifier la rotation globale)
   */
  const getWordByFilter = useCallback(
    (filter: WordFilter): LoadingWord | null => {
      const excludeList = Array.from(displayedWords).slice(-10);

      if (filter.source === "history") {
        let pool = historyKeywordsCache.filter(
          (k) => !excludeList.includes(k.term.toLowerCase()),
        );
        if (filter.category) {
          pool = pool.filter((k) => k.category === filter.category);
        }
        if (pool.length === 0) {
          pool = historyKeywordsCache.filter(
            (k) => !filter.category || k.category === filter.category,
          );
        }
        if (pool.length === 0) return null;
        return convertHistoryKeyword(
          pool[Math.floor(Math.random() * pool.length)],
        );
      }

      if (filter.source === "local") {
        const word = filter.category
          ? getWordByCategory(filter.category, excludeList)
          : getRandomWord(excludeList);
        return convertLocalWord(word, language);
      }

      // No source filter — mix
      if (historyKeywordsCache.length > 0) {
        let pool = historyKeywordsCache.filter(
          (k) => !excludeList.includes(k.term.toLowerCase()),
        );
        if (filter.category) {
          pool = pool.filter((k) => k.category === filter.category);
        }
        if (pool.length > 0) {
          return convertHistoryKeyword(
            pool[Math.floor(Math.random() * pool.length)],
          );
        }
      }
      const word = filter.category
        ? getWordByCategory(filter.category, excludeList)
        : getRandomWord(excludeList);
      return convertLocalWord(word, language);
    },
    [language],
  );

  /**
   * Récupère les N derniers termes uniques pour le ticker/affichage multiple
   */
  const getRecentTerms = useCallback(
    (count: number): LoadingWord[] => {
      const results: LoadingWord[] = [];
      const seen = new Set<string>();

      // D'abord puiser dans l'historique
      for (const kw of historyKeywordsCache) {
        if (seen.has(kw.term.toLowerCase())) continue;
        seen.add(kw.term.toLowerCase());
        results.push(convertHistoryKeyword(kw));
        if (results.length >= count) return results;
      }

      // Compléter avec du local si besoin
      const excludeList = Array.from(seen);
      while (results.length < count) {
        const word = getRandomWord(excludeList);
        const converted = convertLocalWord(word, language);
        if (seen.has(converted.term.toLowerCase())) break; // safety
        seen.add(converted.term.toLowerCase());
        excludeList.push(converted.term.toLowerCase());
        results.push(converted);
      }

      return results;
    },
    [language],
  );

  // Catégories de l'utilisateur (memoized)
  const userCategories = useMemo(() => computeUserCategories(), [currentWord]); // eslint-disable-line react-hooks/exhaustive-deps
  const historyCount = historyKeywordsCache.length;

  // Fetch initial au montage — PRIORITÉ ABSOLUE À L'HISTORIQUE
  useEffect(() => {
    isMountedRef.current = true;

    // NE PAS afficher de mot local immédiatement
    // Attendre fetchWord() pour avoir l'historique en priorité
    fetchWord();

    // Timer: mix 70% historique / 30% local pour la variété
    const timer = setInterval(() => {
      if (historyKeywordsCache.length > 0) {
        const roll = Math.random();
        if (roll < 0.7) {
          applyHistoryWord();
        } else {
          applyLocalFallback();
        }
      } else {
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
        nextWord,
        injectConcepts,
        startTimer,
        stopTimer,
        isTimerActive,
        hasHistory,
        isWidgetVisible,
        toggleWidget,
        isSidebarVisible,
        toggleSidebar,
        userCategories,
        historyCount,
        getWordByFilter,
        getRecentTerms,
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
    throw new Error("useLoadingWord must be used within a LoadingWordProvider");
  }
  return context;
};

export default LoadingWordContext;
