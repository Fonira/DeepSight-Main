/**
 * Message affiché dans le fil du chat quand une question échoue.
 * Avant : « Désolé, une erreur est survenue. Réessayez. » pour tout (quota, limite
 * de requêtes, service indisponible, timeout…), en français uniquement.
 */
import { ApiError, RATE_LIMITED_CODE } from "../services/apiErrors";

type Translate = (frText: string, enText: string) => string;

export function chatErrorMessage(error: unknown, tr: Translate): string {
  if (error instanceof ApiError) {
    if (error.code === "TIMEOUT" || error.status === 408) {
      return tr(
        "La réponse prend trop de temps. Réessaie dans un instant.",
        "The answer is taking too long. Please try again in a moment.",
      );
    }
    if (error.status === 0) {
      return tr(
        "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.",
        "Can't reach the server. Check your connection and try again.",
      );
    }
    if (error.status === 429) {
      return error.code === RATE_LIMITED_CODE
        ? tr(
            "Trop de requêtes — réessaie dans quelques secondes.",
            "Too many requests — try again in a few seconds.",
          )
        : tr(
            "Limite de questions atteinte pour cette vidéo ou pour aujourd'hui.",
            "Question limit reached for this video or for today.",
          );
    }
    if (error.status === 503) {
      return tr(
        "Le chat est momentanément indisponible. Réessaie dans un instant.",
        "Chat is temporarily unavailable. Please try again in a moment.",
      );
    }
    if ((error.status === 400 || error.status === 403) && error.message) {
      // Message métier lisible renvoyé par l'API (modération, accès…)
      return error.message;
    }
  }
  return tr(
    "Désolé, une erreur est survenue. Réessayez.",
    "Sorry, something went wrong. Please try again.",
  );
}
