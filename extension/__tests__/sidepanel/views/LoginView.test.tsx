/**
 * Tests — LoginView : bouton Google selon la configuration serveur.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { LoginView } from "../../../src/sidepanel/views/LoginView";

jest.mock("../../../src/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: jest.requireActual("../../../src/i18n/fr.json"),
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

const props = {
  onLogin: jest.fn(),
  onGoogleLogin: jest.fn(),
  onGuestMode: jest.fn(),
  error: null,
};

function mockProviders(google: boolean | null): void {
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
    (msg: { action?: string }) =>
      Promise.resolve(
        msg?.action === "GET_AUTH_PROVIDERS"
          ? { success: true, result: { google } }
          : {},
      ),
  );
}

describe("LoginView — Google button", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("hides the Google button when the server has no Google OAuth", async () => {
    mockProviders(false);
    render(<LoginView {...props} />);

    await waitFor(() => {
      expect(
        screen.queryByText("Continuer avec Google"),
      ).not.toBeInTheDocument();
    });
    // La connexion e-mail / mot de passe reste disponible.
    expect(screen.getByPlaceholderText("Adresse e-mail")).toBeInTheDocument();
  });

  it("keeps the Google button when available or unknown", async () => {
    mockProviders(null);
    render(<LoginView {...props} />);
    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: "GET_AUTH_PROVIDERS",
      });
    });
    expect(screen.getByText("Continuer avec Google")).toBeInTheDocument();
  });

  it("links account creation to the current register route", () => {
    mockProviders(true);
    render(<LoginView {...props} />);
    expect(
      screen.getByText("Créer un compte").closest("a")?.getAttribute("href"),
    ).toBe("https://www.deepsightsynthesis.com/login?tab=register");
  });
});
