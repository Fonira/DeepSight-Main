/**
 * useAnalyzeAndOpenHub — hook réutilisable qui démarre une analyse vidéo via
 * `BackgroundAnalysisContext` et navigue vers la conversation correspondante
 * dès que l'analyse termine.
 *
 * Comportement :
 *   - L'analyse est immédiatement enregistrée dans le contexte d'arrière-plan
 *     → le panneau bottom-right (`BackgroundAnalysisPanel`) prend le relais
 *     pour afficher la progression sur toutes les pages.
 *   - Cache hit (le backend retourne `summary_id` immédiatement) → navigate
 *     `/hub?conv=<id>` aussitôt.
 *   - Pas de cache hit → l'utilisateur reste sur la page courante. Quand le
 *     polling termine, le hook reçoit le `onComplete` et navigate vers la
 *     nouvelle conversation.
 *
 * Utilisé par :
 *   - `DashboardPageMinimal` (home minimale : input URL + Tournesol cards)
 *   - `ConversationsDrawer` (barre input directe dans le drawer Hub)
 *   - `HubPage` (re-export comme `triggerAnalyze`)
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBackgroundAnalysis } from "../contexts/BackgroundAnalysisContext";
import { useTranslation } from "./useTranslation";

export interface AnalyzeState {
  /** True pendant le call `startVideoAnalysis` (avant que le panneau prenne le relais). */
  analyzing: boolean;
  error: string | null;
}

export interface UseAnalyzeAndOpenHubReturn extends AnalyzeState {
  /** Lance l'analyse en arrière-plan et navigue vers la conv quand terminée. */
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
  });

  const resetError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const analyze = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        setState({
          analyzing: false,
          error:
            language === "fr"
              ? "URL invalide. Collez un lien YouTube ou TikTok."
              : "Invalid URL. Paste a YouTube or TikTok link.",
        });
        return;
      }

      setState({ analyzing: true, error: null });

      try {
        await startVideoAnalysis({
          videoUrl: trimmed,
          language: (language === "en" ? "en" : "fr") as "fr" | "en",
          onComplete: (summaryId) => {
            navigate(`/hub?conv=${summaryId}`);
          },
        });
        setState({ analyzing: false, error: null });
      } catch (err) {
        setState({
          analyzing: false,
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
