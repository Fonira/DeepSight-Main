/**
 * VoicePacksWidget.test.tsx — Tests Vitest pour le widget de packs vocaux.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { VoicePacksWidget } from "../VoicePacksWidget";

vi.mock("../../../services/api", () => ({
  voicePacksApi: {
    list: vi.fn(),
    myCredits: vi.fn(),
    createCheckout: vi.fn(),
  },
}));

vi.mock("../../../hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "en",
    t: (k: string) => k,
    setLanguage: () => {},
  }),
}));

import { voicePacksApi } from "../../../services/api";

describe("VoicePacksWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 packs from API", async () => {
    (voicePacksApi.list as any).mockResolvedValue([
      {
        slug: "voice-30",
        name: "30 min",
        minutes: 30,
        price_cents: 299,
        description: null,
        display_order: 1,
      },
      {
        slug: "voice-60",
        name: "60 min",
        minutes: 60,
        price_cents: 499,
        description: null,
        display_order: 2,
      },
      {
        slug: "voice-180",
        name: "180 min",
        minutes: 180,
        price_cents: 1299,
        description: null,
        display_order: 3,
      },
    ]);
    (voicePacksApi.myCredits as any).mockResolvedValue({
      plan: "pro",
      allowance_total: 30,
      allowance_used: 5,
      allowance_remaining: 25,
      purchased_minutes: 0,
      total_minutes_available: 25,
      is_trial: false,
    });

    render(<VoicePacksWidget />);

    await waitFor(() => {
      expect(screen.getByText("30 min")).toBeDefined();
      expect(screen.getByText("60 min")).toBeDefined();
      expect(screen.getByText("180 min")).toBeDefined();
    });
  });

  it("redirects to Stripe checkout on Buy click", async () => {
    (voicePacksApi.list as any).mockResolvedValue([
      {
        slug: "voice-30",
        name: "30 min",
        minutes: 30,
        price_cents: 299,
        description: null,
        display_order: 1,
      },
    ]);
    (voicePacksApi.myCredits as any).mockResolvedValue({
      plan: "pro",
      allowance_total: 30,
      allowance_used: 0,
      allowance_remaining: 30,
      purchased_minutes: 0,
      total_minutes_available: 30,
      is_trial: false,
    });
    (voicePacksApi.createCheckout as any).mockResolvedValue({
      checkout_url: "https://checkout.stripe.com/test_session",
      session_id: "cs_test_xxx",
    });

    // Mock window.location.href setter
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { ...originalLocation, href: "" };

    render(<VoicePacksWidget />);
    await waitFor(() => screen.getByText("30 min"));
    fireEvent.click(screen.getByLabelText(/Buy 30 min/i));

    await waitFor(() => {
      expect(voicePacksApi.createCheckout).toHaveBeenCalledWith("voice-30");
      expect(window.location.href).toBe(
        "https://checkout.stripe.com/test_session",
      );
    });

    (window as any).location = originalLocation;
  });
});
