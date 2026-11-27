/**
 * Tests — sidepanel/pollingPolicy.ts
 *
 * Bug couvert : le polling GET_TASK_STATUS ignorait toute erreur et
 * reprenait toutes les 2,5 s, y compris sur 429 (boucle de requêtes),
 * session expirée ou tâche introuvable (spinner infini).
 */

import {
  MAX_POLL_BACKOFF_MS,
  MAX_POLL_FAILURES,
  POLL_INTERVAL_MS,
  decidePollAfterError,
} from "../../src/sidepanel/pollingPolicy";

describe("decidePollAfterError", () => {
  it("waits for Retry-After on 429 instead of polling again at once", () => {
    expect(
      decidePollAfterError(
        { errorCode: "rate_limited", httpStatus: 429, retryAfter: 40 },
        0,
      ),
    ).toEqual({ kind: "continue", delayMs: 40_000 });
  });

  it("never waits less than the base interval on 429", () => {
    expect(
      decidePollAfterError({ errorCode: "rate_limited", retryAfter: 1 }, 0),
    ).toEqual({ kind: "continue", delayMs: POLL_INTERVAL_MS });
  });

  it.each(["session_expired", "auth_required", "private_mode"])(
    "stops on %s",
    (errorCode) => {
      expect(decidePollAfterError({ errorCode }, 1)).toEqual({ kind: "stop" });
    },
  );

  it("stops on client errors such as 404 Task not found", () => {
    expect(decidePollAfterError({ httpStatus: 404 }, 1)).toEqual({
      kind: "stop",
    });
  });

  it("backs off exponentially on network / 5xx errors", () => {
    expect(
      decidePollAfterError({ errorCode: "network_error", httpStatus: 0 }, 1),
    ).toEqual({ kind: "continue", delayMs: POLL_INTERVAL_MS });
    expect(decidePollAfterError({ httpStatus: 502 }, 3)).toEqual({
      kind: "continue",
      delayMs: POLL_INTERVAL_MS * 4,
    });
  });

  it("caps the backoff and gives up after MAX_POLL_FAILURES", () => {
    const decision = decidePollAfterError(
      { httpStatus: 503 },
      MAX_POLL_FAILURES - 1,
      20_000,
    );
    expect(decision).toEqual({ kind: "continue", delayMs: MAX_POLL_BACKOFF_MS });
    expect(decidePollAfterError({ httpStatus: 503 }, MAX_POLL_FAILURES)).toEqual(
      { kind: "stop" },
    );
  });
});
