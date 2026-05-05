import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { searchApi, type WithinMatch } from "../../services/api";
import {
  SemanticHighlightContext,
  type SemanticHighlightState,
} from "./SemanticHighlightContext";

interface Props {
  summaryId: number | null;
  children: React.ReactNode;
}

export const SemanticHighlightProvider: React.FC<Props> = ({
  summaryId,
  children,
}) => {
  const [query, setQueryRaw] = useState("");
  const [matches, setMatches] = useState<WithinMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const debounceRef = useRef<number | undefined>(undefined);

  const fetchMatches = useCallback(
    async (q: string) => {
      if (!summaryId || q.trim().length < 2) {
        setMatches([]);
        setCurrentIndex(-1);
        return;
      }
      setLoading(true);
      try {
        const res = await searchApi.searchWithin(summaryId, q.trim());
        setMatches(res.matches);
        setCurrentIndex(res.matches.length > 0 ? 0 : -1);
      } catch {
        setMatches([]);
        setCurrentIndex(-1);
      } finally {
        setLoading(false);
      }
    },
    [summaryId],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryRaw(q);
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => fetchMatches(q), 200);
    },
    [fetchMatches],
  );

  const close = useCallback(() => {
    setQueryRaw("");
    setMatches([]);
    setCurrentIndex(-1);
  }, []);

  const next = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const prev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((i) => (i <= 0 ? matches.length - 1 : i - 1));
  }, [matches.length]);

  const focus = useCallback(
    (passageId: string) => {
      const idx = matches.findIndex((m) => m.passage_id === passageId);
      if (idx >= 0) setCurrentIndex(idx);
    },
    [matches],
  );

  // Cleanup
  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current);
    },
    [],
  );

  const activeTab = matches[currentIndex]?.tab ?? null;

  const state: SemanticHighlightState = useMemo(
    () => ({
      query,
      loading,
      matches,
      currentIndex,
      activeTab,
      setQuery,
      close,
      next,
      prev,
      focus,
    }),
    [
      query,
      loading,
      matches,
      currentIndex,
      activeTab,
      setQuery,
      close,
      next,
      prev,
      focus,
    ],
  );

  return (
    <SemanticHighlightContext.Provider value={state}>
      {children}
    </SemanticHighlightContext.Provider>
  );
};
