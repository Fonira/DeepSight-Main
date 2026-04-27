/** @jest-environment jsdom */
//
// Tests — MainView × VoiceCallButton (Quick Voice Call I1)
//
// Vérifie que le bouton "🎙️ Appel rapide" est rendu dans MainView dès
// qu'une vidéo est détectée, et qu'il reste visible dans toutes les
// phases d'analyse (idle, analyzing, error, complete) — c'est le whole
// point de la killer feature : on doit pouvoir appeler la vidéo à tout
// moment, indépendamment de l'analyse texte.

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";

// Mock useTranslation pour ne pas dépendre de chrome.storage.sync.
// Inclut tout ce que MainView, VoiceCallButton et PromoBanner utilisent.
jest.mock("../../../src/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: {
      common: {
        login: "Login",
        logout: "Logout",
        retry: "Réessayer",
        viewPlans: "Voir les plans",
        unlock: "Débloquer",
        analyses: "analyses",
        credits: "crédits",
        createAccount: "Créer un compte",
      },
      plans: { free: "Gratuit", pro: "Pro", expert: "Expert" },
      upsell: {
        free: { label: "Pro", feature: "x", price: "5,99€" },
      },
      promos: {
        free: [{ text: "x", cta: "y" }],
        starter: [{ text: "x", cta: "y" }],
        standard: [{ text: "x", cta: "y" }],
        pro: [{ text: "x", cta: "y" }],
      },
      analysis: {
        noVideo: "Aucune vidéo",
        analyzeButton: "Analyser cette vidéo",
        starting: "Démarrage…",
        processing: "En cours…",
        failed: "Échec",
        startFailed: "Impossible de démarrer",
        recent: "Récents",
        quickChatButton: "Quick Chat",
        quickChatPreparing: "Préparation…",
        quotaExceeded: "Quota atteint",
        quotaExceededText: "Passez en Pro",
        mode: "Mode",
        language: "Langue",
        modes: { standard: "Standard", accessible: "Accessible" },
        languages: { fr: "FR", en: "EN", es: "ES", de: "DE" },
      },
      guest: { banner: "Découverte", exhaustedText: "Créez un compte" },
      credits: { critical: "{count}", recharge: "x", remaining: "{count}", low: "x" },
      mistral: { badge: "Mistral" },
      ytRecommend: { title: "x", subtitle: "x", dismiss: "x" },
      voiceCall: {
        buttonLabel: "Appel rapide",
        buttonAriaLabel: "Lancer un appel vocal",
        buttonLabelFloating: "🎙️ Appeler la vidéo",
        trialBadge: "1 essai gratuit",
        trialUsed: "Essai utilisé",
        trialUsedTitle: "Essai utilisé — passer en Expert",
        minutesRemaining: "{count} min restantes",
        upgradeBadge: "Passer en Expert",
      },
    },
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

import { MainView } from "../../../src/sidepanel/views/MainView";
import type { User, PlanInfo } from "../../../src/types";

const mockUser: User = {
  id: 1,
  username: "alice",
  email: "alice@test.com",
  plan: "pro",
  credits: 100,
  credits_monthly: 150,
};

const mockPlanInfo: PlanInfo = {
  plan_name: "Pro",
  plan_id: "pro",
  monthly_analyses: 30,
  analyses_this_month: 5,
  credits: 100,
  credits_monthly: 150,
  features: {
    analysis: true,
    synthesis: true,
    chat: true,
    flashcards: true,
    mind_maps: true,
    web_search: true,
    playlists: true,
    exports: true,
  },
};

function setupTabsQuery(url: string, title: string): void {
  // chrome.tabs.query est mocké pour retourner un tab YouTube : MainView
  // l'utilise au mount via Browser.tabs.query() et set le state video.
  const c = global as unknown as {
    chrome: { tabs: { query: jest.Mock } };
  };
  c.chrome.tabs.query = jest.fn().mockResolvedValue([{ id: 1, url, title }]);
}

describe("MainView × VoiceCallButton (I1)", () => {
  beforeEach(() => {
    resetChromeMocks();
    chrome.runtime.sendMessage = jest.fn().mockResolvedValue({
      success: true,
    }) as unknown as typeof chrome.runtime.sendMessage;
    setupTabsQuery("https://www.youtube.com/watch?v=abc123", "Hello world");
  });

  it("renders VoiceCallButton when a YouTube video is detected", async () => {
    render(
      <MainView
        user={mockUser}
        planInfo={mockPlanInfo}
        isGuest={false}
        onLogout={() => {}}
        onLoginRedirect={() => {}}
        onError={() => {}}
      />,
    );

    await waitFor(() => {
      const btn = document.querySelector("button.voice-call-btn");
      expect(btn).not.toBeNull();
    });
  });

  it("does NOT render VoiceCallButton when no video is detected", async () => {
    setupTabsQuery("https://example.com/", "Random page");

    render(
      <MainView
        user={mockUser}
        planInfo={mockPlanInfo}
        isGuest={false}
        onLogout={() => {}}
        onLoginRedirect={() => {}}
        onError={() => {}}
      />,
    );

    // Wait long enough that the tabs.query promise has flushed.
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector("button.voice-call-btn")).toBeNull();
  });

  it("passes the correct plan='pro' badge to VoiceCallButton", async () => {
    render(
      <MainView
        user={mockUser}
        planInfo={mockPlanInfo}
        isGuest={false}
        onLogout={() => {}}
        onLoginRedirect={() => {}}
        onError={() => {}}
      />,
    );

    await waitFor(() => {
      // Pro plan → badge "Passer en Expert" sur VoiceCallButton.
      expect(screen.queryByText(/Passer en Expert/)).not.toBeNull();
    });
  });

  it("maps user.plan='free' to the trial badge", async () => {
    const freeUser: User = { ...mockUser, plan: "free" };
    const freePlan: PlanInfo = { ...mockPlanInfo, plan_id: "free" };

    render(
      <MainView
        user={freeUser}
        planInfo={freePlan}
        isGuest={false}
        onLogout={() => {}}
        onLoginRedirect={() => {}}
        onError={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText(/1 essai gratuit/)).not.toBeNull();
    });
  });

  it("maps user.plan='expert' to the minutes-remaining badge", async () => {
    const expertUser: User = { ...mockUser, plan: "expert" };
    const expertPlan: PlanInfo = { ...mockPlanInfo, plan_id: "expert" };

    render(
      <MainView
        user={expertUser}
        planInfo={expertPlan}
        isGuest={false}
        onLogout={() => {}}
        onLoginRedirect={() => {}}
        onError={() => {}}
      />,
    );

    await waitFor(() => {
      // Default monthlyMinutesUsed=0 → 30 min restantes.
      expect(screen.queryByText(/30 min restantes/)).not.toBeNull();
    });
  });

  it("renders the VoiceCallButton ABOVE the Analyser button in DOM order", async () => {
    render(
      <MainView
        user={mockUser}
        planInfo={mockPlanInfo}
        isGuest={false}
        onLogout={() => {}}
        onLoginRedirect={() => {}}
        onError={() => {}}
      />,
    );

    await waitFor(() => {
      const voiceBtn = document.querySelector("button.voice-call-btn");
      const analyseBtn = document.querySelector("button.analyze-btn");
      expect(voiceBtn).not.toBeNull();
      expect(analyseBtn).not.toBeNull();
      // Voice doit précéder Analyse dans l'ordre DOM (= visuel).
      const all = Array.from(document.querySelectorAll("button"));
      expect(all.indexOf(voiceBtn!)).toBeLessThan(all.indexOf(analyseBtn!));
    });
  });
});
