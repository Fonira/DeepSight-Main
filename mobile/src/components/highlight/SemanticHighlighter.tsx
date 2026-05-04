/**
 * SemanticHighlighter — Context Provider pour la recherche intra-analyse.
 *
 * Hosts :
 *   - query courante
 *   - matches retournés par /api/search/within/{summary_id}
 *   - currentMatchIndex (pour FAB navigation up/down)
 *   - flag activePassageId (passage cliqué = highlight appuyé temporairement)
 *
 * Consumers : `HighlightedText`, `HighlightNavigationBar`, `PassageActionSheet`.
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/services/api";
import type { WithinMatchItem } from "@/services/api";

interface SemanticHighlighterValue {
  query: string;
  setQuery: (q: string) => void;
  matches: WithinMatchItem[];
  currentMatchIndex: number;
  setCurrentMatchIndex: (i: number) => void;
  isLoading: boolean;
  activePassageId: string | null;
  setActivePassageId: (id: string | null) => void;
}

const Ctx = createContext<SemanticHighlighterValue | null>(null);

interface SemanticHighlighterProviderProps {
  children: React.ReactNode;
  summaryId: number;
  initialQuery?: string;
  initialPassageId?: string | null;
}

export const SemanticHighlighterProvider: React.FC<
  SemanticHighlighterProviderProps
> = ({
  children,
  summaryId,
  initialQuery = "",
  initialPassageId = null,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activePassageId, setActivePassageId] = useState<string | null>(
    initialPassageId,
  );

  const enabled = query.trim().length >= 2 && summaryId > 0;

  const { data, isLoading } = useQuery({
    queryKey: ["search", "within", summaryId, query.trim()],
    queryFn: () =>
      searchApi.withinSearch(summaryId, { query: query.trim() }),
    enabled,
    staleTime: 60_000,
  });

  const matches = useMemo(() => data?.matches ?? [], [data]);

  const value = useMemo<SemanticHighlighterValue>(
    () => ({
      query,
      setQuery,
      matches,
      currentMatchIndex,
      setCurrentMatchIndex,
      isLoading,
      activePassageId,
      setActivePassageId,
    }),
    [query, matches, currentMatchIndex, isLoading, activePassageId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useSemanticHighlighter(): SemanticHighlighterValue | null {
  return useContext(Ctx);
}
