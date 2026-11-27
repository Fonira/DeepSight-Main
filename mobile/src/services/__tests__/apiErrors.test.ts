/**
 * apiErrors.test.ts — lecture des corps d'erreur de l'API (detail objet/tableau/chaîne,
 * Retry-After). Régression : un `detail` objet donnait « [object Object] » à l'écran.
 */
import {
  ApiError,
  apiErrorFromResponse,
  parseApiErrorPayload,
  parseRetryAfterMs,
  RATE_LIMITED_CODE,
  VALIDATION_ERROR_CODE,
} from "../apiErrors";

function fakeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON");
      return body;
    },
    headers: { get: (key: string) => lower[key.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe("parseApiErrorPayload", () => {
  it("lit detail.message et detail.code (403 private_mode)", () => {
    const parsed = parseApiErrorPayload(403, {
      detail: {
        code: "private_mode",
        message: "DeepSight est en accès privé pour le moment.",
      },
    });
    expect(parsed.message).toBe("DeepSight est en accès privé pour le moment.");
    expect(parsed.code).toBe("private_mode");
    expect(parsed.detail).toBeUndefined();
  });

  it("lit detail.message et detail.code (503 payments_unavailable)", () => {
    const parsed = parseApiErrorPayload(503, {
      detail: {
        code: "payments_unavailable",
        message: "Les paiements sont temporairement indisponibles.",
      },
    });
    expect(parsed.message).toBe(
      "Les paiements sont temporairement indisponibles.",
    );
    expect(parsed.code).toBe("payments_unavailable");
  });

  it("ne produit jamais « [object Object] » pour un detail objet sans message", () => {
    const parsed = parseApiErrorPayload(500, { detail: { foo: "bar" } });
    expect(parsed.message).toBe("Request failed");
    expect(parsed.message).not.toContain("[object Object]");
  });

  it("joint les messages d'un tableau de validation Pydantic (422)", () => {
    const parsed = parseApiErrorPayload(422, {
      detail: [
        { loc: ["body", "email"], msg: "value is not a valid email address" },
        { loc: ["body", "password"], msg: "field required" },
      ],
    });
    expect(parsed.message).toBe(
      "value is not a valid email address, field required",
    );
    expect(parsed.code).toBe(VALIDATION_ERROR_CODE);
  });

  it("garde la compat EMAIL_NOT_VERIFIED quand detail est une chaîne", () => {
    const parsed = parseApiErrorPayload(403, { detail: "EMAIL_NOT_VERIFIED" });
    expect(parsed.code).toBe("EMAIL_NOT_VERIFIED");
    expect(parsed.detail).toBe("EMAIL_NOT_VERIFIED");
    const err = new ApiError(parsed.message, 403, parsed.code, parsed.detail);
    expect(err.isEmailNotVerified).toBe(true);
  });

  it("préfère le message FR du middleware de rate limit (429)", () => {
    const parsed = parseApiErrorPayload(
      429,
      {
        detail: "Rate limit exceeded",
        retry_after: 12,
        message: "Trop de requêtes. Réessayez dans 12 secondes.",
      },
      "12",
    );
    expect(parsed.message).toBe("Trop de requêtes. Réessayez dans 12 secondes.");
    expect(parsed.code).toBe(RATE_LIMITED_CODE);
    expect(parsed.retryAfterMs).toBe(12000);
  });

  it("lit retry_after dans detail quand il n'y a pas d'en-tête (décorateur 429)", () => {
    const parsed = parseApiErrorPayload(429, {
      detail: { message: "Rate limit exceeded", retry_after: 30 },
    });
    expect(parsed.retryAfterMs).toBe(30000);
    expect(parsed.code).toBe(RATE_LIMITED_CODE);
  });

  it("ne marque pas un quota de chat (429 sans Retry-After) comme rate limit", () => {
    const parsed = parseApiErrorPayload(429, {
      detail: "Chat limit reached: daily quota",
    });
    expect(parsed.retryAfterMs).toBeUndefined();
    expect(parsed.code).toBe("Chat limit reached: daily quota");
    expect(parsed.message).toBe("Chat limit reached: daily quota");
  });

  it("utilise le message de repli si le corps n'est pas exploitable", () => {
    expect(parseApiErrorPayload(502, undefined).message).toBe("Request failed");
    expect(
      parseApiErrorPayload(502, "Bad Gateway", null, "Upload failed").message,
    ).toBe("Upload failed");
  });
});

describe("parseRetryAfterMs", () => {
  it("accepte des secondes ou une date HTTP", () => {
    expect(parseRetryAfterMs("5")).toBe(5000);
    const now = Date.parse("2026-11-27T10:00:00Z");
    expect(parseRetryAfterMs("Fri, 27 Nov 2026 10:00:20 GMT", undefined, now)).toBe(
      20000,
    );
  });

  it("lit wait_seconds dans detail en dernier recours", () => {
    expect(
      parseRetryAfterMs(null, {
        detail: { code: "too_many_attempts", wait_seconds: 60 },
      }),
    ).toBe(60000);
  });

  it("ignore les valeurs invalides", () => {
    expect(parseRetryAfterMs("soon")).toBeUndefined();
    expect(parseRetryAfterMs(null, { retry_after: -3 })).toBeUndefined();
  });
});

describe("apiErrorFromResponse", () => {
  it("construit une ApiError lisible depuis une Response", async () => {
    const err = await apiErrorFromResponse(
      fakeResponse(401, {
        detail: {
          code: "not_authenticated",
          message: "Authentication required. Please log in.",
        },
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("not_authenticated");
    expect(err.message).toBe("Authentication required. Please log in.");
    expect(err.data).toEqual({
      detail: {
        code: "not_authenticated",
        message: "Authentication required. Please log in.",
      },
    });
  });

  it("lit l'en-tête Retry-After", async () => {
    const err = await apiErrorFromResponse(
      fakeResponse(
        429,
        { detail: "Rate limit exceeded", message: "Trop de requêtes." },
        { "Retry-After": "7" },
      ),
    );
    expect(err.retryAfterMs).toBe(7000);
    expect(err.isRateLimited).toBe(true);
  });

  it("survit à un corps non JSON", async () => {
    const err = await apiErrorFromResponse(fakeResponse(502, undefined));
    expect(err.message).toBe("Request failed");
    expect(err.status).toBe(502);
  });
});
