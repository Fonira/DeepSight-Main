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
  // Vraies traductions FR : un dictionnaire partiel faisait planter le rendu
  // dès qu'un composant enfant lisait une clé absente (voiceCall.callActive…).
  useTranslation: () => ({
    t: jest.requireActual("../../../src/i18n/fr.json"),
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

import { MainView } from "../../../src/sidepanel/views/MainView";
import { FEATURES } from "../../../src/utils/features";
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
  // PR #147 SidePanel V3 ajoute aussi onActivated/onUpdated listeners → mocker.
  const c = global as unknown as {
    chrome: {
      tabs: {
        query: jest.Mock;
        onActivated?: { addListener: jest.Mock; removeListener: jest.Mock };
        onUpdated?: { addListener: jest.Mock; removeListener: jest.Mock };
      };
    };
  };
  c.chrome.tabs.query = jest.fn().mockResolvedValue([{ id: 1, url, title }]);
  c.chrome.tabs.onActivated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  c.chrome.tabs.onUpdated = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

describe("MainView × VoiceCallButton (I1)", () => {
  beforeEach(() => {
    FEATURES.voice = true;
    resetChromeMocks();
    chrome.runtime.sendMessage = jest.fn().mockResolvedValue({
      success: true,
    }) as unknown as typeof chrome.runtime.sendMessage;
    setupTabsQuery("https://www.youtube.com/watch?v=abc123", "Hello world");
  });

  afterEach(() => {
    FEATURES.voice = false;
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
      // Pricing v2 : Pro a un quota mensuel → badge « N min restantes ».
      expect(screen.queryByText(/min restantes/)).not.toBeNull();
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
      // PR #147 SidePanel V3 a renommé .analyze-btn en .v3-button-primary.
      // Le bouton Analyser est le 1er v3-button-primary après le voice btn.
      const v3Primary = document.querySelectorAll("button.v3-button-primary");
      expect(voiceBtn).not.toBeNull();
      expect(v3Primary.length).toBeGreaterThan(0);
      // Voice doit précéder le 1er v3-button-primary dans l'ordre DOM.
      const all = Array.from(document.querySelectorAll("button"));
      expect(all.indexOf(voiceBtn!)).toBeLessThan(
        all.indexOf(v3Primary[0] as HTMLButtonElement),
      );
    });
  });
});

describe("MainView × VoiceCallButton — appels vocaux coupés", () => {
  beforeEach(() => {
    FEATURES.voice = false;
    resetChromeMocks();
    chrome.runtime.sendMessage = jest.fn().mockResolvedValue({
      success: true,
    }) as unknown as typeof chrome.runtime.sendMessage;
    setupTabsQuery("https://www.youtube.com/watch?v=abc123", "Hello world");
  });

  it("does NOT render VoiceCallButton even when a YouTube video is detected", async () => {
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

    // La vidéo est bien détectée (bouton Analyser) mais pas de bouton d'appel.
    await waitFor(() => {
      expect(
        document.querySelectorAll("button.v3-button-primary").length,
      ).toBeGreaterThan(0);
    });
    expect(document.querySelector("button.voice-call-btn")).toBeNull();
  });
});
