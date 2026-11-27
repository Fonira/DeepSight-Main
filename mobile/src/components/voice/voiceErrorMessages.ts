/**
 * Messages FR/EN des erreurs de l'appel vocal, à partir du code émis par useVoiceChat.
 */
import type { VoiceErrorCode } from "./useVoiceChat";

type Translate = (frText: string, enText: string) => string;

export function voiceErrorTitle(code: VoiceErrorCode | undefined, tr: Translate): string {
  return code === "SERVICE_UNAVAILABLE"
    ? tr("Appel vocal indisponible", "Voice call unavailable")
    : tr("Appel vocal", "Voice call");
}

export function voiceErrorMessage(
  code: VoiceErrorCode | undefined,
  fallback: string,
  tr: Translate,
): string {
  switch (code) {
    case "SERVICE_UNAVAILABLE":
      return tr(
        "Le chat vocal est momentanément indisponible. Le chat écrit reste disponible.",
        "Voice chat is temporarily unavailable. Text chat still works.",
      );
    case "MICROPHONE_DENIED":
      return tr(
        "Autorisez l'accès au micro dans les réglages de votre appareil.",
        "Allow microphone access in your device settings.",
      );
    case "MICROPHONE_GENERIC":
      return tr(
        "Impossible d'accéder au microphone. Vérifiez vos permissions.",
        "Could not access the microphone. Check your permissions.",
      );
    case "NETWORK":
      return tr(
        "Vérifiez votre connexion internet et réessayez.",
        "Check your internet connection and try again.",
      );
    case "QUOTA_EXCEEDED":
      return tr(
        "Quota vocal épuisé. Passez à un plan supérieur pour continuer.",
        "Voice quota used up. Upgrade your plan to continue.",
      );
    case "SESSION_FAILED":
      return tr(
        "Impossible de démarrer la session vocale. Réessayez.",
        "Could not start the voice session. Please try again.",
      );
    case "SDK_INIT_FAILED":
      return tr(
        "Impossible d'initialiser le module vocal.",
        "Could not initialise the voice module.",
      );
    default:
      return fallback;
  }
}
