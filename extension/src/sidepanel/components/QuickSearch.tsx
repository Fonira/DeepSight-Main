/**
 * QuickSearch — Composant racine sidepanel : input + collapse/expand + cache.
 *
 * Phase 4 light tier (cf. spec § 6 + plan 2026-05-03-semantic-search-v1-phase4-extension):
 *   1. Probe feature flag au mount via GET_RECENT_QUERIES — si désactivé,
 *      composant invisible (return null).
 *   2. Input "🔍 Rechercher mes analyses…" au-dessus de RecentsList
 *   3. Expand inline (collapse si query<2 chars)
 *   4. Cache chrome.storage.local des 5 dernières queries (LRU dedup)
 *      — uniquement push si la recherche backend a renvoyé >0 résultats.
 *   5. Recent queries affichées en suggestions au focus de l'input quand
 *      la query est vide.
 *   6. Click résultat → onSelectResult callback (HomeView décide jump/open)
 *   7. Footer ouvre /search?q=... web tier (full feature)
 */

import React, { useState, useEffect, useCallback } from "react";
import Browser from "../../utils/browser-polyfill";
import { useQuickSearch } from "../hooks/useQuickSearch";
import { QuickSearchResultsList } from "./QuickSearchResultsList";
import { pushCachedQuery } from "../../utils/searchCache";
import type { MessageResponse } from "../../types";
import type { SearchResult } from "../../types/search";

interface Props {
  onSelectResult: (result: SearchResult) => void;
}

type ProbeStatus = "pending" | "enabled" | "disabled";

// Pattern reconnu comme "feature flag désactivé" côté backend. Le backend
// renvoie 404/503 ou un message contenant `feature_disabled` quand la flag
// SEMANTIC_SEARCH_V1_ENABLED est false.
const FEATURE_DISABLED_PATTERN = /feature_disabled|404|503|not\s*found|not\s*available/i;

export function QuickSearch({ onSelectResult }: Props): JSX.Element | null {
  const [query, setQuery] = useState("");
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>("pending");
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const { results, loading, error, totalResults } = useQuickSearch(
    probeStatus === "enabled" ? query : "",
  );

  const trimmed = query.trim();
  const isExpanded = probeStatus === "enabled" && trimmed.length >= 2;

  // ── Probe feature flag (one-shot au mount) ────────────────────────────
  // Le backend expose GET /search/recent-queries qui renvoie 404/503/feature_disabled
  // quand SEMANTIC_SEARCH_V1_ENABLED=false. On utilise cette probe pour décider
  // si on affiche le composant ou pas (return null si désactivé).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = (await Browser.runtime.sendMessage({
          action: "GET_RECENT_QUERIES",
        })) as MessageResponse;
        if (cancelled) return;
        if (response?.success === false) {
          const msg = response.error ?? "";
          if (FEATURE_DISABLED_PATTERN.test(msg)) {
            setProbeStatus("disabled");
            return;
          }
          // Erreur transitoire (réseau, 401, etc.) — on garde le composant
          // affiché mais sans recent queries, l'user pourra quand même chercher.
          setProbeStatus("enabled");
          return;
        }
        setProbeStatus("enabled");
        if (Array.isArray(response?.recentQueries)) {
          setRecentQueries(response.recentQueries.slice(0, 5));
        }
      } catch {
        if (cancelled) return;
        // Network error — on reste affiché, l'user pourra réessayer.
        setProbeStatus("enabled");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist query in chrome.storage.local cache uniquement après une réponse
  // backend OK avec >0 résultats. On ne cache pas les queries qui n'ont
  // produit aucun match — elles ne sont pas utiles en suggestion future.
  useEffect(() => {
    if (
      probeStatus === "enabled" &&
      !loading &&
      !error &&
      trimmed.length >= 2 &&
      results.length > 0
    ) {
      void pushCachedQuery(trimmed);
    }
  }, [probeStatus, loading, error, trimmed, results.length]);

  const handleClear = useCallback(() => {
    setQuery("");
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    setIsFocused(false);
  }, []);

  // Suggestions visibles uniquement quand : feature ON + input focus + query
  // vide + au moins 1 recent query mémorisée côté backend.
  const showSuggestions =
    probeStatus === "enabled" &&
    isFocused &&
    trimmed.length === 0 &&
    recentQueries.length > 0;

  // Feature désactivée côté backend → composant invisible.
  if (probeStatus === "disabled") {
    return null;
  }

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
          onFocus={() => setIsFocused(true)}
          // Petit delay pour permettre le click sur une suggestion avant le
          // blur (sinon onMouseDown déclenche blur avant le click).
          onBlur={() => window.setTimeout(() => setIsFocused(false), 150)}
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
      {showSuggestions && (
        <ul
          role="listbox"
          aria-label="Recherches récentes"
          style={{
            listStyle: "none",
            margin: "8px 0 0 0",
            padding: 4,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 6,
          }}
        >
          <li
            style={{
              padding: "4px 8px",
              fontSize: 11,
              opacity: 0.5,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
            aria-hidden="true"
          >
            Recherches récentes
          </li>
          {recentQueries.map((q) => (
            <li key={q}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                // onMouseDown plutôt que onClick pour intercepter avant que
                // le blur de l'input ne déclenche (et masque la liste).
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSuggestionClick(q);
                }}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}
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
