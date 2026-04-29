import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { OnboardingFlow } from "../OnboardingFlow";

// Mock authApi
vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>(
    "../../../services/api",
  );
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      updatePreferences: vi.fn(async () => ({ success: true, message: "OK" })),
    },
  };
});

import { authApi } from "../../../services/api";

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders welcome step initially", () => {
    renderWithProviders(<OnboardingFlow onComplete={() => {}} />);
    expect(screen.getByText(/bienvenue/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /commencer/i }),
    ).toBeInTheDocument();
  });

  it("advances to persona step on Commencer", async () => {
    renderWithProviders(<OnboardingFlow onComplete={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /commencer/i }));
    expect(
      await screen.findByText(/que faites-vous principalement/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/chercheur/i)).toBeInTheDocument();
    expect(screen.getByText(/journaliste/i)).toBeInTheDocument();
    expect(screen.getByText(/étudiant/i)).toBeInTheDocument();
    expect(screen.getByText(/professionnel/i)).toBeInTheDocument();
  });

  it("persists persona and completes onboarding when researcher selected then Suivant", async () => {
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingFlow onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /commencer/i }));
    const researcherBtn = await screen.findByRole("button", {
      name: /chercheur/i,
    });
    await userEvent.click(researcherBtn);
    await userEvent.click(screen.getByRole("button", { name: /^suivant$/i }));
    // Step 3
    expect(
      await screen.findByPlaceholderText(/youtube\.com/i),
    ).toBeInTheDocument();
    // Skip step 3 → completion
    await userEvent.click(
      screen.getByRole("button", { name: /aller au tableau de bord/i }),
    );
    await waitFor(() => {
      expect(authApi.updatePreferences).toHaveBeenCalledWith({
        extra_preferences: expect.objectContaining({
          has_completed_onboarding: true,
          persona: "researcher",
        }),
      });
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("skip flow at step 1 sets has_completed_onboarding=true with persona null", async () => {
    const onComplete = vi.fn();
    renderWithProviders(<OnboardingFlow onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /^passer$/i }));
    await waitFor(() => {
      expect(authApi.updatePreferences).toHaveBeenCalledWith({
        extra_preferences: {
          has_completed_onboarding: true,
          persona: null,
        },
      });
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
