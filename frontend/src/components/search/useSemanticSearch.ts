import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchApi,
  ApiError,
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

/**
 * Status codes that mean "feature flag SEMANTIC_SEARCH_V1_ENABLED is off"
 * on the backend. We render a dedicated empty state for these instead of a
 * generic error toast — the user has done nothing wrong and there is no
 * "retry" that would help.
 */
const FEATURE_DISABLED_STATUSES = new Set([404, 503]);

function isFeatureDisabledError(err: unknown): boolean {
  return err instanceof ApiError && FEATURE_DISABLED_STATUSES.has(err.status);
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

  const result = useQuery<GlobalSearchResponse, Error>({
    queryKey: ["search", "global", trimmed, filters, limit],
    queryFn: () => searchApi.searchGlobal(trimmed, filters, limit),
    enabled: isEnabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });

  const featureDisabled = isFeatureDisabledError(result.error);

  return {
    ...result,
    /**
     * True when the backend signaled the feature is unavailable
     * (404 / 503). Distinct from `error` so the page can render a
     * neutral "Bientôt disponible" empty state rather than a red error.
     */
    featureDisabled,
    /**
     * Hide the underlying ApiError from consumers when it really means
     * "feature off". This keeps `error` semantic = "something actually
     * went wrong, the user can retry".
     */
    error: featureDisabled ? null : result.error,
  };
}
