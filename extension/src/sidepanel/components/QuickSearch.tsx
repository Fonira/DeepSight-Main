/**
 * QuickSearch — Composant racine sidepanel : input + collapse/expand + cache.
 *
 * Phase 4 light tier (cf. spec § 6 + plan 2026-05-03-semantic-search-v1-phase4-extension):
 *   1. Input "🔍 Rechercher mes analyses…" au-dessus de RecentsList
 *   2. Expand inline (collapse si query<2 chars)
 *   3. Cache chrome.storage.local des 5 dernières queries (LRU dedup)
 *   4. Click résultat → onSelectResult callback (HomeView ouvre nouvel onglet web)
 *   5. Footer ouvre /search?q=... web tier (full feature)
 */

import React, { useState, useEffect } from "react";
import { useQuickSearch } from "../hooks/useQuickSearch";
import { QuickSearchResultsList } from "./QuickSearchResultsList";
import { pushCachedQuery } from "../../utils/searchCache";
import type { SearchResult } from "../../types/search";

interface Props {
  onSelectResult: (result: SearchResult) => void;
}

export function QuickSearch({ onSelectResult }: Props): JSX.Element {
  const [query, setQuery] = useState("");
  const { results, loading, error, totalResults } = useQuickSearch(query);

  const trimmed = query.trim();
  const isExpanded = trimmed.length >= 2;

  // Persist query in chrome.storage.local cache uniquement après une réponse
  // backend OK (success path). On ne cache pas pendant loading/error pour
  // éviter de spammer le cache avec des half-typed queries.
  useEffect(() => {
    if (!loading && !error && trimmed.length >= 2) {
      void pushCachedQuery(trimmed);
    }
  }, [loading, error, trimmed]);

  const handleClear = () => {
    setQuery("");
  };

  return (
    <div style={{ padding: "8px 16px" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 10,
            fontSize: 14,
            opacity: 0.6,
            pointerEvents: "none",
          }}
        >
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Rechercher mes analyses…"
          aria-label="Rechercher dans mes analyses"
          spellCheck={false}
          autoComplete="off"
          style={{
            width: "100%",
            padding: "8px 32px 8px 32px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            color: "inherit",
            fontSize: 13,
            outline: "none",
          }}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Effacer la recherche"
            style={{
              position: "absolute",
              right: 6,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 14,
              padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {isExpanded && (
        <div
          style={{
            marginTop: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 6,
            overflow: "hidden",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          <QuickSearchResultsList
            results={results}
            loading={loading}
            error={error}
            query={trimmed}
            totalResults={totalResults}
            onSelect={onSelectResult}
          />
        </div>
      )}
    </div>
  );
}
