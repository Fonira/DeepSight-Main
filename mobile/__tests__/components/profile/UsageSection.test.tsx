/**
 * UsageSection / useCredits — le plan "unlimited" de l'admin (et les plans legacy) est
 * normalisé comme côté backend : avant, l'admin voyait « x/3 ce mois » et 150 crédits.
 */
import React from "react";
import { render, renderHook } from "@testing-library/react-native";

const mockUser: { plan: string; analyses_this_month: number; credits_monthly: number } = {
  plan: "unlimited",
  analyses_this_month: 4,
  credits_monthly: 120,
};

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ colors: new Proxy({}, { get: () => "#000000" }) }),
}));

jest.mock("@/components/ui/GlassCard", () => {
  const { View } = jest.requireActual("react-native");
  return {
    GlassCard: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

import { UsageSection } from "../../../src/components/profile/UsageSection";
import { useCredits } from "../../../src/hooks/useCredits";

describe("plan unlimited (admin)", () => {
  beforeEach(() => {
    mockUser.plan = "unlimited";
  });

  it("useCredits utilise le total Expert", () => {
    const { result } = renderHook(() => useCredits());
    expect(result.current.total).toBe(10000);
    expect(result.current.remaining).toBe(9880);
  });

  it("UsageSection affiche le quota Expert, pas « x/3 »", () => {
    const screen = render(<UsageSection />);
    expect(screen.getByText("4/100 ce mois")).toBeTruthy();
    expect(screen.getByText("120/10000 utilisés")).toBeTruthy();
  });

  it("plan legacy « plus » → quota Pro", () => {
    mockUser.plan = "plus";
    const screen = render(<UsageSection />);
    expect(screen.getByText("4/30 ce mois")).toBeTruthy();
  });
});
