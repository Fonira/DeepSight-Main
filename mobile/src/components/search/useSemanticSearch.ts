/**
 * useSemanticSearch — Hook React Query pour /api/search/global.
 *
 * Debounce 400ms (plus tolérant que web 200ms : keyboard mobile + autocorrect).
 * Skip si query.trim().length < 2.
 * Cache 30s (staleTime) — recherches récentes restent fraîches.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/services/api";
import type {
  GlobalSearchRequest,
  GlobalSearchResponse,
} from "@/services/api";

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

interface UseSemanticSearchResult {
  data: GlobalSearchResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function useSemanticSearch(
  query: string,
  filters: Partial<GlobalSearchRequest>,
): UseSemanticSearchResult {
  // Initialiser à chaîne vide pour que la 1ère exécution soit aussi debouncée
  // (sinon la 1ère valeur serait disponible immédiatement avant les 400ms).
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", "global", trimmed, filters],
    queryFn: () =>
      searchApi.globalSearch({
        query: trimmed,
        limit: 20,
        ...filters,
      }),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    data: enabled ? data : undefined,
    isLoading: enabled && isLoading,
    error: (error as Error) ?? null,
  };
}
