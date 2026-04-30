/**
 * useAnalyzeAndOpenHub — hook réutilisable qui encapsule le démarrage d'une
 * analyse vidéo (`videoApi.analyze`) et **navigue immédiatement** vers le Hub.
 *
 * Comportement :
 *   - Cache hit (le backend retourne déjà `summary_id`) → navigate `/hub?conv=<id>`.
 *   - Sinon → navigate `/hub?analyzing=<task_id>`. Le polling
 *     `videoApi.getTaskStatus(taskId)` est ensuite repris par `HubPage`, qui
 *     affiche un état "Analyse en cours" et bascule sur la conversation
 *     finale dès que `summary_id` est disponible.
 *
 * Avantage : feedback visuel **immédiat** (la home n'attend pas la fin de
 * l'analyse, l'utilisateur voit déjà le Hub avec le placeholder loading).
 *
 * Utilisé par :
 *   - `DashboardPageMinimal` (home minimale : input URL + Tournesol cards)
 *   - `ConversationsDrawer` (barre input directe dans le drawer Hub)
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { videoApi } from "../services/api";
import { useTranslation } from "./useTranslation";

export interface AnalyzeState {
  /** True pendant l'appel `videoApi.analyze` (avant le navigate). */
  analyzing: boolean;
  error: string | null;
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
        const resp = await videoApi.analyze(
          trimmed,
          "auto",
          "standard",
          undefined,
          false,
          language,
        );
        // Cache hit : l'analyse retourne déjà un `summary_id`. Navigate sur
        // la conversation directement.
        if (resp.result?.summary_id) {
          setState({ analyzing: false, error: null });
          navigate(`/hub?conv=${resp.result.summary_id}`);
          return;
        }
        // Cas standard : on a un `task_id`. On navigue vers le Hub avec
        // `?analyzing=<taskId>` ; HubPage prend le relais pour le polling et
        // affiche le placeholder loading.
        setState({ analyzing: false, error: null });
        navigate(`/hub?analyzing=${resp.task_id}`);
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
    [language, navigate],
  );

  return { ...state, analyze, resetError };
};

export default useAnalyzeAndOpenHub;
