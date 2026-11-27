/**
 * chatErrors.test.ts — messages d'échec du chat selon l'erreur, en FR et EN.
 */
import { ApiError } from "../../services/apiErrors";
import { chatErrorMessage } from "../chatErrors";

const fr = (frText: string) => frText;
const en = (_frText: string, enText: string) => enText;

describe("chatErrorMessage", () => {
  it("quota de questions (429 sans Retry-After) ≠ limite de requêtes (RATE_LIMITED)", () => {
    expect(
      chatErrorMessage(new ApiError("Chat limit reached: daily", 429, "Chat limit reached: daily"), fr),
    ).toContain("Limite de questions");
    expect(
      chatErrorMessage(new ApiError("Trop de requêtes", 429, "RATE_LIMITED", undefined, 5000), fr),
    ).toContain("Trop de requêtes");
  });

  it("service indisponible, timeout et réseau", () => {
    expect(chatErrorMessage(new ApiError("x", 503), fr)).toContain("momentanément indisponible");
    expect(chatErrorMessage(new ApiError("Request timeout", 408, "TIMEOUT"), fr)).toContain(
      "trop de temps",
    );
    expect(chatErrorMessage(new ApiError("Network request failed", 0, "NETWORK_ERROR"), fr)).toContain(
      "joindre le serveur",
    );
  });

  it("400/403 : message lisible de l'API", () => {
    expect(
      chatErrorMessage(new ApiError("Question refusée par la modération.", 400), fr),
    ).toBe("Question refusée par la modération.");
  });

  it("anglais quand la langue est EN, repli générique sinon", () => {
    expect(chatErrorMessage(new ApiError("x", 503), en)).toBe(
      "Chat is temporarily unavailable. Please try again in a moment.",
    );
    expect(chatErrorMessage(new Error("boom"), en)).toBe(
      "Sorry, something went wrong. Please try again.",
    );
  });
});
