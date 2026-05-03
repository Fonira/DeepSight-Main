/**
 * Tests for EndedToast.
 * Verifies render + duration formatting + haptic success on mount.
 */
import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("../../../src/contexts/ThemeContext", () => {
  const { darkColors } = jest.requireActual("../../../src/theme/colors");
  return {
    useTheme: () => ({
      colors: darkColors,
      isDark: true,
      theme: "dark" as const,
      setTheme: jest.fn(),
      toggleTheme: jest.fn(),
    }),
  };
});

jest.mock("../../../src/utils/haptics", () => ({
  haptics: {
    selection: jest.fn(() => Promise.resolve()),
    light: jest.fn(() => Promise.resolve()),
    medium: jest.fn(() => Promise.resolve()),
    heavy: jest.fn(() => Promise.resolve()),
    success: jest.fn(() => Promise.resolve()),
    warning: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
  },
}));

import { EndedToast } from "../../../src/components/conversation/EndedToast";
import { haptics } from "../../../src/utils/haptics";

describe("EndedToast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the toast container", () => {
    const { getByTestId } = render(<EndedToast durationSeconds={75} />);
    expect(getByTestId("ended-toast")).toBeTruthy();
  });

  it("formats duration as MM:SS in label", () => {
    const { getByText } = render(<EndedToast durationSeconds={75} />);
    expect(getByText(/Appel terminé · 01:15 min/)).toBeTruthy();
  });

  it("formats duration < 60s with leading zero minutes", () => {
    const { getByText } = render(<EndedToast durationSeconds={45} />);
    expect(getByText(/Appel terminé · 00:45 min/)).toBeTruthy();
  });

  it("fires haptics.success on mount", () => {
    render(<EndedToast durationSeconds={30} />);
    expect(haptics.success).toHaveBeenCalledTimes(1);
  });

  it("renders the auto-dismiss progress bar", () => {
    const { getByTestId } = render(<EndedToast durationSeconds={30} />);
    expect(getByTestId("ended-toast-progress")).toBeTruthy();
  });
});
