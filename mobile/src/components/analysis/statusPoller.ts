/**
 * Polling du statut d'une analyse (/api/videos/status/{task_id}).
 *
 * - Une seule requête à la fois : le sondage suivant n'est programmé qu'après la
 *   réponse du précédent (avant : setInterval de 3 s, requêtes empilées).
 * - 429 : on attend Retry-After (plafonné à 60 s) sans compter d'échec — l'analyse
 *   continue côté serveur, la limite de 300 req/min/IP ne doit pas l'interrompre.
 * - Disjoncteur ouvert (CIRCUIT_OPEN) : on espace les sondages.
 * - Statut "failed" : échec affiché après 3 réponses consécutives (le compteur était
 *   remis à zéro à chaque réponse, l'échec ne s'affichait jamais).
 */
import { CIRCUIT_OPEN_CODE } from "../../services/RetryService";
import type { AnalysisStatus } from "../../types";

export const POLL_INTERVAL_MS = 3000;
export const MAX_RATE_LIMIT_WAIT_MS = 60_000;
export const CIRCUIT_OPEN_WAIT_MS = 10_000;
export const MAX_TRANSIENT_FAILURES = 10;
export const MAX_NOT_FOUND = 3;
export const MAX_FAILED_STATUSES = 3;

export type PollerOutcome =
  | { type: "completed"; summaryId?: string }
  | { type: "cancelled" }
  | { type: "failed"; message?: string }
  | { type: "notFound" }
  | { type: "connectionLost" };

export interface StatusPollerOptions {
  taskId: string;
  getStatus: (taskId: string) => Promise<AnalysisStatus>;
  onProgress: (progress: number, summaryId?: string) => void;
  onOutcome: (outcome: PollerOutcome) => void;
  intervalMs?: number;
}

export interface StatusPoller {
  start: () => void;
  stop: () => void;
}

interface ErrorInfo {
  status?: number;
  code?: string;
  retryAfterMs?: number;
}

function toErrorInfo(error: unknown): ErrorInfo {
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    status: typeof record.status === "number" ? record.status : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    retryAfterMs:
      typeof record.retryAfterMs === "number" ? record.retryAfterMs : undefined,
  };
}

/** Délai avant le prochain sondage après un 429. */
export function rateLimitDelay(
  retryAfterMs: number | undefined,
  intervalMs: number = POLL_INTERVAL_MS,
): number {
  const wanted = retryAfterMs ?? intervalMs * 5;
  return Math.min(Math.max(wanted, intervalMs), MAX_RATE_LIMIT_WAIT_MS);
}

export function createStatusPoller(options: StatusPollerOptions): StatusPoller {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;
  let inFlight = false;
  let transientFailures = 0;
  let notFound = 0;
  let failedStatuses = 0;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const schedule = (delayMs: number) => {
    if (stopped) return;
    clearTimer();
    timer = setTimeout(() => {
      void tick();
    }, delayMs);
  };

  const finish = (outcome: PollerOutcome) => {
    stopped = true;
    clearTimer();
    options.onOutcome(outcome);
  };

  const handleStatus = (status: AnalysisStatus) => {
    transientFailures = 0;
    notFound = 0;
    options.onProgress(status.progress, status.summary_id);

    if (status.status === "cancelled") {
      finish({ type: "cancelled" });
      return;
    }
    if (status.status === "completed" || status.status === "done") {
      finish({ type: "completed", summaryId: status.summary_id });
      return;
    }
    if (status.status === "failed" || status.status === "error") {
      failedStatuses += 1;
      if (failedStatuses >= MAX_FAILED_STATUSES) {
        finish({ type: "failed", message: status.error });
        return;
      }
    } else {
      failedStatuses = 0;
    }
    schedule(intervalMs);
  };

  const handleError = (error: unknown) => {
    const info = toErrorInfo(error);

    // Session expirée : le refresh de jeton s'en charge, on continue.
    if (info.status === 401 || info.code === "SESSION_EXPIRED") {
      schedule(intervalMs);
      return;
    }

    // Tâche inconnue (serveur redémarré, autre compte).
    if (info.status === 404) {
      notFound += 1;
      if (notFound >= MAX_NOT_FOUND) {
        finish({ type: "notFound" });
        return;
      }
      schedule(intervalMs);
      return;
    }

    // Limite de requêtes : on attend, sans compter d'échec.
    if (info.status === 429) {
      schedule(rateLimitDelay(info.retryAfterMs, intervalMs));
      return;
    }

    // Réseau, timeout, 5xx, disjoncteur ouvert : transitoire.
    transientFailures += 1;
    if (transientFailures >= MAX_TRANSIENT_FAILURES) {
      finish({ type: "connectionLost" });
      return;
    }
    schedule(info.code === CIRCUIT_OPEN_CODE ? CIRCUIT_OPEN_WAIT_MS : intervalMs);
  };

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const status = await options.getStatus(options.taskId);
      if (!stopped) handleStatus(status);
    } catch (error: unknown) {
      if (!stopped) handleError(error);
    } finally {
      inFlight = false;
    }
  };

  return {
    start: () => {
      if (!stopped) return;
      stopped = false;
      transientFailures = 0;
      notFound = 0;
      failedStatuses = 0;
      void tick();
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
  };
}
