/**
 * Tests for EmptyConversationSuggestions.
 * Verifies render of default suggestions, custom override, and onSelect + haptic.
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

import { EmptyConversationSuggestions } from "../../../src/components/conversation/EmptyConversationSuggestions";
import { haptics } from "../../../src/utils/haptics";

describe("EmptyConversationSuggestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the container + heading", () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText } = render(
      <EmptyConversationSuggestions onSelect={onSelect} />,
    );
    expect(getByTestId("empty-conversation-suggestions")).toBeTruthy();
    expect(getByText("Suggestions pour démarrer")).toBeTruthy();
  });

  it("renders 3 default suggestion chips", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <EmptyConversationSuggestions onSelect={onSelect} />,
    );
    expect(getByText("Quels sont les points clés ?")).toBeTruthy();
    expect(getByText("Résume en 3 points")).toBeTruthy();
    expect(getByText("Quelles sources cite la vidéo ?")).toBeTruthy();
  });

  it("calls onSelect with the chip text + haptics.light on tap", () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <EmptyConversationSuggestions onSelect={onSelect} />,
    );
    fireEvent.press(getByTestId("suggestion-chip-1"));
    expect(haptics.light).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("Résume en 3 points");
  });

  it("uses custom suggestions array when provided", () => {
    const onSelect = jest.fn();
    const custom = ["Q1 ?", "Q2 ?"];
    const { getByText, queryByText } = render(
      <EmptyConversationSuggestions onSelect={onSelect} suggestions={custom} />,
    );
    expect(getByText("Q1 ?")).toBeTruthy();
    expect(getByText("Q2 ?")).toBeTruthy();
    expect(queryByText("Quels sont les points clés ?")).toBeNull();
  });

  it("caps the list at 4 chips for vertical density", () => {
    const onSelect = jest.fn();
    const custom = ["A", "B", "C", "D", "E", "F"];
    const { queryByText } = render(
      <EmptyConversationSuggestions onSelect={onSelect} suggestions={custom} />,
    );
    expect(queryByText("A")).toBeTruthy();
    expect(queryByText("D")).toBeTruthy();
    expect(queryByText("E")).toBeNull();
    expect(queryByText("F")).toBeNull();
  });
});
