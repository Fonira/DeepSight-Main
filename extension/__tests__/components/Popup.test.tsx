/**
 * Tests — Popup principal (App.tsx)
 * Fichier source : src/popup/App.tsx
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetChromeMocks } from "../setup/chrome-api-mock";
import { App } from "../../src/popup/App";

// Mock useTranslation to avoid chrome.storage.sync dependency in tests
jest.mock("../../src/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: {
      common: {
        login: "Se connecter",
        logout: "Déconnexion",
        retry: "Réessayer",
        createAccount: "Créer un compte",
        viewPlans: "Voir les plans",
        unlock: "Débloquer",
        analyses: "analyses",
        credits: "crédits",
      },
      login: {
        tagline: "Ne subissez plus vos vidéos — interrogez-les.",
        badgeFr: "IA Française",
        badgeEu: "Données en Europe",
        googleLoading: "Connexion Google...",
        googleButton: "Continuer avec Google",
        divider: "ou",
        emailPlaceholder: "Adresse e-mail",
        passwordPlaceholder: "Mot de passe",
        loginLoading: "Connexion...",
        guestButton: "Essayer sans compte (1 analyse gratuite)",
        privacy: "Confidentialité",
        terms: "CGU",
      },
      plans: {
        free: "Gratuit",
        pro: "Pro",
        starter: "Standard",
        student: "Starter",
      },
      upsell: {
        free: {
          label: "Starter",
          feature: "Flashcards + Cartes mentales",
          price: "2,99€",
        },
        etudiant: {
          label: "Standard",
          feature: "Recherche web IA + 50 analyses",
          price: "5,99€",
        },
        student: {
          label: "Standard",
          feature: "Recherche web IA + 50 analyses",
          price: "5,99€",
        },
        starter: {
          label: "Pro",
          feature: "Playlists + Exports + Chat illimité",
          price: "12,99€",
        },
      },
      promos: {
        free: [
          { text: "Révisez avec des Flashcards IA", cta: "Débloquer Starter" },
          { text: "Cartes mentales IA", cta: "Voir les plans" },
          { text: "Seulement 5 analyses/mois ?", cta: "Upgrade" },
        ],
        starter: [
          { text: "Recherche web IA", cta: "Débloquer" },
          { text: "50 analyses/mois", cta: "Voir les plans" },
        ],
        standard: [
          { text: "Analysez des playlists", cta: "Débloquer Pro" },
          { text: "Exportez en PDF/DOCX", cta: "Voir les plans" },
        ],
        pro: [
          { text: "DeepSight sur mobile", cta: "Télécharger" },
          { text: "Gérez vos playlists", cta: "Ouvrir" },
        ],
      },
      analysis: {
        noVideo: "Ouvre une vidéo YouTube ou TikTok",
        analyzeButton: "Analyser cette vidéo",
        starting: "Démarrage...",
        processing: "Traitement...",
        failed: "Analyse échouée",
        startFailed: "Impossible de démarrer",
        recent: "Analyses récentes",
        quotaExceeded: "Quota atteint",
        quotaExceededText: "Passez au plan supérieur",
        mode: "Mode",
        language: "Langue",
        modes: {
          standard: "Standard",
          accessible: "Accessible",
          expert: "Expert",
        },
        languages: {
          fr: "Français",
          en: "English",
          es: "Español",
          de: "Deutsch",
        },
      },
      guest: {
        banner: "Mode découverte",
        exhaustedText: "Créez un compte gratuit",
      },
      credits: {
        critical: "Plus que {count} crédits",
        recharge: "Recharger",
        remaining: "{count} crédits",
        low: "cr.",
      },
      mistral: { badge: "Propulsé par Mistral AI" },
    },
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

beforeEach(() => {
  resetChromeMocks();
});

// ── Render sans crash ──
describe("App — rendering", () => {
  it("renders without crashing", () => {
    // Mock CHECK_AUTH to return not authenticated
    (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
      authenticated: false,
    });

    const { container } = render(<App />);
    expect(container.querySelector(".app-container")).toBeTruthy();
  });

  it("shows loading state initially", () => {
    // Make sendMessage hang so we stay in loading
    (chrome.runtime.sendMessage as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    const { container } = render(<App />);
    expect(container.querySelector(".loading-view")).toBeTruthy();
  });
});

// ── État non-connecté → login view ──
describe("App — unauthenticated state", () => {
  beforeEach(() => {
    (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
      authenticated: false,
    });
  });

  it("shows login view when not authenticated", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Se connecter")).toBeInTheDocument();
    });
  });

  it("shows email and password inputs", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Adresse e-mail")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Mot de passe")).toBeInTheDocument();
    });
  });

  it("shows Google login button", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Continuer avec Google")).toBeInTheDocument();
    });
  });

  it("shows guest mode button", async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText("Essayer sans compte (1 analyse gratuite)"),
      ).toBeInTheDocument();
    });
  });

  it("shows tagline", async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText("Ne subissez plus vos vidéos — interrogez-les."),
      ).toBeInTheDocument();
    });
  });
});

// ── Login flow ──
describe("App — login flow", () => {
  it("transitions to main view on successful login", async () => {
    const user = userEvent.setup();

    // First call: CHECK_AUTH → not authenticated
    // Second call: LOGIN → success
    // Third call: GET_PLAN → plan info
    (chrome.runtime.sendMessage as jest.Mock)
      .mockResolvedValueOnce({ authenticated: false })
      .mockResolvedValueOnce({
        success: true,
        user: {
          id: 1,
          username: "alice",
          email: "a@b.com",
          plan: "free",
          credits: 100,
          credits_monthly: 150,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        plan: {
          plan_name: "Gratuit",
          plan_id: "free",
          monthly_analyses: 3,
          analyses_this_month: 0,
          credits: 100,
          credits_monthly: 150,
          features: {},
        },
      });

    render(<App />);

    // Wait for login view
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Adresse e-mail")).toBeInTheDocument();
    });

    // Fill form
    await user.type(
      screen.getByPlaceholderText("Adresse e-mail"),
      "alice@test.com",
    );
    await user.type(screen.getByPlaceholderText("Mot de passe"), "password123");

    // Submit
    const submitBtn = screen.getByText("Se connecter");
    await user.click(submitBtn);

    // Should transition to main view
    await waitFor(() => {
      // Main view has the logout button or video detection
      expect(
        screen.queryByPlaceholderText("Adresse e-mail"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows error on failed login", async () => {
    const user = userEvent.setup();

    (chrome.runtime.sendMessage as jest.Mock)
      .mockResolvedValueOnce({ authenticated: false }) // CHECK_AUTH
      .mockResolvedValueOnce({ success: false, error: "Invalid credentials" }); // LOGIN

    render(<App />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Adresse e-mail")).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("Adresse e-mail"),
      "bad@test.com",
    );
    await user.type(screen.getByPlaceholderText("Mot de passe"), "wrong");
    await user.click(screen.getByText("Se connecter"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });
});

// ── État connecté → main view ──
describe("App — authenticated state", () => {
  beforeEach(() => {
    const mockUser = {
      id: 1,
      username: "alice",
      email: "alice@test.com",
      plan: "pro",
      credits: 12000,
      credits_monthly: 15000,
    };

    (chrome.runtime.sendMessage as jest.Mock)
      .mockResolvedValueOnce({ authenticated: true, user: mockUser }) // CHECK_AUTH
      .mockResolvedValueOnce({
        success: true,
        plan: {
          plan_name: "Pro",
          plan_id: "pro",
          monthly_analyses: 200,
          analyses_this_month: 42,
          credits: 12000,
          credits_monthly: 15000,
          features: {},
        },
      }); // GET_PLAN

    // Mock tabs.query for video detection
    (chrome.tabs.query as jest.Mock).mockImplementation(
      (_q: unknown, cb: (tabs: unknown[]) => void) => {
        cb([
          {
            id: 1,
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            title: "Test Video",
          },
        ]);
      },
    );
  });

  it("shows main view with video detection", async () => {
    render(<App />);

    await waitFor(() => {
      // Should show the video title or related content
      expect(
        screen.queryByPlaceholderText("Adresse e-mail"),
      ).not.toBeInTheDocument();
    });
  });
});

// ── Guest mode ──
describe("App — guest mode", () => {
  it("enters guest mode when clicking guest button", async () => {
    const user = userEvent.setup();

    (chrome.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
      authenticated: false,
    });

    // Mock tabs.query for video detection
    (chrome.tabs.query as jest.Mock).mockImplementation(
      (_q: unknown, cb: (tabs: unknown[]) => void) => {
        cb([
          {
            id: 1,
            url: "https://www.youtube.com/watch?v=test123",
            title: "Test",
          },
        ]);
      },
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText("Essayer sans compte (1 analyse gratuite)"),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByText("Essayer sans compte (1 analyse gratuite)"),
    );

    await waitFor(() => {
      // Should show guest banner and main view
      expect(screen.getByText("Mode découverte")).toBeInTheDocument();
    });
  });
});
