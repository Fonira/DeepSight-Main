/**
 * useAnalyzeAndOpenHub — hook réutilisable qui encapsule le pipeline d'analyse
 * vidéo (paste URL → `videoApi.analyze` → polling `videoApi.getTaskStatus`) et,
 * sur succès, navigue vers `/hub?conv=<summary_id>` pour ouvrir la session
 * conversationnelle dans le Hub.
 *
 * Utilisé par :
 *   - `NewConversationModal` (bouton "+ Nouvelle" du drawer Hub)
 *   - `DashboardPageMinimal` (home minimale : SmartInputBar + Tournesol cards)
 *
 * Garanties :
 *   - Annule proprement le polling si le composant unmount ou si une nouvelle
 *     analyse est lancée (cleanup interval).
 *   - Timeout 5 min par défaut (POLL_MAX_DURATION_MS).
 *   - Validation d'URL minimaliste : pas de regex stricte ici (déléguée à
 *     l'appelant via un guard `isValidVideoUrl` si nécessaire). Le hook
 *     accepte toute URL non vide et laisse l'API renvoyer une erreur si elle
 *     ne reconnaît pas la plateforme.
 *   - Statuses d'échec gérés : `failed | cancelled` (cf. `TaskStatus.status`
 *     dans `services/api.ts`).
 *
 * Inputs côté caller : `analyze(url)`. Le hook expose `{ analyzing, progress,
 * message, error, analyze }` pour que le caller affiche son propre UI de
 * progress.
 *
 * NOTE : ne dépend PAS du store Hub. Le caller qui veut additionnellement
 * mettre à jour l'état du Hub (re-fetch conversations, setActiveConv) doit le
 * faire dans son propre `onSuccess` — ce qui n'est pas le cas par défaut, car
 * la navigation vers `/hub?conv=<id>` déclenche un fresh load de HubPage.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { videoApi } from "../services/api";
import { useTranslation } from "./useTranslation";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_DURATION_MS = 5 * 60 * 1000; // 5 min

export interface AnalyzeState {
  analyzing: boolean;
  progress: number;
  message: string;
  error: string | null;
}

export interface UseAnalyzeAndOpenHubReturn extends AnalyzeState {
  /** Lance l'analyse de l'URL fournie. Sur succès, navigue vers `/hub?conv=<id>`. */
  analyze: (url: string) => Promise<void>;
  /** Reset manuel de l'erreur (utile entre deux essais). */
  resetError: () => void;
}

export const useAnalyzeAndOpenHub = (): UseAnalyzeAndOpenHubReturn => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const [state, setState] = useState<AnalyzeState>({
    analyzing: false,
    progress: 0,
    message: "",
    error: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const progressRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup at unmount.
  useEffect(() => () => cleanup(), [cleanup]);

  const resetError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const analyze = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        setState((s) => ({
          ...s,
          error:
            language === "fr"
              ? "URL invalide. Collez un lien YouTube ou TikTok."
              : "Invalid URL. Paste a YouTube or TikTok link.",
        }));
        return;
      }

      cleanup();
      progressRef.current = 5;
      setState({
        analyzing: true,
        progress: 5,
        message:
          language === "fr" ? "Démarrage de l'analyse…" : "Starting analysis…",
        error: null,
      });

      try {
        const resp = await videoApi.analyze(
          trimmed,
          "auto",
          "standard",
          undefined,
          false,
          language,
        );
        // Cache hit immédiat : l'analyse retourne déjà un summary_id.
        if (resp.result?.summary_id) {
          progressRef.current = 100;
          setState({
            analyzing: false,
            progress: 100,
            message: "",
            error: null,
          });
          navigate(`/hub?conv=${resp.result.summary_id}`);
          return;
        }
        const taskId = resp.task_id;
        pollStartRef.current = Date.now();

        pollRef.current = setInterval(async () => {
          try {
            if (Date.now() - pollStartRef.current > POLL_MAX_DURATION_MS) {
              cleanup();
              setState((s) => ({
                ...s,
                analyzing: false,
                error:
                  language === "fr"
                    ? "L'analyse prend trop de temps. Réessayez plus tard."
                    : "Analysis is taking too long. Please try again later.",
              }));
              return;
            }
            const status = await videoApi.getTaskStatus(taskId);
            if (typeof status.progress === "number") {
              const next = Math.max(progressRef.current, status.progress);
              progressRef.current = next;
              setState((s) => ({
                ...s,
                progress: next,
                message: status.message || s.message,
              }));
            } else if (status.message) {
              setState((s) => ({ ...s, message: status.message || s.message }));
            }

            if (status.status === "completed" && status.result?.summary_id) {
              cleanup();
              progressRef.current = 100;
              setState({
                analyzing: false,
                progress: 100,
                message: "",
                error: null,
              });
              navigate(`/hub?conv=${status.result.summary_id}`);
            } else if (
              status.status === "failed" ||
              status.status === "cancelled"
            ) {
              cleanup();
              setState((s) => ({
                ...s,
                analyzing: false,
                error:
                  status.error ||
                  (language === "fr"
                    ? "L'analyse a échoué. Veuillez réessayer."
                    : "Analysis failed. Please try again."),
              }));
            }
          } catch (err) {
            cleanup();
            setState((s) => ({
              ...s,
              analyzing: false,
              error:
                err instanceof Error
                  ? err.message
                  : language === "fr"
                    ? "Erreur lors du polling."
                    : "Polling error.",
            }));
          }
        }, POLL_INTERVAL_MS);
      } catch (err) {
        setState((s) => ({
          ...s,
          analyzing: false,
          error:
            err instanceof Error
              ? err.message
              : language === "fr"
                ? "Erreur lors de l'analyse."
                : "Analysis error.",
        }));
      }
    },
    [language, navigate, cleanup],
  );

  return { ...state, analyze, resetError };
};

export default useAnalyzeAndOpenHub;
