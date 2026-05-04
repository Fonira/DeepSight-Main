/**
 * Tests for MiniActionBar.
 * Verifies callbacks + haptics per button + canShowSummary + isFavorite states.
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

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

import { MiniActionBar } from "../../../src/components/conversation/MiniActionBar";
import { haptics } from "../../../src/utils/haptics";

const baseProps = {
  isFavorite: false,
  onToggleFavorite: jest.fn(),
  onShare: jest.fn(),
};

describe("MiniActionBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Favori and Partager by default (no Résumé)", () => {
    const { getByTestId, queryByTestId } = render(
      <MiniActionBar {...baseProps} />,
    );
    expect(getByTestId("mini-action-favorite")).toBeTruthy();
    expect(getByTestId("mini-action-share")).toBeTruthy();
    expect(queryByTestId("mini-action-show-summary")).toBeNull();
  });

  it("renders Résumé when canShowSummary=true", () => {
    const { getByTestId } = render(
      <MiniActionBar {...baseProps} canShowSummary onShowSummary={jest.fn()} />,
    );
    expect(getByTestId("mini-action-show-summary")).toBeTruthy();
  });

  it("fires haptics.light + onToggleFavorite on Favori tap", () => {
    const onToggleFavorite = jest.fn();
    const { getByTestId } = render(
      <MiniActionBar {...baseProps} onToggleFavorite={onToggleFavorite} />,
    );
    fireEvent.press(getByTestId("mini-action-favorite"));
    expect(haptics.light).toHaveBeenCalled();
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("fires haptics.medium + onShowSummary on Résumé tap", () => {
    const onShowSummary = jest.fn();
    const { getByTestId } = render(
      <MiniActionBar
        {...baseProps}
        canShowSummary
        onShowSummary={onShowSummary}
      />,
    );
    fireEvent.press(getByTestId("mini-action-show-summary"));
    expect(haptics.medium).toHaveBeenCalled();
    expect(onShowSummary).toHaveBeenCalledTimes(1);
  });

  it("fires haptics.light + onShare on Partager tap", () => {
    const onShare = jest.fn();
    const { getByTestId } = render(
      <MiniActionBar {...baseProps} onShare={onShare} />,
    );
    fireEvent.press(getByTestId("mini-action-share"));
    expect(haptics.light).toHaveBeenCalled();
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
