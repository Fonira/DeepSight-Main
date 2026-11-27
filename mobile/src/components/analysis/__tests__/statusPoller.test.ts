/**
 * statusPoller.test.ts — suivi d'analyse robuste aux 429 (point 5 de la relance API).
 */
jest.mock("../../../services/RetryService", () => ({
  CIRCUIT_OPEN_CODE: "CIRCUIT_OPEN",
}));

import {
  CIRCUIT_OPEN_WAIT_MS,
  MAX_RATE_LIMIT_WAIT_MS,
  POLL_INTERVAL_MS,
  createStatusPoller,
  rateLimitDelay,
  type PollerOutcome,
} from "../statusPoller";
import type { AnalysisStatus } from "../../../types";

const processing = (progress = 30): AnalysisStatus => ({
  status: "processing",
  progress,
});

function rateLimited(retryAfterMs?: number) {
  return Object.assign(new Error("Trop de requêtes"), {
    status: 429,
    code: "RATE_LIMITED",
    retryAfterMs,
  });
}

function setup(getStatus: jest.Mock) {
  const outcomes: PollerOutcome[] = [];
  const onProgress = jest.fn();
  const poller = createStatusPoller({
    taskId: "task-1",
    getStatus,
    onProgress,
    onOutcome: (o) => outcomes.push(o),
  });
  return { poller, outcomes, onProgress };
}

describe("createStatusPoller", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("respecte Retry-After sur 429 sans afficher d'échec, puis termine", async () => {
    const getStatus = jest
      .fn()
      .mockRejectedValueOnce(rateLimited(20_000))
      .mockRejectedValueOnce(rateLimited(20_000))
      .mockRejectedValueOnce(rateLimited(20_000))
      .mockResolvedValueOnce({
        status: "completed",
        progress: 100,
        summary_id: "77",
      });
    const { poller, outcomes } = setup(getStatus);

    poller.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(getStatus).toHaveBeenCalledTimes(1);

    // Rien avant l'expiration de Retry-After
    await jest.advanceTimersByTimeAsync(19_000);
    expect(getStatus).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(getStatus).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(40_000);
    expect(getStatus).toHaveBeenCalledTimes(4);
    expect(outcomes).toEqual([{ type: "completed", summaryId: "77" }]);
  });

  it("n'empile jamais deux requêtes (une seule en vol)", async () => {
    let resolveFirst: (s: AnalysisStatus) => void = () => undefined;
    const getStatus = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AnalysisStatus>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(processing(50));
    const { poller } = setup(getStatus);

    poller.start();
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    expect(getStatus).toHaveBeenCalledTimes(1);

    resolveFirst(processing(40));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(getStatus).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("affiche l'échec après 3 statuts « failed » consécutifs", async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValue({ status: "failed", progress: 10, error: "Transcription indisponible" });
    const { poller, outcomes } = setup(getStatus);

    poller.start();
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(outcomes).toEqual([
      { type: "failed", message: "Transcription indisponible" },
    ]);
    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  it("déclare la connexion perdue après 10 erreurs réseau, pas avant", async () => {
    const networkError = Object.assign(new Error("Network request failed"), {
      status: 0,
      code: "NETWORK_ERROR",
    });
    const getStatus = jest.fn().mockRejectedValue(networkError);
    const { poller, outcomes } = setup(getStatus);

    poller.start();
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 8);
    expect(outcomes).toEqual([]);

    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    expect(outcomes).toEqual([{ type: "connectionLost" }]);
  });

  it("espace les sondages quand le disjoncteur est ouvert", async () => {
    const circuitOpen = Object.assign(new Error("open"), {
      status: 0,
      code: "CIRCUIT_OPEN",
    });
    const getStatus = jest
      .fn()
      .mockRejectedValueOnce(circuitOpen)
      .mockResolvedValue(processing());
    const { poller } = setup(getStatus);

    poller.start();
    await jest.advanceTimersByTimeAsync(CIRCUIT_OPEN_WAIT_MS - 100);
    expect(getStatus).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(200);
    expect(getStatus).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("stop() annule le prochain sondage", async () => {
    const getStatus = jest.fn().mockResolvedValue(processing());
    const { poller } = setup(getStatus);
    poller.start();
    await jest.advanceTimersByTimeAsync(0);
    poller.stop();
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
    expect(getStatus).toHaveBeenCalledTimes(1);
  });
});

describe("rateLimitDelay", () => {
  it("borne le délai entre l'intervalle et 60 s", () => {
    expect(rateLimitDelay(500)).toBe(POLL_INTERVAL_MS);
    expect(rateLimitDelay(20_000)).toBe(20_000);
    expect(rateLimitDelay(600_000)).toBe(MAX_RATE_LIMIT_WAIT_MS);
    expect(rateLimitDelay(undefined)).toBe(POLL_INTERVAL_MS * 5);
  });
});
