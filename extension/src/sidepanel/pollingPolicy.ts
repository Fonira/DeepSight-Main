/**
 * Politique de polling du statut d'analyse (side panel → GET_TASK_STATUS).
 *
 * Avant : `setInterval` de 2,5 s qui ignorait silencieusement toute erreur.
 * Une 429, une session expirée ou une tâche introuvable (404) faisaient donc
 * boucler le polling indéfiniment sur un spinner. Ici on décide, après chaque
 * échec, de continuer (avec quel délai) ou d'arrêter.
 */

import type { MessageResponse } from "../types";

export const POLL_INTERVAL_MS = 2500;
/** Échecs consécutifs (réseau, 5xx) tolérés avant d'abandonner. */
export const MAX_POLL_FAILURES = 5;
/** Délai maximal entre deux tentatives après des échecs. */
export const MAX_POLL_BACKOFF_MS = 30_000;
/** Au-delà, on arrête de suivre l'analyse depuis le side panel. */
export const MAX_POLL_DURATION_MS = 30 * 60 * 1000;

export type PollDecision =
  | { kind: "continue"; delayMs: number }
  | { kind: "stop" };

type PollError = Pick<MessageResponse, "errorCode" | "httpStatus" | "retryAfter">;

/** Erreurs pour lesquelles réessayer ne changera rien. */
const FATAL_CODES = new Set([
  "session_expired",
  "auth_required",
  "private_mode",
]);

/**
 * @param failures nombre d'échecs consécutifs, celui-ci inclus (les 429 ne
 *                 comptent pas : le serveur indique quand revenir).
 */
export function decidePollAfterError(
  error: PollError,
  failures: number,
  baseDelayMs: number = POLL_INTERVAL_MS,
): PollDecision {
  if (error.errorCode === "rate_limited") {
    const waitMs = (error.retryAfter ?? 60) * 1000;
    return { kind: "continue", delayMs: Math.max(baseDelayMs, waitMs) };
  }
  if (error.errorCode && FATAL_CODES.has(error.errorCode)) {
    return { kind: "stop" };
  }
  const status = error.httpStatus ?? 0;
  if (status >= 400 && status < 500) {
    // 403/404 (tâche introuvable, accès refusé)… : pas de nouvelle tentative.
    return { kind: "stop" };
  }
  if (failures >= MAX_POLL_FAILURES) {
    return { kind: "stop" };
  }
  const backoff = baseDelayMs * 2 ** Math.max(0, failures - 1);
  return { kind: "continue", delayMs: Math.min(backoff, MAX_POLL_BACKOFF_MS) };
}
