/**
 * Erreurs de génération des flashcards / quiz.
 *
 * Seules les coupures réseau justifient de servir le cache hors ligne ; un 402
 * (crédits), 403, 429 ou 500 doit être expliqué à l'utilisateur, pas transformé
 * en « Aucune flashcard disponible ».
 */
import { ApiError } from "../services/apiErrors";

type Translate = (frText: string, enText: string) => string;

const OFFLINE_LIKE_CODES: ReadonlySet<string> = new Set([
  "OFFLINE",
  "NETWORK_ERROR",
  "TIMEOUT",
  "CIRCUIT_OPEN",
]);

export function isOfflineLikeError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof error !== "object" || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  if (typeof code === "string" && OFFLINE_LIKE_CODES.has(code)) return true;
  return status === 0 || status === 408;
}

export function studyErrorMessage(error: unknown, tr: Translate): string {
  if (isOfflineLikeError(error)) {
    return tr(
      "Impossible de joindre le serveur. Réessaie une fois en ligne.",
      "Can't reach the server. Try again once you're online.",
    );
  }
  if (error instanceof ApiError) {
    if (error.status === 402) {
      return tr(
        "Crédits insuffisants pour générer ce contenu.",
        "Not enough credits to generate this content.",
      );
    }
    if (error.message && error.message !== "Request failed") {
      return error.message;
    }
  }
  return tr(
    "La génération a échoué. Réessaie dans un instant.",
    "Generation failed. Please try again in a moment.",
  );
}
