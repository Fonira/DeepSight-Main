/**
 * Tests for MiniActionBar.
 * Verifies callbacks + haptics per button + isUpgrading + isFavorite states.
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

jest.mock("../../../src/components/ui/DeepSightSpinner", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    DeepSightSpinner: () => React.createElement(View, { testID: "spinner" }),
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
  onViewAnalysis: jest.fn(),
  onToggleFavorite: jest.fn(),
  onShare: jest.fn(),
};

describe("MiniActionBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all 3 actions", () => {
    const { getByTestId } = render(<MiniActionBar {...baseProps} />);
    expect(getByTestId("mini-action-favorite")).toBeTruthy();
    expect(getByTestId("mini-action-view-analysis")).toBeTruthy();
    expect(getByTestId("mini-action-share")).toBeTruthy();
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

  it("fires haptics.medium + onViewAnalysis on Analyse complète tap", () => {
    const onViewAnalysis = jest.fn();
    const { getByTestId } = render(
      <MiniActionBar {...baseProps} onViewAnalysis={onViewAnalysis} />,
    );
    fireEvent.press(getByTestId("mini-action-view-analysis"));
    expect(haptics.medium).toHaveBeenCalled();
    expect(onViewAnalysis).toHaveBeenCalledTimes(1);
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

  it("renders spinner when isUpgrading=true", () => {
    const { getByTestId, queryByText } = render(
      <MiniActionBar {...baseProps} isUpgrading={true} />,
    );
    expect(getByTestId("spinner")).toBeTruthy();
    expect(queryByText("Lancement...")).toBeTruthy();
  });

  it("disables Analyse complète tap when isUpgrading=true", () => {
    const onViewAnalysis = jest.fn();
    const { getByTestId } = render(
      <MiniActionBar
        {...baseProps}
        isUpgrading={true}
        onViewAnalysis={onViewAnalysis}
      />,
    );
    fireEvent.press(getByTestId("mini-action-view-analysis"));
    expect(onViewAnalysis).not.toHaveBeenCalled();
  });

  it("disables Analyse complète tap when canViewAnalysis=false", () => {
    const onViewAnalysis = jest.fn();
    const { getByTestId } = render(
      <MiniActionBar
        {...baseProps}
        canViewAnalysis={false}
        onViewAnalysis={onViewAnalysis}
      />,
    );
    fireEvent.press(getByTestId("mini-action-view-analysis"));
    expect(onViewAnalysis).not.toHaveBeenCalled();
  });
});
