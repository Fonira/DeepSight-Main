import { useContext } from "react";
import {
  SemanticHighlightContext,
  type SemanticHighlightState,
} from "./SemanticHighlightContext";

/** Returns the highlight state, or null if not within a provider. */
export function useSemanticHighlight(): SemanticHighlightState | null {
  return useContext(SemanticHighlightContext);
}
