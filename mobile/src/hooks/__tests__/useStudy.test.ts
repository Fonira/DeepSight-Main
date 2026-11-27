/**
 * useStudy.test.ts — les erreurs API (402 crédits, 403, 429, 5xx) ne sont plus
 * transformées en liste vide (« Aucune flashcard disponible ») ; seul le réseau
 * déclenche le repli sur le cache hors ligne.
 */
import { renderHook } from "@testing-library/react-native";

const mockGenerateFlashcards = jest.fn();
const mockGenerateQuiz = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockNetInfoFetch = jest.fn();

jest.mock("../../services/api", () => ({
  studyApi: {
    generateFlashcards: (...args: unknown[]) => mockGenerateFlashcards(...args),
    generateQuiz: (...args: unknown[]) => mockGenerateQuiz(...args),
  },
}));

jest.mock("../../services/OfflineCache", () => ({
  OfflineCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
  },
  CachePriority: { HIGH: "high", LOW: "low" },
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: () => mockNetInfoFetch() },
}));

import { ApiError } from "../../services/apiErrors";
import { useStudy } from "../useStudy";

const cachedCards = [
  { id: "fc-0", front: "Q", back: "R", difficulty: "medium", repetitions: 0 },
];

function setup() {
  const { result } = renderHook(() => useStudy("42"));
  return result.current;
}

describe("useStudy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  it("402 crédits insuffisants : l'erreur remonte, même si un cache existe", async () => {
    mockCacheGet.mockResolvedValue(cachedCards);
    const creditsError = new ApiError("Crédits insuffisants", 402, "insufficient_credits");
    mockGenerateFlashcards.mockRejectedValue(creditsError);

    await expect(setup().generateFlashcards()).rejects.toBe(creditsError);
  });

  it("coupure réseau : sert les flashcards du cache", async () => {
    mockCacheGet.mockResolvedValue(cachedCards);
    mockGenerateFlashcards.mockRejectedValue(
      new ApiError("Network request failed", 0, "NETWORK_ERROR"),
    );

    await expect(setup().generateFlashcards()).resolves.toEqual(cachedCards);
  });

  it("coupure réseau sans cache : erreur OFFLINE au lieu d'une liste vide", async () => {
    mockGenerateFlashcards.mockRejectedValue(
      new ApiError("Request timeout", 408, "TIMEOUT"),
    );

    await expect(setup().generateFlashcards()).rejects.toMatchObject({
      code: "OFFLINE",
    });
  });

  it("hors ligne sans cache : erreur OFFLINE sans appeler l'API", async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });

    await expect(setup().generateQuiz()).rejects.toMatchObject({ code: "OFFLINE" });
    expect(mockGenerateQuiz).not.toHaveBeenCalled();
  });

  it("quiz : un 429 remonte à l'écran", async () => {
    const rateLimited = new ApiError("Trop de requêtes.", 429, "RATE_LIMITED");
    mockGenerateQuiz.mockRejectedValue(rateLimited);

    await expect(setup().generateQuiz()).rejects.toBe(rateLimited);
  });

  it("succès : renvoie les flashcards du jeu enregistré", async () => {
    mockGenerateFlashcards.mockResolvedValue({
      flashcards: [{ front: "Capitale ?", back: "Paris", category: "geo" }],
    });

    const cards = await setup().generateFlashcards();
    expect(cards).toEqual([
      expect.objectContaining({ id: "fc-0", front: "Capitale ?", back: "Paris" }),
    ]);
  });
});
