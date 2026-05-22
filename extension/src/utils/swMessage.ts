// extension/src/utils/swMessage.ts
//
// Resilient wrapper around `chrome.runtime.sendMessage` for sidepanel → SW
// communication. Mitigates the Sprint C audit gap: the Manifest V3 service
// worker can be killed by Chrome at any time (memory pressure, 30s idle).
// If killed mid-`tryRefreshToken` (or mid-`apiRequest`), the sidepanel hangs
// indefinitely waiting for a response that will never arrive.
//
// Strategy
// --------
// 1. Race `sendMessage` against a hard timeout (default 10s).
// 2. On timeout, retry once after a short delay (default 500ms). Sending a
//    second message is enough to wake the SW back up (Chrome lazily restarts
//    it on incoming runtime traffic), and the SW handlers are idempotent for
//    the actions we care about (CHECK_AUTH, GET_PLAN, etc.).
// 3. On second timeout → reject with `SW_TIMEOUT` so the caller can surface
//    a network-style error rather than hang forever.
//
// Scope: this helper is opt-in. Existing callers using
// `Browser.runtime.sendMessage` directly keep working — we migrate only the
// most critical auth callsites in Step 2 (App.tsx checkAuth + loadPlanInfo).
// Other sites can be migrated incrementally without breaking anything.

import Browser from "./browser-polyfill";

export interface SwMessageOptions {
  /** Hard timeout per attempt in milliseconds. Default 10s. */
  timeout?: number;
  /** Wait this long before retrying after a timeout. Default 500ms. */
  retryDelay?: number;
  /** Retry once on timeout (the retry also wakes the SW). Default true. */
  retryOnTimeout?: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 500;

/**
 * Error thrown when `sendMessage` times out twice (or once if
 * `retryOnTimeout: false`). Callers should treat this as a transient network
 * error (same shape as the existing `"NETWORK_ERROR"` thrown by `apiRequest`
 * in the SW), not as an auth failure.
 */
export const SW_TIMEOUT_ERROR = "SW_TIMEOUT";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(SW_TIMEOUT_ERROR));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a message to the service worker with timeout + automatic retry on
 * timeout. The retry implicitly wakes the SW if Chrome killed it.
 *
 * Use this for sidepanel callsites that previously called
 * `Browser.runtime.sendMessage` directly when the result is required to
 * make UI progress (auth checks, plan loads, revoke actions).
 *
 * Errors:
 *  - `SW_TIMEOUT` → SW unreachable after retry (network-style failure).
 *  - Any other error → propagated as-is from the SW handler.
 */
export async function swMessage<TReq = unknown, TRes = unknown>(
  message: TReq,
  options: SwMessageOptions = {},
): Promise<TRes> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
  const retryOnTimeout = options.retryOnTimeout ?? true;

  const attempt = (): Promise<TRes> =>
    withTimeout(
      Browser.runtime.sendMessage<unknown, TRes>(message as unknown),
      timeout,
    );

  try {
    return await attempt();
  } catch (err) {
    const isTimeout = (err as Error).message === SW_TIMEOUT_ERROR;
    if (!isTimeout || !retryOnTimeout) {
      throw err;
    }
    // Brief pause — give Chrome a moment to spin the SW back up before
    // we hammer it with the second attempt.
    await sleep(retryDelay);
    return attempt();
  }
}
