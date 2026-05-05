/**
 * useHighlightNav — Hook navigation entre matches intra-analyse.
 *
 * Wraps `SemanticHighlighter` context : expose total/current + next/prev/close.
 * No-op si pas de matches ou si le provider n'est pas monté.
 */

import { useCallback } from "react";
import { useSemanticHighlighter } from "./SemanticHighlighter";

interface UseHighlightNavResult {
  total: number;
  current: number;
  matchesEmpty: boolean;
  next: () => void;
  prev: () => void;
  close: () => void;
}

export function useHighlightNav(): UseHighlightNavResult {
  const ctx = useSemanticHighlighter();

  const next = useCallback(() => {
    if (!ctx || ctx.matches.length === 0) return;
    const i = (ctx.currentMatchIndex + 1) % ctx.matches.length;
    ctx.setCurrentMatchIndex(i);
    ctx.setActivePassageId(ctx.matches[i].passage_id);
  }, [ctx]);

  const prev = useCallback(() => {
    if (!ctx || ctx.matches.length === 0) return;
    const i =
      (ctx.currentMatchIndex - 1 + ctx.matches.length) % ctx.matches.length;
    ctx.setCurrentMatchIndex(i);
    ctx.setActivePassageId(ctx.matches[i].passage_id);
  }, [ctx]);

  const close = useCallback(() => {
    if (!ctx) return;
    ctx.setQuery("");
    ctx.setCurrentMatchIndex(0);
    ctx.setActivePassageId(null);
  }, [ctx]);

  return {
    total: ctx?.matches.length ?? 0,
    current: ctx ? ctx.currentMatchIndex + 1 : 0,
    matchesEmpty: !ctx || ctx.matches.length === 0,
    next,
    prev,
    close,
  };
}
