/**
 * Tests — i18n/errorMessages.ts (traduction des codes d'erreur du SW).
 */

import fr from "../../src/i18n/fr.json";
import en from "../../src/i18n/en.json";
import { localizeError } from "../../src/i18n/errorMessages";

describe("localizeError", () => {
  it("translates known API codes in both languages", () => {
    const source = { error: "message serveur", errorCode: "private_mode" };
    expect(localizeError(fr.errors, source)).toBe(fr.errors.privateMode);
    expect(localizeError(en.errors, source)).toBe(en.errors.privateMode);
    expect(
      localizeError(fr.errors, { errorCode: "payments_unavailable" }),
    ).toBe(fr.errors.paymentsUnavailable);
  });

  it("includes the Retry-After delay for rate limits", () => {
    expect(
      localizeError(fr.errors, { errorCode: "rate_limited", retryAfter: 42 }),
    ).toBe("Trop de requêtes. Réessayez dans 42 s.");
    expect(localizeError(en.errors, { errorCode: "rate_limited" })).toBe(
      en.errors.rateLimitedShort,
    );
  });

  it("maps legacy machine strings", () => {
    expect(localizeError(fr.errors, "SESSION_EXPIRED")).toBe(
      fr.errors.sessionExpired,
    );
    expect(localizeError(fr.errors, "NETWORK_ERROR")).toBe(fr.errors.network);
    expect(localizeError(fr.errors, { error: "SW_TIMEOUT" })).toBe(
      fr.errors.network,
    );
    expect(localizeError(en.errors, "AUTH_REQUIRED")).toBe(
      en.errors.authRequired,
    );
  });

  it("shows the backend message for unknown codes", () => {
    expect(
      localizeError(fr.errors, {
        error: "Crédits insuffisants",
        errorCode: "insufficient_credits",
      }),
    ).toBe("Crédits insuffisants");
  });

  it("never displays [object Object]", () => {
    expect(localizeError(fr.errors, "[object Object]", "Échec")).toBe("Échec");
    expect(localizeError(fr.errors, undefined)).toBe(fr.errors.generic);
  });
});
