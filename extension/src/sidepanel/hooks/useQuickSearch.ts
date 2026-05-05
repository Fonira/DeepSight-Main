/**
 * useQuickSearch — Hook React qui appelle SEARCH_GLOBAL avec debounce 400ms.
 *
 * Spec : extension light tier (max 10 résultats, debounce 400ms cf. spec § 6.2).
 * Pas de cache mémoire intra-session — l'extension est censée être légère ;
 * un re-render avec la même query fait un nouveau call (acceptable car le
 * backend cache 24h en Redis).
 *
 * Le sidepanel ne peut PAS faire fetch() direct (CSP MV3) → tout passe par
 * `chrome.runtime.sendMessage` vers `background.ts` qui à son tour appelle
 * `apiRequest` (gère le refresh JWT 401).
 *
 * Annulation : on stocke un AbortController par requête en cours dans une
 * ref. À chaque nouveau call (changement de query, debounce, etc.), on
 * abort() le précédent. Comme `chrome.runtime.sendMessage` ne supporte
 * pas nativement de signal côté Chrome, on observe `signal.aborted` au
 * retour du sendMessage pour ignorer le résultat stale (donc le hook
 * écarte le résultat ; le background fetch ne s'arrête pas vraiment côté
 * réseau, mais c'est sans impact UX). Cleanup au unmount via abort.
 */

import { useEffect, useRef, useState } from "react";
import Browser from "../../utils/browser-polyfill";
import type { MessageResponse } from "../../types";
import type { SearchResult } from "../../types/search";

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 10;

interface QuickSearchState {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  totalResults: number;
}

export function useQuickSearch(query: string): QuickSearchState {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    // Toute nouvelle exécution → annule la précédente.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      setTotalResults(0);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      // Si on a été annulé pendant le timeout du debounce, sort tout de suite.
      if (signal.aborted) return;
      try {
        const response = (await Browser.runtime.sendMessage({
          action: "SEARCH_GLOBAL",
          data: { query: trimmed, limit: SEARCH_LIMIT },
        })) as MessageResponse;

        if (signal.aborted) return;

        if (response.success && response.searchResults) {
          setResults(response.searchResults.results);
          setTotalResults(response.searchResults.total_results);
          setError(null);
        } else {
          setResults([]);
          setTotalResults(0);
          setError(response.error || "Recherche impossible");
        }
      } catch (e) {
        if (signal.aborted) return;
        setResults([]);
        setTotalResults(0);
        setError((e as Error).message || "Recherche impossible");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Cleanup au unmount : abort le dernier controller s'il existe.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { results, loading, error, totalResults };
}
