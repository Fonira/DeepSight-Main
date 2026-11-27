/**
 * billingErrors.test.ts — Stripe non configuré (503 payments_unavailable) : message clair
 * et renvoi vers le site web, au lieu de « [object Object] » ou d'un message brut.
 */
import { Alert, type AlertButton } from "react-native";

const mockOpenBrowser = jest.fn().mockResolvedValue({ type: "dismiss" });
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: (url: string) => mockOpenBrowser(url),
}));

import { ApiError } from "../../services/apiErrors";
import { isPaymentsUnavailable, showBillingError } from "../billingErrors";

const fr = (frText: string) => frText;
const en = (_frText: string, enText: string) => enText;

describe("billingErrors", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockOpenBrowser.mockClear();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => alertSpy.mockRestore());

  it("reconnaît payments_unavailable (503) et stripe_disabled (400)", () => {
    expect(
      isPaymentsUnavailable(new ApiError("x", 503, "payments_unavailable")),
    ).toBe(true);
    expect(isPaymentsUnavailable(new ApiError("x", 400, "stripe_disabled"))).toBe(true);
    expect(isPaymentsUnavailable(new ApiError("x", 500))).toBe(false);
    expect(isPaymentsUnavailable(null)).toBe(false);
  });

  it("paiements indisponibles : explication + bouton qui ouvre le site", () => {
    showBillingError({
      error: new ApiError(
        "Les paiements sont temporairement indisponibles.",
        503,
        "payments_unavailable",
      ),
      tr: fr,
      fallbackTitle: "Erreur",
      fallbackMessage: "Impossible d'ouvrir le portail",
      webUrl: "https://www.deepsightsynthesis.com/account",
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0] as [
      string,
      string,
      AlertButton[],
    ];
    expect(title).toBe("Paiements indisponibles");
    expect(message).toContain("site DeepSight");

    const openButton = buttons.find((b) => b.text === "Ouvrir le site");
    expect(openButton).toBeDefined();
    openButton?.onPress?.();
    expect(mockOpenBrowser).toHaveBeenCalledWith(
      "https://www.deepsightsynthesis.com/account",
    );
  });

  it("textes en anglais quand la langue est EN", () => {
    showBillingError({
      error: new ApiError("x", 503, "payments_unavailable"),
      tr: en,
      fallbackTitle: "Error",
      fallbackMessage: "x",
      webUrl: "https://www.deepsightsynthesis.com/upgrade",
    });
    const [title, , buttons] = alertSpy.mock.calls[0] as [string, string, AlertButton[]];
    expect(title).toBe("Payments unavailable");
    expect(buttons.map((b) => b.text)).toEqual(["Close", "Open the website"]);
  });

  it("autre erreur API : titre de repli et message lisible de l'API", () => {
    showBillingError({
      error: new ApiError("Plan inconnu.", 400, "invalid_plan"),
      tr: fr,
      fallbackTitle: "Paiement impossible",
      fallbackMessage: "Erreur lors du paiement",
      webUrl: "https://www.deepsightsynthesis.com/upgrade",
    });
    expect(alertSpy).toHaveBeenCalledWith("Paiement impossible", "Plan inconnu.");
  });

  it("erreur inconnue : message de repli", () => {
    showBillingError({
      error: new Error("boom"),
      tr: fr,
      fallbackTitle: "Erreur",
      fallbackMessage: "Impossible de démarrer l'essai",
      webUrl: "https://www.deepsightsynthesis.com/upgrade",
    });
    expect(alertSpy).toHaveBeenCalledWith("Erreur", "Impossible de démarrer l'essai");
  });
});
