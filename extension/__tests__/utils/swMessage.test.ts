/**
 * swMessage — timeout + retry wrapper for chrome.runtime.sendMessage
 *
 * Mitigates MV3 service worker death mid-`tryRefreshToken` (Sprint C audit
 * gap). These tests verify the three documented behaviors :
 *  1. happy path → resolve immediately, no retry
 *  2. timeout on first attempt → retry → resolve
 *  3. timeout on both attempts → reject with `SW_TIMEOUT`
 */

import { resetChromeMocks, chromeMock } from "../setup/chrome-api-mock";
import { swMessage, SW_TIMEOUT_ERROR } from "../../src/utils/swMessage";

// Avance les timers internes du wrapper (timeout + retryDelay) sans bloquer
// les vraies micro-tasks Promises. jest.useFakeTimers() seul ne suffit pas
// car withTimeout chaîne des `.then()` sur la promise de sendMessage qui
// utilise des micro-tasks ; on alterne `advanceTimersByTimeAsync` qui flush
// les deux.
beforeEach(() => {
  resetChromeMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("swMessage", () => {
  it("resolves immediately on happy path without retry", async () => {
    chromeMock.runtime.sendMessage.mockResolvedValueOnce({
      success: true,
      result: { foo: "bar" },
    });

    const promise = swMessage({ action: "PING" });
    // Pas besoin d'avancer les timers — sendMessage résout direct.
    await jest.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result).toEqual({ success: true, result: { foo: "bar" } });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("retries once and resolves when first attempt times out", async () => {
    // Premier appel : ne résout jamais → timeout déclenchera retry.
    // Deuxième appel : résout normalement.
    chromeMock.runtime.sendMessage
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce({ success: true });

    const promise = swMessage(
      { action: "CHECK_AUTH" },
      { timeout: 100, retryDelay: 50 },
    );

    // Avance jusqu'au timeout du premier appel.
    await jest.advanceTimersByTimeAsync(100);
    // Avance le retryDelay → second appel kick-in.
    await jest.advanceTimersByTimeAsync(50);
    // Flush micro-tasks pour récupérer le résolved du second appel.
    await jest.advanceTimersByTimeAsync(0);

    const result = await promise;
    expect(result).toEqual({ success: true });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("rejects with SW_TIMEOUT when both attempts time out", async () => {
    chromeMock.runtime.sendMessage
      .mockReturnValueOnce(new Promise(() => {}))
      .mockReturnValueOnce(new Promise(() => {}));

    const promise = swMessage(
      { action: "GET_PLAN" },
      { timeout: 100, retryDelay: 50 },
    );
    // Attache un catch IMMÉDIATEMENT pour éviter le warning unhandledRejection
    // pendant qu'on avance les timers.
    const rejection = expect(promise).rejects.toThrow(SW_TIMEOUT_ERROR);

    // Premier timeout.
    await jest.advanceTimersByTimeAsync(100);
    // Retry delay.
    await jest.advanceTimersByTimeAsync(50);
    // Second timeout.
    await jest.advanceTimersByTimeAsync(100);

    await rejection;
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });
});
