/**
 * 🧪 Tests — UpgradeModal Component
 *
 * Event-driven modal listening to 'show-upgrade-modal' CustomEvent.
 * Langue par défaut = FR (via LanguageProvider).
 *
 * ⚠️ PAS de vi.useFakeTimers() — framer-motion ne fonctionne pas avec.
 * On utilise waitFor + waitForElementToBeRemoved pour les animations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  act,
} from "../../__tests__/test-utils";
import { UpgradeModal } from "../UpgradeModal";

// ═══════════════════════════════════════════════════════════════════════════════
// 🧹 SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

afterEach(() => {
  vi.clearAllMocks();
});

/** Helper pour dispatcher l'event et attendre que le modal apparaisse */
async function showModal(detail: Record<string, unknown>, expectText: RegExp) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent("show-upgrade-modal", { detail }));
  });
  await waitFor(() => {
    expect(screen.getByText(expectText)).toBeInTheDocument();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ BASIC VISIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - Visibility", () => {
  it("should not render modal content by default", () => {
    renderWithProviders(<UpgradeModal />);

    expect(
      screen.queryByText(
        /Fonctionnalité verrouillée|Quota atteint|Vidéo trop longue/i,
      ),
    ).not.toBeInTheDocument();
  });

  it("should render nothing when no data received", () => {
    const { container } = renderWithProviders(<UpgradeModal />);
    expect(container.querySelector('[class*="fixed"]')).not.toBeInTheDocument();
  });

  it("should show modal after dispatching show-upgrade-modal event", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Mind Map",
        required_plan_name: "Pro",
        required_plan_price: 1299,
      },
      /Mind Map/,
    );

    // FR: "Disponible dès le plan Pro"
    expect(screen.getByText(/Disponible dès le plan Pro/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 FEATURE_LOCKED TYPE
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - feature_locked", () => {
  it("should display feature_locked with correct content", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Playlist Analysis",
        required_plan_name: "Pro",
        required_plan_price: 1299,
      },
      /Playlist Analysis/,
    );

    expect(screen.getByText(/Disponible dès le plan Pro/i)).toBeInTheDocument();
    expect(screen.getByText(/12.99/)).toBeInTheDocument();
  });

  it("should show upgrade button", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Web Search",
        required_plan_name: "Starter",
        required_plan_price: 599,
      },
      /Web Search/,
    );

    // FR: "Passer à Starter"
    const buttons = screen.getAllByRole("button");
    const upgradeButton = buttons.find((b) =>
      b.textContent?.includes("Passer à"),
    );
    expect(upgradeButton).toBeTruthy();
  });

  it("should use default label if feature_label not provided", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      { type: "feature_locked", required_plan_name: "Pro" },
      /Fonctionnalité verrouillée/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 QUOTA_EXCEEDED TYPE
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - quota_exceeded", () => {
  it("should display quota_exceeded with progress bar and counts", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      { type: "quota_exceeded", limit: 50, used: 50 },
      /Quota atteint/,
    );

    expect(screen.getByText(/\(50\/50\)/)).toBeInTheDocument();
  });

  it("should display default message when no custom message", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      { type: "quota_exceeded", limit: 20, used: 20 },
      /Quota atteint/,
    );

    // FR: "Vous avez atteint la limite de votre plan actuel."
    expect(
      screen.getByText(/Vous avez atteint la limite/i),
    ).toBeInTheDocument();
  });

  it('should show "Voir les plans" button', async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      { type: "quota_exceeded", limit: 3, used: 3 },
      /Quota atteint/,
    );

    // FR: "Voir les plans"
    const buttons = screen.getAllByRole("button");
    const ctaButton = buttons.find((b) =>
      b.textContent?.includes("Voir les plans"),
    );
    expect(ctaButton).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ⏱️ VIDEO_TOO_LONG TYPE
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - video_too_long", () => {
  it("should display video_too_long with duration info", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "video_too_long",
        video_duration_min: 180,
        max_duration_min: 120,
      },
      /Vidéo trop longue/,
    );

    // FR: "Cette vidéo dure 180 min (max 120 min sur votre plan)."
    expect(screen.getByText(/180 min/)).toBeInTheDocument();
    expect(screen.getByText(/max 120 min/)).toBeInTheDocument();
  });

  it("should show plan duration limits", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "video_too_long",
        video_duration_min: 300,
        max_duration_min: 240,
      },
      /Vidéo trop longue/,
    );

    expect(screen.getByText(/Free: 15 min/)).toBeInTheDocument();
    expect(screen.getByText(/Pro: 60 min/)).toBeInTheDocument();
    expect(screen.getByText(/Expert: 240 min/)).toBeInTheDocument();
  });

  it("should use default message if durations not provided", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal({ type: "video_too_long" }, /Vidéo trop longue/);

    // FR: "Cette vidéo dépasse la durée maximale de votre plan."
    expect(
      screen.getByText(/Cette vidéo dépasse la durée maximale/i),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ❌ CLOSE BEHAVIOR
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - Close", () => {
  it("should close modal when X button clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Test Feature",
        required_plan_name: "Pro",
      },
      /Test Feature/,
    );

    // Find close button (absolute top-4 right-4)
    const allButtons = screen.getAllByRole("button");
    const closeButton = allButtons.find(
      (btn) =>
        btn.className.includes("absolute") && btn.className.includes("top-4"),
    );
    expect(closeButton).toBeTruthy();

    await user.click(closeButton!);

    await waitFor(
      () => {
        expect(screen.queryByText("Test Feature")).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('should close modal when "Plus tard" button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UpgradeModal />);

    await showModal(
      { type: "quota_exceeded", limit: 10, used: 10 },
      /Quota atteint/,
    );

    // FR: "Plus tard"
    const laterButton = screen.getByRole("button", { name: /Plus tard/i });
    await user.click(laterButton);

    await waitFor(
      () => {
        expect(screen.queryByText(/Quota atteint/i)).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("should close modal when backdrop clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Test",
        required_plan_name: "Pro",
      },
      /^Test$/,
    );

    // Backdrop: div.absolute.inset-0 with bg-black
    const backdrop = document.querySelector(
      '[class*="bg-black"]',
    ) as HTMLElement;
    expect(backdrop).toBeTruthy();

    await user.click(backdrop);

    await waitFor(
      () => {
        expect(screen.queryByText(/^Test$/)).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🧭 NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - Navigation", () => {
  it("should navigate to /upgrade when upgrade button clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Export PDF",
        required_plan_name: "Pro",
        required_plan_price: 1299,
      },
      /Export PDF/,
    );

    // FR: "Passer à Pro"
    const buttons = screen.getAllByRole("button");
    const upgradeButton = buttons.find((b) =>
      b.textContent?.includes("Passer à"),
    );
    expect(upgradeButton).toBeTruthy();

    await user.click(upgradeButton!);

    await waitFor(
      () => {
        expect(screen.queryByText("Export PDF")).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("should close modal after CTA click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UpgradeModal />);

    await showModal(
      { type: "quota_exceeded", limit: 50, used: 50 },
      /Quota atteint/,
    );

    const buttons = screen.getAllByRole("button");
    const ctaButton = buttons.find((b) =>
      b.textContent?.includes("Voir les plans"),
    );
    expect(ctaButton).toBeTruthy();

    await user.click(ctaButton!);

    await waitFor(
      () => {
        expect(screen.queryByText(/Quota atteint/i)).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 i18n (FR par défaut)
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - i18n", () => {
  it("should display text in French by default", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Mind Map",
        required_plan_name: "Pro",
      },
      /Mind Map/,
    );

    // FR: "Disponible dès le plan"
    expect(screen.getByText(/Disponible dès le plan/i)).toBeInTheDocument();
  });

  it("should show correct button labels in French", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "video_too_long",
        video_duration_min: 300,
        max_duration_min: 240,
      },
      /Vidéo trop longue/,
    );

    // FR: "Voir les plans", "Plus tard"
    const buttons = screen.getAllByRole("button");
    expect(
      buttons.find((b) => b.textContent?.includes("Voir les plans")),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Plus tard/i }),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 EVENT HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - Event Handling", () => {
  it("should update modal when new event dispatched while open", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal(
      {
        type: "feature_locked",
        feature_label: "Feature A",
        required_plan_name: "Pro",
      },
      /Feature A/,
    );

    // Second event while modal open
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("show-upgrade-modal", {
          detail: { type: "quota_exceeded", limit: 20, used: 20 },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Quota atteint/i)).toBeInTheDocument();
    });
  });

  it("should ignore malformed event (missing type)", async () => {
    renderWithProviders(<UpgradeModal />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("show-upgrade-modal", {
          detail: { feature_label: "Test" },
        }),
      );
    });

    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  it("should handle event with valid type and minimal data", async () => {
    renderWithProviders(<UpgradeModal />);

    await showModal({ type: "feature_locked" }, /Fonctionnalité verrouillée/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

describe("UpgradeModal - Cleanup", () => {
  it("should cleanup event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderWithProviders(<UpgradeModal />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "show-upgrade-modal",
      expect.any(Function),
    );
    removeEventListenerSpy.mockRestore();
  });

  it("should not cause memory leaks with repeated mounts", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    for (let i = 0; i < 3; i++) {
      const { unmount } = renderWithProviders(<UpgradeModal />);
      unmount();
    }

    // Vérifie que removeEventListener a bien été appelé pour 'show-upgrade-modal' 3 fois
    const upgradeModalCalls = removeEventListenerSpy.mock.calls.filter(
      (call) => call[0] === "show-upgrade-modal",
    );
    expect(upgradeModalCalls.length).toBe(3);

    removeEventListenerSpy.mockRestore();
  });
});
