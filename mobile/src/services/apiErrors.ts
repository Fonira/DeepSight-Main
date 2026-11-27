/**
 * ApiError + lecture des corps d'erreur de l'API DeepSight.
 *
 * FastAPI renvoie `detail` sous trois formes :
 *   - chaîne  : {"detail": "Summary not found"}
 *   - objet   : {"detail": {"code": "private_mode", "message": "…"}}
 *               (private_mode 403, payments_unavailable 503, not_authenticated 401…)
 *   - tableau : {"detail": [{"loc": […], "msg": "…", "type": "…"}]} (validation 422)
 *
 * Le middleware de rate limit renvoie
 *   {"detail": "Rate limit exceeded", "message": "Trop de requêtes…", "retry_after": 12}
 * avec l'en-tête `Retry-After`.
 *
 * Même ordre de lecture que `frontend/src/services/api.ts` (detail.message,
 * detail.error, tableau Pydantic) pour que web et mobile affichent le même texte.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public detail?: string,
    public retryAfterMs?: number,
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  // Helper to check if this is an email verification required error
  get isEmailNotVerified(): boolean {
    return (
      this.status === 403 &&
      (this.code === "EMAIL_NOT_VERIFIED" ||
        this.detail === "EMAIL_NOT_VERIFIED")
    );
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export interface ParsedApiError {
  message: string;
  code?: string;
  /** `detail` d'origine, seulement quand c'est une chaîne (ex. "EMAIL_NOT_VERIFIED"). */
  detail?: string;
  retryAfterMs?: number;
  data?: Record<string, unknown>;
}

export const RATE_LIMITED_CODE = "RATE_LIMITED";
export const VALIDATION_ERROR_CODE = "VALIDATION_ERROR";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const nonNegativeNumber = (value: unknown): number | undefined => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
};

function messageFromDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return nonEmptyString(detail);

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item: unknown) => {
        if (isRecord(item)) return nonEmptyString(item.msg);
        return nonEmptyString(item);
      })
      .filter((part): part is string => part !== undefined);
    return parts.length > 0 ? parts.join(", ") : undefined;
  }

  if (isRecord(detail)) {
    const nested = isRecord(detail.error) ? detail.error : undefined;
    return (
      nonEmptyString(detail.message) ??
      nonEmptyString(detail.error) ??
      nonEmptyString(nested?.message) ??
      nonEmptyString(nested?.code)
    );
  }

  return undefined;
}

function explicitCode(
  payload: Record<string, unknown>,
  detail: unknown,
): string | undefined {
  if (nonEmptyString(payload.code)) return nonEmptyString(payload.code);
  if (!isRecord(detail)) return undefined;
  const nested = isRecord(detail.error) ? detail.error : undefined;
  return nonEmptyString(detail.code) ?? nonEmptyString(nested?.code);
}

/**
 * Délai de `Retry-After` en millisecondes : en-tête (secondes ou date HTTP),
 * sinon `retry_after` / `wait_seconds` du corps.
 */
export function parseRetryAfterMs(
  headerValue: string | null | undefined,
  payload?: unknown,
  now: number = Date.now(),
): number | undefined {
  if (headerValue) {
    const seconds = nonNegativeNumber(headerValue.trim());
    if (seconds !== undefined) return Math.round(seconds * 1000);
    const date = Date.parse(headerValue);
    if (!Number.isNaN(date)) return Math.max(0, date - now);
  }

  if (!isRecord(payload)) return undefined;
  const detail = isRecord(payload.detail) ? payload.detail : undefined;
  const seconds =
    nonNegativeNumber(payload.retry_after) ??
    nonNegativeNumber(detail?.retry_after) ??
    nonNegativeNumber(detail?.wait_seconds);
  return seconds !== undefined ? Math.round(seconds * 1000) : undefined;
}

/**
 * Transforme le corps d'une réponse d'erreur en message lisible + code.
 * Ne renvoie jamais un objet dans `message` (fini « [object Object] »).
 */
export function parseApiErrorPayload(
  status: number,
  payload: unknown,
  retryAfterHeader?: string | null,
  fallbackMessage = "Request failed",
): ParsedApiError {
  const body = isRecord(payload) ? payload : {};
  const detail = body.detail;
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader, body);

  const message =
    nonEmptyString(body.message) ??
    messageFromDetail(detail) ??
    nonEmptyString(body.error) ??
    fallbackMessage;

  let code = explicitCode(body, detail);
  if (!code && Array.isArray(detail)) code = VALIDATION_ERROR_CODE;
  if (!code && status === 429 && retryAfterMs !== undefined) {
    code = RATE_LIMITED_CODE;
  }
  // Compat : certains endpoints mettent le code directement dans `detail`
  // (ex. "EMAIL_NOT_VERIFIED").
  if (!code && typeof detail === "string") code = nonEmptyString(detail);

  return {
    message,
    code,
    detail: typeof detail === "string" ? detail : undefined,
    retryAfterMs,
    data: isRecord(payload) ? payload : undefined,
  };
}

/** Lit une réponse HTTP en échec et construit l'ApiError correspondante. */
export async function apiErrorFromResponse(
  response: Response,
  fallbackMessage = "Request failed",
): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const headers = response.headers as Headers | undefined;
  const retryAfterHeader =
    headers && typeof headers.get === "function"
      ? headers.get("Retry-After")
      : null;

  const parsed = parseApiErrorPayload(
    response.status,
    payload,
    retryAfterHeader,
    fallbackMessage,
  );

  return new ApiError(
    parsed.message,
    response.status,
    parsed.code,
    parsed.detail,
    parsed.retryAfterMs,
    parsed.data,
  );
}
