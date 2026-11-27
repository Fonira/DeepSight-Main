/**
 * Normalisation des erreurs de l'API DeepSight.
 *
 * FastAPI renvoie `detail` sous plusieurs formes :
 *   - chaîne                       → `{"detail": "Summary not found"}`
 *   - objet `{code, message, …}`   → private_mode, payments_unavailable,
 *                                    quotas, voice_service_unavailable…
 *   - tableau (422 de validation)  → `[{loc, msg, type}, …]`
 * et le rate limiter ajoute `message` + `retry_after` à la racine du corps
 * (plus l'en-tête `Retry-After`).
 *
 * `new Error(body.detail)` affichait donc « [object Object] » dès que le
 * backend renvoyait un objet. Tout passe désormais par `buildApiError`, qui
 * produit toujours un message lisible et expose le `code` machine pour que
 * l'UI puisse le traduire.
 */

import type { MessageResponse } from "../types";

/** Codes produits côté extension (en plus de ceux renvoyés par l'API). */
export const ERROR_CODES = {
  SESSION_EXPIRED: "session_expired",
  NETWORK: "network_error",
  RATE_LIMITED: "rate_limited",
  AUTH_REQUIRED: "auth_required",
  GOOGLE_UNAVAILABLE: "google_oauth_unavailable",
  VALIDATION: "validation_error",
} as const;

/**
 * Messages « machine » historiques, conservés tels quels : plusieurs
 * composants (useConversation, RevokeAllDevicesButton) comparent encore
 * `response.error` à ces chaînes.
 */
export const LEGACY_ERROR_MESSAGES = {
  SESSION_EXPIRED: "SESSION_EXPIRED",
  NETWORK_ERROR: "NETWORK_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
} as const;

/** Bornes du délai d'attente accepté depuis `Retry-After` (secondes). */
const MIN_RETRY_AFTER_S = 1;
const MAX_RETRY_AFTER_S = 3600;

export interface ApiErrorInit {
  status: number;
  message: string;
  code?: string;
  retryAfter?: number;
  detail?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  /** Secondes à attendre avant de réessayer (429 uniquement). */
  readonly retryAfter?: number;
  /** `detail` brut quand l'API renvoie un objet (ex. quota voice 402). */
  readonly detail?: Record<string, unknown>;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.retryAfter = init.retryAfter;
    this.detail = init.detail;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function clampRetryAfter(seconds: number): number | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.min(
    MAX_RETRY_AFTER_S,
    Math.max(MIN_RETRY_AFTER_S, Math.ceil(seconds)),
  );
}

/**
 * Lit le délai d'attente d'une 429 : en-tête `Retry-After` (secondes ou date
 * HTTP), sinon `retry_after` / `wait_seconds` dans le corps ou dans `detail`.
 */
export function parseRetryAfter(
  header: string | null | undefined,
  body?: unknown,
  now: number = Date.now(),
): number | undefined {
  const raw = nonEmptyString(header);
  if (raw) {
    if (/^\d+(\.\d+)?$/.test(raw)) {
      const fromSeconds = clampRetryAfter(Number(raw));
      if (fromSeconds !== undefined) return fromSeconds;
    } else {
      const date = Date.parse(raw);
      if (!Number.isNaN(date)) {
        const fromDate = clampRetryAfter((date - now) / 1000);
        if (fromDate !== undefined) return fromDate;
      }
    }
  }

  const sources: unknown[] = [body];
  if (isRecord(body)) sources.push(body.detail);
  for (const source of sources) {
    if (!isRecord(source)) continue;
    for (const key of ["retry_after", "wait_seconds"]) {
      const value = source[key];
      if (typeof value === "number") {
        const seconds = clampRetryAfter(value);
        if (seconds !== undefined) return seconds;
      }
    }
  }
  return undefined;
}

/** Messages des erreurs de validation Pydantic (422). */
function validationMessage(detail: unknown[]): string | undefined {
  const messages = detail
    .map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item)) return nonEmptyString(item.msg);
      return undefined;
    })
    .filter((msg): msg is string => Boolean(msg));
  return messages.length > 0 ? messages.join(" · ") : undefined;
}

/** `EMAIL_NOT_VERIFIED`, `SESSION_EXPIRED`… → codes en minuscules. */
function codeFromString(detail: string): string | undefined {
  return /^[A-Z][A-Z0-9_]{2,}$/.test(detail) ? detail.toLowerCase() : undefined;
}

/**
 * Construit une `ApiError` lisible à partir du statut HTTP et du corps JSON
 * (déjà parsé, ou `null` si le corps n'était pas du JSON).
 */
export function buildApiError(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
  fallbackMessage?: string,
): ApiError {
  const detail = isRecord(body) ? body.detail : undefined;
  const detailObject = isRecord(detail) ? detail : undefined;

  let code = detailObject ? nonEmptyString(detailObject.code) : undefined;
  let message =
    (detailObject &&
      (nonEmptyString(detailObject.message) ??
        nonEmptyString(detailObject.detail) ??
        nonEmptyString(detailObject.error))) ??
    (isRecord(body) ? nonEmptyString(body.message) : undefined);

  if (!message && typeof detail === "string") {
    message = nonEmptyString(detail);
    code = code ?? codeFromString(detail);
  }
  if (!message && Array.isArray(detail)) {
    message = validationMessage(detail);
    code = code ?? ERROR_CODES.VALIDATION;
  }

  let retryAfter: number | undefined;
  if (status === 429) {
    // Les 429 ont plusieurs formes (middleware, décorateur, quota user) :
    // un seul code côté extension, le code d'origine reste dans `detail`.
    code = ERROR_CODES.RATE_LIMITED;
    retryAfter = parseRetryAfter(retryAfterHeader, body);
  }

  return new ApiError({
    status,
    code,
    message:
      message ?? fallbackMessage ?? `API Error: ${status || "unknown status"}`,
    retryAfter,
    detail: detailObject,
  });
}

interface ResponseLike {
  status?: number;
  headers?: { get?: (name: string) => string | null };
  json?: () => Promise<unknown>;
}

/** Lit le corps d'une réponse en échec et le transforme en `ApiError`. */
export async function apiErrorFromResponse(
  response: ResponseLike,
  fallbackMessage?: string,
): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = response.json ? await response.json() : null;
  } catch {
    body = null;
  }
  const retryAfterHeader = response.headers?.get?.("Retry-After") ?? null;
  return buildApiError(
    response.status ?? 0,
    body,
    retryAfterHeader,
    fallbackMessage,
  );
}

/** Erreur réseau (fetch rejeté : hors ligne, DNS, CORS, coupure). */
export function networkError(): ApiError {
  return new ApiError({
    status: 0,
    code: ERROR_CODES.NETWORK,
    message: LEGACY_ERROR_MESSAGES.NETWORK_ERROR,
  });
}

export type ErrorResponseFields = Pick<
  MessageResponse,
  "success" | "error" | "errorCode" | "httpStatus" | "retryAfter" | "errorDetail"
>;

/**
 * Convertit n'importe quelle erreur levée dans le service worker en réponse
 * sérialisable pour `chrome.runtime.sendMessage` (une instance d'Error ne
 * traverse pas le message passing).
 */
export function toErrorResponse(error: unknown): ErrorResponseFields {
  if (error instanceof ApiError) {
    const response: ErrorResponseFields = {
      success: false,
      error: error.message,
    };
    if (error.code) response.errorCode = error.code;
    if (error.status) response.httpStatus = error.status;
    if (error.retryAfter !== undefined) response.retryAfter = error.retryAfter;
    if (error.detail) response.errorDetail = error.detail;
    return response;
  }
  if (error instanceof Error) {
    return { success: false, error: error.message || "Unknown error" };
  }
  return { success: false, error: String(error ?? "Unknown error") };
}
