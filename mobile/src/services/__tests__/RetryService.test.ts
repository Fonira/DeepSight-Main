/**
 * RetryService.test.ts — politique de relance :
 *   - POST/PATCH jamais rejoués sur timeout/5xx (doublons Quick Chat, crédits) ;
 *   - 429 rejoué une fois seulement si Retry-After ≤ 10 s ;
 *   - 503 « service non configuré » (code métier) jamais rejoué ;
 *   - les 4xx n'ouvrent plus le disjoncteur, qui lève une ApiError lisible.
 */
import { ApiError } from "../apiErrors";
import {
  CIRCUIT_OPEN_CODE,
  RETRY_PRESETS,
  countsAsCircuitFailure,
  getRetryDecision,
  resetCircuitBreaker,
  withRetry,
  withRetryPreset,
} from "../RetryService";

const standard = RETRY_PRESETS.standard;
const GET = { idempotent: true, rateLimitRetried: false };
const POST = { idempotent: false, rateLimitRetried: false };

describe("getRetryDecision", () => {
  it("ne rejoue jamais un POST sur 408, 502 ou 503", () => {
    for (const status of [408, 502, 503]) {
      expect(getRetryDecision(new ApiError("x", status), standard, POST)).toEqual({
        retry: false,
      });
    }
  });

  it("rejoue un GET sur 502 ou 503 sans code (redéploiement)", () => {
    expect(getRetryDecision(new ApiError("x", 502), standard, GET).retry).toBe(true);
    expect(getRetryDecision(new ApiError("x", 503), standard, GET).retry).toBe(true);
  });

  it("ne rejoue pas un 503 avec un code métier (service non configuré)", () => {
    const err = new ApiError("Paiements indisponibles", 503, "payments_unavailable");
    expect(getRetryDecision(err, standard, GET).retry).toBe(false);
  });

  it("rejoue un 429 avec Retry-After court, même en POST, après ce délai", () => {
    const err = new ApiError("Trop de requêtes", 429, "RATE_LIMITED", undefined, 2000);
    const decision = getRetryDecision(err, standard, POST);
    expect(decision.retry).toBe(true);
    expect(decision.rateLimited).toBe(true);
    expect(decision.delayMs).toBeGreaterThanOrEqual(2000);
    expect(decision.delayMs).toBeLessThan(2250);
  });

  it("ne rejoue pas un 429 avec Retry-After > 10 s, sans Retry-After ou déjà rejoué", () => {
    const long = new ApiError("x", 429, "RATE_LIMITED", undefined, 45000);
    const quota = new ApiError("Chat limit reached", 429, "Chat limit reached");
    const short = new ApiError("x", 429, "RATE_LIMITED", undefined, 1000);
    expect(getRetryDecision(long, standard, GET).retry).toBe(false);
    expect(getRetryDecision(quota, standard, GET).retry).toBe(false);
    expect(
      getRetryDecision(short, standard, { idempotent: true, rateLimitRetried: true })
        .retry,
    ).toBe(false);
  });
});

describe("countsAsCircuitFailure", () => {
  it("ne compte que les pannes réseau/serveur", () => {
    expect(countsAsCircuitFailure(new ApiError("x", 404))).toBe(false);
    expect(countsAsCircuitFailure(new ApiError("x", 429))).toBe(false);
    expect(countsAsCircuitFailure(new ApiError("x", 503, "voice_service_unavailable"))).toBe(
      false,
    );
    expect(countsAsCircuitFailure(new ApiError("x", 0, "OFFLINE"))).toBe(false);
    expect(countsAsCircuitFailure(new ApiError("x", 503))).toBe(true);
    expect(countsAsCircuitFailure(new ApiError("x", 0, "NETWORK_ERROR"))).toBe(true);
    expect(countsAsCircuitFailure(new ApiError("Request timeout", 408, "TIMEOUT"))).toBe(
      true,
    );
    expect(countsAsCircuitFailure(new TypeError("Network request failed"))).toBe(true);
  });
});

describe("withRetryPreset — délais (faux timers)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("POST : un seul appel sur 503", async () => {
    const fn = jest.fn().mockRejectedValue(new ApiError("Service Unavailable", 503));
    await expect(
      withRetryPreset(fn, "standard", "test-post-503", { idempotent: false }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("GET : rejoue un 502 puis réussit", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("Bad Gateway", 502))
      .mockResolvedValueOnce("ok");
    const promise = withRetryPreset(fn, "standard", "test-get-502");
    await jest.advanceTimersByTimeAsync(1300); // backoff 1 s + jitter ≤ 25 %
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("429 avec Retry-After 3 s : attend ce délai avant de rejouer", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError("Trop de requêtes", 429, "RATE_LIMITED", undefined, 3000),
      )
      .mockResolvedValueOnce("ok");
    const promise = withRetryPreset(fn, "standard", "test-429", { idempotent: false });

    await jest.advanceTimersByTimeAsync(2900);
    expect(fn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("withRetry — disjoncteur", () => {
  afterEach(() => {
    resetCircuitBreaker("test-404");
    resetCircuitBreaker("test-502");
  });

  it("des 404 répétés n'ouvrent pas le disjoncteur", async () => {
    const fn = jest.fn().mockRejectedValue(new ApiError("Not found", 404));
    for (let i = 0; i < 7; i++) {
      await expect(
        withRetry(fn, { maxRetries: 0, circuitBreakerKey: "test-404" }),
      ).rejects.toMatchObject({ status: 404 });
    }
    expect(fn).toHaveBeenCalledTimes(7);
  });

  it("5 pannes serveur ouvrent le disjoncteur, qui lève une ApiError CIRCUIT_OPEN", async () => {
    const fn = jest.fn().mockRejectedValue(new ApiError("Bad Gateway", 502));
    for (let i = 0; i < 5; i++) {
      await expect(
        withRetry(fn, { maxRetries: 0, circuitBreakerKey: "test-502" }),
      ).rejects.toMatchObject({ status: 502 });
    }

    const error = await withRetry(fn, {
      maxRetries: 0,
      circuitBreakerKey: "test-502",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(CIRCUIT_OPEN_CODE);
    expect(fn).toHaveBeenCalledTimes(5);
  });
});
