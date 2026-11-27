/**
 * studyErrors.test.ts — messages FR/EN des échecs de génération (flashcards, quiz).
 */
import { ApiError } from "../../services/apiErrors";
import { isOfflineLikeError, studyErrorMessage } from "../studyErrors";

const fr = (frText: string) => frText;
const en = (_frText: string, enText: string) => enText;

describe("isOfflineLikeError", () => {
  it("reconnaît les erreurs réseau, timeout et hors ligne", () => {
    expect(isOfflineLikeError(new ApiError("x", 0, "NETWORK_ERROR"))).toBe(true);
    expect(isOfflineLikeError(new ApiError("x", 408, "TIMEOUT"))).toBe(true);
    expect(isOfflineLikeError(new ApiError("x", 0, "OFFLINE"))).toBe(true);
    expect(isOfflineLikeError(new TypeError("Network request failed"))).toBe(true);
    expect(isOfflineLikeError(new ApiError("x", 402))).toBe(false);
    expect(isOfflineLikeError(new ApiError("x", 500))).toBe(false);
  });
});

describe("studyErrorMessage", () => {
  it("402 : crédits insuffisants, en FR et EN", () => {
    const err = new ApiError("Payment required", 402);
    expect(studyErrorMessage(err, fr)).toBe("Crédits insuffisants pour générer ce contenu.");
    expect(studyErrorMessage(err, en)).toBe("Not enough credits to generate this content.");
  });

  it("hors ligne : message de connexion", () => {
    expect(studyErrorMessage(new ApiError("x", 0, "OFFLINE"), fr)).toContain(
      "joindre le serveur",
    );
  });

  it("autre erreur API : message lisible renvoyé par le backend", () => {
    expect(
      studyErrorMessage(new ApiError("Trop de requêtes. Réessayez dans 9 secondes.", 429), fr),
    ).toBe("Trop de requêtes. Réessayez dans 9 secondes.");
  });

  it("message générique de l'API ou erreur inconnue : repli", () => {
    expect(studyErrorMessage(new ApiError("Request failed", 500), en)).toBe(
      "Generation failed. Please try again in a moment.",
    );
    expect(studyErrorMessage(new Error("boom"), fr)).toBe(
      "La génération a échoué. Réessaie dans un instant.",
    );
  });
});
