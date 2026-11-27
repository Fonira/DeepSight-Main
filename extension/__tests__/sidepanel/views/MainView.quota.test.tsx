/**
 * Tests — MainView : barre de quota avec le PlanInfo normalisé.
 *
 * Bug couvert : « undefined/undefined analyses » (format my-plan non adapté)
 * et blocage de l'analyse pour le compte admin « unlimited » (mode privé).
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { MainView } from "../../../src/sidepanel/views/MainView";
import { normalizePlanInfo } from "../../../src/utils/plan";
import type { User } from "../../../src/types";

jest.mock("../../../src/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: jest.requireActual("../../../src/i18n/fr.json"),
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

const admin: User = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  plan: "unlimited",
  credits: 0,
  credits_monthly: 0,
};

const props = {
  isGuest: false,
  onLogout: jest.fn(),
  onLoginRedirect: jest.fn(),
  onError: jest.fn(),
};

describe("MainView — quota strip", () => {
  beforeEach(() => {
    resetChromeMocks();
    (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({});
  });

  it("never blocks the unlimited admin plan and hides the quota denominator", async () => {
    const planInfo = normalizePlanInfo(
      {
        plan: "unlimited",
        plan_name: "Expert",
        limits: { monthly_analyses: 100, monthly_credits: 15000 },
        usage: { analyses_this_month: 250 },
      },
      admin,
    );

    render(<MainView {...props} user={admin} planInfo={planInfo} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Analyser cette vidéo/ }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Quota atteint")).not.toBeInTheDocument();
    expect(screen.getByText(/^250\s*analyses$/)).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it("shows used/limit for a plan with a monthly quota", async () => {
    const user: User = { ...admin, plan: "pro", credits: 100 };
    const planInfo = normalizePlanInfo(
      {
        plan: "pro",
        plan_name: "Pro",
        limits: { monthly_analyses: 30, monthly_credits: 150 },
        usage: { analyses_this_month: 12 },
      },
      user,
    );

    render(<MainView {...props} user={user} planInfo={planInfo} />);

    await waitFor(() => {
      expect(screen.getByText(/^12\s*\/30\s*analyses$/)).toBeInTheDocument();
    });
  });
});
