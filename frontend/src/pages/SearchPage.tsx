import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { DeepSightSpinner } from "../components/ui/DeepSightSpinner";
import { SearchInput } from "../components/search/SearchInput";
import { SearchFiltersBar } from "../components/search/SearchFiltersBar";
import { SearchAdvancedFilters } from "../components/search/SearchAdvancedFilters";
import { SearchResultsList } from "../components/search/SearchResultsList";
import { SearchEmptyState } from "../components/search/SearchEmptyState";
import { useSemanticSearch } from "../components/search/useSemanticSearch";
import { useRecentQueries } from "../components/search/useRecentQueries";
import type {
  GlobalSearchResult,
  SearchFilters,
  SearchSourceType,
} from "../services/api";
import { analytics } from "../services/analytics";

const SearchPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { addQuery, queries: recent } = useRecentQueries();

  const initialQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const initialTypes = useMemo<SearchSourceType[] | undefined>(() => {
    const raw = params.get("types");
    if (!raw) return undefined;
    return raw.split(",").filter(Boolean) as SearchSourceType[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [filters, setFilters] = useState<SearchFilters>({
    source_types: initialTypes,
    platform: (params.get("platform") ||
      undefined) as SearchFilters["platform"],
    lang: params.get("lang") || undefined,
    category: params.get("category") || undefined,
    favorites_only: params.get("favs") === "1" || undefined,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync state → URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (filters.source_types?.length)
      next.set("types", filters.source_types.join(","));
    if (filters.platform) next.set("platform", filters.platform);
    if (filters.lang) next.set("lang", filters.lang);
    if (filters.category) next.set("category", filters.category);
    if (filters.favorites_only) next.set("favs", "1");
    setParams(next, { replace: true });
  }, [query, filters, setParams]);

  const { data, isFetching, error, featureDisabled } = useSemanticSearch({
    query,
    filters,
  });

  // Track query when results land
  useEffect(() => {
    if (data && query.trim().length >= 2) {
      addQuery(query);
      analytics.capture("search_query", {
        query_length: query.length,
        results_count: data.total_results,
        has_filters: Object.keys(filters).some(
          (k) => (filters as Record<string, unknown>)[k] !== undefined,
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.searched_at]);

  const countsByType = useMemo<
    Partial<Record<SearchSourceType, number>>
  >(() => {
    if (!data) return {};
    const counts: Partial<Record<SearchSourceType, number>> = {};
    for (const r of data.results) {
      counts[r.source_type] = (counts[r.source_type] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  const handleOpen = (r: GlobalSearchResult) => {
    analytics.capture("search_result_clicked", {
      position: data?.results.indexOf(r) ?? -1,
      source_type: r.source_type,
      score: r.score,
    });
    const tab = r.source_metadata.tab ?? "synthesis";
    const url = new URLSearchParams({
      summaryId: String(r.summary_id),
      q: query,
      highlight: `${r.source_type}-${r.source_id}`,
      tab,
    });
    navigate(`/hub?${url.toString()}`);
  };

  const isEmptyQuery = query.trim().length < 2;
  const hasResults = !!data && data.results.length > 0;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary relative">
      <SEO title="Recherche — Deep Sight" noindex />
      <DoodleBackground />
      <Sidebar />
      <main
        id="main-content"
        className="lg:pl-[240px] pt-6 pb-12 px-4 sm:px-6 lg:px-8 relative z-10"
      >
        <div className="max-w-5xl mx-auto space-y-6">
          <header>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-1">
              Recherche
            </h1>
            <p className="text-sm text-white/55">
              Sémantique sur tes analyses, flashcards, quiz et chats.
            </p>
          </header>

          <SearchInput value={query} onChange={setQuery} onSubmit={setQuery} />

          <SearchFiltersBar
            filters={filters}
            onChange={setFilters}
            countsByType={countsByType}
            totalCount={data?.total_results}
            onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
            advancedOpen={advancedOpen}
          />

          {advancedOpen && (
            <SearchAdvancedFilters filters={filters} onChange={setFilters} />
          )}

          {featureDisabled && (
            <div
              role="status"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center"
            >
              <p className="text-base text-white/85 font-medium mb-1">
                Fonctionnalité bientôt disponible
              </p>
              <p className="text-sm text-white/55">
                La recherche sémantique est en cours d'activation côté serveur.
                Reviens d'ici quelques minutes — aucune action requise de ta
                part.
              </p>
            </div>
          )}

          {!featureDisabled && error && (
            <div className="text-center py-8 text-red-300">
              Une erreur est survenue. Réessaie dans un instant.
            </div>
          )}

          {!featureDisabled && !error && isFetching && (
            <div className="flex justify-center py-10">
              <DeepSightSpinner size="md" />
            </div>
          )}

          {!featureDisabled && !error && !isFetching && isEmptyQuery && (
            <SearchEmptyState
              variant="no-query"
              recentQueries={recent}
              onPickQuery={(q) => setQuery(q)}
            />
          )}

          {!featureDisabled &&
            !error &&
            !isFetching &&
            !isEmptyQuery &&
            !hasResults && (
              <SearchEmptyState variant="no-results" query={query} />
            )}

          {!featureDisabled && !error && !isFetching && hasResults && data && (
            <SearchResultsList
              results={data.results}
              query={query}
              onOpen={handleOpen}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
