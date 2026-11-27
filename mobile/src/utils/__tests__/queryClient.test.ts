/**
 * queryClient.test.ts — TanStack ne rejoue plus les erreurs déjà gérées par RetryService
 * (429, 4xx, 503 métier) : une requête pouvait partir jusqu'à 8 fois.
 */
import { ApiError } from "../../services/apiErrors";
import { createQueryClient, shouldRetryQuery } from "../queryClient";

describe("shouldRetryQuery", () => {
  it("rejoue une fois une coupure réseau", () => {
    const err = new ApiError("Network request failed", 0, "NETWORK_ERROR");
    expect(shouldRetryQuery(0, err)).toBe(true);
    expect(shouldRetryQuery(1, err)).toBe(false);
  });

  it("ne rejoue pas les erreurs HTTP déjà traitées par RetryService", () => {
    expect(shouldRetryQuery(0, new ApiError("x", 429, "RATE_LIMITED"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("x", 404))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("x", 503, "payments_unavailable"))).toBe(
      false,
    );
    expect(shouldRetryQuery(0, new ApiError("x", 502))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("x", 0, "OFFLINE"))).toBe(false);
  });

  it("les mutations ne sont jamais rejouées", () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
