// frontend/src/store/__tests__/tutorStore.concepts.test.ts
//
// Tests pour les actions concepts du store Tuteur (sprint 2026-05-18,
// PR #3 — carrousel concepts illustrés Expert only).
//
// Couvre :
// - fetchConcepts (succès + erreur préserve la liste)
// - generateConcept (upsert idempotent + erreur silencieuse)
// - startConceptsPolling (back-off 5s → 10s → 30s + idempotence)
// - stopConceptsPolling (clear timer + flag down)
// - clearConcepts (reset complet)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTutorStore } from "../tutorStore";
import { tutorApi } from "../../services/api";
import type {
  TutorConceptItem,
  TutorConceptsResponse,
  GenerateConceptResponse,
} from "../../types/conceptImage";

vi.mock("../../services/api", () => ({
  tutorApi: {
    listConcepts: vi.fn(),
    generateConcept: vi.fn(),
    refreshConcepts: vi.fn(),
    // Inclure les autres méthodes utilisées par les actions existantes du
    // store, sinon `reset()` / autres tests indirects pourraient casser
    // lors d'un appel transitif.
    sessionStart: vi.fn(),
    sessionTurn: vi.fn(),
    sessionEnd: vi.fn(),
  },
}));

const mockedApi = vi.mocked(tutorApi);

const conceptReady = (overrides?: Partial<TutorConceptItem>): TutorConceptItem => ({
  term: "Rasoir d'Occam",
  term_hash: "hash-occam",
  category: "philosophy",
  image_url: "https://r2.example.com/occam.webp",
  status: "ready",
  ...overrides,
});

const conceptPending = (overrides?: Partial<TutorConceptItem>): TutorConceptItem => ({
  term: "Téléologie",
  term_hash: "hash-teleo",
  category: "philosophy",
  image_url: null,
  status: "pending",
  ...overrides,
});

const responseFromConcepts = (
  items: TutorConceptItem[],
): TutorConceptsResponse => ({
  concepts: items,
  total: items.length,
  ready_count: items.filter((c) => c.status === "ready").length,
  pending_count: items.filter((c) => c.status === "pending").length,
});

describe("tutorStore — concepts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useTutorStore.getState().stopConceptsPolling();
    useTutorStore.getState().reset();
  });

  afterEach(() => {
    useTutorStore.getState().stopConceptsPolling();
    vi.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────
  // fetchConcepts
  // ──────────────────────────────────────────────────────────────────────

  it("fetchConcepts populates the store with the API response", async () => {
    const items = [conceptReady(), conceptPending()];
    mockedApi.listConcepts.mockResolvedValueOnce(responseFromConcepts(items));

    await useTutorStore.getState().fetchConcepts();

    const s = useTutorStore.getState();
    expect(s.concepts).toHaveLength(2);
    expect(s.concepts[0].term_hash).toBe("hash-occam");
    expect(s.conceptsLoading).toBe(false);
    expect(s.conceptsError).toBeNull();
    expect(s.conceptsLastFetch).not.toBeNull();
    expect(typeof s.conceptsLastFetch).toBe("number");
  });

  it("fetchConcepts on failure sets error and preserves the existing list", async () => {
    // Premier fetch OK pour pré-populer.
    mockedApi.listConcepts.mockResolvedValueOnce(
      responseFromConcepts([conceptReady()]),
    );
    await useTutorStore.getState().fetchConcepts();
    expect(useTutorStore.getState().concepts).toHaveLength(1);

    // Second fetch rejette → la liste doit être préservée.
    mockedApi.listConcepts.mockRejectedValueOnce(new Error("network down"));
    await useTutorStore.getState().fetchConcepts();

    const s = useTutorStore.getState();
    expect(s.conceptsError).toBe("network down");
    expect(s.conceptsLoading).toBe(false);
    expect(s.concepts).toHaveLength(1); // Pas wipé.
    expect(s.concepts[0].term_hash).toBe("hash-occam");
  });

  // ──────────────────────────────────────────────────────────────────────
  // generateConcept
  // ──────────────────────────────────────────────────────────────────────

  it("generateConcept adds a new concept when the term_hash is unknown", async () => {
    const resp: GenerateConceptResponse = {
      term: "Stoïcisme",
      term_hash: "hash-stoic",
      status: "pending",
      image_url: null,
      cap_remaining: 299,
    };
    mockedApi.generateConcept.mockResolvedValueOnce(resp);

    await useTutorStore
      .getState()
      .generateConcept("Stoïcisme", "Philosophie pratique", "philosophy");

    const s = useTutorStore.getState();
    expect(s.concepts).toHaveLength(1);
    expect(s.concepts[0].term_hash).toBe("hash-stoic");
    expect(s.concepts[0].status).toBe("pending");
  });

  it("generateConcept updates the existing item in place (no duplicate)", async () => {
    // Pré-popule avec un concept pending.
    mockedApi.listConcepts.mockResolvedValueOnce(
      responseFromConcepts([conceptPending({ term_hash: "hash-x" })]),
    );
    await useTutorStore.getState().fetchConcepts();
    expect(useTutorStore.getState().concepts).toHaveLength(1);

    // generateConcept retourne le même term_hash mais status=ready.
    const resp: GenerateConceptResponse = {
      term: "Téléologie",
      term_hash: "hash-x",
      status: "ready",
      image_url: "https://r2.example.com/x.webp",
      cap_remaining: 295,
    };
    mockedApi.generateConcept.mockResolvedValueOnce(resp);

    await useTutorStore
      .getState()
      .generateConcept("Téléologie", "Finalité", "philosophy");

    const s = useTutorStore.getState();
    expect(s.concepts).toHaveLength(1); // Pas de doublon.
    expect(s.concepts[0].status).toBe("ready");
    expect(s.concepts[0].image_url).toBe("https://r2.example.com/x.webp");
  });

  it("generateConcept on failure is silent (no error in store, no throw)", async () => {
    mockedApi.generateConcept.mockRejectedValueOnce(new Error("rate-limited"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      useTutorStore.getState().generateConcept("X", "", null),
    ).resolves.toBeUndefined();

    const s = useTutorStore.getState();
    expect(s.conceptsError).toBeNull(); // Silencieux.
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────
  // startConceptsPolling — back-off + arrêts auto
  // ──────────────────────────────────────────────────────────────────────

  it("startConceptsPolling triggers an immediate fetch then schedules a 5s back-off", async () => {
    // Réponse pending → polling continue.
    mockedApi.listConcepts.mockResolvedValue(
      responseFromConcepts([conceptPending()]),
    );

    useTutorStore.getState().startConceptsPolling();
    expect(useTutorStore.getState().conceptsPollingActive).toBe(true);

    // Premier fetch déclenché immédiatement (microtask).
    await vi.advanceTimersByTimeAsync(0);
    expect(mockedApi.listConcepts).toHaveBeenCalledTimes(1);

    // Avancer 5s pour déclencher le second tick.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mockedApi.listConcepts).toHaveBeenCalledTimes(2);

    // Avancer 10s pour le 3e tick.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mockedApi.listConcepts).toHaveBeenCalledTimes(3);

    // Avancer 30s pour le 4e tick (et tous suivants).
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockedApi.listConcepts).toHaveBeenCalledTimes(4);
  });

  it("polling stops after ~60s without any pending concept (after some pending was seen)", async () => {
    // Premier fetch : pending présent.
    // Tous les suivants : aucun pending.
    mockedApi.listConcepts
      .mockResolvedValueOnce(responseFromConcepts([conceptPending()]))
      .mockResolvedValue(responseFromConcepts([conceptReady()]));

    useTutorStore.getState().startConceptsPolling();
    await vi.advanceTimersByTimeAsync(0); // tick 1 (pending → set _lastPendingSeenAt)

    // Boucle jusqu'à 90s écoulés depuis le dernier pending vu — devrait stop.
    // 5s + 10s + 30s = 45s ; 5+10+30+30 = 75s ; suffisant pour dépasser 60s.
    await vi.advanceTimersByTimeAsync(5_000); // tick 2 (no pending)
    await vi.advanceTimersByTimeAsync(10_000); // tick 3 (no pending)
    await vi.advanceTimersByTimeAsync(30_000); // tick 4 (no pending, >60s écoulés)
    await vi.advanceTimersByTimeAsync(30_000); // safety

    expect(useTutorStore.getState().conceptsPollingActive).toBe(false);
  });

  it("polling stops after 3 attempts when no pending is ever seen", async () => {
    // Aucun pending jamais retourné.
    mockedApi.listConcepts.mockResolvedValue(
      responseFromConcepts([conceptReady()]),
    );

    useTutorStore.getState().startConceptsPolling();
    await vi.advanceTimersByTimeAsync(0); // tick 1, attempt 0 → no pending, attempt<3 → continue
    await vi.advanceTimersByTimeAsync(5_000); // tick 2, attempt 1
    await vi.advanceTimersByTimeAsync(10_000); // tick 3, attempt 2
    await vi.advanceTimersByTimeAsync(30_000); // tick 4, attempt 3 → stop

    expect(useTutorStore.getState().conceptsPollingActive).toBe(false);
    // Pas plus de 4 fetches (le 4e tick déclenche le stop avant scheduling).
    expect(mockedApi.listConcepts.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("startConceptsPolling is idempotent (calling it twice does not double-fetch)", async () => {
    mockedApi.listConcepts.mockResolvedValue(
      responseFromConcepts([conceptPending()]),
    );

    useTutorStore.getState().startConceptsPolling();
    useTutorStore.getState().startConceptsPolling(); // no-op

    await vi.advanceTimersByTimeAsync(0);
    // Un seul fetch initial malgré 2 appels.
    expect(mockedApi.listConcepts).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────────────────────────────
  // stopConceptsPolling + clearConcepts
  // ──────────────────────────────────────────────────────────────────────

  it("stopConceptsPolling clears the timer and prevents further fetches", async () => {
    mockedApi.listConcepts.mockResolvedValue(
      responseFromConcepts([conceptPending()]),
    );

    useTutorStore.getState().startConceptsPolling();
    await vi.advanceTimersByTimeAsync(0); // tick 1
    expect(mockedApi.listConcepts).toHaveBeenCalledTimes(1);

    useTutorStore.getState().stopConceptsPolling();
    expect(useTutorStore.getState().conceptsPollingActive).toBe(false);

    // Avancer beaucoup de temps : aucun fetch supplémentaire.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockedApi.listConcepts).toHaveBeenCalledTimes(1);
  });

  it("clearConcepts resets list, stops polling, and clears error", async () => {
    mockedApi.listConcepts.mockResolvedValueOnce(
      responseFromConcepts([conceptReady(), conceptPending()]),
    );
    await useTutorStore.getState().fetchConcepts();
    expect(useTutorStore.getState().concepts).toHaveLength(2);

    // Mock pending pour que le polling reste actif si on ne l'arrête pas.
    mockedApi.listConcepts.mockResolvedValue(
      responseFromConcepts([conceptPending()]),
    );
    useTutorStore.getState().startConceptsPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(useTutorStore.getState().conceptsPollingActive).toBe(true);

    useTutorStore.getState().clearConcepts();

    const s = useTutorStore.getState();
    expect(s.concepts).toEqual([]);
    expect(s.conceptsError).toBeNull();
    expect(s.conceptsLastFetch).toBeNull();
    expect(s.conceptsPollingActive).toBe(false);
  });
});
