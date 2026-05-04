/**
 * QuickSearchResultItem — 1 ligne par résultat (sidepanel ~360px de large).
 *
 * Phase 4 light tier : pas de thumbnail, pas de score, pas de preview multi-ligne.
 * Juste un badge type + titre tronqué via text-overflow:ellipsis.
 *
 * Cliquable + accessible clavier (role=button, Enter/Space).
 */

import React from "react";
import type { SearchResult, SearchSourceType } from "../../types/search";

interface Props {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}

const BADGE_LABELS: Record<SearchSourceType, string> = {
  summary: "Synthèse",
  flashcard: "Flashcard",
  quiz: "Quiz",
  chat: "Chat",
  transcript: "Transcript",
};

const BADGE_COLORS: Record<SearchSourceType, string> = {
  summary: "rgba(99, 102, 241, 0.25)", // indigo
  flashcard: "rgba(139, 92, 246, 0.25)", // violet
  quiz: "rgba(6, 182, 212, 0.25)", // cyan
  chat: "rgba(59, 130, 246, 0.25)", // bleu
  transcript: "rgba(255, 255, 255, 0.1)", // gris
};

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

export function QuickSearchResultItem({
  result,
  onSelect,
}: Props): JSX.Element {
  const title =
    result.source_metadata?.summary_title?.trim() ||
    truncate(result.text_preview, 60);

  const badgeLabel = BADGE_LABELS[result.source_type];
  const badgeColor = BADGE_COLORS[result.source_type];

  return (
    <li
      onClick={() => onSelect(result)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(result);
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        padding: "8px 16px",
        cursor: "pointer",
        display: "flex",
        gap: 8,
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 4,
          background: badgeColor,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
        }}
      >
        {badgeLabel}
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
        title={title}
      >
        {title}
      </span>
    </li>
  );
}
