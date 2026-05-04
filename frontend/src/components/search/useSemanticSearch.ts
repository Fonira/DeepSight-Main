import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchApi,
  type GlobalSearchResponse,
  type SearchFilters,
} from "../../services/api";

interface UseSemanticSearchOptions {
  query: string;
  filters: SearchFilters;
  limit?: number;
  /** debounce ms — defaults to 300, pass 0 to disable for tests */
  debounceMs?: number;
  /** disable the query entirely (e.g. when query.length < 2) */
  enabled?: boolean;
}

export function useSemanticSearch({
  query,
  filters,
  limit = 20,
  debounceMs = 300,
  enabled = true,
}: UseSemanticSearchOptions) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    if (debounceMs === 0) {
      setDebouncedQuery(query);
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const trimmed = debouncedQuery.trim();
  const isEnabled = enabled && trimmed.length >= 2;

  return useQuery<GlobalSearchResponse, Error>({
    queryKey: ["search", "global", trimmed, filters, limit],
    queryFn: () => searchApi.searchGlobal(trimmed, filters, limit),
    enabled: isEnabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}
