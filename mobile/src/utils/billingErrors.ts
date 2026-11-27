/**
 * Erreurs de paiement : Stripe n'est pas configuré sur l'API relancée.
 * Les endpoints de paiement répondent 503 {code: "payments_unavailable", message}
 * (et /api/voice/addon/checkout 400 {code: "stripe_disabled"}). Au lieu d'un message
 * brut, on explique et on propose d'ouvrir le site web.
 */
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { ApiError } from "../services/apiErrors";

export const PAYMENTS_UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  "payments_unavailable",
  "stripe_disabled",
]);

type Translate = (frText: string, enText: string) => string;

export function isPaymentsUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code } = error as { code?: unknown };
  return typeof code === "string" && PAYMENTS_UNAVAILABLE_CODES.has(code);
}

export interface BillingErrorOptions {
  error: unknown;
  tr: Translate;
  /** Titre/message si l'erreur n'est pas « paiements indisponibles ». */
  fallbackTitle: string;
  fallbackMessage: string;
  /** Page du site web à ouvrir (offres ou compte). */
  webUrl: string;
}

export function showBillingError({
  error,
  tr,
  fallbackTitle,
  fallbackMessage,
  webUrl,
}: BillingErrorOptions): void {
  if (isPaymentsUnavailable(error)) {
    Alert.alert(
      tr("Paiements indisponibles", "Payments unavailable"),
      tr(
        "Les paiements ne sont pas disponibles dans l'application pour le moment. Tu peux gérer ton abonnement sur le site DeepSight.",
        "Payments are not available in the app right now. You can manage your subscription on the DeepSight website.",
      ),
      [
        { text: tr("Fermer", "Close"), style: "cancel" },
        {
          text: tr("Ouvrir le site", "Open the website"),
          onPress: () => {
            WebBrowser.openBrowserAsync(webUrl).catch(() => undefined);
          },
        },
      ],
    );
    return;
  }

  const message =
    error instanceof ApiError && error.message ? error.message : fallbackMessage;
  Alert.alert(fallbackTitle, message);
}
