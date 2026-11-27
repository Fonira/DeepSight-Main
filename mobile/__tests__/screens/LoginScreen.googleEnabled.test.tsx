/**
 * LoginScreen — avec EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true, le bouton Google revient
 * sans changer le code (le jour où Google OAuth est configuré côté serveur).
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

jest.mock("@/constants/config", () => ({
  ...jest.requireActual("@/constants/config"),
  GOOGLE_AUTH_ENABLED: true,
  APPLE_AUTH_ENABLED: false,
}));

import LoginScreen from "../../app/(auth)/login";

describe("LoginScreen — Google activé par flag", () => {
  it("affiche le bouton Google et le séparateur", () => {
    const screen = render(<LoginScreen />);
    expect(screen.getByText("Continuer avec Google")).toBeTruthy();
    expect(screen.getByText("ou")).toBeTruthy();
  });
});
