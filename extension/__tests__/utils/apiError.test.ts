/**
 * Tests — utils/apiError.ts
 *
 * Bug couvert : `new Error(body.detail)` affichait « [object Object] » dès
 * que FastAPI renvoyait `detail` sous forme d'objet (private_mode,
 * payments_unavailable, quotas…) ou de tableau (422).
 */

import {
  ApiError,
  apiErrorFromResponse,
  buildApiError,
  networkError,
  parseRetryAfter,
  toErrorResponse,
} from "../../src/utils/apiError";

describe("buildApiError", () => {
  it("keeps a plain string detail", () => {
    const err = buildApiError(404, { detail: "Summary not found" });
    expect(err.message).toBe("Summary not found");
    expect(err.status).toBe(404);
    expect(err.code).toBeUndefined();
  });

  it("reads code + message from an object detail (private_mode)", () => {
    const err = buildApiError(403, {
      detail: { code: "private_mode", message: "Accès privé." },
    });
    expect(err.message).toBe("Accès privé.");
    expect(err.code).toBe("private_mode");
    expect(err.detail).toEqual({ code: "private_mode", message: "Accès privé." });
  });

  it("reads payments_unavailable (503)", () => {
    const err = buildApiError(503, {
      detail: { code: "payments_unavailable", message: "Paiements indisponibles" },
    });
    expect(err.code).toBe("payments_unavailable");
    expect(err.message).toBe("Paiements indisponibles");
  });

  it("falls back to the code when an object detail has no message", () => {
    const err = buildApiError(404, {
      detail: { code: "user_not_registered", email: "a@b.c" },
    });
    expect(err.code).toBe("user_not_registered");
    expect(err.message).not.toContain("[object Object]");
  });

  it("turns upper-case string details into codes", () => {
    const err = buildApiError(403, { detail: "EMAIL_NOT_VERIFIED" });
    expect(err.code).toBe("email_not_verified");
    expect(err.message).toBe("EMAIL_NOT_VERIFIED");
  });

  it("joins 422 validation errors", () => {
    const err = buildApiError(422, {
      detail: [
        { loc: ["body", "url"], msg: "Field required" },
        { loc: ["body", "mode"], msg: "Input should be a valid string" },
      ],
    });
    expect(err.code).toBe("validation_error");
    expect(err.message).toBe(
      "Field required · Input should be a valid string",
    );
  });

  it("uses the middleware 429 body (top-level message + retry_after)", () => {
    const err = buildApiError(
      429,
      {
        detail: "Rate limit exceeded",
        retry_after: 42,
        message: "Trop de requêtes. Réessayez dans 42 secondes.",
      },
      "42",
    );
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfter).toBe(42);
    expect(err.message).toBe("Trop de requêtes. Réessayez dans 42 secondes.");
  });

  it("normalises the decorator 429 shape (detail object without header)", () => {
    const err = buildApiError(429, {
      detail: { message: "Rate limit exceeded", retry_after: 15 },
    });
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfter).toBe(15);
  });

  it("uses wait_seconds from the per-user 429", () => {
    const err = buildApiError(429, {
      detail: {
        code: "rate_limit_exceeded",
        message: "Too many requests",
        wait_seconds: 30,
      },
    });
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfter).toBe(30);
    expect(err.detail?.code).toBe("rate_limit_exceeded");
  });

  it("falls back to the provided message, then to the status", () => {
    expect(buildApiError(500, null, null, "Login failed").message).toBe(
      "Login failed",
    );
    expect(buildApiError(502, null).message).toBe("API Error: 502");
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds and clamps to [1, 3600]", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter("0.2")).toBe(1);
    expect(parseRetryAfter("99999")).toBe(3600);
  });

  it("parses an HTTP date", () => {
    const now = Date.parse("2026-11-27T10:00:00Z");
    expect(parseRetryAfter("Fri, 27 Nov 2026 10:01:00 GMT", null, now)).toBe(60);
  });

  it("returns undefined without usable information", () => {
    expect(parseRetryAfter(null, { detail: "nope" })).toBeUndefined();
    expect(parseRetryAfter("garbage")).toBeUndefined();
  });
});

describe("apiErrorFromResponse", () => {
  it("survives a non-JSON body and reads the Retry-After header", async () => {
    const err = await apiErrorFromResponse({
      status: 429,
      headers: { get: (name: string) => (name === "Retry-After" ? "12" : null) },
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfter).toBe(12);
  });
});

describe("toErrorResponse", () => {
  it("serialises every ApiError field", () => {
    const res = toErrorResponse(
      new ApiError({
        status: 402,
        code: "voice_quota",
        message: "Quota atteint",
        detail: { reason: "trial_used" },
      }),
    );
    expect(res).toEqual({
      success: false,
      error: "Quota atteint",
      errorCode: "voice_quota",
      httpStatus: 402,
      errorDetail: { reason: "trial_used" },
    });
  });

  it("keeps the legacy NETWORK_ERROR message for network failures", () => {
    expect(toErrorResponse(networkError())).toEqual({
      success: false,
      error: "NETWORK_ERROR",
      errorCode: "network_error",
    });
  });

  it("handles plain errors and non-errors", () => {
    expect(toErrorResponse(new Error("boom"))).toEqual({
      success: false,
      error: "boom",
    });
    expect(toErrorResponse("raw")).toEqual({ success: false, error: "raw" });
  });
});
