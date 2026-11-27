/**
 * LoginScreen — sans EXPO_PUBLIC_GOOGLE_AUTH_ENABLED / EXPO_PUBLIC_APPLE_AUTH_ENABLED,
 * les boutons Google et Apple sont masqués (Google OAuth n'est pas configuré sur
 * l'API relancée : le tap finissait en 401 silencieux). Config réelle, non mockée.
 */
import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useIdTokenAuthRequest: () => [null, null, jest.fn()],
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

jest.mock("@/components/ui/DoodleBackground", () => ({
  DoodleBackground: () => null,
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: jest.fn(),
    loginWithGoogleToken: jest.fn(),
    loginWithApple: jest.fn(),
  }),
}));

jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    isDark: true,
    colors: new Proxy({}, { get: () => "#000000" }),
  }),
}));

import LoginScreen from "../../app/(auth)/login";
import { APPLE_AUTH_ENABLED, GOOGLE_AUTH_ENABLED } from "../../src/constants/config";

describe("LoginScreen — connexions sociales désactivées par défaut", () => {
  it("les flags sont faux sans variable EXPO_PUBLIC_*_AUTH_ENABLED", () => {
    expect(GOOGLE_AUTH_ENABLED).toBe(false);
    expect(APPLE_AUTH_ENABLED).toBe(false);
  });

  it("ni bouton Google ni séparateur « ou »", () => {
    const screen = render(<LoginScreen />);
    expect(screen.getByText("Se connecter")).toBeTruthy();
    expect(screen.queryByText("Continuer avec Google")).toBeNull();
    expect(screen.queryByText("ou")).toBeNull();
  });
});
