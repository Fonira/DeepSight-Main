/**
 * 🧪 ShepherdTour — Tests unitaires.
 *
 * Mocke shepherd.js pour vérifier l'init/destroy + persistance API + analytics.
 * On ne teste PAS le rendu visuel des popups Shepherd (ça relève du E2E).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../__tests__/test-utils";

// ─────────── Mocks (déclarés AVANT l'import du SUT) ───────────

// Capture les events pour les assertions
const captureMock = vi.fn();
const trackOnboardingStepMock = vi.fn();

vi.mock("../../../services/analytics", () => ({
  analytics: {
    capture: (...args: unknown[]) => captureMock(...args),
    trackOnboardingStep: (...args: unknown[]) =>
      trackOnboardingStepMock(...args),
  },
  AnalyticsEvents: {},
}));

const updatePreferencesMock = vi.fn(
  async (_prefs: { extra_preferences?: Record<string, unknown> }) => ({
    success: true,
    message: "OK",
  }),
);

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>(
    "../../../services/api",
  );
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      updatePreferences: (prefs: {
        extra_preferences?: Record<string, unknown>;
      }) => updatePreferencesMock(prefs),
    },
  };
});

// ─────────── Shepherd.js mock ───────────

interface MockTour {
  addStep: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  next: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  isActive: ReturnType<typeof vi.fn>;
  /** Liste des steps ajoutés (id, options) — utile pour assertions. */
  steps: Array<Record<string, unknown>>;
  /** Map event → handler pour pouvoir simuler les triggers depuis le test. */
  handlers: Record<string, (...args: unknown[]) => void>;
}

let lastTour: MockTour | null = null;

vi.mock("shepherd.js", () => {
  function Tour(_opts: unknown) {
    const steps: Array<Record<string, unknown>> = [];
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    let active = false;
    const tour: MockTour = {
      addStep: vi.fn((opts: Record<string, unknown>) => {
        steps.push(opts);
      }),
      start: vi.fn(() => {
        active = true;
        handlers["start"]?.();
      }),
      complete: vi.fn(() => {
        active = false;
        handlers["complete"]?.();
      }),
      cancel: vi.fn(() => {
        active = false;
        handlers["cancel"]?.();
      }),
      next: vi.fn(),
      back: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handler;
      }),
      isActive: vi.fn(() => active),
      steps,
      handlers,
    };
    lastTour = tour;
    return tour;
  }
  return {
    Tour: Tour as unknown as new (opts: unknown) => MockTour,
    default: { Tour: Tour as unknown as new (opts: unknown) => MockTour },
  };
});

// Mock CSS imports (évite ENOENT au transform)
vi.mock("shepherd.js/dist/css/shepherd.css", () => ({}));
vi.mock("../ShepherdTour.css", () => ({}));

// ─────────── SUT (Subject Under Test) ───────────

import ShepherdTour from "../ShepherdTour";

// ─────────── Helpers ───────────

beforeEach(() => {
  vi.clearAllMocks();
  lastTour = null;
});

afterEach(() => {
  // Nettoie tour actif si laissé par un test
  if (lastTour && lastTour.isActive()) {
    lastTour.cancel();
  }
  lastTour = null;
});

/** Attend que le tour soit instancié (import() dynamique + setTimeout 250ms). */
async function waitForTourInit() {
  await waitFor(() => expect(lastTour).not.toBeNull(), { timeout: 3000 });
  // Le composant fait un setTimeout(250) avant tour.start() → attendre.
  await waitFor(() => expect(lastTour!.start).toHaveBeenCalled(), {
    timeout: 3000,
  });
}

// ─────────── Tests ───────────

describe("ShepherdTour", () => {
  it("ne se monte pas / ne démarre pas si disabled=true", async () => {
    renderWithProviders(<ShepherdTour disabled />);
    // Attendre un peu pour s'assurer qu'il n'y a pas de side-effect
    await new Promise((r) => setTimeout(r, 350));
    expect(lastTour).toBeNull();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("instancie Shepherd, ajoute 5 steps et démarre le tour quand mounted", async () => {
    renderWithProviders(<ShepherdTour />);
    await waitForTourInit();
    expect(lastTour!.steps.length).toBe(5);
    expect(captureMock).toHaveBeenCalledWith("onboarding_tour_started");
  });

  it("au complete : capture event + persist has_completed_onboarding=true", async () => {
    const onClose = vi.fn();
    renderWithProviders(<ShepherdTour onClose={onClose} />);
    await waitForTourInit();
    // Simule le complete de l'utilisateur
    lastTour!.complete();
    await waitFor(() => {
      expect(captureMock).toHaveBeenCalledWith("onboarding_tour_completed");
      expect(updatePreferencesMock).toHaveBeenCalledWith({
        extra_preferences: { has_completed_onboarding: true },
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("au cancel/skip : capture skipped + persist has_completed_onboarding=true", async () => {
    const onClose = vi.fn();
    renderWithProviders(<ShepherdTour onClose={onClose} />);
    await waitForTourInit();
    lastTour!.cancel();
    await waitFor(() => {
      expect(captureMock).toHaveBeenCalledWith("onboarding_tour_skipped");
      expect(updatePreferencesMock).toHaveBeenCalledWith({
        extra_preferences: { has_completed_onboarding: true },
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("ne persiste qu'une seule fois même si complete + cancel sont triggered", async () => {
    renderWithProviders(<ShepherdTour />);
    await waitForTourInit();
    lastTour!.complete();
    // Cancel après complete = no-op pour la persistance (déjà flaggué).
    // On simule directement le handler interne sans repasser par tour.cancel
    // (car notre mock toggle active=false → 2e cancel ne fire plus).
    if (lastTour!.handlers["cancel"]) {
      lastTour!.handlers["cancel"]();
    }
    await waitFor(() => {
      expect(updatePreferencesMock).toHaveBeenCalledTimes(1);
    });
  });

  it("chaque step a un id et une définition de bouton", async () => {
    renderWithProviders(<ShepherdTour />);
    await waitForTourInit();
    const ids = lastTour!.steps.map((s) => s.id);
    expect(ids).toEqual([
      "welcome",
      "analyze-input",
      "hub-nav",
      "study-nav",
      "profile-menu",
    ]);
    // Le premier step (welcome) n'a pas de back → 2 boutons (skip + next)
    const welcomeStep = lastTour!.steps[0];
    expect(Array.isArray(welcomeStep.buttons)).toBe(true);
    const welcomeBtns = welcomeStep.buttons as Array<{ text: string }>;
    expect(welcomeBtns.length).toBeGreaterThanOrEqual(2);
    // Le dernier step a un bouton "done" (pas next)
    const lastStep = lastTour!.steps[4];
    const lastBtns = lastStep.buttons as Array<{ text: string }>;
    expect(lastBtns.some((b) => /commencer|start/i.test(b.text))).toBe(true);
  });

  it("steps avec target déclarent attachTo (vs welcome step centré)", async () => {
    renderWithProviders(<ShepherdTour />);
    await waitForTourInit();
    const welcome = lastTour!.steps[0];
    expect(welcome.attachTo).toBeUndefined();
    const inputStep = lastTour!.steps[1];
    expect(inputStep.attachTo).toEqual({
      element: '[data-tour-step="analyze-input"]',
      on: "bottom",
    });
  });
});
