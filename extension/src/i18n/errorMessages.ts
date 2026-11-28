/**
 * Traduit une erreur renvoyée par le service worker en message affichable.
 *
 * Le SW ne connaît pas la langue de l'UI : il renvoie le message du backend
 * (souvent en français) et un `errorCode` machine. Les codes connus sont
 * traduits ici (FR/EN) ; sinon on affiche le message du backend tel quel.
 */

import type fr from "./fr.json";

export type ErrorTranslations = (typeof fr)["errors"];

export interface ErrorLike {
  error?: string;
  errorCode?: string;
  retryAfter?: number;
}

/** Messages « machine » historiques encore émis par certains chemins. */
const LEGACY_CODES: Record<string, string> = {
  SESSION_EXPIRED: "session_expired",
  NETWORK_ERROR: "network_error",
  SW_TIMEOUT: "network_error",
  "Failed to fetch": "network_error",
  AUTH_REQUIRED: "auth_required",
  RATE_LIMITED: "rate_limited",
  EMAIL_NOT_VERIFIED: "email_not_verified",
};

function resolveCode(source: ErrorLike): string | undefined {
  if (source.errorCode) return source.errorCode;
  return source.error ? LEGACY_CODES[source.error] : undefined;
}

export function localizeError(
  errors: ErrorTranslations,
  source: ErrorLike | string | null | undefined,
  fallback?: string,
): string {
  const normalized: ErrorLike =
    typeof source === "string" ? { error: source } : (source ?? {});

  switch (resolveCode(normalized)) {
    case "private_mode":
      return errors.privateMode;
    case "payments_unavailable":
      return errors.paymentsUnavailable;
    case "rate_limited":
      return normalized.retryAfter
        ? errors.rateLimited.replace("{seconds}", String(normalized.retryAfter))
        : errors.rateLimitedShort;
    case "session_expired":
      return errors.sessionExpired;
    case "network_error":
      return errors.network;
    case "auth_required":
      return errors.authRequired;
    case "google_oauth_unavailable":
      return errors.googleUnavailable;
    case "voice_service_unavailable":
      return errors.voiceUnavailable;
    case "voice_service_error":
      return errors.voiceServiceError;
    case "voice_call_disabled":
      return errors.voiceCallDisabled;
    case "voice_connection_failed":
      return errors.voiceConnectionFailed;
    case "mic_denied":
      return errors.micDenied;
    case "mic_dismissed":
      return errors.micDismissed;
    case "mic_not_found":
      return errors.micNotFound;
    case "email_not_verified":
      return errors.emailNotVerified;
    case "user_not_registered":
      return errors.userNotRegistered;
    case "invalid_url":
      return errors.invalidUrl;
    case "guest_quota_exhausted":
      return errors.guestQuota;
    default:
      break;
  }

  const message = normalized.error?.trim();
  if (message && message !== "[object Object]") return message;
  return fallback ?? errors.generic;
}
