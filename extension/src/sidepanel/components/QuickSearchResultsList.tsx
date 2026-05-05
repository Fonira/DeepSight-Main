/**
 * QuickSearchResultsList — Liste compacte + états loading/error/empty + footer.
 *
 * Phase 4 light tier : footer "Voir tous les résultats sur deepsightsynthesis.com"
 * → ouvre WEBAPP_URL/search?q=... dans nouvel onglet (chrome.tabs.create).
 * Le sidepanel reste ouvert (UX) ; on ne ferme pas suite à un click.
 *
 * États visuels mutually exclusive :
 *   1. loading=true  → spinner texte
 *   2. error≠null    → message rouge accessibility role=alert
 *   3. results=[]    → empty state ("Aucun résultat pour <query>")
 *   4. results≠[]    → liste + footer
 */

import React from "react";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { QuickSearchResultItem } from "./QuickSearchResultItem";
import type { SearchResult } from "../../types/search";

interface Props {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  totalResults: number;
  onSelect: (result: SearchResult) => void;
}

export function QuickSearchResultsList({
  results,
  loading,
  error,
  query,
  totalResults,
  onSelect,
}: Props): JSX.Element {
  const openWebSearch = () => {
    const url = `${WEBAPP_URL}/search?q=${encodeURIComponent(query)}`;
    Browser.tabs.create({ url });
  };

  if (loading) {
    return (
      <div
        style={{
          padding: 16,
          opacity: 0.6,
          fontSize: 13,
          textAlign: "center",
        }}
        role="status"
        aria-live="polite"
      >
        Recherche en cours…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          color: "#fca5a5",
          fontSize: 13,
        }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          opacity: 0.6,
          fontSize: 13,
        }}
      >
        Aucun résultat pour « {query} »
      </div>
    );
  }

  return (
    <div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {results.map((r) => (
          <QuickSearchResultItem
            key={`${r.source_type}-${r.source_id}`}
            result={r}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={openWebSearch}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          color: "rgba(99, 102, 241, 0.95)",
          fontSize: 12,
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-label={`Voir les ${totalResults} résultats sur deepsightsynthesis.com`}
      >
        Voir tous les résultats ({totalResults}) sur deepsightsynthesis.com →
      </button>
    </div>
  );
}
