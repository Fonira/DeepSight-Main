/**
 * useAuthResumeHandler — auth V2 step 1
 *
 * Quand l'app revient au foreground (transition `background|inactive → active`),
 * ping `GET /api/auth/me` pour valider la session JWT en cours :
 *   - 200      → no-op (token encore valide)
 *   - 401      → forceLogout() (clear tokens + redirect /(auth))
 *   - 5xx      → retry 1× après 2s puis log Sentry et no-op
 *   - autre    → log Sentry et no-op
 *
 * Sans ce hook, l'utilisateur tombait sur des 401 silencieux jusqu'à un refresh
 * réflexe car l'access token (60min, Sprint C 2026-05-21) peut expirer pendant
 * que l'app est en arrière-plan.
 *
 * Early-return si non authentifié — le hook ne fait rien tant qu'aucune session
 * n'est active.
 */
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { authApi, ApiError } from "../services/api";
import { captureException, captureMessage } from "../services/CrashReporting";

interface UseAuthResumeHandlerOptions {
  /** Indique si une session utilisateur est active. Le hook no-op si false. */
  isAuthenticated: boolean;
  /** Callback appelé sur 401 — doit clear tokens + rediriger /(auth). */
  forceLogout: () => Promise<void> | void;
}

const RETRY_DELAY_MS = 2000;

export function useAuthResumeHandler({
  isAuthenticated,
  forceLogout,
}: UseAuthResumeHandlerOptions): void {
  // Refs pour éviter de re-binder le listener AppState sur chaque render.
  const isAuthenticatedRef = useRef(isAuthenticated);
  const forceLogoutRef = useRef(forceLogout);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    forceLogoutRef.current = forceLogout;
  }, [forceLogout]);

  useEffect(() => {
    const pingMe = async (isRetry = false): Promise<void> => {
      try {
        await authApi.getMe();
        // 200 → no-op, token encore valide.
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            // Session révoquée ou expirée côté serveur → force logout.
            try {
              await forceLogoutRef.current();
            } catch (logoutErr) {
              captureException(logoutErr, {
                tags: { source: "useAuthResumeHandler", reason: "logout_failed" },
              });
            }
            return;
          }

          if (err.status >= 500 && !isRetry) {
            // 5xx → retry 1× après 2s.
            setTimeout(() => {
              if (isAuthenticatedRef.current) {
                void pingMe(true);
              }
            }, RETRY_DELAY_MS);
            return;
          }

          if (err.status >= 500) {
            // Retry échoué → log Sentry et no-op (pas de logout sur infra).
            captureMessage(
              "[useAuthResumeHandler] /me returned 5xx after retry",
              "warning",
              { tags: { source: "useAuthResumeHandler", status: String(err.status) } },
            );
            return;
          }

          // Autre status code (4xx hors 401) → log et no-op.
          captureMessage(
            `[useAuthResumeHandler] /me returned ${err.status}`,
            "info",
            { tags: { source: "useAuthResumeHandler", status: String(err.status) } },
          );
          return;
        }

        // Erreur non-API (réseau, parse, etc.) → log et no-op.
        captureException(err, {
          tags: { source: "useAuthResumeHandler", reason: "unknown_error" },
        });
      }
    };

    const handleAppStateChange = (nextState: AppStateStatus): void => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // Transition background|inactive → active.
      const cameToForeground =
        (prevState === "background" || prevState === "inactive") &&
        nextState === "active";

      if (!cameToForeground) return;
      if (!isAuthenticatedRef.current) return;

      void pingMe();
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, []);
}

export default useAuthResumeHandler;
