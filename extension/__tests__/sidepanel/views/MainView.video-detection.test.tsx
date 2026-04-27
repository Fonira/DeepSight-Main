/**
 * Tests — MainView : détection vidéo dans le contexte side panel.
 * Fichier source : src/sidepanel/views/MainView.tsx
 *
 * Bug couvert : dans un side panel Chrome MV3, `tabs.query({currentWindow:true})`
 * cible la fenêtre du panel (contexte distinct), pas la fenêtre du navigateur.
 * Le fix bascule sur `lastFocusedWindow:true` ET ajoute deux listeners pour
 * re-détecter quand l'user change de tab ou navigue dans la même tab YouTube.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { MainView } from "../../../src/sidepanel/views/MainView";

// ── Mock i18n (évite la dépendance à chrome.storage.sync) ──
jest.mock("../../../src/i18n/useTranslation", () => ({
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
      plans: {
        free: "Gratuit",
        pro: "Pro",
        starter: "Standard",
        student: "Starter",
      },
      upsell: {
        free: { label: "Starter", feature: "Flashcards", price: "2,99€" },
        pro: { label: "Expert", feature: "Tout", price: "14,99€" },
      },
      promos: {
        free: [
          { text: "Flashcards IA", cta: "Débloquer Starter" },
          { text: "Cartes mentales", cta: "Voir les plans" },
        ],
        starter: [{ text: "Recherche web IA", cta: "Débloquer" }],
        standard: [{ text: "Playlists", cta: "Débloquer Pro" }],
        pro: [{ text: "Mobile", cta: "Télécharger" }],
      },
      analysis: {
        noVideo: "Ouvre une vidéo YouTube ou TikTok",
        analyzeButton: "Analyser cette vidéo",
        starting: "Démarrage...",
        processing: "Traitement...",
        failed: "Échec",
        startFailed: "Impossible de démarrer",
        recent: "Récents",
        quotaExceeded: "Quota atteint",
        quotaExceededText: "Upgrade",
        quickChatButton: "Quick Chat",
        quickChatPreparing: "Préparation...",
        mode: "Mode",
        language: "Langue",
        modes: { standard: "Standard", accessible: "Accessible" },
        languages: { fr: "FR", en: "EN", es: "ES", de: "DE" },
      },
      guest: { banner: "Mode découverte", exhaustedText: "Créer un compte" },
      credits: {
        critical: "Plus que {count}",
        recharge: "Recharger",
        remaining: "{count} crédits",
        low: "cr.",
      },
      ytRecommend: {
        title: "Astuce",
        subtitle: "Ouvre une vidéo",
        dismiss: "Fermer",
      },
      mistral: { badge: "Propulsé par Mistral AI" },
    },
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

// ── Helpers ──

type TabsListener<T extends unknown[]> = (...args: T) => void;

interface TabsQueryArgs {
  active?: boolean;
  currentWindow?: boolean;
  lastFocusedWindow?: boolean;
}

interface MockTab {
  id?: number;
  url?: string;
  title?: string;
}

interface MockTabsApi {
  query: jest.Mock;
  onActivated: {
    addListener: jest.Mock;
    removeListener: jest.Mock;
    listeners: TabsListener<[{ tabId: number; windowId: number }]>[];
  };
  onUpdated: {
    addListener: jest.Mock;
    removeListener: jest.Mock;
    listeners: TabsListener<
      [number, { url?: string; status?: string }, MockTab]
    >[];
  };
}

/**
 * Patche chrome.tabs avec :
 *  - une query qui répond uniquement quand `lastFocusedWindow: true` est passé
 *    (sinon retourne []), pour matérialiser le bug : `currentWindow:true` dans
 *    un side panel ne renvoie PAS le tab navigateur attendu
 *  - deux listeners onActivated / onUpdated qu'on peut déclencher à la main
 */
function installTabsMock(initialTab: MockTab | null): MockTabsApi {
  const onActivatedListeners: TabsListener<
    [{ tabId: number; windowId: number }]
  >[] = [];
  const onUpdatedListeners: TabsListener<
    [number, { url?: string; status?: string }, MockTab]
  >[] = [];

  let currentTab: MockTab | null = initialTab;

  const query = jest.fn((args: TabsQueryArgs) => {
    // Side panel context — `currentWindow:true` cible la fenêtre du panel
    // (pas le navigateur), donc on retourne un array vide pour matérialiser
    // ce comportement. Seul `lastFocusedWindow:true` doit cibler le bon tab.
    if (args.lastFocusedWindow === true) {
      return Promise.resolve(currentTab ? [currentTab] : []);
    }
    return Promise.resolve([]);
  });

  const tabsApi: MockTabsApi = {
    query,
    onActivated: {
      addListener: jest.fn((cb) => {
        onActivatedListeners.push(cb);
      }),
      removeListener: jest.fn((cb) => {
        const i = onActivatedListeners.indexOf(cb);
        if (i >= 0) onActivatedListeners.splice(i, 1);
      }),
      listeners: onActivatedListeners,
    },
    onUpdated: {
      addListener: jest.fn((cb) => {
        onUpdatedListeners.push(cb);
      }),
      removeListener: jest.fn((cb) => {
        const i = onUpdatedListeners.indexOf(cb);
        if (i >= 0) onUpdatedListeners.splice(i, 1);
      }),
      listeners: onUpdatedListeners,
    },
  };

  // Replace chrome.tabs (the polyfill mock redirects Browser to chrome)
  (chrome as unknown as { tabs: MockTabsApi & { sendMessage: jest.Mock; create: jest.Mock } }).tabs = {
    ...tabsApi,
    sendMessage: jest.fn(() => Promise.resolve()),
    create: jest.fn(() => Promise.resolve({ id: 99 })),
  };

  // Helper to swap current tab between events
  (tabsApi as unknown as { __setTab: (tab: MockTab | null) => void }).__setTab =
    (tab: MockTab | null) => {
      currentTab = tab;
    };

  return tabsApi;
}

// Common props
const baseProps = {
  user: {
    id: 1,
    username: "alice",
    email: "a@b.com",
    plan: "free" as const,
    credits: 100,
    credits_monthly: 150,
    default_mode: "standard",
    default_lang: "fr",
  },
  planInfo: {
    plan_name: "Gratuit",
    plan_id: "free",
    monthly_analyses: 5,
    analyses_this_month: 0,
    credits: 100,
    credits_monthly: 150,
    features: {},
  },
  isGuest: false,
  onLogout: jest.fn(),
  onLoginRedirect: jest.fn(),
  onError: jest.fn(),
};

beforeEach(() => {
  resetChromeMocks();
  // Mock recents API call (returns empty)
  (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
    success: true,
    items: [],
  });
});

describe("MainView — video detection in side panel context", () => {
  it("detects YouTube video via lastFocusedWindow and shows the primary Analyser button", async () => {
    installTabsMock({
      id: 42,
      url: "https://www.youtube.com/watch?v=abc123",
      title: "Ma super vidéo YouTube",
    });

    render(<MainView {...baseProps} />);

    // Attendre que le titre de la vidéo apparaisse → preuve que la détection
    // a fonctionné via lastFocusedWindow et que le bloc analysis n'est pas masqué.
    await waitFor(() => {
      expect(screen.getByText("Ma super vidéo YouTube")).toBeInTheDocument();
    });

    // Le bouton primaire d'analyse doit être présent
    const analyserButton = screen
      .getAllByRole("button")
      .find((b) => b.className.includes("v3-button-primary"));
    expect(analyserButton).toBeDefined();
    expect(analyserButton?.textContent).toMatch(/Analyser/);

    // L'empty state ne doit PAS être affiché
    expect(
      screen.queryByText("Ouvre une vidéo YouTube ou TikTok"),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when active tab is not a video URL (and queries via lastFocusedWindow)", async () => {
    // Setup divergent : si le code (à tort) utilise `currentWindow:true`, il
    // recevra un tab YouTube et affichera la card vidéo. Avec `lastFocusedWindow:true`,
    // il reçoit Google.com et doit afficher l'empty state.
    const onActivatedListeners: TabsListener<
      [{ tabId: number; windowId: number }]
    >[] = [];
    const onUpdatedListeners: TabsListener<
      [number, { url?: string; status?: string }, MockTab]
    >[] = [];

    const query = jest.fn((args: TabsQueryArgs) => {
      if (args.lastFocusedWindow === true) {
        return Promise.resolve([
          { id: 7, url: "https://google.com", title: "Google" },
        ]);
      }
      // Si le code utilise toujours currentWindow:true → on retourne un YT
      // pour matérialiser le faux positif et faire échouer le test.
      return Promise.resolve([
        {
          id: 99,
          url: "https://www.youtube.com/watch?v=trap666",
          title: "TRAP — should NOT appear",
        },
      ]);
    });

    (
      chrome as unknown as {
        tabs: {
          query: jest.Mock;
          onActivated: { addListener: jest.Mock; removeListener: jest.Mock };
          onUpdated: { addListener: jest.Mock; removeListener: jest.Mock };
          sendMessage: jest.Mock;
          create: jest.Mock;
        };
      }
    ).tabs = {
      query,
      onActivated: {
        addListener: jest.fn((cb) => {
          onActivatedListeners.push(cb);
        }),
        removeListener: jest.fn(),
      },
      onUpdated: {
        addListener: jest.fn((cb) => {
          onUpdatedListeners.push(cb);
        }),
        removeListener: jest.fn(),
      },
      sendMessage: jest.fn(() => Promise.resolve()),
      create: jest.fn(() => Promise.resolve({ id: 1 })),
    };

    render(<MainView {...baseProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("Ouvre une vidéo YouTube ou TikTok"),
      ).toBeInTheDocument();
    });

    // Le tab "TRAP" ne doit jamais s'afficher — ce serait la preuve que le code
    // utilise encore currentWindow:true.
    expect(screen.queryByText("TRAP — should NOT appear")).not.toBeInTheDocument();

    // Aucun bouton "Analyser cette vidéo" ne doit être visible (pas de video card)
    const analyserButton = screen
      .queryAllByRole("button")
      .find(
        (b) =>
          b.className.includes("v3-button-primary") &&
          /Analyser/.test(b.textContent || ""),
      );
    expect(analyserButton).toBeUndefined();
  });

  it("re-detects video when user switches tab (chrome.tabs.onActivated)", async () => {
    const tabsApi = installTabsMock({
      id: 1,
      url: "https://www.youtube.com/watch?v=first123",
      title: "Première vidéo",
    });

    render(<MainView {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Première vidéo")).toBeInTheDocument();
    });

    // L'user change de tab → on swap le current tab avant le déclenchement
    (tabsApi as unknown as { __setTab: (tab: MockTab) => void }).__setTab({
      id: 2,
      url: "https://www.youtube.com/watch?v=second456",
      title: "Seconde vidéo",
    });

    // Vérifier qu'au moins un listener onActivated a bien été enregistré
    expect(tabsApi.onActivated.listeners.length).toBeGreaterThan(0);

    // Trigger l'event onActivated
    await act(async () => {
      for (const listener of tabsApi.onActivated.listeners) {
        listener({ tabId: 2, windowId: 1 });
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Seconde vidéo")).toBeInTheDocument();
    });

    // L'ancienne vidéo ne doit plus être affichée
    expect(screen.queryByText("Première vidéo")).not.toBeInTheDocument();
  });

  it("re-detects video on URL change inside same tab (chrome.tabs.onUpdated with changeInfo.url)", async () => {
    const tabsApi = installTabsMock({
      id: 1,
      url: "https://www.youtube.com/watch?v=foo111",
      title: "Vidéo Foo",
    });

    render(<MainView {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Vidéo Foo")).toBeInTheDocument();
    });

    // L'user navigue (SPA YouTube) vers une autre vidéo dans le même tab
    (tabsApi as unknown as { __setTab: (tab: MockTab) => void }).__setTab({
      id: 1,
      url: "https://www.youtube.com/watch?v=bar222",
      title: "Vidéo Bar",
    });

    // Vérifier qu'au moins un listener onUpdated a bien été enregistré
    expect(tabsApi.onUpdated.listeners.length).toBeGreaterThan(0);

    // Trigger l'event onUpdated avec changeInfo.url (signal d'une vraie navigation)
    await act(async () => {
      for (const listener of tabsApi.onUpdated.listeners) {
        listener(
          1,
          { url: "https://www.youtube.com/watch?v=bar222" },
          {
            id: 1,
            url: "https://www.youtube.com/watch?v=bar222",
            title: "Vidéo Bar",
          },
        );
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Vidéo Bar")).toBeInTheDocument();
    });

    expect(screen.queryByText("Vidéo Foo")).not.toBeInTheDocument();
  });

  it("removes onActivated and onUpdated listeners on unmount (no leak)", async () => {
    const tabsApi = installTabsMock({
      id: 1,
      url: "https://www.youtube.com/watch?v=abc123",
      title: "Test",
    });

    const { unmount } = render(<MainView {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    const activatedAddCount = (tabsApi.onActivated.addListener as jest.Mock)
      .mock.calls.length;
    const updatedAddCount = (tabsApi.onUpdated.addListener as jest.Mock).mock
      .calls.length;

    expect(activatedAddCount).toBeGreaterThan(0);
    expect(updatedAddCount).toBeGreaterThan(0);

    unmount();

    // Cleanup obligatoire : chaque addListener doit avoir un removeListener correspondant
    expect(
      (tabsApi.onActivated.removeListener as jest.Mock).mock.calls.length,
    ).toBe(activatedAddCount);
    expect(
      (tabsApi.onUpdated.removeListener as jest.Mock).mock.calls.length,
    ).toBe(updatedAddCount);
  });
});
