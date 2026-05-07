/**
 * useAnalyzeAndOpenHub — hook réutilisable qui démarre une analyse vidéo
 * via `BackgroundAnalysisContext` (FAB + polling unifié) et **navigue
 * immédiatement** vers le Hub.
 *
 * Comportement :
 *   - Cap atteint (2 analyses simultanées) → `error` retourné, pas de navigate.
 *     Le caller affiche un toast.
 *   - Cache hit (le backend retourne déjà `summary_id`) → navigate
 *     `/hub?conv=<id>`. La task est marquée `completed` côté context (FAB
 *     affiche brièvement le check anim).
 *   - Cas standard → navigate `/hub?analyzing=<task_id>`. Le polling
 *     démarré par le context permet au FAB de suivre la progression cross-route ;
 *     `HubPage` continue son propre polling local pour le placeholder UI.
 *
 * Utilisé par : `DashboardPageMinimal`, `ConversationsDrawer`,
 * `NewConversationModal`, `HubPage`, `SmartInputBar`.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useBackgroundAnalysis,
  MaxConcurrentReachedError,
} from "../contexts/BackgroundAnalysisContext";
import { useTranslation } from "./useTranslation";

export interface AnalyzeState {
  /** True pendant l'appel d'analyse (avant le navigate). */
  analyzing: boolean;
  error: string | null;
  /** True si l'erreur est un cap atteint (caller peut afficher un toast spécifique). */
  capReached: boolean;
}

export interface UseAnalyzeAndOpenHubReturn extends AnalyzeState {
  /** Lance l'analyse et navigue immédiatement vers `/hub`. */
  analyze: (url: string) => Promise<void>;
  /** Reset manuel de l'erreur (utile entre deux essais). */
  resetError: () => void;
}

export const useAnalyzeAndOpenHub = (): UseAnalyzeAndOpenHubReturn => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { startVideoAnalysis } = useBackgroundAnalysis();
  const [state, setState] = useState<AnalyzeState>({
    analyzing: false,
    error: null,
    capReached: false,
  });

  const resetError = useCallback(() => {
    setState((s) => ({ ...s, error: null, capReached: false }));
  }, []);

  const analyze = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        setState({
          analyzing: false,
          capReached: false,
          error:
            language === "fr"
              ? "URL invalide. Collez un lien YouTube ou TikTok."
              : "Invalid URL. Paste a YouTube or TikTok link.",
        });
        return;
      }

      setState({ analyzing: true, error: null, capReached: false });

      try {
        const result = await startVideoAnalysis({
          videoUrl: trimmed,
          mode: "auto",
          category: "standard",
        });

        setState({ analyzing: false, error: null, capReached: false });

        // Cache hit synchrone : navigate direct sur la conversation finale.
        if (result.summaryId) {
          navigate(`/hub?conv=${result.summaryId}`);
          return;
        }

        // Cas standard : navigate vers le placeholder loading du Hub.
        navigate(`/hub?analyzing=${result.taskId}`);
      } catch (err) {
        if (err instanceof MaxConcurrentReachedError) {
          setState({
            analyzing: false,
            capReached: true,
            error: err.message,
          });
          return;
        }
        setState({
          analyzing: false,
          capReached: false,
          error:
            err instanceof Error
              ? err.message
              : language === "fr"
                ? "Erreur lors de l'analyse."
                : "Analysis error.",
        });
      }
    },
    [language, navigate, startVideoAnalysis],
  );

  return { ...state, analyze, resetError };
};

export default useAnalyzeAndOpenHub;
