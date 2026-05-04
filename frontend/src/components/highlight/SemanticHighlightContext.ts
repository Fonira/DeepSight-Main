import { createContext } from "react";
import type { WithinMatch } from "../../services/api";

export interface SemanticHighlightState {
  /** Active query — empty string when search bar closed */
  query: string;
  /** Loading state for /api/search/within */
  loading: boolean;
  /** Matches across all tabs */
  matches: WithinMatch[];
  /** Index in `matches` of the currently focused match (-1 if none) */
  currentIndex: number;
  /** Tab to switch to when current match is selected */
  activeTab: WithinMatch["tab"] | null;
  /** Open a search session */
  setQuery: (q: string) => void;
  /** Close the search session (clears matches) */
  close: () => void;
  /** Navigate next/prev match (wraps) */
  next: () => void;
  prev: () => void;
  /** Jump to a specific passage_id (e.g. from search result deeplink) */
  focus: (passageId: string) => void;
}

export const SemanticHighlightContext =
  createContext<SemanticHighlightState | null>(null);
