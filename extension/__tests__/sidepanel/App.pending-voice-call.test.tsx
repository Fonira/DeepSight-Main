/** @jest-environment jsdom */
//
// Tests — App.tsx racine pour le flow pendingVoiceCall.
//
// Cible le finding [B4] de l'audit Quick Voice Call :
//   1. Lecture + suppression centralisée de pendingVoiceCall dans App.tsx
//      (PAS dans VoiceView qui doit recevoir le payload en prop).
//   2. App.tsx écoute chrome.storage.session.onChanged pour réagir
//      si la clé est set après le mount initial (finding [I6]).
//
// Stratégie : on mock useExtensionVoiceChat + useStreamingVideoContext +
// useTranslation pour ne tester QUE le routing pendingVoiceCall →
// rendering VoiceView avec le bon payload.

import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { resetChromeMocks } from "../setup/chrome-api-mock";

// Mocks AVANT l'import de App pour qu'ils soient effectifs.
const startSessionMock = jest.fn();
const endSessionMock = jest.fn();

jest.mock("../../src/sidepanel/useExtensionVoiceChat", () => ({
  useExtensionVoiceChat: () => ({
    startSession: startSessionMock,
    endSession: endSessionMock,
    toggleMute: jest.fn(),
    conversation: null,
    lastSessionWasTrial: true,
    status: "idle",
    error: null,
    transcripts: [],
    sessionId: null,
    isActive: false,
    start: jest.fn(),
    stop: jest.fn(),
    appendTranscript: jest.fn(),
  }),
  VoiceQuotaError: class extends Error {
    status = 402;
    detail = {};
  },
  __setElevenLabsSdkForTests: jest.fn(),
}));

jest.mock("../../src/sidepanel/hooks/useStreamingVideoContext", () => ({
  useStreamingVideoContext: () => ({
    contextProgress: 0,
    contextComplete: false,
  }),
}));

jest.mock("../../src/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: {
      common: { login: "x", logout: "x", retry: "Réessayer" },
      login: { tagline: "x" },
      analysis: { noVideo: "x" },
      plans: {},
      upsell: {},
      promos: { free: [], starter: [], standard: [], pro: [] },
      guest: { banner: "x", exhaustedText: "x" },
      credits: {},
      mistral: { badge: "x" },
      voiceCall: {
        buttonLabel: "Appel rapide",
        buttonAriaLabel: "x",
        buttonLabelFloating: "🎙️",
        trialBadge: "1 essai gratuit",
        trialUsed: "Essai utilisé",
        trialUsedTitle: "x",
        minutesRemaining: "{count} min restantes",
        upgradeBadge: "Passer en Expert",
        connecting: {
          title: "Connexion à l'agent…",
          subtitle: "x",
          ariaStatus: "x",
        },
        callActive: {
          live: "En appel",
          mute: "Mute",
          hangup: "Raccrocher",
          muteAriaLabel: "x",
          hangupAriaLabel: "x",
        },
        ctxBar: {
          inProgress: "Analyse en cours · {percent}%",
          complete: "Analyse complète",
          ariaInProgress: "{percent}",
          ariaComplete: "x",
        },
        upgradeCta: {
          trialUsedHeadline: "Tu as adoré ?",
          monthlyQuotaHeadline: "x",
          proNoVoiceHeadline: "Voice call exclusif Expert",
          headlineSuffix: "Continue avec 30 min/mois",
          trialUsedBody: "x",
          monthlyQuotaBody: "x",
          proNoVoiceBody: "x",
          planName: "Expert",
          planPrice: "14.99€",
          planPeriod: "/mois",
          feature1: "x",
          feature2: "x",
          feature3: "x",
          ctaPrimary: "Passer en Expert →",
          ctaDismiss: "Continuer en Free",
        },
        errors: {
          micPermission: "Permission micro requise.",
          callEnded: "Appel terminé.",
          genericPrefix: "Erreur :",
          close: "Fermer",
          connectingTimeout: "x",
        },
      },
    },
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

import { App } from "../../src/sidepanel/App";

interface SessionStorageMock {
  data: Record<string, unknown>;
  get: jest.Mock;
  set: jest.Mock;
  remove: jest.Mock;
  changeListeners: ((
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    area: string,
  ) => void)[];
}

function setupSessionStorage(initialData: Record<string, unknown> = {}): SessionStorageMock {
  const mock: SessionStorageMock = {
    data: { ...initialData },
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    changeListeners: [],
  };
  mock.get.mockImplementation((key: string) => {
    return Promise.resolve(
      mock.data[key] !== undefined ? { [key]: mock.data[key] } : {},
    );
  });
  mock.set.mockImplementation(async (kv: Record<string, unknown>) => {
    const old: Record<string, unknown> = {};
    for (const k of Object.keys(kv)) old[k] = mock.data[k];
    mock.data = { ...mock.data, ...kv };
    const changes: Record<string, { newValue: unknown; oldValue: unknown }> = {};
    for (const k of Object.keys(kv)) {
      changes[k] = { newValue: kv[k], oldValue: old[k] };
    }
    mock.changeListeners.forEach((fn) => fn(changes, "session"));
  });
  mock.remove.mockImplementation(async (key: string) => {
    const oldValue = mock.data[key];
    delete mock.data[key];
    const changes: Record<string, { newValue?: unknown; oldValue: unknown }> = {
      [key]: { oldValue },
    };
    mock.changeListeners.forEach((fn) => fn(changes, "session"));
  });

  const c = global as unknown as {
    chrome: {
      storage: { session?: unknown; onChanged?: { addListener: jest.Mock; removeListener?: jest.Mock } };
    };
  };
  c.chrome.storage.session = mock;
  // Some code uses chrome.storage.onChanged (top-level, all areas).
  const onChanged = {
    addListener: jest.fn((cb: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void) => {
      mock.changeListeners.push(cb);
    }),
    removeListener: jest.fn((cb: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void) => {
      const idx = mock.changeListeners.indexOf(cb);
      if (idx >= 0) mock.changeListeners.splice(idx, 1);
    }),
  };
  c.chrome.storage.onChanged = onChanged;
  return mock;
}

describe("App — pendingVoiceCall centralisé (B4 + I6)", () => {
  beforeEach(() => {
    resetChromeMocks();
    startSessionMock.mockReset();
    endSessionMock.mockReset();
    chrome.runtime.sendMessage = jest.fn().mockResolvedValue({
      authenticated: false,
    }) as unknown as typeof chrome.runtime.sendMessage;
  });

  it("renders VoiceView when pendingVoiceCall exists at mount", async () => {
    setupSessionStorage({
      pendingVoiceCall: { videoId: "abc", videoTitle: "Test" },
    });
    startSessionMock.mockResolvedValue({
      session_id: "s1",
      signed_url: "wss://x",
      max_minutes: 3,
      is_trial: true,
    });

    let renderResult: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(<App />);
    });

    // App should bypass MainView and render VoiceView (which calls
    // startSession). Au minimum, on doit voir une UI Voice (ConnectingView
    // avec son texte caractéristique) plutôt que LoginView.
    await waitFor(
      () => {
        const txt = renderResult!.container.textContent ?? "";
        expect(txt).toMatch(/Connexion à l'agent|En appel/);
      },
      { timeout: 3000 },
    );
  });

  it("removes pendingVoiceCall from session storage after consumption (centralized)", async () => {
    const session = setupSessionStorage({
      pendingVoiceCall: { videoId: "abc", videoTitle: "Test" },
    });
    startSessionMock.mockResolvedValue({
      session_id: "s1",
      signed_url: "wss://x",
      max_minutes: 3,
      is_trial: true,
    });

    await act(async () => {
      render(<App />);
    });

    // Centralisation B4 : la suppression est faite par App.tsx (ou un
    // useEffect racine), PAS par VoiceView. On accepte l'une OU l'autre
    // appelant remove tant que c'est fait UNE seule fois côté chrome
    // (idempotence sur double-mount StrictMode).
    await waitFor(() => {
      expect(session.remove).toHaveBeenCalledWith("pendingVoiceCall");
    });
  });

  it("reacts to pendingVoiceCall set AFTER initial mount (storage.onChanged)", async () => {
    // Initial mount : pas de pending call → MainView (login car non auth).
    const session = setupSessionStorage({});

    let renderResult: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(<App />);
    });

    // Attendre que App soit stable (pas en loading).
    await waitFor(() => {
      const c = renderResult!.container;
      expect(c.querySelector(".loading-view")).toBeNull();
    });

    // Maintenant le SW set la clé (clic Quick Voice Call sur YouTube).
    startSessionMock.mockResolvedValue({
      session_id: "s2",
      signed_url: "wss://x",
      max_minutes: 3,
      is_trial: true,
    });
    await act(async () => {
      await session.set({
        pendingVoiceCall: { videoId: "xyz", videoTitle: "Live test" },
      });
    });

    // Doit basculer vers VoiceView sans refresh manuel.
    await waitFor(
      () => {
        const txt = renderResult!.container.textContent ?? "";
        expect(txt).toMatch(/Connexion à l'agent|En appel/);
      },
      { timeout: 3000 },
    );
  });
});
