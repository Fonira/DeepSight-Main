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
 */

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      setTotalResults(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const response = (await Browser.runtime.sendMessage({
          action: "SEARCH_GLOBAL",
          data: { query: trimmed, limit: SEARCH_LIMIT },
        })) as MessageResponse;

        if (cancelled) return;

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
        if (cancelled) return;
        setResults([]);
        setTotalResults(0);
        setError((e as Error).message || "Recherche impossible");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading, error, totalResults };
}
